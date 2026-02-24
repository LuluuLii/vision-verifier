import type { Page } from 'playwright';
import type { ScreenshotOptions } from '../types/observer.js';

/**
 * Disable CSS animations and transitions on the page.
 * Uses a three-layer strategy for maximum reliability:
 * 1. emulateMedia prefers-reduced-motion
 * 2. Inject CSS to force zero durations
 * 3. Playwright screenshot animations option (applied at capture time)
 */
export async function disableAnimations(page: Page): Promise<void> {
  // Layer 1: Media feature
  await page.emulateMedia({ reducedMotion: 'reduce' });

  // Layer 2: CSS injection
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

/**
 * Capture a screenshot of the current page state.
 * Applies Playwright's animation disabling at capture time (Layer 3).
 */
export async function captureScreenshot(
  page: Page,
  options?: ScreenshotOptions,
): Promise<Buffer> {
  const screenshot = await page.screenshot({
    animations: options?.disableAnimations !== false ? 'disabled' : 'allow',
    fullPage: options?.fullPage ?? false,
    clip: options?.clip,
    type: 'png',
  });

  return Buffer.from(screenshot);
}
