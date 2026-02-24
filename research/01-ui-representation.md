# UI 表示与建模：让机器理解界面

## 核心问题

AI agent 要验证、操作或评估 UI，首先需要「看到」UI。但 UI 的表示形式直接决定了 agent 的能力边界：用什么数据、什么格式、什么粒度来向 AI 描述一个界面？

本文调研了三种主要的 UI 表示方法，分析了各自的优劣和适用场景，并给出实践建议。

---

## 1. 三种表示范式

### 1.1 结构化表示（DOM / Accessibility Tree）

**DOM Tree**：浏览器的原始数据结构，包含所有 HTML 元素、属性、嵌套关系。

**问题**：现代网页的 raw DOM 通常有 2,000-10,000+ 个节点，充斥着 styling wrappers、tracking scripts、SVG paths 等噪音。直接给 LLM 消费不现实（token 成本过高，信噪比极低）。

**Accessibility Tree（无障碍树）**：浏览器为屏幕阅读器构建的语义化 UI 树。它是目前最推荐的结构化 UI 表示。

核心优势：
- **语义化**：节点有明确的 role（button, link, textbox, heading 等），正是 agent 需要的词汇
- **紧凑**：自动过滤纯视觉元素（装饰性 div、样式容器），只保留功能性元素
- **状态感知**：包含 `checked`, `expanded`, `selected`, `focused`, `disabled` 等交互状态
- **名称计算**：自动解析 label、aria-label、alt text 为统一的 "name" 属性

局限性：
- 依赖页面的无障碍标注质量——`<div>` 堆砌的现代框架页面可能产生稀疏/无用的树
- 不包含空间布局信息（元素位置、大小）
- Canvas/WebGL 内容完全不透明
- Shadow DOM（Web Components）部分不透明

**实证数据**：在基准测试中，使用无障碍数据的 AI agent 任务成功率约 **85%**，仅靠视觉理解的约 **50%**。这是结构化表示最有力的论据。

### 1.2 视觉表示（Screenshots）

截图是最直觉的 UI 表示——人类就是这样看界面的。

**优势**：
- 捕获 DOM 无法表达的视觉信息：颜色、间距、字体渲染、图片内容、阴影效果
- 对任何 GUI 应用通用（不限浏览器）
- 不依赖页面的标注质量

**劣势**：
- Token 消耗高（一张截图 ~1000+ tokens）
- 丢失结构信息（哪些元素可交互、当前状态等）
- 分辨率影响理解能力——CogAgent 的成功部分归因于 1120x1120 的高分辨率输入

**Set-of-Mark (SoM) 标注**：Yang et al. (2023) 提出的方法——在截图上叠加编号标记（彩色边框 + 数字标签），让 VLM 通过编号引用元素。被 WebVoyager、SeeAct、OmniACT 等系统采用。

权衡：标注在密集 UI 上会重叠遮挡内容；增加渲染成本；消耗更多 token。**最佳实践是作为文本元素列表的补充**，而非唯一表示。

### 1.3 混合表示（Hybrid）

**经验结论**：混合表示在几乎所有主要基准上都优于单一模态。

| 基准测试 | 结论 |
|----------|------|
| Mind2Web (NeurIPS 2023) | 简化 DOM + 候选元素 > 仅截图 |
| WebArena (ICLR 2024) | 无障碍树 + 截图 > 任一单独 |
| ScreenSpot | 混合 > 纯视觉 > 纯文本 |

SeeAct (OSU NLP, 2024) 的关键发现：GPT-4V 纯视觉方式**漏掉 ~30%** 的元素（DOM 能捕获），但**捕获 ~15%** DOM 遗漏的元素。两者互补。

---

## 2. DOM 简化方法

每个成功的 UI agent 系统都会对 DOM 做积极裁剪。核心技术：

### 2.1 属性裁剪
移除 `class`、`style`、`data-*`、事件处理器。只保留语义属性：`role`、`aria-*`、`href`、`alt`、`type`、`name`、`value`。仅此一步即可减少 **80-90%** 的 token。

### 2.2 子树移除
删除 `<script>`、`<style>`、`<noscript>`、隐藏元素（`display:none`、`aria-hidden="true"`）、零尺寸元素。

### 2.3 结构扁平化
合并单子节点的 wrapper `<div>`（不添加语义的）。合并相邻文本节点。

### 2.4 元素索引（最有效的 action-grounding 格式）

为交互元素分配编号，以扁平列表呈现：

```
[0] <input type="text" placeholder="Search...">
[1] <button>Submit</button>
[2] <a href="/about">About Us</a>
```

LLM 看到编号列表后输出 `click(1)` 或 `type(0, "query")`。这是 browser-use、WebArena、Vercel agent-browser 等系统的标准做法。有效因为 LLM 擅长引用编号项。

