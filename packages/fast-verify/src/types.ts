/**
 * Types specific to the fast-verify pipeline.
 */

import type { Viewport, Interaction, ContextConfig } from '@vision-verifier/core';

export interface ComponentRef {
  /** Relative path to the component file from project root */
  path: string;
  /** Named export (default: 'default') */
  exportName?: string;
}

export interface RenderRequest {
  /** Component to render */
  component: ComponentRef;
  /** State to inject */
  state?: {
    props?: Record<string, unknown>;
    contexts?: ContextConfig[];
  };
  /** Interactions to execute after render */
  interactions?: Interaction[];
  /** Output configuration */
  output?: {
    screenshot?: boolean;
    dom?: boolean;
    /** Capture screenshot after each interaction */
    screenshotAfterEachInteraction?: boolean;
  };
  /** Render options */
  options?: {
    viewport?: Viewport;
    /** Disable CSS animations (default: true) */
    disableAnimations?: boolean;
    /** Render timeout in ms (default: 10000) */
    timeout?: number;
  };
}

export interface StepScreenshot {
  /** Interaction that preceded this screenshot */
  interaction: Interaction;
  /** Screenshot buffer */
  screenshot: Buffer;
  /** Whether the interaction succeeded */
  success: boolean;
  /** Error message if interaction failed */
  error?: string;
}

export interface RenderResponse {
  /** Whether the render (and all interactions) succeeded */
  success: boolean;
  /** Screenshot after initial render (before interactions) */
  screenshot?: Buffer;
  /** Outer HTML of the rendered component */
  dom?: string;
  /** Console errors and page errors captured during render */
  errors: string[];
  /** Screenshots captured after each interaction step */
  stepScreenshots?: StepScreenshot[];
  /** Timing metrics */
  metrics: {
    totalTime: number;
    renderTime: number;
    interactionTime?: number;
  };
}

export interface ServerConfig {
  /** Port for the HTTP server (default: 4173) */
  port?: number;
  /** Path to user's project root */
  projectRoot: string;
  /** Default viewport */
  viewport?: Viewport;
  /** Run browser headless (default: true) */
  headless?: boolean;
}
