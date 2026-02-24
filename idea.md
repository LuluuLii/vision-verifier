1. 研究如何表示和建模界面 UI，让机器更好理解
2. 研究怎么让 agent 可靠的自动化操作 GUI 界面

希望达到的目标：
1. 实现一个 agent 可以自主验证 UI 效果和功能：
1.1 开发过程中验收单个模块，作为 agentic coding 的一环，实现自我验证和迭代更新，或在人机协作中提高开发效率，不让验证成为效率瓶颈 见 ./ui-fast-verify 的讨论
1.2 自动化评测一个 GUI 界面的质量，包括功能是否实现、界面元素布局位置是否合理（有无重叠、字体、间距等问题）、美学性
2. 实现可复用和解耦模块，例如 ui-extractor, ui-evaluator, ui-executor 等
3. 在这个过程中，我希望能学习和研究以下内容：
3.1 研究如何表示和建模界面 UI，让机器更好理解，比如 ui-state-graph, DOM tree，图像视觉等，有哪些研究
3.2 理解浏览器管线和api，从而理解实现浏览器自动化的要点，怎么在复杂操作和交互时，能精准达到和判断某个状态（比如精确获取某个状态的截图，而不是 loading 状态等）
3.3 前端复杂的状态管理、交互、接口权限等会对上述事情有挑战，页面不是静态的单页，而是复杂的应用。帮我明确下挑战和可能的路线。

学习自查问题清单参考：
level 1
- 浏览器如何从 HTML 到像素？
- Layout / Paint / Composite 区别？
- 重排 vs 重绘？
level 2
- 为什么某些 UI 截图识别不稳定？
- 为什么模型无法判断 spacing？
- 如何从 DOM 推断视觉结构？
- 如何用 CDP 获取 layout 信息？
- playwright 自动化测试如何处理登陆和跨域问题？
 Level 3
- 如何构建 UI 的结构化表示？
- 如何把 UI 转成 Agent 可理解的 state graph？
- 如何评估 UI 美学？
- 如何让 Agent 理解交互逻辑？

初步设想的 modules
#### 1️⃣ UI State Extractor（最重要）

功能：
- DOM tree
- accessibility tree
- layout info
- UI graph

关键词：
- structural UI representation


#### 2️⃣ Agent Planner

模式：
- ReAct
- Plan → Execute → Reflect

输出：

```json
[
  { "action": "click", "target": "login button" },
  { "action": "type", "value": "test@example.com" }
]
```


#### 3️⃣ Executor

工具：

- Playwright
- CDP


支持：

- click / type / scroll / navigate
- multi-step interaction

#### 4️⃣ Observer

采集：

- screenshots
    
- DOM diff
    
- performance trace
    

解决问题：

- 页面未加载完
    
- 多截图
    
- UI 状态变化
    

---

#### 5️⃣ Evaluator
评估维度：
- functional correctness
- UI aesthetics
- layout anomalies

---

## 调研文档索引

针对以上各模块和研究方向，已完成系统调研，详见 `research/` 目录：

| 文档 | 覆盖的目标/模块 | 核心发现 |
|------|----------------|---------|
| [01-ui-representation.md](./research/01-ui-representation.md) | 目标 3.1 + Module 1 (Extractor) | 无障碍树是最佳结构化表示（85% vs 50% 成功率）；混合表示（结构+视觉）在所有基准上最优；DOM 简化和元素索引是 LLM 消费的标准做法 |
| [02-browser-automation.md](./research/02-browser-automation.md) | 目标 3.2, 3.3 + Module 3 (Executor) + Module 4 (Observer) | Playwright 是最佳选择；截图稳定需要组合等待策略（网络+DOM+字体+动画）；认证用 storageState；观察/动作循环以无障碍树为主 |
| [03-ui-evaluation.md](./research/03-ui-evaluation.md) | 目标 1.2 + Module 5 (Evaluator) | VLM 适合粗过滤（~90%布局、~95%内容）但不可靠于精确间距（~30%）；程序化检查（axe-core、布局检测）是生产级方案；美学评分无生产工具 |
| [04-agent-architecture.md](./research/04-agent-architecture.md) | Module 2 (Planner) | 分层验证协调器模式：L0 静态 → L1 快照 → L2 交互 → L3 E2E；程序化优先，AI 为辅；结构化反馈支持自修复循环 |
| [05-framework-design.md](./research/05-framework-design.md) | 整体架构 | 模块化框架设计；ui-fast-verify 是特化快速管线；6 阶段实施路线图 |
| [06-interaction-state.md](./research/06-interaction-state.md) | 目标 3.3 + Module 2, 3, 4 | XState 状态机建模 + 模型化测试；中间状态验证（WorldGUI/WebCanvas）；动画处理策略；状态管理可测试性对比；ui-fast-verify 轻量交互设计 |

### ui-fast-verify 的定位

`ui-fast-verify`（见 [./ui-fast-verify](./ui-fast-verify/)）是整体框架中的**特化快速管线**，对应目标 1.1：
- 跳过 Executor（状态注入代替浏览器操作）
- 简化 Observer（基础截图和 DOM 输出）
- 使用 Evaluator 子集（错误捕获、可选 VLM 评估）
- 支持轻量交互验证（click, type, hover）
- 面向开发体验的极速反馈（目标 <500ms）

是框架实现的起点（Phase 1），验证核心假设后逐步扩展到完整框架。
