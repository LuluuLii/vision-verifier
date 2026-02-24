# 浏览器自动化：AI Agent 的操作层

## 核心问题

UI 验证和 agent 操作都需要浏览器自动化能力。关键挑战不在于「能不能操作」，而在于：
1. 操作的**可靠性**（如何确保点击到了正确的元素、页面已稳定）
2. 观察的**效率**（如何用最少 token 获取足够信息）
3. 复杂场景的**鲁棒性**（认证、SPA、动态内容、iframe）

---

## 1. 自动化框架对比

### 1.1 Playwright（推荐）

Playwright 是 AI agent 场景的最佳选择：

| 特性 | 对 Agent 的意义 |
|------|----------------|
| **Auto-wait** | 每个动作自动等待元素可操作（可见、启用、稳定），agent 不需要自行管理时序 |
| **无障碍树快照** | `page.accessibility.snapshot()` 提供最 token 高效的页面表示 |
| **多浏览器** | 同一 API 支持 Chromium、Firefox、WebKit |
| **CDP 访问** | `page.context().newCDPSession(page)` 需要低级控制时可用 |
| **请求拦截** | `page.route()` 用于认证注入、API mock |
| **storage state** | 保存/恢复认证状态 |

### 1.2 Puppeteer

- 仅 Chromium
- 无 auto-wait（需手动管理时序 = 脆弱性）
- CDP 原生访问更直接
- **适用场景**：需要原始 CDP 控制的特殊用例

### 1.3 CDP 直接

- 最大控制力（DOM 变更、网络事件、性能、无障碍 API 全部可用）
- 需要大量模板代码
- 跨浏览器版本不稳定
- **适用场景**：需要 Playwright 不暴露的特定 CDP 域功能

---

## 2. AI Browser Agent 工具生态

### 2.1 browser-use（Python）

开源 Python 库，Playwright Python bindings 之上构建。

**UI 表示方法**：
- DOM 提取 + 简化（移除 script/style/隐藏元素）
- 为交互元素分配数字索引
- 以编号列表呈现给 LLM：
  ```
  [0] <input type="text" placeholder="Search...">
  [1] <button>Search</button>
  [2] <a href="/products">Products</a>
  ```
- 可选截图（多模态模型时使用）
- LLM 输出：`click(1)` 或 `type(0, "query")`

**设计要点**：过滤至仅可见/可交互元素，计算边界框过滤屏幕外元素，截断过长文本内容，支持元素列表分页。

### 2.2 Stagehand（Browserbase）

SDK 提供三个核心 API + 自然语言：

```typescript
await stagehand.act("click the login button");
const data = await stagehand.extract({
  instruction: "extract product name and price",
  schema: z.object({ name: z.string(), price: z.number() })
});
const elements = await stagehand.observe("find all add-to-cart buttons");
```

**v3 关键更新（2025）**：
- 移除 Playwright 依赖，引入模块化 driver 系统（也支持 Puppeteer/CDP）
- AI-native 重构，完成速度比 v2 快 44%+
- 支持 Computer Use Agent (CUA) 模式，兼容 Google/OpenAI/Anthropic 的 computer use 模型

**两阶段 `act` 方法**：(1) Observe 阶段识别候选元素，(2) Action 阶段选择最佳元素执行。减少幻觉。

### 2.3 playwright-mcp（Microsoft）

MCP server，将 Playwright 暴露为 LLM 工具。

**两种模式**：
- **Snapshot 模式（默认，推荐）**：返回无障碍树 + 稳定 ref ID
  ```
  - heading "Welcome to Example" [ref=1]
  - textbox "Email" [ref=2]
  - button "Sign In" [ref=4]
  ```
  AI 说 `browser_click(ref=4)`。ref 在页面加载期间稳定，捕获语义信息。

- **Vision 模式**：使用截图。适合视觉复杂页面，token 更多。

**可用工具**：`browser_navigate`, `browser_screenshot`, `browser_click`, `browser_type`, `browser_snapshot`, `browser_evaluate`, `browser_tab_*`, `browser_press`, `browser_drag` 等。

### 2.4 Vercel agent-browser

**核心创新：Snapshot + Refs 系统**

不发送完整无障碍树，而是提供压缩的交互元素列表，每个元素一个短引用 ID（@e1, @e2）。

