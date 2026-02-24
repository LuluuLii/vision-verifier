/**
 * Evaluator module types.
 *
 * Multi-dimensional UI quality assessment:
 * layout checks, accessibility, visual regression, VLM evaluation.
 */

import type { Page } from 'playwright';
import type { Screenshot } from './common.js';

export type CheckType =
  | 'layout'
  | 'accessibility'
  | 'visual-regression'
  | 'vlm-evaluation'
  | 'design-tokens'
  | 'typography'
  | 'color-contrast';

export interface LayoutCheckResult {
  overlaps: Array<{ elementA: string; elementB: string; area: number }>;
  overflows: Array<{
    element: string;
    overflowX: number;
    overflowY: number;
  }>;
  viewportViolations: Array<{ element: string; exceedsBy: number }>;
}

export interface AccessibilityCheckResult {
  violations: Array<{
    id: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    description: string;
    nodes: string[];
  }>;
  passes: number;
  incomplete: number;
}

export interface VisualComparisonResult {
  match: boolean;
  diffPercentage: number;
  diffImage?: Buffer;
}

export interface EvaluationCriteria {
  prompt: string;
  aspects?: string[];
}

export interface VLMEvaluationResult {
  score: number;
  feedback: string;
  aspects?: Record<string, { score: number; comment: string }>;
}

export interface DesignTokenSet {
  colors?: Record<string, string>;
  spacing?: Record<string, string>;
  typography?: Record<string, { fontFamily: string; fontSize: string }>;
}

export interface TokenComplianceResult {
  compliant: boolean;
  violations: Array<{
    element: string;
    token: string;
    expected: string;
    actual: string;
  }>;
}

export interface CheckResult {
  type: CheckType;
  passed: boolean;
  details: unknown;
  suggestions?: string[];
}

export interface EvaluationResult {
  success: boolean;
  score: number;
  checks: CheckResult[];
}

export interface Evaluator {
  checkLayout(page: Page): Promise<LayoutCheckResult>;
  checkAccessibility(page: Page): Promise<AccessibilityCheckResult>;
  compareVisual(
    screenshot: Screenshot,
    baseline: Screenshot,
    threshold?: number,
  ): Promise<VisualComparisonResult>;
  evaluateWithVLM(
    screenshot: Screenshot,
    criteria: EvaluationCriteria,
  ): Promise<VLMEvaluationResult>;
  checkDesignTokens(
    page: Page,
    tokens: DesignTokenSet,
  ): Promise<TokenComplianceResult>;
  evaluate(page: Page, checks: CheckType[]): Promise<EvaluationResult>;
}
