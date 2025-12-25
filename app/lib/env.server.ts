import { settings } from './settings.server';

/**
 * Serverless environment detection utilities.
 * Auto-detects various serverless platforms without manual configuration.
 */

/**
 * Detect if running in a serverless environment.
 * These environment variables are automatically set by each platform.
 */
export function isServerless(): boolean {
  return Boolean(
    settings.VERCEL ||           // Vercel
    settings.AWS_LAMBDA_FUNCTION_NAME ||  // AWS Lambda
    settings.NETLIFY ||          // Netlify
    settings.CF_PAGES ||         // Cloudflare Pages
    settings.SERVERLESS_MODE     // Manual override
  );
}

/**
 * Check if workers should be used for background processing.
 * Workers are only used in persistent server environments.
 */
export function useWorkers(): boolean {
  return !isServerless();
}

/**
 * Get the current deployment environment name for logging.
 */
export function getDeploymentEnvironment(): string {
  if (settings.VERCEL) return 'Vercel';
  if (settings.AWS_LAMBDA_FUNCTION_NAME) return 'AWS Lambda';
  if (settings.NETLIFY) return 'Netlify';
  if (settings.CF_PAGES) return 'Cloudflare Pages';
  if (settings.SERVERLESS_MODE) return 'Serverless (manual)';
  return 'Persistent Server';
}
