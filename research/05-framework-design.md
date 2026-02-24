# Vision Verifier 框架设计

## 愿景

构建一个模块化的 UI 验证框架，让 AI coding agent 和开发者都能高效验证前端界面的正确性和质量。

核心设计原则：
1. **模块化**：每个模块可独立使用，也可组合使用
2. **分层验证**：按需选择验证深度，不过度验证
3. **双受众**：同时服务 AI agent（结构化 API）和人类开发者（CLI/IDE）
4. **程序化优先**：确定性检查为主，AI 评估为辅

---

## 1. 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Vision Verifier Framework                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  基础设施层                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  UI Extractor │  │   Executor   │  │   Observer   │           │
│  │              │  │              │  │              │           │
│  │ - DOM 简化    │  │ - Playwright │  │ - 截图捕获   │           │
│  │ - 无障碍树    │  │ - CDP        │  │ - DOM diff   │           │
│  │ - 布局信息    │  │ - 动作执行   │  │ - 稳定检测   │           │
│  │ - 元素索引    │  │ - 认证管理   │  │ - 性能指标   │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                 │                    │
│  评估层  └─────────────────┼─────────────────┘                    │
│  ┌─────────────────────────▼──────────────────────────────┐      │
│  │                     Evaluator                           │      │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐         │      │
│  │  │ 布局检查   │ │ 无障碍检查  │ │ 视觉回归   │         │      │
│  │  │ (overlap,  │ │ (axe-core) │ │ (screenshot │         │      │
│  │  │  overflow) │ │            │ │  compare)   │         │      │
│  │  └────────────┘ └────────────┘ └────────────┘         │      │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐         │      │
│  │  │ VLM 评估   │ │ 设计系统   │ │ 功能验证   │         │      │
│  │  │ (Claude/   │ │ 合规检查   │ │ (assertions│         │      │
│  │  │  GPT-4V)   │ │ (tokens)   │ │  + tests)  │         │      │
│  │  └────────────┘ └────────────┘ └────────────┘         │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                   │
│  编排层                                                           │
│  ┌────────────────────────────────────────────────────────┐      │
│  │              Verification Coordinator                    │      │
│  │  - 层级选择（L0/L1/L2/L3）                               │      │
│  │  - 任务调度（并行/串行）                                   │      │
│  │  - 结果聚合与反馈生成                                     │      │
│  │  - AI 辅助决策（可选）                                    │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                   │
│  接入层                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │   CLI    │ │ HTTP API │ │   MCP    │ │ IDE 扩展  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐      │
│  │         ui-fast-verify（特化快速管线）                     │      │
│  │  状态注入 → Vite 渲染 → 截图 → 基础评估                   │      │
│  │  （跳过 Executor，简化 Observer，面向开发体验）             │      │
│  └────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 模块设计

### 2.1 UI Extractor（UI 提取器）

**职责**：从运行中的页面提取结构化 UI 表示。

**核心接口**：
```typescript
interface UIExtractor {
  // 获取无障碍树（主要表示）
  getAccessibilityTree(page: Page, options?: {
    interestingOnly?: boolean;  // 默认 true
    root?: ElementHandle;       // 仅子树
  }): Promise<AccessibilityNode>;

  // 获取简化 DOM（辅助表示）
  getSimplifiedDOM(page: Page, options?: {
    maxDepth?: number;
    includeAttributes?: string[];  // 默认: role, aria-*, href, alt, type, name
    excludeSelectors?: string[];   // 默认: script, style, [aria-hidden]
  }): Promise<DOMNode>;

  // 获取元素索引列表（动作导向表示）
  getElementIndex(page: Page, options?: {
    interactive?: boolean;  // 仅交互元素
    viewport?: boolean;     // 仅视口内
  }): Promise<IndexedElement[]>;

  // 获取布局信息
  getLayoutInfo(page: Page, selector?: string): Promise<LayoutInfo>;

  // 获取完整 UI 快照（组合以上信息）
  getSnapshot(page: Page): Promise<UISnapshot>;
}

interface IndexedElement {
  index: number;
  role: string;
  name: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  states: Record<string, boolean>;  // focused, disabled, checked, etc.
  selector: string;  // CSS 选择器（用于后续操作）
}

interface UISnapshot {
  accessibilityTree: AccessibilityNode;
  elementIndex: IndexedElement[];
  screenshot: Buffer;
  viewport: { width: number; height: number };
  url: string;
  timestamp: number;
}
```

