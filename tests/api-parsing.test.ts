import { z } from 'zod';
import { parseRequest } from '../app/lib/request.server';

// Mock Request class for testing
class MockRequest {
  headers: Map<string, string>;
  body: any;
  method: string;

  constructor(options: { headers: Record<string, string>, body: any, method?: string }) {
    this.headers = new Map(Object.entries(options.headers));
    this.body = options.body;
    this.method = options.method || 'POST';
  }

  async json() {
    return this.body;
  }

  async formData() {
    const fd = new URLSearchParams();
    for (const [key, value] of Object.entries(this.body)) {
      fd.append(key, value as string);
    }
    return fd;
  }
}

async function testParsing() {
  const schema = z.object({
    email: z.string().email(),
    metadata: z.record(z.string(), z.any()).optional(),
  });

  console.log('--- Testing JSON Parsing ---');
  const jsonReq = new MockRequest({
    headers: { 'content-type': 'application/json' },
    body: { email: 'test@example.com', metadata: { foo: 'bar' } }
  });
  const jsonData = await parseRequest(jsonReq as any, schema);
  console.log('JSON Data:', jsonData);
  if (jsonData.email !== 'test@example.com' || jsonData.metadata?.foo !== 'bar') {
    throw new Error('JSON parsing failed');
  }

  console.log('\n--- Testing FormData Parsing ---');
  const formReq = new MockRequest({
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: { 
      email: 'test@example.com', 
      metadata: JSON.stringify({ foo: 'bar' }) 
    }
  });
  const formData = await parseRequest(formReq as any, schema);
  console.log('FormData Data:', formData);
  if (formData.email !== 'test@example.com' || formData.metadata?.foo !== 'bar') {
    throw new Error('FormData parsing failed');
  }

  console.log('\n✅ All parsing tests passed!');
}

testParsing().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
