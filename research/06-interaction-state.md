# UI 交互与状态转换建模

## 核心问题

UI 不是静态的——用户通过交互（点击、输入、滚动、拖拽）触发状态变化，状态变化驱动界面更新。验证 UI 不仅要检查某个时刻的"快照正确性"，还需要理解和验证**状态转换过程**。

关键问题：
1. 如何建模 UI 的交互状态和转换？
2. 中间状态（过渡动画、加载态、部分更新）如何验证？
3. 在快速验证（ui-fast-verify）和完整 E2E 评测中，交互验证的侧重有何不同？
4. 不同状态管理方案如何影响验证策略？

---

## 1. UI 状态机建模

### 1.1 有限状态机（FSM）与状态图（Statecharts）

状态图（David Harel, 1987）是有限状态机的扩展，增加了层次化状态、并行状态和守卫条件，非常适合建模复杂 UI 行为。

**核心概念**：

| 概念 | 说明 | UI 示例 |
|------|------|---------|
| 状态（State） | 系统所处的离散模式 | `idle`, `loading`, `success`, `error` |
| 事件（Event） | 触发状态转换的外部输入 | `CLICK`, `SUBMIT`, `TIMEOUT` |
| 转换（Transition） | 从一个状态到另一个状态 | `idle → loading`（由 SUBMIT 触发） |
| 守卫（Guard） | 条件转换 | 只有表单有效时才允许提交 |
| 动作（Action） | 转换时执行的副作用 | 发送 API 请求、更新 context |
| 层次状态（Hierarchical） | 嵌套的子状态 | `editing.valid`, `editing.invalid` |
| 并行状态（Parallel） | 同时活跃的独立状态区域 | 侧边栏状态 + 主内容状态 |

### 1.2 XState 实践

XState 是目前最成熟的 JavaScript 状态机/状态图库，用于显式建模 UI 状态和转换。

**登录流程状态机示例**：

```typescript
import { createMachine } from 'xstate';

const loginMachine = createMachine({
  id: 'login',
  initial: 'idle',
  context: { attempts: 0, error: null },
  states: {
    idle: {
      on: { SUBMIT: { target: 'loading', guard: 'isFormValid' } }
    },
    loading: {
      invoke: {
        src: 'authenticateUser',
        onDone: 'success',
        onError: {
          target: 'error',
          actions: 'setError'
        }
      }
    },
    error: {
      on: {
        SUBMIT: {
          target: 'loading',
          guard: 'canRetry'   // attempts < 3
        },
        RESET: 'idle'
      }
    },
    success: { type: 'final' }
  }
});
```

**多步表单（层次状态 + 守卫）**：

```typescript
const wizardMachine = createMachine({
  id: 'wizard',
  initial: 'step1',
  context: { formData: {} },
  states: {
    step1: {
      on: {
        NEXT: {
          target: 'step2',
          guard: 'isStep1Valid',
          actions: 'saveStep1Data'
        }
      }
    },
    step2: {
      on: {
        BACK: 'step1',
        NEXT: {
          target: 'step3',
          guard: 'isStep2Valid',
          actions: 'saveStep2Data'
        }
      }
    },
    step3: {
      on: {
        BACK: 'step2',
        SUBMIT: 'submitting'
      }
    },
    submitting: {
      invoke: {
        src: 'submitForm',
        onDone: 'success',
        onError: 'step3'  // 回到最后一步
      }
    },
    success: { type: 'final' }
  }
});
```

**并行状态（Dashboard UI）**：

```typescript
const dashboardMachine = createMachine({
  type: 'parallel',
  states: {
    sidebar: {
      initial: 'collapsed',
      states: {
        collapsed: { on: { TOGGLE_SIDEBAR: 'expanded' } },
        expanded: { on: { TOGGLE_SIDEBAR: 'collapsed' } }
      }
    },
    notifications: {
      initial: 'hidden',
      states: {
        hidden: { on: { SHOW_NOTIFICATIONS: 'visible' } },
        visible: { on: { HIDE_NOTIFICATIONS: 'hidden' } }
      }
    },
    modal: {
      initial: 'closed',
      states: {
        closed: { on: { OPEN_MODAL: 'opening' } },
        opening: { invoke: { src: 'animateOpen', onDone: 'open' } },
        open: { on: { CLOSE_MODAL: 'closing' } },
        closing: { invoke: { src: 'animateClose', onDone: 'closed' } }
      }
    }
  }
});
```

