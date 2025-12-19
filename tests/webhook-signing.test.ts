import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';

// Inline implementations for testing (match webhook.server.ts)
function signWebhookPayload(payload: string, secret: string, timestamp: number): string {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  toleranceSeconds: number = 300
): boolean {
  const parts = signature.split(',');
  const timestampPart = parts.find(p => p.startsWith('t='));
  const signaturePart = parts.find(p => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) {
    return false;
  }

  const timestamp = parseInt(timestampPart.slice(2), 10);
  const expectedSignature = signaturePart.slice(3);

  // Check timestamp tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }

  // Compute expected signature
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(computedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('base64url')}`;
}

describe('Webhook Signing', () => {
  const testSecret = 'whsec_test_secret_12345';
  const testPayload = JSON.stringify({
    event: 'message.created',
    timestamp: '2024-01-15T12:00:00.000Z',
    data: { ticketId: 'ticket_123', text: 'Hello' },
  });

  it('should generate valid signature format', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhookPayload(testPayload, testSecret, timestamp);
    
    expect(signature).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
  });

  it('should verify valid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhookPayload(testPayload, testSecret, timestamp);
    
    const isValid = verifyWebhookSignature(testPayload, signature, testSecret);
    expect(isValid).toBe(true);
  });

  it('should reject invalid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const invalidSignature = `t=${timestamp},v1=0000000000000000000000000000000000000000000000000000000000000000`;
    
    const isValid = verifyWebhookSignature(testPayload, invalidSignature, testSecret);
    expect(isValid).toBe(false);
  });

  it('should reject old timestamp', () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const signature = signWebhookPayload(testPayload, testSecret, oldTimestamp);
    
    const isValid = verifyWebhookSignature(testPayload, signature, testSecret);
    expect(isValid).toBe(false);
  });

  it('should accept timestamp within tolerance', () => {
    const recentTimestamp = Math.floor(Date.now() / 1000) - 240; // 4 minutes ago
    const signature = signWebhookPayload(testPayload, testSecret, recentTimestamp);
    
    const isValid = verifyWebhookSignature(testPayload, signature, testSecret);
    expect(isValid).toBe(true);
  });

  it('should reject tampered payload', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhookPayload(testPayload, testSecret, timestamp);
    const tamperedPayload = JSON.stringify({ event: 'ticket.deleted' });
    
    const isValid = verifyWebhookSignature(tamperedPayload, signature, testSecret);
    expect(isValid).toBe(false);
  });

  it('should reject wrong secret', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhookPayload(testPayload, testSecret, timestamp);
    
    const isValid = verifyWebhookSignature(testPayload, signature, 'wrong_secret');
    expect(isValid).toBe(false);
  });

  it('should reject malformed signature (missing timestamp)', () => {
    const isValid = verifyWebhookSignature(testPayload, 'v1=abc123', testSecret);
    expect(isValid).toBe(false);
  });

  it('should reject malformed signature (missing signature)', () => {
    const isValid = verifyWebhookSignature(testPayload, 't=1234567890', testSecret);
    expect(isValid).toBe(false);
  });
});

describe('Webhook Secret Generation', () => {
  it('should generate secret with correct prefix', () => {
    const secret = generateWebhookSecret();
    expect(secret.startsWith('whsec_')).toBe(true);
  });

  it('should generate unique secrets', () => {
    const secrets = new Set<string>();
    for (let i = 0; i < 100; i++) {
      secrets.add(generateWebhookSecret());
    }
    expect(secrets.size).toBe(100);
  });

  it('should generate sufficiently long secrets', () => {
    const secret = generateWebhookSecret();
    // whsec_ (6) + 32 base64url chars (24 bytes) = ~38 chars minimum
    expect(secret.length).toBeGreaterThanOrEqual(30);
  });
});

