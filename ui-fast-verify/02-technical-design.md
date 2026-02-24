# UI 分层验证工具 - 技术设计文档

## 项目目标

开发一个前端 UI 分层验证工具，服务两个场景：

1. **Coding Agent 评测/RL**：离线批量验证，支持结构化评分
2. **开发者体验**：实时交互验证，快速反馈循环

## 核心设计原则

1. **状态优先**：通过状态注入而非操作路径到达验证状态
2. **分层验证**：不同层级覆盖不同类型的问题，按需选择
3. **常驻服务**：避免冷启动，保持渲染环境热状态
4. **AI 友好**：输入输出格式便于 AI agent 使用

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI / API                                │
│                   (验证请求入口)                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      验证协调器                                   │
│              (选择验证层级、调度任务)                              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Layer 0     │   │   Layer 1     │   │   Layer 2     │
│  静态分析器   │   │  快照渲染器   │   │  交互验证器   │
│  (AST/类型)   │   │  (状态注入)   │   │  (轻量交互)   │
└───────────────┘   └───────────────┘   └───────────────┘
                            │
                    ┌───────▼───────┐
                    │  常驻渲染服务  │
                    │  (Vite HMR)   │
                    └───────────────┘
```

## 验证层级详细设计

### Layer 0: 静态分析

**职责**：不运行代码，只分析代码结构

**检查项**：
- TypeScript 类型检查
- ESLint 规则
- 组件 props 类型匹配
- Import 依赖解析

**输入**：
```typescript
interface Layer0Input {
  files: Array<{
    path: string;
    content: string;
  }>;
  tsconfig?: string;
  eslintConfig?: string;
}
```

**输出**：
```typescript
interface Layer0Output {
  success: boolean;
  errors: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning';
  }>;
  duration: number;
}
```

**目标时间**：< 100ms

---

### Layer 1: 状态快照渲染

**职责**：注入状态，渲染组件，输出 DOM/截图

**核心能力**：
- 组件隔离渲染（不需要完整应用）
- Props 注入
- Context 注入
- Store 状态注入（Redux/Zustand/Jotai 等）
- API Mock（MSW）

**输入**：
```typescript
interface Layer1Input {
  // 要渲染的组件
  component: {
    path: string;           // e.g., "src/components/Checkout.tsx"
    exportName?: string;    // 默认 default export
  };
  
  // 状态注入
  state: {
    props?: Record<string, any>;
    
    // Context 注入
    contexts?: Array<{
      provider: string;     // Provider 组件路径
      value: any;
    }>;
    
    // Store 状态（支持多种状态库）
    store?: {
      type: 'redux' | 'zustand' | 'jotai' | 'custom';
      initialState: Record<string, any>;
    };
    
    // API Mock
    mocks?: Array<{
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      url: string | RegExp;
      response: any;
      delay?: number;
    }>;
    
    // 路由状态
    router?: {
      path: string;
      params?: Record<string, string>;
      query?: Record<string, string>;
    };
  };
  
  // 视口配置
  viewport?: {
    width: number;
    height: number;
  };
  
  // 输出配置
  output: {
    screenshot?: boolean;
    dom?: boolean;
    accessibilityTree?: boolean;
    consoleErrors?: boolean;
  };
}
```

**输出**：
```typescript
interface Layer1Output {
  success: boolean;
  renderTime: number;
  
  screenshot?: {
    data: Buffer;
    format: 'png' | 'jpeg';
    width: number;
    height: number;
  };
  
  dom?: {
    html: string;
    textContent: string;  // 提取的文本内容
  };
  
  accessibilityTree?: object;
  
  errors?: Array<{
    type: 'render' | 'console' | 'runtime';
    message: string;
    stack?: string;
  }>;
}
```

**目标时间**：< 500ms（首次），< 100ms（HMR 后）

---

### Layer 2: 交互验证

**职责**：在 Layer 1 基础上执行轻量交互，验证组件响应

**输入**：
```typescript
interface Layer2Input extends Layer1Input {
  // 交互序列
  interactions: Array<{
    type: 'click' | 'type' | 'hover' | 'focus' | 'blur' | 'select';
    target: string;  // CSS 选择器或 data-testid
    value?: string;  // for 'type' and 'select'
    delay?: number;  // 等待时间
  }>;
  