### 1.3 基于模型的测试（Model-Based Testing）

@xstate/test 将状态机转化为测试计划，自动生成覆盖所有可达状态的测试路径。

**工作原理**：

```
状态机定义 → 图遍历算法（Dijkstra） → 生成最短路径覆盖所有状态 → 自动化测试
```

**示例**：

```typescript
import { createModel } from '@xstate/test';

const testModel = createModel(loginMachine).withEvents({
  SUBMIT: async (page) => {
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    await page.click('[data-testid="submit"]');
  },
  RESET: async (page) => {
    await page.click('[data-testid="reset"]');
  }
});

// 自动生成的测试路径：
// Path 1: idle → loading → success
// Path 2: idle → loading → error → idle → loading → success
// Path 3: idle → loading → error → loading → error (max retries)

const plans = testModel.getShortestPathPlans();

plans.forEach(plan => {
  plan.paths.forEach(path => {
    test(path.description, async ({ page }) => {
      await page.goto('/login');
      await path.test(page);
    });
  });
});
```

**关键优势**：
- **穷举覆盖**：数学保证覆盖所有可达状态
- **自动发现边界情况**：状态机揭示开发者可能忽略的路径
- **可视化验证**：状态图即文档，可视化检查完整性
- **可维护性**：修改状态机定义自动更新测试路径

### 1.4 对本项目的意义

状态机建模为 UI 验证提供了**交互行为的抽象层**：

| 应用场景 | 收益 |
|---------|------|
| ui-fast-verify | 从状态机定义中提取所有需要验证的状态，直接注入每个状态进行快照渲染 |
| 交互验证（L2） | 用状态机定义交互序列，自动生成测试路径 |
| E2E 评测 | 以状态图为参考模型，验证实际交互是否按预期转换 |
| Agent 验证 | Agent 的操作结果可与状态机的预期转换对比 |

---

## 2. 中间状态验证

### 2.1 为什么不能只检查终态

传统测试往往只关注最终结果（"表单提交后显示成功页"）。但在 AI agent 驱动的验证和实际用户体验中，**中间状态**同样重要：

1. **错误在中间步骤累积**：如果 agent 在第 3 步犯错，后续所有步骤都会失败
2. **用户体验不只是终态**：加载动画、过渡效果、表单校验反馈都是中间状态
3. **调试需要定位失败点**：只有终态 pass/fail 无法帮助定位问题
4. **部分进度有价值**：完成 80% 的步骤也是有意义的信号

### 2.2 学术界最新进展

#### WorldGUI（2025）

WorldGUI 是桌面 GUI 代理的综合评测基准，覆盖 10 个常用桌面和 Web 应用的 611 个任务。

**关键创新——中间状态起点**：
- 真实用户不会总从默认初始状态开始
- 任务可以从任意中间状态启动
- 反映真实人机交互场景

**Step-Check 模块**：
- 逐步验证 agent 的操作是否正确
- 没有逐步验证时，成功率下降 6.2%（从 26.0% 降至 19.8%）
- 能拦截和纠正多步交互中的错误

**启示**：逐步验证不是可选的——它显著提升 agent 成功率。

#### WebCanvas（2024）

WebCanvas 是在线 Web 代理评测框架，核心数据集 Mind2Web-Live 包含 **542 个任务、2,439 个中间评估状态**。

**中间评估状态设计**：
- 定义"关键节点"——完成任务必须经过的检查点
- 区分关键中间状态（必须通过）和噪音事件（可忽略）
- 支持多条有效路径（不强制特定操作顺序）

**评估维度**：
- 任务成功率：23.1%（最佳 agent）
- 任务完成率：48.8%（达到了多少中间检查点）
- 完成率 vs 成功率的差距说明中间验证的价值

