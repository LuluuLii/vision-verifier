// Common types
export type {
  Viewport,
  BoundingBox,
  Screenshot,
  ContextConfig,
} from './common.js';

// Renderer types
export type {
  RendererConfig,
  RenderTarget,
  IBaseRenderer,
} from './renderer.js';

// Extractor types
export type {
  AccessibilityNode,
  DOMNode,
  IndexedElement,
  LayoutInfo,
  UISnapshot,
  UIExtractor,
} from './extractor.js';

// Executor types
export type {
  InteractionType,
  Interaction,
  StepResult,
  ExecuteInteractionsOptions,
  Executor,
} from './executor.js';

// Observer types
export type {
  ScreenshotOptions,
  ErrorCapture,
  StabilityOptions,
  DOMSnapshot,
  DOMDiff,
  PerformanceMetrics,
  Observer,
} from './observer.js';

// Evaluator types
export type {
  CheckType,
  LayoutCheckResult,
  AccessibilityCheckResult,
  VisualComparisonResult,
  EvaluationCriteria,
  VLMEvaluationResult,
  DesignTokenSet,
  TokenComplianceResult,
  CheckResult,
  EvaluationResult,
  Evaluator,
} from './evaluator.js';

// Coordinator types
export type {
  VerificationLayer,
  ComponentTarget,
  VerificationTarget,
  VerificationRequest,
  VerificationPlan,
  LayerResult,
  VerificationResult,
  VerificationFeedback,
  BatchResult,
  VerificationManifest,
  VerificationCoordinator,
} from './coordinator.js';