---

## 3. 浏览器 API：提取 UI 信息

### 3.1 Chrome DevTools Protocol (CDP)

CDP 是最强大的 UI 信息提取接口：

**DOM 域**：
```
DOM.getDocument()           → 根 DOM 节点
DOM.getBoxModel()           → content/padding/border/margin 盒模型
DOM.querySelectorAll()      → CSS 选择器搜索
DOM.getOuterHTML()          → 子树完整 HTML
```

**CSS 域**：
```
CSS.getComputedStyleForNode()  → 所有计算后 CSS 属性
CSS.getMatchedStylesForNode()  → 匹配的 CSS 规则
```

**Accessibility 域**：
```
Accessibility.getFullAXTree()       → 完整无障碍树
Accessibility.getPartialAXTree()    → 子树
Accessibility.queryAXTree()         → 按 role/name 搜索
```
每个 AX 节点包含：role, name, value, description, properties (checked, expanded 等), bounding box, backendDOMNodeId（映射到 DOM）。

**Page 域**：
```
Page.captureScreenshot()    → 视口或整页截图（PNG/JPEG）
Page.getLayoutMetrics()     → 视口和内容尺寸
```

**LayerTree 域**：
```
LayerTree.compositingReasons()  → 合成层原因（理解 z-index、重叠）
```

### 3.2 Playwright 的无障碍树 API

**`page.accessibility.snapshot()`**：返回递归树结构
```javascript
const snapshot = await page.accessibility.snapshot();
// { role: 'WebArea', name: 'Page Title', children: [
//   { role: 'navigation', name: 'Main Nav', children: [...] },
//   { role: 'main', children: [
//     { role: 'heading', name: 'Welcome', level: 1 },
//     { role: 'textbox', name: 'Email', focused: true },
//     { role: 'button', name: 'Submit' }
//   ]}
// ]}
```

选项：
- `interestingOnly: true`（默认）——仅语义有意义的节点（交互、地标、标题），树更小
- `interestingOnly: false`——所有节点，包括静态文本，更完整但更大
- `root: elementHandle`——仅快照子树

**`page.locator(...).ariaSnapshot()`**（较新版本）：返回 YAML 风格文本表示，适合直接作为 LLM 输入：
```
- navigation "Main Nav":
  - link "Home"
  - link "Products"
- main:
  - heading "Welcome" [level=1]
  - textbox "Email" [focused]
  - button "Submit"
```

### 3.3 获取「视觉结构」（而非仅 DOM 结构）

视觉结构与 DOM 的关键差异：
- `position: absolute/fixed` 脱离文档流
- Flexbox/Grid 可能改变视觉顺序（与 DOM 顺序不同）
- `opacity: 0`, `visibility: hidden`, `clip-path` 隐藏元素
- `::before`, `::after` 伪元素有视觉表现但不在 DOM 中
- Shadow DOM 封装的子树

**推荐方案：无障碍树 + 边界框**

结合 `Accessibility.getFullAXTree()` 和 bounding box 数据，一次性获得：
- 语义信息（roles, names）
- 空间位置（x, y, width, height）
- 交互状态（focusable, clickable）

```javascript
// Playwright 中结合无障碍信息和空间位置
const elements = await page.$$('[role], a, button, input, select, textarea');
for (const el of elements) {
  const box = await el.boundingBox();
  const name = await el.getAttribute('aria-label') || await el.innerText();
  const role = await el.getAttribute('role') || await el.evaluate(e => e.tagName);
  // { role, name, box: { x, y, width, height } }
}
```

---

## 4. 关键模型与研究

### 4.1 UI 理解基础模型

| 模型 | 来源 | 年份 | 核心创新 |
|------|------|------|---------|
| UIBert | Google | 2021 | 多模态预训练（截图 + view hierarchy），证明视觉+结构结合显著优于单一模态 |
| Screen2Words | Google | 2021 | 移动屏幕的自然语言摘要，112K screen-summary pairs |
| Pix2Struct | Google | 2023 | 预训练将截图转回简化 HTML，证明视觉→结构转换可学习 |
| ScreenAI | Google | 2024 | 统一 UI 理解架构：QA、摘要、导航、元素定位 |
| Ferret-UI | Apple | 2024 | 「任意分辨率」方法，将高分辨率截图切分为子图像，精细理解小 UI 元素 |
| CogAgent | 清华/智谱 | 2024 | 18B VLM，双分辨率架构（低分辨率看布局 + 高分辨率看文字细节） |
| SeeClick | | 2024 | GUI visual grounding 作为瓶颈；预训练数据显著提升下游 agent 性能 |

### 4.2 Web UI Agent 系统

