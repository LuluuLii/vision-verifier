/**
 * Renderer module types.
 *
 * The renderer manages browser and dev server lifecycle,
 * providing infrastructure for all verification pipelines.
 */

import type { Page } from 'playwright';
import type { Viewport } from './common.js';

export interface RendererConfig {
  /** Path to the user's project root (where vite.config.ts lives) */
  projectRoot: string;
  /** Default viewport size */
  viewport?: Viewport;
  /** Run browser in headless mode (default: true) */
  headless?: boolean;
  /** Vite dev server port (default: auto) */
  port?: number;
}

export type RenderTarget =
  | { type: 'url'; url: string }
  | {
      type: 'component';
      path: string;
      exportName?: string;
      props?: Record<string, unknown>;
    }
  | { type: 'html'; content: string };

export interface IBaseRenderer {
  start(config: RendererConfig): Promise<void>;
  navigateTo(url: string): Promise<void>;
  setViewport(viewport: Viewport): Promise<void>;
  getPage(): Page;
  getViteUrl(): string;
  getTempDir(): string;
  invalidateModule(filePath: string): Promise<void>;
  withRenderLock<T>(fn: () => Promise<T>): Promise<T>;
  stop(): Promise<void>;
}