### 2.2 Executor（执行器）

**职责**：在浏览器中执行操作。

**核心接口**：
```typescript
interface Executor {
  // 导航
  navigate(url: string): Promise<void>;
  waitForStable(): Promise<void>;

  // 动作（按元素索引）
  click(index: number): Promise<void>;
  type(index: number, text: string): Promise<void>;
  hover(index: number): Promise<void>;
  select(index: number, value: string): Promise<void>;
  scroll(direction: 'up' | 'down', amount?: number): Promise<void>;

  // 动作（按选择器，后备方案）
  clickSelector(selector: string): Promise<void>;
  typeSelector(selector: string, text: string): Promise<void>;

  // 认证
  saveAuthState(path: string): Promise<void>;
  loadAuthState(path: string): Promise<void>;

  // 请求拦截
  interceptRequest(pattern: string, handler: RequestHandler): Promise<void>;
}
```

### 2.3 Observer（观察器）

**职责**：可靠地捕获页面状态。

**核心接口**：
```typescript
interface Observer {
  // 截图（带稳定等待）
  captureScreenshot(page: Page, options?: {
    waitForStable?: boolean;  // 默认 true
    disableAnimations?: boolean;  // 默认 true
    viewport?: { width: number; height: number };
    fullPage?: boolean;
    clip?: { x: number; y: number; width: number; height: number };
  }): Promise<Screenshot>;

  // DOM 快照（用于 diff）
  captureDOMSnapshot(page: Page): Promise<DOMSnapshot>;

  // DOM diff
  diffDOM(before: DOMSnapshot, after: DOMSnapshot): Promise<DOMDiff>;

  // Console 错误收集
  collectConsoleErrors(page: Page): ConsoleErrorCollector;

  // 性能指标
  collectPerformanceMetrics(page: Page): Promise<PerformanceMetrics>;

  // 等待页面稳定
  waitForStable(page: Page, options?: StabilityOptions): Promise<void>;
}

interface StabilityOptions {
  networkQuietMs?: number;   // 默认 500
  domQuietMs?: number;       // 默认 300
  noLayoutShiftMs?: number;  // 默认 500
  maxWaitMs?: number;        // 默认 10000
}
```

### 2.4 Evaluator（评估器）

**职责**：多维度评估 UI 质量。

**核心接口**：
```typescript
interface Evaluator {
  // 布局检查
  checkLayout(page: Page): Promise<LayoutCheckResult>;

  // 无障碍检查
  checkAccessibility(page: Page): Promise<AccessibilityCheckResult>;

  // 视觉回归（与 baseline 对比）
  compareVisual(
    screenshot: Screenshot,
    baseline: Screenshot,
    threshold?: number
  ): Promise<VisualComparisonResult>;

  // VLM 评估（可选）
  evaluateWithVLM(
    screenshot: Screenshot,
    criteria: EvaluationCriteria
  ): Promise<VLMEvaluationResult>;

  // 设计系统合规
  checkDesignTokens(
    page: Page,
    tokens: DesignTokenSet
  ): Promise<TokenComplianceResult>;

  // 综合评分
  evaluate(page: Page, checks: CheckType[]): Promise<EvaluationResult>;
}

interface LayoutCheckResult {
  overlaps: Array<{ elementA: string; elementB: string; area: number }>;
  overflows: Array<{ element: string; overflowX: number; overflowY: number }>;
  viewportViolations: Array<{ element: string; exceedsBy: number }>;
}

interface EvaluationResult {
  success: boolean;
  score: number;  // 0-1
  checks: Array<{
    type: CheckType;
    passed: boolean;
    details: any;
    suggestions?: string[];
  }>;
}

type CheckType =
  | 'layout'
  | 'accessibility'
  | 'visual-regression'
  | 'vlm-evaluation'
  | 'design-tokens'
  | 'typography'
  | 'color-contrast';
```

