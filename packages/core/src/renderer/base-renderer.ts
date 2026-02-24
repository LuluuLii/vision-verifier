import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { RendererConfig, IBaseRenderer } from '../types/renderer.js';
import type { Viewport } from '../types/common.js';

const TEMP_DIR_NAME = '.ui-verify';

export class BaseRenderer implements IBaseRenderer {
  private config!: RendererConfig;
  private vite!: ViteDevServer;
  private browser!: Browser;
  private page!: Page;
  private tempDir!: string;
  private viteUrl!: string;
  private renderLock = false;

  async start(config: RendererConfig): Promise<void> {
    this.config = config;
    this.tempDir = join(config.projectRoot, TEMP_DIR_NAME);

    // Create temp directory
    await mkdir(this.tempDir, { recursive: true });

    // Start Vite dev server (inherits user's vite.config.ts)
    this.vite = await createServer({
      root: config.projectRoot,
      server: {
        port: config.port,
        strictPort: false,
      },
      logLevel: 'silent',
    });
    await this.vite.listen();

    const resolvedPort = this.vite.config.server.port ?? 5173;
    const address = this.vite.httpServer?.address();
    if (address && typeof address === 'object') {
      this.viteUrl = `http://localhost:${address.port}`;
    } else {
      this.viteUrl = `http://localhost:${resolvedPort}`;
    }

    // Start Playwright browser
    this.browser = await chromium.launch({
      headless: config.headless ?? true,
    });
    const context = await this.browser.newContext({
      viewport: config.viewport ?? { width: 1280, height: 720 },
    });
    this.page = await context.newPage();
  }

  async navigateTo(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async setViewport(viewport: Viewport): Promise<void> {
    await this.page.setViewportSize(viewport);
  }

  getPage(): Page {
    return this.page;
  }

  getViteUrl(): string {
    return this.viteUrl;
  }

  getTempDir(): string {
    return this.tempDir;
  }

  /**
   * Invalidate Vite's module cache for a file.
   * Call this after writing a file to ensure Vite serves the latest version.
   */
  async invalidateModule(filePath: string): Promise<void> {
    const modules = this.vite.moduleGraph.getModulesByFile(filePath);
    if (modules) {
      for (const mod of modules) {
        this.vite.moduleGraph.invalidateModule(mod);
      }
    }
  }

  async withRenderLock<T>(fn: () => Promise<T>): Promise<T> {
    if (this.renderLock) {
      throw new Error('Render already in progress. Concurrent renders are not supported.');
    }
    this.renderLock = true;
    try {
      return await fn();
    } finally {
      this.renderLock = false;
    }
  }

  async stop(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
    }
    if (this.vite) {
      await this.vite.close();
    }
  }
}
