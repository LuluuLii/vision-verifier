/**
 * Shared types used across all vision-verifier modules.
 */

export interface Viewport {
  width: number;
  height: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Screenshot {
  data: Buffer;
  viewport: Viewport;
  timestamp: number;
}

export interface ContextConfig {
  provider: string;
  value: unknown;
}