#### ShowUI（CVPR 2025）

ShowUI 是轻量级（2B 参数）视觉-语言-动作模型，用于 GUI agent 的视觉定位。

**关键创新**：
- UI 引导的视觉 Token 选择：将截图建模为 UI 连接图，减少 33% 视觉 token
- 交错式视觉-语言-动作流：统一多轮查询-动作序列
- 零样本截图定位准确率 75.1%

**对验证的意义**：ShowUI 的视觉定位能力可用于验证 UI 元素是否存在、位置是否正确、元素间关系是否符合预期。

#### GUI-Actor（Microsoft, NeurIPS 2025）

GUI-Actor 提出无坐标的视觉定位方法，使用注意力机制而非坐标生成。

**核心方法**：
- 引入 `<ACTOR>` token，通过注意力机制与视觉区域对齐
- 无需生成数字坐标，避免坐标参考框架的混淆
- GUI-Actor-7B 在 ScreenSpot-Pro 上达到 44.6，超过 72B 模型

**验证相关**：GUI-Actor-Verifier-2B 是专门为验证任务设计的小模型。

#### UI-TARS 的状态转换描述训练（ByteDance）

UI-TARS（arXiv:2501.12326）和 UI-TARS-2（arXiv:2509.02544）在中间状态验证上有两个重要的工程实践：

**状态转换描述（State Transition Captioning）**：
- 训练模型识别和描述**连续两张截图之间的差异**
- 判断特定操作（点击、输入）是否已经生效
- 这是 agent 感知"我的动作有没有成功"的关键能力

**反射学习（Reflection Tuning）**：
- Agent 学习识别并从自身的错误操作中恢复
- 标注者标注 "error correction" 和 "post-reflection" 场景
- 通过 Direct Preference Optimization（DPO）训练

**UI-TARS-2 的 ORM（Outcome Reward Model）**：
- 用 UI-TARS-2 自身作为生成式结果奖励模型
- 处理最近 5 张截图作为上下文
- F1 达到 83.8，但有较高的假阳性率
- 区分"确定性可验证任务"（二元正确信号）和"不可验证任务"（ORM 评分）

**对本项目的启示**：连续截图对比是验证交互结果的有效方法。ui-fast-verify 可在每步交互后截图，通过 DOM diff 或截图对比确认操作生效。

#### Dropdown 交互：DOM 和 VLM 的边界案例（来自 Agent TARS）

Agent TARS 的实践揭示了 **dropdown 是需要 DOM+VLM 混合处理的典型交互类型**：

**问题**：
- 原生 `<select>` 元素的选项列表由浏览器引擎渲染，不在页面 DOM 中
- VLM 看截图时**看不到**未展开的下拉选项
- 即使展开后，原生下拉菜单的选项列表也可能超出页面可视区域
- 自定义 dropdown（如 Ant Design Select、Headless UI Listbox）的选项通过 Portal 渲染到 `<body>` 下，DOM 位置与视觉位置不一致

**Agent TARS 的解决方案——专用 DOM action**：

```typescript
// VLM 识别到下拉组件后，切换到 DOM 模式处理
// 1. 获取选项列表（纯 DOM 操作）
const options = await page.getDropdownOptions(elementIndex);
// 返回: [{ index: 0, text: "选项A", value: "a" }, ...]

// 2. 将选项列表作为文本发给 LLM 选择
// LLM 输出: select_dropdown_option(index=5, text="选项E")

// 3. 通过 DOM 操作选择并触发事件
select.value = option.value;
select.dispatchEvent(new Event('change', { bubbles: true }));
select.dispatchEvent(new Event('input', { bubbles: true }));
```

**对本项目的意义**：
- ui-fast-verify 的交互支持应包含 `select` 操作类型
- 自定义 dropdown 组件需要特殊的 DOM 查询策略（检查 Portal 渲染的列表）
- 这是"确定性方法优先"原则的实际案例——不要让 VLM 猜测选项，直接用 DOM 获取

### 2.3 中间状态验证的实践模式

**检查点模式**：