  // 断言
  assertions?: Array<{
    type: 'visible' | 'hidden' | 'text' | 'value' | 'attribute' | 'called';
    target?: string;
    expected?: any;
    matcher?: 'equals' | 'contains' | 'matches';
  }>;
}
```

**输出**：
```typescript
interface Layer2Output extends Layer1Output {
  interactions: Array<{
    action: string;
    success: boolean;
    duration: number;
    error?: string;
  }>;
  
  assertions: Array<{
    description: string;
    passed: boolean;
    actual?: any;
    expected?: any;
  }>;
}
```

**目标时间**：1-3s

---

## 常驻渲染服务设计

### 技术栈

```
Vite (dev server)
  + React/Vue/Svelte (根据项目)
  + Playwright (截图)
  + MSW (API mock)
  + Testing Library (交互)
```

### 服务架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      HTTP Server (Express)                       │
│                         Port: 4173                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │  请求路由器   │
                    └───────┬───────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  /render      │   │  /interact    │   │  /health      │
│  Layer 1      │   │  Layer 2      │   │  状态检查     │
└───────┬───────┘   └───────┬───────┘   └───────────────┘
        │                   │
        └─────────┬─────────┘
                  ▼
        ┌─────────────────┐
        │  Vite Dev Server │
        │  (HMR enabled)   │
        │  Port: 5173      │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │  渲染 iframe    │
        │  (隔离环境)     │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │  Playwright     │
        │  (截图/交互)    │
        └─────────────────┘
```

## CLI 接口设计

```bash
# 启动常驻服务
ui-verify serve --port 4173 --project ./my-app

# 单次验证
ui-verify render \
  --component src/components/Checkout.tsx \
  --state '{"props": {"items": [...]}}' \
  --screenshot output.png

# 交互验证
ui-verify interact \
  --component src/components/LoginForm.tsx \
  --state '{"props": {}}' \
  --actions '[{"type": "type", "target": "[name=email]", "value": "test@example.com"}]'

# 批量验证（评测场景）
ui-verify batch \
  --manifest tests/verification-manifest.json \
  --output results/
```

## 与 AI Agent 集成

### 状态描述生成

建议 AI 在生成组件代码时，同时生成状态描述文件：

```typescript
// Checkout.tsx
export function Checkout({ items, coupon, user }: CheckoutProps) {
  // ...
}

// Checkout.verify.json (AI 同时生成)
{
  "scenarios": [
    {
      "name": "empty_cart",
      "state": { "props": { "items": [], "coupon": null } }
    },
    {
      "name": "with_discount",
      "state": { "props": { "items": [...], "coupon": { "code": "SAVE20", "discount": 0.2 } } }
    },
    {
      "name": "out_of_stock_item",
      "state": { "props": { "items": [{ "id": 1, "inStock": false }] } }
    }
  ]
}
```

### 验证结果反馈格式

```typescript
interface VerificationFeedback {
  task_id: string;
  component: string;
  scenario: string;
  
  result: 'pass' | 'fail' | 'error';
  
  // 成功时
  screenshot?: string;  // base64 或 URL
  
  // 失败时
  errors: Array<{
    type: 'render' | 'assertion' | 'interaction';
    message: string;
    suggestion?: string;  // 可能的修复建议
  }>;
  
  // 性能指标
  metrics: {
    renderTime: number;
    totalTime: number;
  };
}
```

## 实现优先级

### Phase 1: MVP (2-3 周)

- [ ] 常驻 Vite 渲染服务
- [ ] Layer 1 基础实现（props 注入、截图）
- [ ] CLI 基本命令
- [ ] React 支持

### Phase 2: 核心功能 (2-3 周)

- [ ] Context/Store 注入
- [ ] API Mock (MSW 集成)
- [ ] Layer 2 交互验证
- [ ] 批量验证模式

### Phase 3: 生态集成 (2-3 周)

- [ ] Vue/Svelte 支持
- [ ] Storybook story 导入
- [ ] VS Code 扩展
- [ ] AI Agent SDK

## 开放问题

1. **状态序列化边界**：函数、ref、循环引用如何处理？
2. **组件依赖解析**：如何自动发现组件依赖的 Context/Provider？
3. **样式隔离**：如何确保隔离渲染时样式正确加载？
4. **真实性权衡**：快照方式遗漏的问题如何弥补？

## 参考资源

- Storybook Component Testing: https://storybook.js.org/docs/writing-tests/component-testing
- Vercel agent-browser: https://github.com/vercel/agent-browser
- MSW (Mock Service Worker): https://mswjs.io/
- Vite API: https://vitejs.dev/guide/api-javascript.html
