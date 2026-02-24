# UI Verify - Claude Code 项目指南

## 项目概述

这是一个前端 UI 分层验证工具的研究和开发项目。目标是解决 AI coding agent 和开发者在前端开发中的验证效率问题。

## 核心问题

前端验证的瓶颈：
1. 项目启动慢
2. 到达验证状态需要多步操作
3. 操作路径获取成本高

## 解决思路

**状态快照注入**：不通过操作路径到达状态，而是直接注入状态后渲染。

## 文档结构

```
├── 01-research-summary.md      # 调研总结
├── 02-technical-design.md      # 技术设计文档
├── 03-mvp-implementation.md    # MVP 实现计划
├── 04-references.md            # 参考资料
└── CLAUDE.md                   # 本文件
```

## 开发指南

### 技术栈

- **运行时**: Node.js / Bun
- **构建**: Vite
- **UI 框架**: React (MVP 阶段)
- **浏览器自动化**: Playwright
- **包管理**: pnpm (monorepo)

### MVP 核心模块

1. **Renderer** (`packages/core/src/renderer.ts`)
   - 管理 Vite dev server
   - 管理 Playwright browser
   - 处理渲染请求

2. **Wrapper Generator** (`packages/core/src/wrapper.ts`)
   - 动态生成组件包装代码
   - 注入 props 和 context

3. **HTTP Server** (`packages/core/src/server.ts`)
   - Express 服务器
   - `/render` 端点

4. **CLI** (`packages/cli/`)
   - `serve` 命令启动服务
   - `render` 命令单次渲染

### 关键设计决策

1. **常驻服务而非每次启动**
   - 避免冷启动延迟
   - 利用 Vite HMR

2. **动态生成 wrapper 而非修改源码**
   - 不侵入用户项目
   - 支持任意组件路径

3. **Playwright 而非 Puppeteer**
   - 更好的 API 设计
   - 更稳定的截图

### 开发命令

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 测试
pnpm test
```

### 测试验证

```bash
# 启动服务
pnpm --filter @ui-verify/cli serve --project ./examples/react-app

# 渲染测试
curl -X POST http://localhost:4173/render \
  -H "Content-Type: application/json" \
  -d '{
    "component": {"path": "src/components/Button.tsx"},
    "state": {"props": {"label": "Test"}},
    "output": {"screenshot": true}
  }'
```

## 注意事项

### 状态序列化限制

以下类型无法直接序列化到 JSON：
- 函数
- Symbol
- 循环引用
- DOM 节点
- React refs

对于这些类型，需要在 runtime 层提供 mock 机制。

### 样式加载

确保组件渲染时样式正确加载：
- Vite 会自动处理 CSS imports
- 需要等待样式加载完成再截图
- 考虑添加 `waitForTimeout` 或检测样式表加载

### HMR 集成

当源文件变化时：
1. Vite 自动触发 HMR
2. 需要重新执行渲染
3. 可以通过 WebSocket 通知客户端

## 后续迭代方向

1. **状态管理库支持**: Redux, Zustand, Jotai
2. **API Mock**: MSW 集成
3. **交互验证**: Layer 2 实现
4. **多框架支持**: Vue, Svelte
5. **IDE 集成**: VS Code 扩展
6. **AI Agent SDK**: 标准化接口

## 与整体框架的关系

ui-fast-verify 是 **Vision Verifier 框架** 的特化快速管线，对应 `idea.md` 中的目标 1.1。

**在框架中的定位**：
- 跳过 **Executor** 模块（状态注入代替浏览器导航操作）
- 使用简化的 **Observer**（基础截图 + DOM，无复杂稳定检测）
- 使用 **Evaluator** 子集（错误捕获，可选 VLM 评估）
- 不需要 **Agent Planner**（确定性渲染管线）

**共享模块**：随着框架成熟，ui-fast-verify 将逐步复用框架的 Observer（截图稳定策略）和 Evaluator（布局检查、axe-core）模块。

**完整框架文档**：见 `../research/05-framework-design.md`
**所有调研文档**：见 `../research/` 目录

## 联系上下文

这个项目源于对以下问题的思考：
- Anthropic 收购 Bun 的战略意义
- Vibe coding 时代前端验证的变化
- AI coding agent 评测的需求

详见 `01-research-summary.md`。