| 系统 | 核心方法 | UI 表示 |
|------|---------|---------|
| WebAgent (DeepMind, 2023) | 任务分解 + HTML 简化 | 简化 DOM |
| SeeAct (OSU NLP, 2024) | GPT-4V + SoM | 标注截图 + 文本元素信息 |
| WebVoyager (2024) | 端到端 GPT-4V agent | SoM 标注截图 |
| Agent-E (2024) | 层级架构 + DOMDistiller | 语义化简化 DOM |
| OS-Atlas (2024) | 跨平台基础动作模型 | Web + 移动 + 桌面 |

### 4.3 新兴标准

**Google A2UI (2025.12)**：Agent-to-User Interface 开放标准。agent 输出 JSON 描述 UI 组件树，客户端用原生组件渲染。声明式数据（非代码），安全且框架无关。当前 v0.8 公开预览。

**Vercel agent-browser**：「Snapshot + Refs」系统。不发送完整的无障碍树，而是提供每个交互元素一个短引用 ID（@e1, @e2）。上下文使用减少 **93%**（~1,400 tokens vs ~7,800 tokens/Playwright MCP）。

---

## 5. 实践建议

### 5.1 推荐的 UI 表示架构

```
提取层:
├── Playwright page.accessibility.snapshot() → 无障碍树
├── element.boundingBox() → 空间信息
├── page.screenshot() → 视觉截图
└── 可选: CDP Accessibility.getFullAXTree() → 完整细节

表示层:
├── 主要: 编号元素列表（来自无障碍树 + bbox）
│   格式: [id] role "name" (x,y,w,h) {states}
├── 辅助: SoM 标注截图（在元素位置叠加编号）
└── 可选: 简化 DOM 子树（需要更多上下文时）

消费层:
├── 纯文本 LLM: 编号列表 + 任务描述
├── 多模态 LLM: 标注截图 + 编号列表
└── 动作输出: "click(5)" 或 "type(3, 'hello')"
```

### 5.2 方法对比

| 方法 | 优势 | 劣势 | 最佳用途 |
|------|------|------|---------|
| Raw DOM | 信息完整 | 太大、噪音多 | 不直接使用 |
| 简化 DOM | 保留结构 | 仍然冗长，需要好的裁剪 | 复杂页面分析 |
| 无障碍树 | 语义化、紧凑 | 依赖页面质量 | 通用首选 |
| 编号元素列表 | LLM 友好、动作导向 | 丢失层级上下文 | 动作选择 |
| 纯截图 | 任何 GUI 通用 | 丢失隐藏信息，token 昂贵 | 通用 GUI 任务 |
| SoM 标注截图 | 视觉 + 引用 | 密集 UI 问题 | 视觉定位 |
| 混合（无障碍树 + 截图） | 最高准确率 | 更复杂、更多 token | 生产环境 agent |

### 5.3 开放挑战

1. **动态内容**：无限滚动、懒加载、动画——难以捕获稳定「状态」
2. **Shadow DOM / Web Components**：对标准提取方法部分不透明
3. **Canvas/WebGL**：对 DOM/无障碍提取完全不透明
4. **规模**：超长页面（数百交互元素）超出上下文窗口
5. **跨平台一致性**：不同浏览器/平台生成不同的无障碍树
6. **iframe**：嵌套浏览上下文使提取复杂化
7. **实时性**：当前方法基于快照；流式 UI 状态是开放问题

---

## 6. 参考文献

### 基础论文
- Mind2Web (Deng et al., NeurIPS 2023)
- WebArena (Zhou et al., ICLR 2024)
- Pix2Struct (Lee et al., ICML 2023)
- ScreenAI (Baechler et al., 2024)
- Ferret-UI (You et al., 2024)
- CogAgent (Hong et al., 2024)
- SeeAct (Zheng et al., 2024)
- Set-of-Mark (Yang et al., 2023)
- WebVoyager (He et al., 2024)

### Agent 系统与工具
- browser-use: https://github.com/browser-use/browser-use
- playwright-mcp: Playwright MCP server
- Stagehand: https://github.com/browserbase/stagehand
- Vercel agent-browser: https://github.com/vercel-labs/agent-browser
- Skyvern: https://github.com/skyvern-ai/skyvern

### API 与协议
- Chrome DevTools Protocol: https://chromedevtools.github.io/devtools-protocol/
- Playwright Accessibility: https://playwright.dev/docs/accessibility-testing
- Google A2UI: https://a2ui.org/
- Accessibility Object Model: https://wicg.github.io/aom/

### 关键文章
- [Do Accessible Websites Really Perform Better for AI Agents?](https://www.accessibility.works/blog/do-accessible-websites-perform-better-for-ai-agents/)
- [Introducing A2UI](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/)
- [GUI Agent Research Landscape](https://github.com/showlab/Awesome-GUI-Agent)
- [Navigating the Digital World as Humans Do](https://arxiv.org/html/2410.05243v1)