- 上下文使用减少 **93%**
- 6 个测试：Playwright MCP ~31K 字符 (~7,800 tokens) vs agent-browser ~5.5K 字符 (~1,400 tokens)
- AI agent 在同等上下文预算下可执行 **5.7x** 更多测试
- 语义定位器（semantic locators）：按用途（role + label）而非 CSS 选择器查找元素

**架构**：三层——Rust CLI（<50ms 启动）→ Node.js 常驻守护进程（Playwright 管理）→ 后备 Node.js 模式

### 2.5 Agent TARS / UI-TARS（ByteDance）

字节跳动的 GUI agent 体系，包含模型（UI-TARS）和 agent 框架（Agent TARS），提供了 **DOM / VLM / Hybrid 三种浏览器控制模式** 的生产级实践。

**三种控制模式对比**：

| 模式 | 原理 | 优势 | 劣势 |
|------|------|------|------|
| **DOM** | JS 解析 DOM，提取交互元素并编号 | 无需视觉能力，纯文本 LLM 可用 | LLM 看不到屏幕时操作路径复杂，**视觉任务直接失败** |
| **Visual Grounding** | VLM 看截图，输出坐标+动作 | 理解视觉布局，框架无关，能处理 Canvas/CSS | 需截图处理时间，实时性较弱 |
| **Hybrid** | Prompt Engineering 协调两种模式 | DOM 先试 → VLM 兜底，容错更好 | 实际性能接近 VLM，增加复杂度 |

VLM 模式的动作格式：
```
click(point='<point>383 502</point>')   # 点击坐标
type(content='W9H5K')                   # 输入文本
```

**Dropdown 专项处理**：

Agent TARS 的 browser-use 包为原生下拉菜单提供了**专门的 action**，因为 VLM 看截图无法看到 `<select>` 的选项列表（原生渲染不在 DOM 视口中）：

```typescript
// 获取下拉选项——必须通过 DOM 操作，VLM 无法完成
async getDropdownOptions(index: number) {
  const elementHandle = await this.locateElement(element);
  const options = await elementHandle.evaluate((select) => {
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error('Element is not a select element');
    }
    return Array.from(select.options).map(option => ({
      index: option.index, text: option.text, value: option.value,
    }));
  });
  return options;
}

// 选择选项——通过文本匹配，手动触发 change/input 事件
async selectDropdownOption(index: number, text: string) {
  // 验证元素确实是 <select>
  // 按 text.trim() 匹配选项
  // 设置 value 后 dispatch change + input 事件
  // 选项未找到时返回所有可用选项列表供 LLM 重试
}
```

**启示**：Dropdown 是需要 **DOM 和 VLM 混合处理的典型案例**——VLM 可识别下拉组件，但选项获取和选择必须走 DOM。

**UI-TARS 模型的感知挑战**（来自论文 arXiv:2501.12326）：
- GUI 图像信息密度远超一般场景图像，常含数百个元素
- 小元素感知困难：1920×1080 截图中 10×10 像素图标难以精确定位
- 精细桌面定位只有 **<50-60%** 绝对性能
- 幻觉问题：模型思维链推理与实际动作之间存在 "hallucination gap"

**参考**：
- UI-TARS 论文：https://arxiv.org/abs/2501.12326
- UI-TARS-2 技术报告：https://arxiv.org/abs/2509.02544
- Agent TARS：https://agent-tars.com/
- GitHub：https://github.com/bytedance/UI-TARS-desktop

---

## 3. 截图稳定性

### 3.1 不稳定的来源

| 来源 | 现象 | 影响 |
|------|------|------|
| 字体加载 (FOUT) | 文本在 web font 加载后重渲染 | 截图中文本位置/大小变化 |
| 图片加载 | 图片渲染导致布局偏移 | 元素位置变化 |
| CSS 动画/过渡 | 元素处于动画中间状态 | 不确定的视觉状态 |
| Loading 状态 | 骨架屏、spinner | 截图到非最终状态 |
| 第三方内容 | 广告、聊天组件、cookie 横幅 | 不可预测的覆盖 |
| 光标闪烁 | 输入框光标 | 截图间差异 |
| 子像素渲染 | 不同平台/GPU 差异 | 像素级比较失败 |

