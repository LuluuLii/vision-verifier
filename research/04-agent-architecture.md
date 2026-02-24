# Agent 架构模式：UI 验证的智能编排

## 核心问题

UI 验证不是单一任务，而是多层决策：
- 需要什么级别的验证（静态分析？截图？交互？E2E？）
- 用什么表示（DOM？无障碍树？截图？）
- 如何判断结果（程序化断言？VLM 评估？）
- 失败后怎么办（重试？降级？报告？）

Agent 架构模式为这些决策提供组织框架。

---

## 1. 基础模式

### 1.1 ReAct (Observe → Reason → Act)

最简单的 agent 模式，由 Yao et al. (2023) 提出。

```
观察(Observe) → 推理(Reason) → 行动(Act) → 观察 → 推理 → 行动 → ...
```

**在 UI 验证中的应用**：
```
1. 观察：获取组件截图和 DOM
2. 推理：分析截图是否有布局问题
3. 行动：运行 axe-core 检查无障碍
4. 观察：获取 axe-core 结果
5. 推理：综合视觉和程序化检查结果
6. 行动：输出验证报告
```

**优势**：简单、通用、易于实现和调试。
**劣势**：线性执行，不擅长多步规划和回溯。

### 1.2 Plan-Execute-Reflect

更结构化的三阶段循环：

```
规划(Plan) → 执行(Execute) → 反思(Reflect) → 调整规划 → ...
```

**在 UI 验证中的应用**：
```
1. 规划：分析组件类型和验证需求
   - 这是表单组件 → 需要交互验证
   - 有多种状态 → 需要状态快照测试
   - 有样式变化 → 需要视觉回归

2. 执行：按计划运行验证
   - 渲染空表单状态 → 截图
   - 渲染填充状态 → 截图
   - 模拟提交交互 → 检查结果
   - 运行 axe-core

3. 反思：评估结果，决定下一步
   - 表单验证错误未显示 → 需要更多状态测试
   - 无障碍问题发现 → 标记并继续
   - 所有通过 → 输出最终报告
```

**优势**：更高效（规划避免无用动作），可处理复杂多步验证。
**劣势**：规划本身有成本（LLM 调用），规划可能不准确。

### 1.3 层级架构（Hierarchical）

将复杂任务分解为子任务，由专家处理：

```
协调器(Orchestrator)
├── 静态分析专家 → TypeScript 检查、ESLint
├── 渲染验证专家 → 状态注入、截图、DOM
├── 交互验证专家 → 模拟用户操作、断言
├── 视觉评估专家 → 布局检查、VLM 评估
└── 报告生成器 → 汇总结果、生成报告
```

**优势**：分工明确、可并行、每个专家可独立优化。
**劣势**：架构复杂度高，需要定义好模块间通信。

---

## 2. UI 验证的专用模式

### 2.1 分层验证协调器

核心思想：**不是所有验证都需要同样的深度**。

```
验证请求 → 协调器判断需要哪些层级
  │
  ├─ Layer 0: 静态分析 (<100ms)
  │  ├─ TypeScript 类型检查
  │  ├─ ESLint 规则
  │  └─ Props 类型匹配
  │
  ├─ Layer 1: 状态快照渲染 (<500ms)
  │  ├─ 组件隔离渲染
  │  ├─ Props/Context 注入
  │  ├─ 截图 + DOM 输出
  │  └─ 程序化布局检查
  │
  ├─ Layer 2: 轻量交互验证 (1-3s)
  │  ├─ 点击、输入、悬停
  │  ├─ 状态变化断言
  │  └─ 表单提交流程
  │
  └─ Layer 3: 端到端流程 (10s+)
     ├─ 完整应用启动
     ├─ 多页面导航
     └─ 集成测试
```

**层级选择逻辑**：

| 变更类型 | 建议层级 |
|----------|---------|
| 样式修改 | L0 + L1 |
| 新组件（纯展示） | L0 + L1 |
| 新组件（有交互） | L0 + L1 + L2 |
| 表单逻辑变更 | L0 + L2 |
| 路由/导航变更 | L0 + L3 |
| 全局状态变更 | L0 + L1 + L2 + L3 |

大多数验证应在 **L0-L1** 完成。L2 用于交互组件。L3 仅用于关键路径。

### 2.2 验证结果反馈循环

