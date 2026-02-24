import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BaseRenderer,
  disableAnimations,
  captureScreenshot,
  waitForRenderSignal,
  setupErrorCapture,
  executeInteractions,
} from '@vision-verifier/core';
import type { RendererConfig } from '@vision-verifier/core';
import { generateWrapperCode, generateIndexHtml } from './wrapper.js';
import type { RenderRequest, RenderResponse, StepScreenshot, ServerConfig } from './types.js';

const RENDER_SIGNAL = '__UI_VERIFY_RENDERED__';
const ERROR_SIGNAL = '__UI_VERIFY_ERROR__';

export class FastRenderer {
  private renderer: BaseRenderer;
  private initialized = false;

  constructor() {
    this.renderer = new BaseRenderer();
  }

  async start(config: ServerConfig): Promise<void> {
    const rendererConfig: RendererConfig = {
      projectRoot: config.projectRoot,
      viewport: config.viewport,
      headless: config.headless,
    };
    await this.renderer.start(rendererConfig);

    // Write index.html once during initialization
    // (avoids Vite full-reload on every render)
    const tempDir = this.renderer.getTempDir();
    await writeFile(join(tempDir, 'index.html'), generateIndexHtml(), 'utf-8');
    this.initialized = true;
  }

  async render(request: RenderRequest): Promise<RenderResponse> {
    if (!this.initialized) {
      throw new Error('FastRenderer not started. Call start() first.');
    }

    return this.renderer.withRenderLock(async () => {
      const totalStart = Date.now();
      const page = this.renderer.getPage();

      // Set up error capture
      const errorCapture = setupErrorCapture(page);

      try {
        // 1. Navigate to blank page first (clean slate, prevents HMR interference)
        // Vite HMR from the previous render's file write may trigger a full-reload
        // that interrupts this navigation — catch and retry once.
        try {
          await page.goto('about:blank');
        } catch {
          await page.goto('about:blank');
        }

        // 2. Generate wrapper code
        const wrapperCode = generateWrapperCode(request);

        // 3. Write wrapper.tsx to temp directory (index.html already exists)
        const tempDir = this.renderer.getTempDir();
        const wrapperPath = join(tempDir, 'wrapper.tsx');
        await writeFile(wrapperPath, wrapperCode, 'utf-8');

        // 4. Invalidate Vite's module cache to ensure fresh content
        await this.renderer.invalidateModule(wrapperPath);

        // 4. Set viewport if specified
        if (request.options?.viewport) {
          await this.renderer.setViewport(request.options.viewport);
        }

        // 5. Navigate to the wrapper page
        const renderStart = Date.now();
        const wrapperUrl = `${this.renderer.getViteUrl()}/.ui-verify/index.html`;
        await this.renderer.navigateTo(wrapperUrl);

        // 6. Disable animations after navigation (CSS injection must happen on the live page)
        if (request.options?.disableAnimations !== false) {
          await disableAnimations(page);
        }

        // 7. Wait for render signal
        const timeout = request.options?.timeout ?? 10000;
        await waitForRenderSignal(page, RENDER_SIGNAL, timeout);
        const renderTime = Date.now() - renderStart;

        // 7. Check for render error
        const renderError = await page.evaluate(
          (sig: string) => (window as unknown as Record<string, unknown>)[sig] as string | undefined,
          ERROR_SIGNAL,
        );

        const hasRenderError = !!renderError;

        // 8. Capture screenshot (even on error — shows ErrorBoundary fallback)
        let screenshot: Buffer | undefined;
        if (request.output?.screenshot !== false) {
          screenshot = await captureScreenshot(page);
        }

        // 9. Capture DOM (even on error — shows ErrorBoundary fallback)
        let dom: string | undefined;
        if (request.output?.dom) {
          dom = await page.evaluate(() => {
            const root = document.getElementById('root');
            return root?.innerHTML ?? '';
          });
        }

        // 10. Execute interactions (skip if render errored)
        const interactionStart = Date.now();
        let stepScreenshots: StepScreenshot[] | undefined;

        if (!hasRenderError && request.interactions?.length) {
          const results = await executeInteractions(page, request.interactions, {
            captureScreenshots:
              request.output?.screenshotAfterEachInteraction ?? false,
          });

          stepScreenshots = results.map((result) => ({
            interaction: result.interaction,
            screenshot: result.screenshot!,
            success: result.success,
            error: result.error,
          }));
        }

        const interactionTime = request.interactions?.length
          ? Date.now() - interactionStart
          : undefined;

        // 11. Collect all errors
        const errors = [
          ...(renderError ? [renderError] : []),
          ...errorCapture.getErrors(),
        ];

        return {
          success: !hasRenderError,
          screenshot,
          dom,
          errors,
          stepScreenshots,
          metrics: {
            totalTime: Date.now() - totalStart,
            renderTime,
            interactionTime,
          },
        };
      } finally {
        errorCapture.cleanup();
      }
    });
  }

  async stop(): Promise<void> {
    await this.renderer.stop();
  }
}
