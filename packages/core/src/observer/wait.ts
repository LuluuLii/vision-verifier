import type { Page } from 'playwright';

/**
 * Wait for a global render signal to be set on the page.
 *
 * The rendered component is expected to set `window[signal] = true`
 * when rendering is complete. This function polls for that signal.
 *
 * @param page - Playwright page
 * @param signal - Global variable name (e.g., '__UI_VERIFY_RENDERED__')
 * @param timeout - Maximum wait time in ms (default: 10000)
 */
export async function waitForRenderSignal(
  page: Page,
  signal: string,
  timeout: number = 10000,
): Promise<void> {
  await page.waitForFunction(
    (sig: string) => (window as unknown as Record<string, unknown>)[sig] === true,
    signal,
    { timeout },
  );
}
