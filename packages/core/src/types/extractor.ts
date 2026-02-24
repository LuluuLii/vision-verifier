/**
 * UI Extractor module types.
 *
 * Extracts structured UI representations from running pages,
 * making UI understandable by machines and AI agents.
 */

import type { Page, ElementHandle } from 'playwright';
import type { BoundingBox, Viewport } from './common.js';

export interface AccessibilityNode {
  role: string;
  name: string;
  value?: string;
  description?: string;
  children?: AccessibilityNode[];
  states?: Record<string, boolean>;
}

export interface DOMNode {
  tag: string;
  attributes: Record<string, string>;
  children: DOMNode[];
  text?: string;
}

export interface IndexedElement {
  index: number;
  role: string;
  name: string;
  boundingBox: BoundingBox;
  states: Record<string, boolean>;
  selector: string;
}

export interface LayoutInfo {
  boundingBox: BoundingBox;
  computedStyle: Record<string, string>;
  children: LayoutInfo[];
}

export interface UISnapshot {
  accessibilityTree: AccessibilityNode;
  elementIndex: IndexedElement[];
  screenshot: Buffer;
  viewport: Viewport;
  url: string;
  timestamp: number;
}

export interface UIExtractor {
  getAccessibilityTree(
    page: Page,
    options?: {
      interestingOnly?: boolean;
      root?: ElementHandle;
    },
  ): Promise<AccessibilityNode>;

  getSimplifiedDOM(
    page: Page,
    options?: {
      maxDepth?: number;
      includeAttributes?: string[];
      excludeSelectors?: string[];
    },
  ): Promise<DOMNode>;

  getElementIndex(
    page: Page,
    options?: {
      interactive?: boolean;
      viewport?: boolean;
    },
  ): Promise<IndexedElement[]>;

  getLayoutInfo(page: Page, selector?: string): Promise<LayoutInfo>;

  getSnapshot(page: Page): Promise<UISnapshot>;
}