```typescript
interface VerificationCheckpoint {
  id: string;
  description: string;

  // 验证条件
  conditions: {
    elements?: string[];        // 必须存在的元素
    state?: Record<string, any>; // 必须匹配的状态
    assertions?: Array<(page: Page) => Promise<boolean>>;
  };

  // 元数据
  isCritical: boolean;   // 关键检查点必须通过
  timeout: number;
  screenshot?: boolean;  // 是否在此检查点截图
}

// 示例：多步表单验证
const formCheckpoints: VerificationCheckpoint[] = [
  {
    id: 'personal-info-filled',
    description: '个人信息已填写',
    conditions: {
      assertions: [
        async (page) => !!(await page.inputValue('#firstName')),
        async (page) => !!(await page.inputValue('#email')),
      ]
    },
    isCritical: true,
    timeout: 5000,
    screenshot: true
  },
  {
    id: 'validation-passed',
    description: '表单验证通过，无错误信息',
    conditions: {
      elements: [],
      assertions: [
        async (page) => !(await page.isVisible('.error-message'))
      ]
    },
    isCritical: true,
    timeout: 3000,
    screenshot: false
  },
  {
    id: 'submit-success',
    description: '提交成功，显示成功页面',
    conditions: {
      elements: ['.success-message']
    },
    isCritical: true,
    timeout: 10000,
    screenshot: true
  }
];
```

**部分进度评分**：

```typescript
interface CheckpointResult {
  checkpointId: string;
  passed: boolean;
  screenshot?: Buffer;
  error?: string;
  timestamp: number;
}

interface InteractionVerificationResult {
  totalCheckpoints: number;
  passedCheckpoints: number;
  completionRate: number;    // passedCheckpoints / totalCheckpoints
  success: boolean;          // 所有 critical 检查点通过
  checkpoints: CheckpointResult[];
  trajectory: string[];      // 实际经过的状态路径
}
```

---

## 3. 动画与过渡状态

### 3.1 动画类型与验证挑战

| 动画类型 | 实现方式 | 验证挑战 |
|---------|---------|---------|
| CSS Transition | `transition: opacity 0.3s` | 时序不确定，中间帧不可预测 |
| CSS Animation | `@keyframes` | 关键帧可定义，但持续时间影响测试速度 |
| JavaScript 动画 | Framer Motion, GSAP | 库特定行为，需要等待回调 |
| Web Animations API | `element.animate()` | 可编程控制，有 `finished` Promise |
| Layout 动画 | Framer Motion `layout` | 依赖 DOM 变化，难以隔离 |

### 3.2 Playwright 动画处理策略

**策略 1：禁用动画（推荐用于大多数验证测试）**

```typescript
// Playwright 截图时默认禁用动画
await page.screenshot({ animations: 'disabled' });
// 效果：
// - CSS 动画/过渡停止
// - 有限动画快进到完成态（触发 transitionend）
// - 无限动画取消到初始态
```

**策略 2：等待动画完成**

```typescript
// 使用 Web Animations API 等待
await element.evaluate(el =>
  Promise.all(
    el.getAnimations({ subtree: true })
      .map(animation => animation.finished)
  )
);
```

**策略 3：CSS 属性值检测**

```typescript
// 等待特定 CSS 属性达到目标值
await page.waitForFunction(() => {
  const el = document.querySelector('.fade-in');
  return parseFloat(getComputedStyle(el).opacity) > 0.99;
});
```

**策略 4：prefers-reduced-motion**

```typescript
// 通过媒体查询减少/禁用动画
await page.emulateMedia({ reducedMotion: 'reduce' });
// 配合 CSS:
// @media (prefers-reduced-motion: reduce) {
//   * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
// }
```

**策略 5：注入 CSS 全局禁用**

```typescript
await page.addStyleTag({
  content: `*, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }`
});
```

### 3.3 动画验证分层策略

