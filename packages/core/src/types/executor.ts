/**
 * Executor module types.
 *
 * Executes user actions in the browser (click, type, hover, etc.).
 */

import type { Page } from 'playwright';

export type InteractionType = 'click' | 'type' | 'hover' | 'select';

export interface Interaction {
  type: InteractionType;
  /** CSS selector or text selector for the target element */
  target: string;
  /** Value for type/select interactions */
  value?: string;
}

export interface StepResult {
  interaction: Interaction;
  success: boolean;
  error?: string;
  screenshot?: Buffer;
  duration: number;
}

export interface ExecuteInteractionsOptions {
  /** Capture screenshot after each interaction */
  captureScreenshots?: boolean;
  /** Timeout per interaction in ms (default: 5000) */
  timeout?: number;
}

export interface Executor {
  click(page: Page, target: string): Promise<void>;
  type(page: Page, target: string, value: string): Promise<void>;
  hover(page: Page, target: string): Promise<void>;
  select(page: Page, target: string, value: string): Promise<void>;

  // Phase 5 extensions
  // navigate(url: string): Promise<void>;
  // scroll(direction: 'up' | 'down', amount?: number): Promise<void>;
  // saveAuthState(path: string): Promise<void>;
  // loadAuthState(path: string): Promise<void>;
  // interceptRequest(pattern: string, handler: RequestHandler): Promise<void>;
}
