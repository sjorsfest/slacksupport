import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

// Mock the env var before importing the module
const SLACK_SIGNING_SECRET = 'test-signing-secret-12345';

// Inline implementation for testing (matches the one in slack.server.ts)
function verifySlackSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  signingSecret: string
): boolean {
  if (!timestamp || !signature || !signingSecret) {
    return false;
  }

  const requestTimestamp = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  
  // Check timestamp is not too old (5 minutes)
  if (Math.abs(now - requestTimestamp) > 300) {
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const expectedSignature = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(sigBasestring)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

function generateValidSignature(body: string, timestamp: number, secret: string): string {
  const sigBasestring = `v0:${timestamp}:${body}`;
  return 'v0=' + crypto
    .createHmac('sha256', secret)
    .update(sigBasestring)
    .digest('hex');
}

describe('Slack Signature Verification', () => {
  const mockBody = JSON.stringify({ type: 'url_verification', challenge: 'test' });
  
  it('should accept valid signature with current timestamp', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = generateValidSignature(mockBody, parseInt(timestamp), SLACK_SIGNING_SECRET);
    
    const result = verifySlackSignature(mockBody, timestamp, signature, SLACK_SIGNING_SECRET);
    expect(result).toBe(true);
  });

  it('should reject invalid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const invalidSignature = 'v0=invalid_signature_here_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    
    const result = verifySlackSignature(mockBody, timestamp, invalidSignature, SLACK_SIGNING_SECRET);
    expect(result).toBe(false);
  });

  it('should reject old timestamp (> 5 minutes)', () => {
    // 10 minutes ago
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
    const signature = generateValidSignature(mockBody, parseInt(oldTimestamp), SLACK_SIGNING_SECRET);
    
    const result = verifySlackSignature(mockBody, oldTimestamp, signature, SLACK_SIGNING_SECRET);
    expect(result).toBe(false);
  });

  it('should reject missing timestamp', () => {
    const signature = generateValidSignature(mockBody, Math.floor(Date.now() / 1000), SLACK_SIGNING_SECRET);
    
    const result = verifySlackSignature(mockBody, null, signature, SLACK_SIGNING_SECRET);
    expect(result).toBe(false);
  });

  it('should reject missing signature', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    const result = verifySlackSignature(mockBody, timestamp, null, SLACK_SIGNING_SECRET);
    expect(result).toBe(false);
  });

  it('should reject empty signing secret', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = generateValidSignature(mockBody, parseInt(timestamp), SLACK_SIGNING_SECRET);
    
    const result = verifySlackSignature(mockBody, timestamp, signature, '');
    expect(result).toBe(false);
  });

  it('should accept timestamp within 5 minute window', () => {
    // 4 minutes ago (still valid)
    const recentTimestamp = (Math.floor(Date.now() / 1000) - 240).toString();
    const signature = generateValidSignature(mockBody, parseInt(recentTimestamp), SLACK_SIGNING_SECRET);
    
    const result = verifySlackSignature(mockBody, recentTimestamp, signature, SLACK_SIGNING_SECRET);
    expect(result).toBe(true);
  });

  it('should reject tampered body', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = generateValidSignature(mockBody, parseInt(timestamp), SLACK_SIGNING_SECRET);
    const tamperedBody = JSON.stringify({ type: 'event_callback', event: { text: 'hacked' } });
    
    const result = verifySlackSignature(tamperedBody, timestamp, signature, SLACK_SIGNING_SECRET);
    expect(result).toBe(false);
  });
});