| 验证目标 | 策略 | 速度 |
|---------|------|------|
| 快照渲染正确性 | 禁用动画，只检查终态 | 快 |
| 动画存在性 | 检查 CSS 属性或 `getAnimations()` 是否返回动画 | 快 |
| 动画终态正确性 | 等待动画完成后截图 | 中 |
| 关键帧正确性 | 捕获开始、中间、结束三个截图 | 慢 |
| 逐帧回归测试 | 全帧捕获 + 对比 | 很慢 |

### 3.4 React 动画库的测试模式

**React Transition Group**：

```typescript
// 单元测试中 mock 掉过渡效果
jest.mock('react-transition-group', () => ({
  CSSTransition: jest.fn(({ children }) => children),
  TransitionGroup: jest.fn(({ children }) => children),
}));

// E2E 测试中等待 CSS class 变化
await waitFor(() => {
  expect(screen.getByRole('dialog')).toHaveClass('entered');
});
```

**Framer Motion**：

```typescript
// 单元测试中 mock motion 组件
jest.mock('framer-motion', () => ({
  motion: { div: 'div', span: 'span', button: 'button' },
  AnimatePresence: ({ children }) => children,
}));

// E2E 测试中使用 Playwright
const element = page.locator('.animated-element');
await element.evaluate(async (el) => {
  const animations = el.getAnimations();
  await Promise.all(animations.map(a => a.finished));
});
await expect(element).toHaveCSS('opacity', '1');
```

### 3.5 对本项目的建议

**ui-fast-verify（L1 快照验证）**：
- 默认禁用所有动画（追求速度和稳定性）
- 只验证动画的起始态和终态
- 通过状态注入直接到达各个动画状态

**交互验证（L2）**：
- 提供动画等待选项（`waitForAnimations: boolean`）
- 支持 `prefers-reduced-motion` 模拟
- 关键交互动画：等待完成后再截图

**完整评测（L3）**：
- 可选的动画质量评估（通过 VLM 评估过渡效果平滑度）
- 支持关键帧捕获用于回归测试

---

## 4. 状态管理与可验证性

### 4.1 状态管理方案对比

不同的状态管理方案在"状态注入"（ui-fast-verify 的核心能力）和"测试友好性"上有显著差异。

| 方案 | 状态注入方式 | 注入难度 | 测试友好性 | 适用场景 |
|------|-----------|---------|-----------|---------|
| Redux / RTK | `preloadedState` 参数 | 低 | 极好（纯函数 reducer） | 大型应用、严格模式 |
| Zustand | `store.setState()` | 低 | 很好（直接设置） | 简单应用、最小样板 |
| Jotai | `store.set(atom, value)` | 低 | 很好（原子隔离测试） | 细粒度更新、派生状态 |
| useState | Props / 默认值 | 中 | 好（需通过 Props 控制） | 组件级简单状态 |
| useReducer | `initialState` 参数 | 低 | 极好（纯 reducer 可独立测试） | 组件级复杂状态 |
| React Router | `MemoryRouter initialEntries` | 低 | 好 | URL/路由状态 |
| React Hook Form | `defaultValues` | 低 | 很好 | 表单 |
| XState | Machine context + 初始状态 | 低 | 极好（状态机可单独验证） | 复杂状态转换 |

### 4.2 状态注入模式

**Redux**：

```typescript
const store = configureStore({
  reducer: rootReducer,
  preloadedState: {
    user: { name: 'John', loggedIn: true },
    cart: { items: [{ id: 1, name: 'Product', price: 29.99 }] }
  }
});

render(<Provider store={store}><App /></Provider>);
```

**Zustand**：

```typescript
// 无需 Provider，直接设置状态
useStore.setState({
  user: { name: 'John', loggedIn: true },
  cart: { items: [{ id: 1, name: 'Product', price: 29.99 }] }
});

render(<App />);
```

**Jotai**：

```typescript
const store = createStore();
store.set(userAtom, { name: 'John', loggedIn: true });
store.set(cartAtom, { items: [{ id: 1, name: 'Product', price: 29.99 }] });

render(<Provider store={store}><App /></Provider>);
```

**URL/路由状态**：

```typescript
render(
  <MemoryRouter initialEntries={['/products/123?sort=price&filter=electronics']}>
    <App />
  </MemoryRouter>
);
```

