# 参考资料与相关链接

## 核心参考

### 前端测试工具

| 工具 | 用途 | 链接 |
|------|------|------|
| Storybook | 组件隔离开发与测试 | https://storybook.js.org/ |
| Playwright | 浏览器自动化 | https://playwright.dev/ |
| Testing Library | DOM 测试工具 | https://testing-library.com/ |
| MSW | API Mock | https://mswjs.io/ |
| Vitest | 测试框架 | https://vitest.dev/ |

### 构建工具

| 工具 | 特点 | 链接 |
|------|------|------|
| Vite | 快速冷启动、HMR | https://vitejs.dev/ |
| Bun | 高性能 JS 运行时 | https://bun.sh/ |

### AI Coding Agent 相关

| 资源 | 描述 | 链接 |
|------|------|------|
| Vercel agent-browser | 轻量级浏览器自动化 | https://github.com/vercel/agent-browser |
| TestSprite | AI 测试代理 | https://www.testsprite.com/ |
| Anthropic Evals Guide | Agent 评估指南 | https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents |

## 关键文章

### Storybook 组件测试

> "Component tests can cover a wide range of other important UI states. It's challenging to write and maintain the large number of E2E tests necessary to cover all the key UI states in a complex app."

来源: https://storybook.js.org/blog/component-testing/

### Vercel agent-browser 效率对比

> "Six tests consumed ~31K characters with Playwright MCP versus ~5.5K with agent-browser. At roughly 4 characters per token, that's ~7,800 tokens versus ~1,400. An AI agent could run 5.7x more tests in the same context budget."

来源: https://www.pulumi.com/blog/self-verifying-ai-agents-vercels-agent-browser-in-the-ralph-wiggum-loop/

### Anthropic 收购 Bun

> "Claude Code ships as a Bun executable to millions of users. If Bun breaks, Claude Code breaks. Anthropic has direct incentive to keep Bun excellent."

来源: https://bun.com/blog/bun-joins-anthropic

## 相关学术/技术研究

### AI 代码生成可复现性

> "AI-generated code looks complete but isn't reproducible. The 31.7% failure rate... represents thousands of hours developers waste debugging code that should have worked."

来源: https://arxiv.org/pdf/2512.22387

### 生成式 AI 与软件开发实践

> "Agent-based approaches can successfully fix vulnerabilities in code by iteratively testing and patching, demonstrating automated debugging skills."

来源: https://arxiv.org/html/2510.10819v1

## 开源项目参考

### 状态管理测试模式

**Redux 官方测试指南**
```typescript
// 推荐：使用真实 store 进行集成测试
function renderWithProviders(ui, { reduxState } = {}) {
  const store = createStore(reducer, reduxState);
  return render(<Provider store={store}>{ui}</Provider>);
}
```
来源: https://redux.js.org/usage/writing-tests

**Apollo Client Mock Provider**
```typescript
// GraphQL 状态 mock
<MockedProvider mocks={[{ request: {...}, result: {...} }]}>
  <Component />
</MockedProvider>
```
来源: https://www.apollographql.com/docs/react/development-testing/testing

### Storybook 状态注入

```typescript
// 使用 decorators 注入状态
export default {
  decorators: [
    (Story) => (
      <Provider store={mockStore}>
        <Story />
      </Provider>
    ),
  ],
};
```
来源: https://storybook.js.org/tutorials/ui-testing-handbook/react/en/composition-testing/

## 工具对比

### 验证方式对比表

| 方式 | 速度 | 真实性 | 维护成本 | 适用场景 |
|------|------|--------|---------|---------|
| 状态快照注入 | 最快 (ms) | 低 | 中 | 快速迭代、静态渲染 |
| Playwright E2E | 慢 (s) | 高 | 高 | 关键路径、集成测试 |
| VLM 截图对比 | 中 | 中 | 低 | 视觉回归、样式检查 |
| Jest Snapshot | 快 | 低 | 低 | DOM 结构回归 |
| Storybook | 快 | 中 | 中 | 组件开发、文档 |

### 冷启动时间对比

| 工具/方式 | 冷启动时间 | HMR 后 |
|----------|-----------|--------|
| Webpack dev server | 10-30s | 1-5s |
| Vite dev server | 1-3s | <500ms |
| Storybook | 5-15s | 1-2s |
| SSR 渲染 | <100ms | N/A |

## 待深入研究的方向

### 学术论文

1. **视觉回归测试自动化**
   - 关键词: Visual Regression Testing, Screenshot Comparison, Perceptual Diff

2. **AI 代码生成评估**
   - 关键词: Code Generation Evaluation, LLM Benchmark, SWE-bench

3. **前端状态管理形式化**
   - 关键词: State Machine UI, Formal Verification, Model-Based Testing

### 开源项目

1. **Chromatic** - Storybook 的视觉测试服务
   - https://www.chromatic.com/

2. **Percy** - BrowserStack 的视觉测试
   - https://percy.io/

3. **Lost Pixel** - 开源视觉回归测试
   - https://github.com/lost-pixel/lost-pixel

4. **Meticulous** - AI 驱动的前端测试
   - https://www.meticulous.ai/

## 社区讨论

### Storybook 状态管理讨论

> "Storybook gives a testing mechanism in isolation so it should not break this contract by providing external state or changing it."

来源: https://github.com/storybookjs/storybook/discussions/21680

### Vibe Coding 测试实践

> "Prompt-Generate-Review-Refine: You provide a prompt, the AI generates code, you review it (often visually or by testing), and then you provide further refinement based on what you see."

来源: https://testrigor.com/blog/what-are-vibe-coding-and-vibe-testing/
