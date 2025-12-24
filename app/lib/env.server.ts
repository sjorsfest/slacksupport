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
    process.env.VERCEL ||           // Vercel
    process.env.AWS_LAMBDA_FUNCTION_NAME ||  // AWS Lambda
    process.env.NETLIFY ||          // Netlify
    process.env.CF_PAGES ||         // Cloudflare Pages
    process.env.SERVERLESS_MODE     // Manual override
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
  if (process.env.VERCEL) return 'Vercel';
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) return 'AWS Lambda';
  if (process.env.NETLIFY) return 'Netlify';
  if (process.env.CF_PAGES) return 'Cloudflare Pages';
  if (process.env.SERVERLESS_MODE) return 'Serverless (manual)';
  return 'Persistent Server';
}
