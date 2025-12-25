import { z } from 'zod';

export async function parseRequest<T>(request: Request, schema: z.ZodSchema<T>): Promise<T> {
  const contentType = request.headers.get('content-type') || '';
  let data: any;

  if (contentType.includes('application/json')) {
    data = await request.json();
  } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    data = Object.fromEntries(formData.entries());

    // Attempt to parse JSON strings for complex fields (like metadata)
    for (const key in data) {
      const value = data[key];
      if (typeof value === 'string') {
        try {
          if (value.startsWith('{') || value.startsWith('[')) {
            data[key] = JSON.parse(value);
          }
        } catch (e) {
          // Not JSON, keep as string
        }
      }
    }
  } else {
    throw new Error('Unsupported content type');
  }

  return schema.parse(data);
}