### 2.5 Verification Coordinator（验证协调器）

**职责**：编排验证流程，选择层级，聚合结果。

```typescript
interface VerificationCoordinator {
  // 分析变更，规划验证
  plan(request: VerificationRequest): VerificationPlan;

  // 执行验证计划
  execute(plan: VerificationPlan): Promise<VerificationResult>;

  // 批量验证
  batch(manifest: VerificationManifest): Promise<BatchResult>;
}

interface VerificationRequest {
  // 验证目标
  target:
    | { type: 'component'; path: string; exportName?: string }
    | { type: 'page'; url: string }
    | { type: 'url'; url: string };

  // 状态（用于组件渲染）
  state?: {
    props?: Record<string, unknown>;
    contexts?: Array<{ provider: string; value: unknown }>;
  };

  // 验证层级（可选，协调器可自动选择）
  layers?: (0 | 1 | 2 | 3)[];

  // 检查项
  checks?: CheckType[];

  // 输出配置
  output?: {
    screenshot?: boolean;
    dom?: boolean;
    report?: boolean;
  };
}
```

---

## 3. ui-fast-verify 与框架的关系

### 3.1 ui-fast-verify 是框架的特化管线

```
完整框架路径（通用）:
  Extractor → Executor → Observer → Evaluator → Coordinator
  （灵活但较慢）

ui-fast-verify 路径（特化）:
  状态注入 → Vite 渲染 → [可选: 轻量交互] → 截图 + DOM → 基础评估
  （快速但范围有限，支持 click/type/hover 等基础交互）
```

### 3.2 共享模块

ui-fast-verify 可以复用框架中的以下模块：
- **Observer.captureScreenshot()** — 截图稳定策略
- **Evaluator.checkLayout()** — 布局异常检测
- **Evaluator.checkAccessibility()** — axe-core 检查
- **Evaluator 的类型和接口定义**

### 3.3 渐进式迁移路径

```
Phase 1: ui-fast-verify 独立实现（MVP）
         └── 内联的简单截图和错误捕获

Phase 2: 提取 Observer 和 Evaluator 为独立模块
         └── ui-fast-verify 使用框架模块
         └── 新增 Extractor 模块

Phase 3: 添加 Executor 和 Coordinator
         └── 支持交互验证和 E2E
         └── ui-fast-verify 成为 Coordinator 的一个快速路径
```

---

## 4. 技术栈

| 层面 | 选择 | 理由 |
|------|------|------|
| 运行时 | Node.js / Bun | 前端生态兼容 |
| 包管理 | pnpm (monorepo) | 工作区支持，高效磁盘使用 |
| 构建 | tsup | 零配置 TypeScript 打包 |
| 浏览器自动化 | Playwright | Auto-wait, 无障碍树, CDP 访问 |
| 开发服务器 | Vite | 快速冷启动, HMR |
| 无障碍检查 | axe-core | 事实标准，~57% WCAG 覆盖 |
| CLI | Commander | 成熟，广泛使用 |
| HTTP 服务 | Express | 简单，生态丰富 |
| 测试 | Vitest | Vite 原生，快速 |

---

## 5. 项目结构