```
AI 生成代码
    │
    ▼
验证协调器
    │
    ├─ 通过 → 完成
    │
    └─ 失败 → 结构化反馈
         │
         ▼
    反馈格式：
    {
      "result": "fail",
      "layer": "L1",
      "errors": [
        {
          "type": "layout",
          "message": "Button overflows container by 12px",
          "severity": "error",
          "suggestion": "Add overflow: hidden to parent or reduce button padding"
        },
        {
          "type": "accessibility",
          "message": "Form input missing label",
          "severity": "error",
          "suggestion": "Add aria-label or associated <label>"
        }
      ],
      "screenshot": "base64...",
      "metrics": { "renderTime": 234 }
    }
         │
         ▼
    AI 修复代码 → 重新验证 → ...
```

关键设计：反馈必须**结构化**且**可操作**，不只是 pass/fail。包含：
- 具体错误位置和类型
- 修复建议
- 截图证据
- 性能指标

### 2.3 批量验证模式（评测/RL 场景）

```
验证清单 (manifest.json)
├── scenario_1: { component: "Button", states: [...], checks: [...] }
├── scenario_2: { component: "Form", states: [...], checks: [...] }
└── scenario_N: { ... }
    │
    ▼
批量执行器
├── 并行渲染（多个 Playwright 上下文）
├── 结果收集
└── 汇总报告
    │
    ▼
结构化评分
{
  "total": 50,
  "passed": 42,
  "failed": 8,
  "score": 0.84,
  "details": [...]
}
```

---

## 3. 观察/动作循环的工程实践

### 3.1 Token 预算管理

Token 预算是 agent 系统的核心约束。策略：

1. **渐进式展开**：先给高层概要，agent 按需请求详情
2. **仅视口范围**：只提取可见区域的 UI 信息
3. **动作相关过滤**：如果要点击，只展示可点击元素
4. **差异传递**：连续观察只发送变化部分
5. **区域截图**：裁剪截图到相关区域而非全页

### 3.2 错误恢复

```
执行动作
  │
  ├─ 成功 → 继续
  │
  └─ 失败
       │
       ├─ 元素未找到 → 重新观察、尝试替代选择器
       ├─ 页面错误 → 截图记录、尝试刷新
       ├─ 超时 → 增加等待、检查网络状态
       ├─ 意外状态 → 重新观察、重新规划
       └─ 不可恢复 → 记录错误、优雅退出
```

### 3.3 确定性优先

**核心原则**：能用确定性方法的地方不用 AI 推理。

```
已知页面结构 → 确定性选择器 + 确定性等待
动态/未知页面 → AI 推理 + 自适应策略
```

这是 Stagehand 的设计哲学：`act()` 用自然语言处理动态情况，但底层用确定性操作。

### 3.4 Context Engineering（来自 Agent TARS 实践）

Agent TARS Beta（ByteDance, 2025）揭示了长对话 agent 的 context 管理是**核心工程挑战**，而非附属问题。

**问题量化**：
- 128k context window
- 平均每轮工具调用结果 ~5,000 tokens（高清截图可达 5,000 tokens/张）
- 第 26 轮交互时即溢出，无优化则 agent 无法完成 20+ 步任务

**Agent TARS 的分层记忆设计**：

| 层级 | 作用域 | 内容 | 生命周期 |
|------|-------|------|---------|
| L0（永久） | 跨会话 | 初始输入、最终答案 | 永不丢弃 |
| L1（会话级） | 当前会话 | 计划、决策 | 会话结束清除 |
| L2（循环级） | 当前迭代 | 工具调用、截图 | 下一迭代可压缩 |
| L3（临时） | 瞬时 | 流式数据块 | 立即可丢弃 |

**多模态滑动窗口**：不同类型内容使用不同窗口策略——文本工具结果和截图图像的 token 成本差异巨大，不能用统一策略裁剪。

**压缩手段**（已实施或计划中）：
- Selective Context：基于算法选择性保留关键内容
- LLM 摘要：用 LLM 将历史对话压缩为摘要
- 截图降级：历史截图降低分辨率或转为文本描述

**Snapshot Framework（可观测性）**：

Agent TARS 提出 "Agent UI is just a Replay of Agent Event Stream" 的设计哲学，将 agent 运行时状态以事件流形式捕获，支持确定性重放：

```typescript
const agentSnapshot = new AgentSnapshot(agent, {
  snapshotPath: './fixtures/',
});
await agentSnapshot.generate(runOptions);  // 捕获
await agentSnapshot.replay(runOptions);    // 重放
```

该机制在 Beta 开发中帮助**避免了 10+ 个问题**，是持续集成测试的基础。

**对本项目的启示**：
- 验证框架的 Coordinator 需要内置 token 预算管理
- 截图和 DOM 快照的传递应支持渐进式压缩
- Event Stream 模式适合用于验证过程的可观测性和回放