### 3.2 生产级稳定等待策略

没有单一信号能表示「UI 已完成渲染」。需要组合多个信号：

```typescript
async function waitForStablePage(page: Page) {
  // 1. 网络空闲
  await page.waitForLoadState('networkidle').catch(() => {});

  // 2. 字体加载完成
  await page.waitForFunction(() => document.fonts.ready.then(() => true));

  // 3. 图片加载完成
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('img')).every(img => img.complete)
  );

  // 4. 无 loading 指示器
  await page.waitForFunction(() =>
    document.querySelectorAll(
      '[aria-busy="true"], .loading, .spinner, .skeleton'
    ).length === 0
  ).catch(() => {});

  // 5. 通过 prefers-reduced-motion 减少动画
  await page.emulateMedia({ reducedMotion: 'reduce' });

  // 6. 强制禁用所有动画/过渡
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      transition-duration: 0s !important;
    }`
  });

  // 7. DOM 变更稳定（无变更 300ms）
  await page.waitForFunction(() => {
    return new Promise(resolve => {
      let timeout;
      const observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(() => resolve(true), 300);
      });
      observer.observe(document.body, {
        childList: true, subtree: true, attributes: true, characterData: true
      });
      timeout = setTimeout(() => resolve(true), 300);
    });
  });

  // 8. 最终重绘等待
  await page.waitForTimeout(100);
}
```

### 3.3 Playwright 等待方法速查

| 方法 | 等待条件 |
|------|---------|
| `waitForLoadState('load')` | `window.onload`（所有资源） |
| `waitForLoadState('domcontentloaded')` | DOM 解析完成 |
| `waitForLoadState('networkidle')` | 500ms 无网络请求 |
| `waitForSelector(sel)` | 元素可见 |
| `waitForFunction(fn)` | 自定义 JS 返回 truthy |
| `waitForURL(pattern)` | URL 匹配 |
| `waitForResponse(pred)` | 匹配的响应已接收 |

---

## 4. 复杂场景处理

### 4.1 认证/登录

**推荐方案：预认证浏览器上下文**

```typescript
// 登录后保存状态
await context.storageState({ path: 'auth.json' });

// 后续使用时恢复
const context = await browser.newContext({ storageState: 'auth.json' });
```

其他方案：cookie 注入、请求拦截注入 auth header、OAuth 重定向拦截。

**关键**：预认证上下文完全避免 CAPTCHA 问题。

### 4.2 SPA 导航

SPA 不触发传统页面加载。解决方案：
- `page.waitForURL('**/dashboard')` — URL 变化
- `page.waitForResponse(resp => resp.url().includes('/api/data'))` — API 完成
- DOM 内容变化检测（`waitForFunction`）

**避免使用 `waitForNavigation()`**——在 SPA 中不可靠。

### 4.3 动态内容和 Loading 状态

链式等待策略：
1. 等待 loading 指示器消失：`waitForSelector('.spinner', { state: 'hidden' })`
2. 等待内容出现：`waitForSelector('[data-testid="results"]')`
3. 自定义稳定检查：`waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0)`

**注意**：WebSocket 连接、轮询、分析脚本可能阻止 `networkidle`。优先等待特定请求。

### 4.4 CORS 和跨域

- Playwright 通过 `frame.locator()` / `page.frameLocator()` 处理跨域 iframe
- `page.route()` 可拦截和修改请求
- 受控环境可用 `--disable-web-security`
- Service Workers 可能干扰——需要时通过 CDP 禁用

### 4.5 iframe 处理

```typescript
const frame = page.frameLocator('iframe#payment');
await frame.locator('#card-number').fill('4242...');
```

**关键问题**：默认的无障碍树可能不包含 iframe 内容——agent 需要显式遍历 iframe。

### 4.6 复杂状态管理

**实用建议**：AI agent **不应**直接操作应用状态。应通过 UI 交互（像真实用户）并观察结果。

直接状态访问仅用于：
- 设置测试前置条件
- 验证操作的预期状态效果
- 调试

```typescript
// 读取应用状态（如 Redux）
const state = await page.evaluate(() => window.__REDUX_STORE__?.getState());
```

---

## 5. 观察/动作循环模式

### 5.1 2025 年最佳实践

```
1. WAIT   — 等待稳定（网络 + DOM + 动画）
2. OBSERVE — 获取信息
   a. 无障碍树（主要——token 高效、语义化）
   b. 定向截图（辅助——视觉上下文）
   c. 页面元数据（URL、标题、console 错误）