**表单状态（React Hook Form）**：

```typescript
function TestWrapper() {
  const methods = useForm({
    defaultValues: {
      email: 'test@example.com',
      password: 'password123',
      errors: {}
    }
  });
  return <FormProvider {...methods}><MyForm /></FormProvider>;
}
```

### 4.3 状态可序列化性

状态注入的前提是状态可以被序列化为 JSON。不可序列化的类型需要特殊处理：

| 类型 | 可序列化 | 处理策略 |
|------|---------|---------|
| 基础类型（string, number, boolean） | ✅ | 直接序列化 |
| 普通对象/数组 | ✅ | 直接序列化 |
| Date | ⚠️ | 转为 ISO 字符串，运行时还原 |
| 函数（事件处理器、回调） | ❌ | 提供 mock/noop 函数 |
| React Refs | ❌ | 初始化为 `{ current: null }` |
| Symbol | ❌ | 忽略或替换为标识字符串 |
| 循环引用 | ❌ | 需要检测并断开 |
| DOM 节点 | ❌ | 无法注入，需要在渲染后获取 |
| Promise / Observable | ❌ | 用 resolved 值替代 |
| Class 实例 | ⚠️ | 转为 plain object，丢失方法 |

**序列化策略**：

```typescript
interface StateSnapshot {
  // 可直接序列化的状态
  serializable: Record<string, unknown>;

  // 需要 mock 的部分
  mocks: {
    functions: Record<string, 'noop' | 'console.log' | string>;
    refs: Record<string, any>;
  };

  // 上下文注入
  contexts: Array<{
    provider: string;    // Provider 组件路径
    value: unknown;      // 可序列化的 context value
  }>;

  // 路由状态
  route?: {
    path: string;
    params?: Record<string, string>;
    search?: string;
  };
}
```

### 4.4 状态变化 → UI 变化的映射

理解状态到 UI 的映射关系对验证至关重要：

```
状态变化
  │
  ├─ 直接映射：state.visible → element.style.display
  │   → 验证策略：检查 DOM 属性/CSS
  │
  ├─ 条件渲染：state.isLoggedIn → <Dashboard /> | <LoginPage />
  │   → 验证策略：检查组件是否存在
  │
  ├─ 列表渲染：state.items → items.map(item => <ListItem />)
  │   → 验证策略：检查列表项数量和内容
  │
  ├─ 异步更新：state.loading → skeleton → content
  │   → 验证策略：中间状态检查点
  │
  └─ 动画触发：state.expanded → CSS transition
      → 验证策略：等待动画完成或跳过
```

---

## 5. 快速验证 vs 完整评测中的交互处理

### 5.1 ui-fast-verify（L1 层 + 轻量交互）

**核心原则**：用状态注入跳过大部分交互，但支持基础交互验证。

**MVP 交互支持范围**：

| 交互类型 | 支持 | 实现方式 |
|---------|------|---------|
| 纯展示渲染 | ✅ | 状态注入 → 截图 |
| 点击按钮 → 状态变化 | ✅ | Playwright click → 等待 → 截图 |
| 输入文本 → 实时验证 | ✅ | Playwright type → 等待 → 截图 |
| 悬停效果 | ✅ | Playwright hover → 截图 |
| 下拉菜单展开 | ✅ | click → 等待 DOM 稳定 → 截图 |
| 多步表单流程 | ⚠️ 部分 | 各步骤状态注入，不通过操作流转 |
| 拖拽交互 | ❌ | 太复杂，留给 L2 |
| 无限滚动 | ❌ | 需要真实数据流，留给 L2/L3 |

**轻量交互的 API 设计**：

```typescript
interface RenderRequest {
  component: { path: string; exportName?: string };
  state: {
    props?: Record<string, unknown>;
    contexts?: Array<{ provider: string; value: unknown }>;
  };

  // 新增：轻量交互
  interactions?: Array<{
    type: 'click' | 'type' | 'hover' | 'select';
    target: string;   // CSS 选择器或文本内容
    value?: string;    // type 和 select 需要
    wait?: number;     // 交互后等待时间（ms），默认 300
  }>;

  output: {
    screenshot?: boolean;
    dom?: boolean;
    // 新增：每个交互步骤后都截图
    screenshotAfterEachInteraction?: boolean;
  };
}
```

