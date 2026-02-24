import type { Page } from 'playwright';
import type { ErrorCapture } from '../types/observer.js';

/**
 * Set up console error and page error capture on a Playwright page.
 *
 * Returns an ErrorCapture object with:
 * - getErrors(): retrieve all captured error messages
 * - cleanup(): remove listeners (call after each render to prevent leaks)
 */
export function setupErrorCapture(page: Page): ErrorCapture {
  const errors: string[] = [];

  const onConsoleMessage = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') {
      errors.push(`[console.error] ${msg.text()}`);
    }
  };

  const onPageError = (error: Error) => {
    errors.push(`[page.error] ${error.message}`);
  };

  page.on('console', onConsoleMessage);
  page.on('pageerror', onPageError);

  return {
    getErrors() {
      return [...errors];
    },
    cleanup() {
      page.removeListener('console', onConsoleMessage);
      page.removeListener('pageerror', onPageError);
      errors.length = 0;
    },
  };
}
