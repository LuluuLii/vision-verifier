/**
 * Observer module types.
 *
 * Reliably captures page state: screenshots, errors, DOM snapshots.
 */

import type { Page } from 'playwright';
import type { BoundingBox } from './common.js';

export interface ScreenshotOptions {
  /** Wait for page to be stable before capturing (default: false) */
  waitForStable?: boolean;
  /** Disable CSS animations before capture (default: true) */
  disableAnimations?: boolean;
  /** Capture full page instead of viewport (default: false) */
  fullPage?: boolean;
  /** Clip to a specific region */
  clip?: BoundingBox;
}

export interface ErrorCapture {
  /** Get all captured errors since last cleanup */
  getErrors(): string[];
  /** Clean up listeners */
  cleanup(): void;
}

export interface StabilityOptions {
  /** Wait for network to be quiet for this many ms (default: 500) */
  networkQuietMs?: number;
  /** Wait for DOM to be stable for this many ms (default: 300) */
  domQuietMs?: number;
  /** Wait for no layout shifts for this many ms (default: 500) */
  noLayoutShiftMs?: number;
  /** Maximum wait time in ms (default: 10000) */
  maxWaitMs?: number;
}

export interface DOMSnapshot {
  html: string;
  timestamp: number;
}

export interface DOMDiff {
  added: string[];
  removed: string[];
  modified: string[];
}

export interface PerformanceMetrics {
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
  timeToInteractive?: number;
}

export interface Observer {
  // Phase 1: Basic capabilities
  captureScreenshot(page: Page, options?: ScreenshotOptions): Promise<Buffer>;
  disableAnimations(page: Page): Promise<void>;
  waitForRenderSignal(
    page: Page,
    signal: string,
    timeout?: number,
  ): Promise<void>;
  setupErrorCapture(page: Page): ErrorCapture;

  // Phase 3: Enhanced capabilities
  // waitForStable(page: Page, options?: StabilityOptions): Promise<void>;
  // captureDOMSnapshot(page: Page): Promise<DOMSnapshot>;
  // diffDOM(before: DOMSnapshot, after: DOMSnapshot): Promise<DOMDiff>;
  // collectPerformanceMetrics(page: Page): Promise<PerformanceMetrics>;
}
