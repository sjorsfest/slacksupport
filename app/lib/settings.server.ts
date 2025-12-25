import 'dotenv/config';

/**
 * Centralized settings for the application.
 * All environment variables should be accessed through this file.
 */

export const settings = {
  DATABASE_URL: process.env.DATABASE_URL!,
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!,
  SESSION_SECRET: process.env.SESSION_SECRET!,
  SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID!,
  SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET!,
  SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET!,
  BASE_URL: process.env.BASE_URL || 'http://localhost:5173',
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  PORT: Number(process.env.PORT) || (process.env.NODE_ENV === 'production' ? 3000 : 5173),
  
  // Serverless detection
  VERCEL: process.env.VERCEL,
  AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
  NETLIFY: process.env.NETLIFY,
  CF_PAGES: process.env.CF_PAGES,
  SERVERLESS_MODE: process.env.SERVERLESS_MODE,
};

// Validation to ensure required env vars are present
const requiredVars: (keyof typeof settings)[] = [
  'DATABASE_URL',
  'ENCRYPTION_KEY',
  'SESSION_SECRET',
  'SLACK_CLIENT_ID',
  'SLACK_CLIENT_SECRET',
  'SLACK_SIGNING_SECRET',
];

if (settings.NODE_ENV !== 'test') {
  for (const key of requiredVars) {
    if (!settings[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}
