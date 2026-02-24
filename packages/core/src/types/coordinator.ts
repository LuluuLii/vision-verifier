/**
 * Verification Coordinator module types.
 *
 * Orchestrates the verification flow: layer selection,
 * task scheduling, result aggregation, feedback generation.
 */

import type { CheckType } from './evaluator.js';
import type { ContextConfig } from './common.js';

export type VerificationLayer = 0 | 1 | 2 | 3;

export interface ComponentTarget {
  path: string;
  exportName?: string;
}

export type VerificationTarget =
  | { type: 'component'; path: string; exportName?: string }
  | { type: 'page'; url: string }
  | { type: 'url'; url: string };

export interface VerificationRequest {
  target: VerificationTarget;
  state?: {
    props?: Record<string, unknown>;
    contexts?: ContextConfig[];
  };
  layers?: VerificationLayer[];
  checks?: CheckType[];
  output?: {
    screenshot?: boolean;
    dom?: boolean;
    report?: boolean;
  };
}

export interface VerificationPlan {
  layers: Array<{
    level: VerificationLayer;
    components: ComponentTarget[];
    checks: CheckType[];
  }>;
  parallel: boolean;
  timeout: number;
}

export interface LayerResult {
  level: VerificationLayer;
  success: boolean;
  checks: Array<{
    type: CheckType;
    passed: boolean;
    details: unknown;
  }>;
  duration: number;
}

export interface VerificationResult {
  success: boolean;
  score: number;
  layers: LayerResult[];
  metrics: {
    totalTime: number;
    renderTime: number;
  };
}

export interface VerificationFeedback {
  result: 'pass' | 'fail';
  layer: VerificationLayer;
  errors: Array<{
    type: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
    suggestion?: string;
  }>;
  screenshot?: Buffer;
  metrics: Record<string, number>;
}

export interface BatchResult {
  total: number;
  passed: number;
  failed: number;
  score: number;
  details: VerificationResult[];
}

export interface VerificationManifest {
  scenarios: Array<{
    name: string;
    request: VerificationRequest;
  }>;
}

export interface VerificationCoordinator {
  plan(request: VerificationRequest): VerificationPlan;
  execute(plan: VerificationPlan): Promise<VerificationResult>;
  generateFeedback(result: VerificationResult): VerificationFeedback;
  batch(manifest: VerificationManifest): Promise<BatchResult>;
}