**示例请求**：

```json
{
  "component": { "path": "src/components/SearchForm.tsx" },
  "state": {
    "props": { "placeholder": "搜索商品..." }
  },
  "interactions": [
    { "type": "click", "target": "input[type=text]" },
    { "type": "type", "target": "input[type=text]", "value": "iPhone" },
    { "type": "click", "target": "button[type=submit]" }
  ],
  "output": {
    "screenshot": true,
    "screenshotAfterEachInteraction": true
  }
}
```

**响应**：

```json
{
  "screenshots": [
    { "step": "initial", "image": "base64...", "timestamp": 1234567890 },
    { "step": "after-click-input", "image": "base64...", "timestamp": 1234567891 },
    { "step": "after-type-iPhone", "image": "base64...", "timestamp": 1234567892 },
    { "step": "after-click-submit", "image": "base64...", "timestamp": 1234567893 }
  ],
  "dom": "...",
  "errors": [],
  "metrics": { "totalTime": 1250 }
}
```

### 5.2 完整交互验证（L2 层）

**L2 层关注真实的交互序列和状态转换验证**：

```typescript
interface InteractionVerificationRequest {
  target: { type: 'component' | 'page'; path: string };

  // 交互场景定义
  scenario: {
    name: string;
    description: string;

    // 完整交互序列
    steps: Array<{
      action: {
        type: 'click' | 'type' | 'hover' | 'select' | 'scroll' | 'drag' | 'keyboard';
        target: string;
        value?: string;
        modifiers?: ('Shift' | 'Control' | 'Alt')[];
      };

      // 步骤后的验证
      assertions?: Array<{
        type: 'element-visible' | 'element-hidden' | 'text-content' | 'css-property' | 'screenshot';
        target?: string;
        expected?: string;
      }>;

      // 状态检查点
      checkpoint?: VerificationCheckpoint;
    }>;
  };
}
```

### 5.3 E2E 评测（L3 层）

**终态 vs 中间状态的平衡**：

E2E 评测**不应只检查终态**，但也不需要验证每一帧。推荐策略：

```
定义关键检查点（Critical Checkpoints）
  ├─ 对应用户旅程的关键节点
  ├─ 例如：登录成功、商品加入购物车、支付完成
  └─ 每个检查点：截图 + DOM 快照 + 状态断言

忽略非关键中间状态
  ├─ 加载动画的具体帧
  ├─ 页面滚动的中间位置
  └─ 与功能无关的视觉变化
```

**评分维度**：

```typescript
interface E2EEvaluationResult {
  // 终态正确性
  finalStateCorrect: boolean;

  // 关键检查点通过率
  checkpointCompletionRate: number;  // 0-1

  // 功能正确性评分
  functionalScore: number;  // 0-1

  // 路径效率（最优步骤数 / 实际步骤数）
  pathEfficiency: number;  // 0-1

  // 详细检查点结果
  checkpoints: CheckpointResult[];
}
```

---

## 6. 本项目的设计建议

### 6.1 交互状态的分层处理

```
Layer 0: 静态分析
  └─ 无交互，检查代码质量

Layer 1: 快照渲染 + 轻量交互（ui-fast-verify）
  ├─ 状态注入 → 渲染 → 截图（核心）
  ├─ 基础交互（click, type, hover）→ 截图（新增）
  └─ 目标：<2s 首次渲染，交互响应 <1s

Layer 2: 交互验证
  ├─ 完整交互序列执行
  ├─ 中间状态检查点
  ├─ 状态转换断言
  └─ 目标：单场景 <5s

Layer 3: E2E 评测
  ├─ 完整应用启动
  ├─ 多页面导航
  ├─ 关键路径检查点
  └─ 目标：按需，无严格时间限制
```

### 6.2 推荐实现优先级

