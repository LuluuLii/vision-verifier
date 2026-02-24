import type { Page } from 'playwright';
import type { Interaction, StepResult, ExecuteInteractionsOptions } from '../types/executor.js';
import { captureScreenshot } from '../observer/screenshot.js';

const DEFAULT_TIMEOUT = 5000;

export async function click(page: Page, target: string): Promise<void> {
  await page.locator(target).click();
}

export async function type(
  page: Page,
  target: string,
  value: string,
): Promise<void> {
  await page.locator(target).fill(value);
}

export async function hover(page: Page, target: string): Promise<void> {
  await page.locator(target).hover();
}

export async function select(
  page: Page,
  target: string,
  value: string,
): Promise<void> {
  await page.locator(target).selectOption(value);
}

/**
 * Execute a sequence of interactions on the page.
 *
 * - Fail-fast: stops on first failure
 * - Optional screenshot capture after each step
 */
export async function executeInteractions(
  page: Page,
  interactions: Interaction[],
  options?: ExecuteInteractionsOptions,
): Promise<StepResult[]> {
  const results: StepResult[] = [];
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  for (const interaction of interactions) {
    const start = Date.now();
    try {
      const locator = page.locator(interaction.target);
      await locator.waitFor({ state: 'visible', timeout });

      switch (interaction.type) {
        case 'click':
          await locator.click({ timeout });
          break;
        case 'type':
          await locator.fill(interaction.value ?? '', { timeout });
          break;
        case 'hover':
          await locator.hover({ timeout });
          break;
        case 'select':
          await locator.selectOption(interaction.value ?? '', { timeout });
          break;
      }

      const screenshot = options?.captureScreenshots
        ? await captureScreenshot(page)
        : undefined;

      results.push({
        interaction,
        success: true,
        screenshot,
        duration: Date.now() - start,
      });
    } catch (error) {
      results.push({
        interaction,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
      // Fail-fast: stop on first failure
      break;
    }
  }

  return results;
}
