import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock types for testing
type Ticket = {
  id: string;
  accountId: string;
  slackThreadTs: string | null;
  slackChannelId: string | null;
};

type Account = {
  id: string;
  slackInstallation: {
    slackTeamId: string;
    botUserId: string;
  } | null;
};

// Mock database
let mockTickets: Ticket[] = [];
let mockAccounts: Account[] = [];

// Simulated findTicketBySlackThread function (matches the logic in slack-event.job.ts)
async function findTicketBySlackThread(
  teamId: string,
  threadTs: string
): Promise<(Ticket & { account: Account }) | null> {
  for (const ticket of mockTickets) {
    if (ticket.slackThreadTs === threadTs) {
      const account = mockAccounts.find(a => a.id === ticket.accountId);
      if (account?.slackInstallation?.slackTeamId === teamId) {
        return { ...ticket, account };
      }
    }
  }
  return null;
}

// Simulated shouldProcessSlackMessage function
function shouldProcessSlackMessage(
  event: {
    type: string;
    subtype?: string;
    thread_ts?: string;
    ts: string;
    bot_id?: string;
    user?: string;
  },
  botUserId: string
): { shouldProcess: boolean; reason?: string } {
  // Only handle message events
  if (event.type !== 'message') {
    return { shouldProcess: false, reason: 'Not a message event' };
  }

  // Skip certain subtypes
  if (event.subtype && !['bot_message'].includes(event.subtype)) {
    return { shouldProcess: false, reason: `Skipping subtype: ${event.subtype}` };
  }

  // Must be a thread reply
  if (!event.thread_ts || event.thread_ts === event.ts) {
    return { shouldProcess: false, reason: 'Not a thread reply' };
  }

  // Ignore our own bot messages
  if (event.bot_id || event.user === botUserId) {
    return { shouldProcess: false, reason: 'Message from our bot' };
  }

  return { shouldProcess: true };
}

describe('Ticket Matching', () => {
  beforeEach(() => {
    // Reset mock data
    mockAccounts = [
      {
        id: 'account_1',
        slackInstallation: {
          slackTeamId: 'T12345',
          botUserId: 'B98765',
        },
      },
      {
        id: 'account_2',
        slackInstallation: {
          slackTeamId: 'T67890',
          botUserId: 'B11111',
        },
      },
    ];

    mockTickets = [
      {
        id: 'ticket_1',
        accountId: 'account_1',
        slackThreadTs: '1234567890.123456',
        slackChannelId: 'C12345',
      },
      {
        id: 'ticket_2',
        accountId: 'account_1',
        slackThreadTs: '1234567890.654321',
        slackChannelId: 'C12345',
      },
      {
        id: 'ticket_3',
        accountId: 'account_2',
        slackThreadTs: '1234567890.111111',
        slackChannelId: 'C67890',
      },
    ];
  });

  it('should find ticket by matching team and thread_ts', async () => {
    const result = await findTicketBySlackThread('T12345', '1234567890.123456');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('ticket_1');
  });

  it('should not find ticket for different team', async () => {
    const result = await findTicketBySlackThread('T99999', '1234567890.123456');
    expect(result).toBeNull();
  });

  it('should not find ticket for non-existent thread_ts', async () => {
    const result = await findTicketBySlackThread('T12345', '9999999999.999999');
    expect(result).toBeNull();
  });

  it('should match correct account when multiple accounts exist', async () => {
    const result = await findTicketBySlackThread('T67890', '1234567890.111111');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('ticket_3');
    expect(result?.account.id).toBe('account_2');
  });
});

describe('Slack Message Processing', () => {
  const botUserId = 'B98765';

  it('should process valid thread reply', () => {
    const event = {
      type: 'message',
      thread_ts: '1234567890.123456',
      ts: '1234567890.654321',
      user: 'U12345',
    };
    
    const result = shouldProcessSlackMessage(event, botUserId);
    expect(result.shouldProcess).toBe(true);
  });

  it('should skip non-message events', () => {
    const event = {
      type: 'channel_join',
      thread_ts: '1234567890.123456',
      ts: '1234567890.654321',
      user: 'U12345',
    };
    
    const result = shouldProcessSlackMessage(event, botUserId);
    expect(result.shouldProcess).toBe(false);
    expect(result.reason).toBe('Not a message event');
  });

  it('should skip non-thread messages (root messages)', () => {
    const event = {
      type: 'message',
      ts: '1234567890.123456',
      // No thread_ts means it's a root message
      user: 'U12345',
    };
    
    const result = shouldProcessSlackMessage(event, botUserId);
    expect(result.shouldProcess).toBe(false);
    expect(result.reason).toBe('Not a thread reply');
  });

  it('should skip messages where thread_ts equals ts (root with replies)', () => {
    const event = {
      type: 'message',
      thread_ts: '1234567890.123456',
      ts: '1234567890.123456', // Same as thread_ts = this is the root
      user: 'U12345',
    };
    
    const result = shouldProcessSlackMessage(event, botUserId);
    expect(result.shouldProcess).toBe(false);
    expect(result.reason).toBe('Not a thread reply');
  });

  it('should skip messages from our bot (by bot_id)', () => {
    const event = {
      type: 'message',
      thread_ts: '1234567890.123456',
      ts: '1234567890.654321',
      bot_id: 'B11111',
      user: 'U12345',
    };
    
    const result = shouldProcessSlackMessage(event, botUserId);
    expect(result.shouldProcess).toBe(false);
    expect(result.reason).toBe('Message from our bot');
  });

  it('should skip messages from our bot (by user id)', () => {
    const event = {
      type: 'message',
      thread_ts: '1234567890.123456',
      ts: '1234567890.654321',
      user: 'B98765', // Our bot user ID
    };
    
    const result = shouldProcessSlackMessage(event, botUserId);
    expect(result.shouldProcess).toBe(false);
    expect(result.reason).toBe('Message from our bot');
  });

  it('should skip message_changed subtype', () => {
    const event = {
      type: 'message',
      subtype: 'message_changed',
      thread_ts: '1234567890.123456',
      ts: '1234567890.654321',
      user: 'U12345',
    };
    
    const result = shouldProcessSlackMessage(event, botUserId);
    expect(result.shouldProcess).toBe(false);
    expect(result.reason).toBe('Skipping subtype: message_changed');
  });

  it('should skip message_deleted subtype', () => {
    const event = {
      type: 'message',
      subtype: 'message_deleted',
      thread_ts: '1234567890.123456',
      ts: '1234567890.654321',
      user: 'U12345',
    };
    
    const result = shouldProcessSlackMessage(event, botUserId);
    expect(result.shouldProcess).toBe(false);
    expect(result.reason).toBe('Skipping subtype: message_deleted');
  });
});