1. **Phase 1 MVP（当前）**：
   - 状态注入渲染（已规划）
   - **新增**：基础交互支持（click, type, hover）
   - **新增**：交互后截图能力
   - 默认禁用动画

2. **Phase 2-3（框架模块）**：
   - 中间状态检查点机制
   - 动画等待策略
   - DOM diff（交互前后对比）

3. **Phase 4+（高级功能）**：
   - XState 状态机集成（从定义中自动生成验证场景）
   - VLM 评估交互效果
   - 部分进度评分

### 6.3 关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 动画处理 | 默认禁用，可配置等待 | 追求速度和稳定性 |
| 状态注入 vs 操作到达 | 优先状态注入，操作为补充 | 更快、更确定性 |
| 中间状态检查 | 仅在 L2+ 支持 | L1 追求速度，不做中间检查 |
| 状态管理兼容 | 支持 Redux/Zustand/Jotai/原生 | 覆盖主流方案 |
| 交互范围（MVP） | click, type, hover, select | 覆盖 80% 常见交互 |

---

## 7. 开放问题

| 问题 | 状态 | 影响阶段 |
|------|------|---------|
| 状态注入后事件处理器如何 mock | 需要实验 | Phase 1 |
| 异步状态（API 调用）如何在快照模式下处理 | 需要 MSW 集成方案 | Phase 1-2 |
| XState 状态机如何自动生成验证场景 | 可行但需设计接口 | Phase 4+ |
| 复杂动画（Framer Motion layout）的可靠截图时机 | 已有策略但需验证 | Phase 2 |
| 跨状态管理库的统一注入接口 | 需要适配器模式 | Phase 2 |
| 实时协作/WebSocket 驱动的状态变化如何验证 | 无成熟方案 | 长期 |

---

## 参考资料

### 工具与框架
- XState: https://stately.ai/docs/xstate
- @xstate/test: https://stately.ai/docs/xstate-test
- Playwright Animations: https://playwright.dev/docs/screenshots#animations
- Framer Motion: https://www.framer.com/motion/
- React Transition Group: https://reactcommunity.org/react-transition-group/
- Storybook Interaction Testing: https://storybook.js.org/docs/writing-tests/interaction-testing

### 评测基准
- WorldGUI (2025): https://github.com/showlab/WorldGUI
- WebCanvas (2024): https://github.com/iMeanAI/WebCanvas — Mind2Web-Live, 2,439 intermediate evaluation states
- ShowUI (CVPR 2025): https://github.com/showlab/ShowUI — 2B 视觉-语言-动作模型
- GUI-Actor (Microsoft, NeurIPS 2025): https://github.com/microsoft/GUI-Actor — 无坐标视觉定位

### 论文
- Harel, D. (1987). Statecharts: A Visual Formalism for Complex Systems
- Model-Based Testing in React with State Machines (CSS-Tricks)
- WorldGUI: An Interactive Benchmark for Desktop GUI Automation (2025)
- WebCanvas: Benchmarking Web Agents in Online Environments (2024)
- ShowUI: One Vision-Language-Action Model for GUI Visual Agent (CVPR 2025)
- GUI-Actor: Coordinate-Free Visual Grounding for GUI Agents (NeurIPS 2025)
- UI-TARS: Pioneering Automated GUI Interaction with Native Agents (ByteDance, 2025) — https://arxiv.org/abs/2501.12326
- UI-TARS-2: Advancing GUI Agent with Multi-Turn Reinforcement Learning (ByteDance, 2025) — https://arxiv.org/abs/2509.02544

### Agent 框架
- Agent TARS: https://agent-tars.com/ — DOM/VLM/Hybrid 三模式，dropdown 专项处理
- Agent TARS Beta Blog: https://agent-tars.com/blog/2025-06-25-introducing-agent-tars-beta — Context Engineering, Snapshot Framework
- UI-TARS-desktop: https://github.com/bytedance/UI-TARS-desktop — browser-use 实现源码

### 状态管理
- Redux Toolkit: https://redux-toolkit.js.org/
- Zustand: https://zustand.docs.pmnd.rs/
- Jotai: https://jotai.org/
- React Hook Form: https://react-hook-form.com/