3. COMPRESS — 压缩观察结果
   a. 仅视口范围或相关区域
   b. 移除噪音（广告、tracking 元素）
   c. 限制树深度
4. DECIDE — LLM 推理
   a. 分析观察
   b. 规划下一步动作
   c. 生成带元素引用的动作
5. ACT — 执行动作
   a. 元素 ref（来自无障碍树）——首选
   b. CSS 选择器——后备
   c. 坐标——最后手段
6. VERIFY — 验证结果
   a. 检查预期变化是否发生
   b. 检测错误（console 错误、HTTP 错误、页面错误信息）
   c. 如果意外状态，重新观察和规划
7. REPEAT — 直到任务完成或达到最大步数
```

### 5.2 Token 表示对比

| 方法 | Token 成本 | 空间信息 | 语义信息 | 代表系统 |
|------|-----------|---------|---------|---------|
| 完整截图 | 很高 | 优秀 | 需要视觉模型 | Claude computer use |
| 无障碍树 | 低 | 中等 | 优秀 | playwright-mcp |
| 简化 DOM + 索引 | 中等 | 差 | 好 | browser-use |
| 混合（a11y + 定向截图） | 中等 | 好 | 优秀 | 高级 agent |

**趋势明确：无障碍树作为主要机制，定向截图作为补充。**

---

## 6. Computer Use Agent（2024-2025）

### 6.1 Claude Computer Use (Anthropic)

- 纯截图 + 坐标交互
- 循环：截图 → Claude 视觉理解 → 动作（click x,y / type / scroll） → 截图 → 重复
- 适用于**任何**应用（不限浏览器）
- 高 token 消耗（~1000+ tokens/截图），每步都需要完整视觉推理

### 6.2 新兴混合方案

纯截图方法正在被增强：
1. **无障碍树增强**：同时发送截图和无障碍树
2. **SoM 标注**：在截图上标注编号，模型引用编号而非坐标
3. **结构化动作空间**：提供可能动作的枚举列表

---

## 7. 对本项目的建议

1. **使用 Playwright** 作为浏览器自动化层
2. **主要观察：无障碍树**——通过 `page.accessibility.snapshot()` 或 playwright-mcp 的 `browser_snapshot()`
3. **辅助观察：定向截图**——用于视觉验证任务
4. **截图稳定性**：实现组合等待策略（网络 + DOM + layout shift + 字体 + 禁用动画）
5. **认证**：使用 `storageState` 保存和恢复会话
6. **SPA 处理**：使用 `waitForURL()` + `waitForResponse()`
7. **Agent 循环**：从一开始就实现观察压缩、错误恢复、token 预算管理
8. **考虑 MCP 集成**：playwright-mcp 提供了与 LLM 协作的干净工具接口

---

## 参考资料

### 工具
- Playwright: https://playwright.dev/
- browser-use: https://github.com/browser-use/browser-use
- Stagehand: https://github.com/browserbase/stagehand / https://www.stagehand.dev/
- playwright-mcp: Playwright MCP Server
- Vercel agent-browser: https://github.com/vercel-labs/agent-browser
- Skyvern: https://github.com/skyvern-ai/skyvern
- Agent TARS: https://agent-tars.com/ / https://github.com/bytedance/UI-TARS-desktop
- UI-TARS: https://github.com/bytedance/UI-TARS

### 文章
- [Agent-Browser: AI-First Browser Automation That Saves 93% of Your Context Window](https://medium.com/@richardhightower/agent-browser-ai-first-browser-automation-that-saves-93-of-your-context-window-7a2c52562f8c)
- [Self-Verifying AI Agents: Vercel's Agent-Browser](https://www.pulumi.com/blog/self-verifying-ai-agents-vercels-agent-browser-in-the-ralph-wiggum-loop/)
- [Stagehand v3: The Fastest AI-Ready Automation Framework](https://www.browserbase.com/blog/stagehand-v3)
- [Why Stagehand Is Moving Beyond Playwright](https://www.browserbase.com/blog/stagehand-playwright-evolution-browser-automation)