```
vision-verifier/
├── research/                    # 调研文档（本目录）
│   ├── 01-ui-representation.md
│   ├── 02-browser-automation.md
│   ├── 03-ui-evaluation.md
│   ├── 04-agent-architecture.md
│   ├── 05-framework-design.md   # 本文件
│   └── 06-interaction-state.md  # 交互与状态转换建模
│
├── ui-fast-verify/              # 快速验证方案文档
│   ├── CLAUDE.md
│   ├── 01-research-summary.md
│   ├── 02-technical-design.md
│   ├── 03-mvp-implementation.md
│   └── 04-references.md
│
├── packages/                    # 源代码（monorepo）
│   ├── core/                    # 核心模块
│   │   ├── src/
│   │   │   ├── extractor/       # UI Extractor
│   │   │   ├── executor/        # Executor
│   │   │   ├── observer/        # Observer
│   │   │   ├── evaluator/       # Evaluator
│   │   │   ├── coordinator/     # Verification Coordinator
│   │   │   ├── types/           # 共享类型定义
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── fast-verify/             # ui-fast-verify 实现
│   │   ├── src/
│   │   │   ├── renderer.ts      # Vite + Playwright 渲染
│   │   │   ├── wrapper.ts       # 组件包装器生成
│   │   │   ├── server.ts        # HTTP 服务器
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── cli/                     # CLI 工具
│       ├── src/
│       │   ├── index.ts
│       │   └── commands/
│       └── package.json
│
├── examples/                    # 示例项目
│   └── react-app/
│
├── idea.md                      # 原始构想
├── package.json                 # Monorepo 根配置
├── pnpm-workspace.yaml
└── tsconfig.json
```

---

## 6. 实现路线图

### Phase 0: 调研文档 ✅（当前）
- 5 篇调研文档
- 框架架构设计
- 模块接口定义

### Phase 1: ui-fast-verify MVP
- 目标：验证「状态快照注入 + 常驻渲染服务」假设，同时支持轻量交互
- 范围：Vite 渲染、Props 注入、截图、DOM、CLI、**基础交互（click, type, hover, select）**
- 交互能力：
  - 渲染后执行基础 Playwright 交互操作
  - 每步交互后可截图（`screenshotAfterEachInteraction`）
  - 默认禁用动画以确保截图稳定性
  - 详见 `research/06-interaction-state.md` 第 5.1 节的 API 设计
- 成功标准：首次渲染 < 2s，HMR < 500ms，单步交互响应 < 1s，连续 10 次不崩溃

### Phase 2: UI Extractor
- 目标：结构化 UI 表示，供 agent 和评估器使用
- 范围：无障碍树 + 边界框、DOM 简化、元素索引
- 成功标准：能从任意页面提取结构化 UI 快照，token 效率比 raw DOM 提升 10x+

### Phase 3: Observer 增强
- 目标：可靠的页面状态观察
- 范围：组合稳定等待、DOM diff、loading 检测
- 成功标准：在 100 个不同页面上截图稳定性 >95%

### Phase 4: Evaluator
- 目标：多维度 UI 质量评估
- 范围：布局检查、axe-core、视觉回归、VLM 评估
- 成功标准：程序化检查 < 1s，能检测常见布局问题

### Phase 5: Executor
- 目标：可靠的浏览器操作
- 范围：Playwright 封装、认证管理、SPA 处理
- 成功标准：在 10 个不同 SPA 上完成登录+导航+操作

### Phase 6: Coordinator + 集成
- 目标：智能验证编排
- 范围：层级选择、批量模式、MCP 集成
- 成功标准：AI agent 可通过 MCP 调用完整验证管线

---

## 7. 开放问题

| 问题 | 状态 | 影响 |
|------|------|------|
| 状态序列化边界（函数、ref、循环引用） | 需要实验 | Phase 1 |
| 组件依赖自动发现（Context/Provider） | 需要调研 | Phase 1 |
| VLM 评估的精度/成本权衡 | 已有初步数据 | Phase 4 |
| Canvas/WebGL 内容的表示和评估 | 无解决方案 | 长期 |
| 跨浏览器无障碍树一致性 | 已知问题 | Phase 2 |
| 大规模页面（数百交互元素）的 token 管理 | 需要分页策略 | Phase 2 |
| 轻量交互后的状态一致性验证 | 需要实验 | Phase 1 |
| 跨状态管理库的统一注入接口 | 需要适配器模式 | Phase 2 |
