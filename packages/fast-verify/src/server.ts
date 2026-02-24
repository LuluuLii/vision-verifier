import express from 'express';
import type { Server } from 'node:http';
import { FastRenderer } from './fast-renderer.js';
import type { RenderRequest, ServerConfig } from './types.js';

export async function createFastVerifyServer(
  config: ServerConfig,
): Promise<{ server: Server; stop: () => Promise<void> }> {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const renderer = new FastRenderer();
  await renderer.start(config);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Render endpoint
  app.post('/render', async (req, res) => {
    try {
      const request = req.body as RenderRequest;

      // Basic validation
      if (!request.component?.path) {
        res.status(400).json({
          success: false,
          errors: ['component.path is required'],
          metrics: { totalTime: 0, renderTime: 0 },
        });
        return;
      }

      const result = await renderer.render(request);

      // Convert screenshot buffers to base64 for JSON response
      const response = {
        ...result,
        screenshot: result.screenshot
          ? result.screenshot.toString('base64')
          : undefined,
        stepScreenshots: result.stepScreenshots?.map((step) => ({
          ...step,
          screenshot: step.screenshot
            ? step.screenshot.toString('base64')
            : undefined,
        })),
      };

      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
        metrics: { totalTime: 0, renderTime: 0 },
      });
    }
  });

  const port = config.port ?? 4173;
  const server = app.listen(port, () => {
    console.log(`[ui-verify] Server listening on http://localhost:${port}`);
  });

  const stop = async () => {
    console.log('[ui-verify] Shutting down...');
    await renderer.stop();
    server.close();
  };

  // Graceful shutdown
  process.on('SIGINT', () => {
    stop().then(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    stop().then(() => process.exit(0));
  });

  return { server, stop };
}
