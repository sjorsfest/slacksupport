import { settings } from './app/lib/settings.server';
import type { ServerBuild } from 'react-router';
import { createRequestHandler } from '@react-router/express';
import express from 'express';
import { startAllWorkers } from './app/jobs';

const isProduction = settings.NODE_ENV === 'production';
const BUILD_PATH = './build/server/index.js';

async function start() {
  const app = express();

  // Initialize workers - needed for both dev and production
  console.log('ℹ️ Running in PERSISTENT SERVER mode (VPC)');
  await startAllWorkers();
  console.log('✅ BullMQ workers started');

  if (isProduction) {
    // Production: serve static files and use built React Router app
    app.use(express.static('build/client'));
    
    const build = await import(BUILD_PATH);
    app.use(createRequestHandler({ build }));
  } else {
    // Development: use Vite's dev server middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    
    app.use(vite.middlewares);
    
    // Handle React Router requests through Vite
    app.use(async (req, res, next) => {
      try {
        const build = await vite.ssrLoadModule('virtual:react-router/server-build') as unknown as ServerBuild;
        const handler = createRequestHandler({ build });
        return handler(req, res, next);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  // Start listening
  const port = settings.PORT;
  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