### 3.5 MCP 集成的陷阱

Agent TARS 的实践揭示了 MCP 集成的**核心矛盾**：

> "Agent 越需要细粒度 Context Engineering 控制，就越不需要 MCP 的静默 Prompt 注入行为。"

**具体问题**：
1. **Context 溢出**：设计不好的 MCP 一轮调用就可能产生超大返回值，直接撑爆 context（实际遇到的报错：128k limit 被 138k 结果突破）
2. **Schema 验证失败**：严格的参数校验导致工具调用失败
3. **不可控的 Prompt 注入**：MCP tool 的 description 和结果都会注入 prompt，难以精确控制

**建议**：
- MCP 应作为"标准化工具分发协议"使用，不是无限制的工具扩展
- 我们的 MCP 工具应控制返回值大小（如截图压缩、DOM 摘要限制长度）
- 考虑添加 MCP 工具的 benchmark 指标：模型兼容性、context 压缩率等

---

## 4. 与现有工具的集成模式

### 4.1 MCP (Model Context Protocol) 集成

MCP 为 agent 提供工具接口的标准协议。UI 验证可以暴露为 MCP 工具：

```
MCP Server: ui-verify
├── tool: render_component
│   input: { component, props, viewport }
│   output: { screenshot, dom, errors }
├── tool: check_layout
│   input: { page_url }
│   output: { overlaps, overflows, violations }
├── tool: check_accessibility
│   input: { page_url }
│   output: { violations, passes }
└── tool: evaluate_visual
    input: { screenshot, criteria }
    output: { score, feedback }
```

AI coding agent（Claude Code、Cursor 等）通过 MCP 调用验证工具，无需了解底层实现。

### 4.2 与 CI/CD 集成

```
git push → CI pipeline
  │
  ├─ 静态检查 (L0): tsc + eslint
  ├─ 快速验证 (L1): 状态快照渲染 + 程序化检查
  ├─ 交互测试 (L2): 关键组件交互验证
  └─ 可选: VLM 评估 (L3): 视觉变更的 AI 审查
```

---

## 5. 对本项目的设计建议

### 5.1 验证协调器架构

```typescript
interface VerificationCoordinator {
  // 分析变更，决定需要哪些验证层级
  planVerification(changes: FileChange[]): VerificationPlan;

  // 执行验证计划
  execute(plan: VerificationPlan): Promise<VerificationResult>;

  // 生成结构化反馈
  generateFeedback(result: VerificationResult): VerificationFeedback;
}

interface VerificationPlan {
  layers: Array<{
    level: 0 | 1 | 2 | 3;
    components: ComponentTarget[];
    checks: CheckType[];
  }>;
  parallel: boolean;
  timeout: number;
}

interface VerificationResult {
  success: boolean;
  score: number;  // 0-1
  layers: LayerResult[];
  metrics: { totalTime: number; renderTime: number; };
}
```

### 5.2 推荐实现顺序

1. **先实现确定性层（L0, L1）**——不需要 AI，可靠性高
2. **再加交互验证（L2）**——仍是确定性的，但更复杂
3. **最后加 AI 评估和智能编排**——VLM 评估、智能层级选择

### 5.3 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 默认验证深度 | L0 + L1 | 快速反馈，覆盖大部分问题 |
| 评估是否 AI 驱动 | 程序化为主，AI 为辅 | AI 不够精确，程序化更可靠 |
| 失败策略 | 结构化反馈 + 修复建议 | 支持 agent 自修复循环 |
| 并行策略 | 同层级并行，跨层级串行 | 平衡速度和资源 |
| 缓存策略 | 按组件 + 状态哈希缓存截图 | 避免重复渲染 |

---

## 参考资料

### 论文
- ReAct: Synergizing Reasoning and Acting in Language Models (Yao et al., 2023)
- WebAgent: World Model + Grounding (Google DeepMind, 2023)
- SWE-agent: Agent-Computer Interfaces for Software Engineering (Princeton, 2024)

### 工具与标准
- Model Context Protocol (MCP): https://modelcontextprotocol.io/
- XState: https://xstate.js.org/
- LangGraph: https://langchain-ai.github.io/langgraph/

### 相关项目
- Anthropic Evals Guide: https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
- Vercel AI SDK: https://sdk.vercel.ai/
- OpenAI Operator: Computer Use Agent pattern
- Agent TARS Beta Blog: https://agent-tars.com/blog/2025-06-25-introducing-agent-tars-beta
- UI-TARS-2 Technical Report: https://arxiv.org/abs/2509.02544
