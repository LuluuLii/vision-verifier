# UI 分层验证工具 - MVP 实现计划

## MVP 目标

用最小工作量验证核心假设：**状态快照注入 + 常驻渲染服务** 能否显著提升前端验证效率。

## MVP 范围

### 包含

- ✅ 常驻 Vite 渲染服务
- ✅ React 组件渲染
- ✅ Props 注入
- ✅ 简单 Context 注入
- ✅ 截图输出
- ✅ DOM 输出
- ✅ CLI 基本命令
- ✅ 渲染错误捕获

### 不包含（后续迭代）

- ❌ 复杂状态管理库集成（Redux/Zustand）
- ❌ API Mock
- ❌ 交互验证
- ❌ Vue/Svelte 支持
- ❌ VS Code 扩展

## 项目结构

```
ui-verify/
├── packages/
│   ├── core/                    # 核心逻辑
│   │   ├── src/
│   │   │   ├── server.ts        # HTTP 服务器
│   │   │   ├── renderer.ts      # 渲染逻辑
│   │   │   ├── wrapper.ts       # 组件包装器生成
│   │   │   ├── screenshot.ts    # Playwright 截图
│   │   │   └── types.ts         # 类型定义
│   │   └── package.json
│   │
│   ├── cli/                     # CLI 工具
│   │   ├── src/
│   │   │   ├── index.ts         # 入口
│   │   │   ├── commands/
│   │   │   │   ├── serve.ts     # serve 命令
│   │   │   │   └── render.ts    # render 命令
│   │   │   └── utils.ts
│   │   └── package.json
│   │
│   └── runtime/                 # 运行时注入库
│       ├── src/
│       │   ├── MockProviders.tsx
│       │   └── index.ts
│       └── package.json
│
├── examples/
│   └── react-app/               # 测试用 React 项目
│
├── package.json                 # monorepo 配置
├── pnpm-workspace.yaml
└── tsconfig.json
```

## 核心模块实现

### 1. 类型定义 (`packages/core/src/types.ts`)

```typescript
export interface RenderRequest {
  component: {
    path: string;
    exportName?: string;
  };
  state: {
    props?: Record<string, unknown>;
    contexts?: Array<{
      provider: string;
      value: unknown;
    }>;
  };
  viewport?: {
    width: number;
    height: number;
  };
  output: {
    screenshot?: boolean;
    dom?: boolean;
  };
}

export interface RenderResponse {
  success: boolean;
  renderTime: number;
  screenshot?: {
    data: string;  // base64
    width: number;
    height: number;
  };
  dom?: {
    html: string;
    textContent: string;
  };
  errors?: Array<{
    type: 'render' | 'console' | 'runtime';
    message: string;
    stack?: string;
  }>;
}

export interface ServerConfig {
  port: number;
  projectRoot: string;
  vitePort: number;
}
```

### 2. 组件包装器生成 (`packages/core/src/wrapper.ts`)

```typescript
import type { RenderRequest } from './types';

export function generateWrapperCode(request: RenderRequest): string {
  const { component, state } = request;
  const componentPath = component.path;
  const exportName = component.exportName || 'default';
  
  const propsJson = JSON.stringify(state.props || {});
  
  // 生成 Context 包装
  let contextImports = '';
  let contextWrapperStart = '';
  let contextWrapperEnd = '';
  
  if (state.contexts && state.contexts.length > 0) {
    state.contexts.forEach((ctx, index) => {
      contextImports += `import { ${ctx.provider} } from '${ctx.provider}';\n`;
      contextWrapperStart += `<Provider_${index} value={${JSON.stringify(ctx.value)}}>\n`;
      contextWrapperEnd = `</Provider_${index}>\n` + contextWrapperEnd;
    });
  }
  
  return `
import React from 'react';
import { createRoot } from 'react-dom/client';
${exportName === 'default' 
  ? `import Component from '${componentPath}';`
  : `import { ${exportName} as Component } from '${componentPath}';`
}
${contextImports}

const props = ${propsJson};

function Wrapper() {
  return (
    ${contextWrapperStart || '<>'}
      <Component {...props} />
    ${contextWrapperEnd || '</>'}
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Wrapper />);

// 通知渲染完成
window.__UI_VERIFY_RENDERED__ = true;
`;
}
```

### 3. 渲染服务 (`packages/core/src/renderer.ts`)

```typescript
import { createServer, ViteDevServer } from 'vite';
import { chromium, Browser, Page } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { RenderRequest, RenderResponse, ServerConfig } from './types';
import { generateWrapperCode } from './wrapper';

export class Renderer {
  private vite: ViteDevServer | null = null;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: ServerConfig;
  
  constructor(config: ServerConfig) {
    this.config = config;
  }
  
  async start(): Promise<void> {
    // 启动 Vite dev server
    this.vite = await createServer({
      root: this.config.projectRoot,
      server: {
        port: this.config.vitePort,
        strictPort: true,
      },
      // 配置别名，使得动态生成的 wrapper 可以被解析
      resolve: {
        alias: {
          '@ui-verify/wrapper': join(this.config.projectRoot, '.ui-verify/wrapper.tsx'),
        },
      },
    });
    
    await this.vite.listen();
    
    // 启动 Playwright
    this.browser = await chromium.launch();
    this.page = await this.browser.newPage();
  }
  
  async render(request: RenderRequest): Promise<RenderResponse> {
    const startTime = Date.now();
    const errors: RenderResponse['errors'] = [];
    
    try {
      // 1. 生成 wrapper 代码
      const wrapperCode = generateWrapperCode(request);
      const wrapperDir = join(this.config.projectRoot, '.ui-verify');
      mkdirSync(wrapperDir, { recursive: true });
      writeFileSync(join(wrapperDir, 'wrapper.tsx'), wrapperCode);
      
      // 2. 生成入口 HTML
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/@ui-verify/wrapper"></script>
</body>
</html>
      `;
      writeFileSync(join(wrapperDir, 'index.html'), html);
      
      // 3. 设置视口
      if (request.viewport) {
        await this.page!.setViewportSize(request.viewport);
      } else {
        await this.page!.setViewportSize({ width: 1280, height: 720 });
      }
      
      // 4. 捕获 console 错误
      this.page!.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push({
            type: 'console',
            message: msg.text(),
          });
        }
      });
      
      this.page!.on('pageerror', (err) => {
        errors.push({
          type: 'runtime',
          message: err.message,
          stack: err.stack,
        });
      });
      
      // 5. 导航到渲染页面
      await this.page!.goto(`http://localhost:${this.config.vitePort}/.ui-verify/index.html`);
      
      // 6. 等待渲染完成
      await this.page!.waitForFunction(() => (window as any).__UI_VERIFY_RENDERED__, {
        timeout: 10000,
      });
      
      // 7. 额外等待一小段时间确保样式加载
      await this.page!.waitForTimeout(100);
      
      const renderTime = Date.now() - startTime;
      
      // 8. 获取输出
      const response: RenderResponse = {
        success: errors.length === 0,
        renderTime,
        errors: errors.length > 0 ? errors : undefined,
      };
      
      if (request.output.screenshot) {
        const screenshot = await this.page!.screenshot({ type: 'png' });
        const viewport = this.page!.viewportSize()!;
        response.screenshot = {
          data: screenshot.toString('base64'),
          width: viewport.width,
          height: viewport.height,
        };
      }
      
      if (request.output.dom) {
        const html = await this.page!.content();
        const textContent = await this.page!.evaluate(() => document.body.textContent || '');
        response.dom = { html, textContent: textContent.trim() };
      }
      
      return response;
      
    } catch (error) {
      return {
        success: false,
        renderTime: Date.now() - startTime,
        errors: [{
          type: 'render',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }],
      };
    }
  }
  
  async stop(): Promise<void> {
    await this.page?.close();
    await this.browser?.close();
    await this.vite?.close();
  }
}
```

### 4. HTTP 服务器 (`packages/core/src/server.ts`)

```typescript
import express from 'express';
import { Renderer } from './renderer';
import type { RenderRequest, ServerConfig } from './types';

export async function createVerifyServer(config: ServerConfig) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  
  const renderer = new Renderer(config);
  await renderer.start();
  
  // 健康检查
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  
  // 渲染接口
  app.post('/render', async (req, res) => {
    try {
      const request: RenderRequest = req.body;
      const response = await renderer.render(request);
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
  
  // 优雅关闭
  const server = app.listen(config.port, () => {
    console.log(`UI Verify server running on http://localhost:${config.port}`);
  });
  
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await renderer.stop();
    server.close();
    process.exit(0);
  });
  
  return server;
}
```

### 5. CLI 命令 (`packages/cli/src/commands/serve.ts`)

```typescript
import { Command } from 'commander';
import { createVerifyServer } from '@ui-verify/core';

export const serveCommand = new Command('serve')
  .description('Start the UI verification server')
  .option('-p, --port <port>', 'Server port', '4173')
  .option('--vite-port <port>', 'Vite dev server port', '5173')
  .option('--project <path>', 'Project root directory', '.')
  .action(async (options) => {
    await createVerifyServer({
      port: parseInt(options.port),
      vitePort: parseInt(options.vitePort),
      projectRoot: options.project,
    });
  });
```

### 6. CLI 命令 (`packages/cli/src/commands/render.ts`)

```typescript
import { Command } from 'commander';
import { writeFileSync } from 'fs';

export const renderCommand = new Command('render')
  .description('Render a component and capture output')
  .requiredOption('-c, --component <path>', 'Component file path')
  .option('-s, --state <json>', 'State JSON', '{}')
  .option('-o, --output <path>', 'Screenshot output path')
  .option('--server <url>', 'Server URL', 'http://localhost:4173')
  .action(async (options) => {
    const state = JSON.parse(options.state);
    
    const response = await fetch(`${options.server}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        component: { path: options.component },
        state: { props: state },
        output: { screenshot: !!options.output, dom: true },
      }),
    });
    
    const result = await response.json();
    
    if (!result.success) {
      console.error('Render failed:', result.errors);
      process.exit(1);
    }
    
    if (options.output && result.screenshot) {
      const buffer = Buffer.from(result.screenshot.data, 'base64');
      writeFileSync(options.output, buffer);
      console.log(`Screenshot saved to ${options.output}`);
    }
    
    if (result.dom) {
      console.log('Text content:', result.dom.textContent.substring(0, 200) + '...');
    }
    
    console.log(`Render time: ${result.renderTime}ms`);
  });
```

## 依赖清单

```json
{
  "dependencies": {
    "vite": "^5.0.0",
    "express": "^4.18.0",
    "playwright": "^1.40.0",
    "commander": "^11.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0"
  }
}
```

## 验证 MVP 的测试场景

### 场景 1：简单组件渲染

```bash
# 启动服务
ui-verify serve --project ./examples/react-app

# 渲染一个按钮组件
ui-verify render \
  --component src/components/Button.tsx \
  --state '{"label": "Click me", "variant": "primary"}' \
  --output button.png
```

### 场景 2：带 props 变化的组件

```bash
# 空购物车状态
ui-verify render \
  --component src/components/Cart.tsx \
  --state '{"items": []}' \
  --output cart-empty.png

# 有商品状态
ui-verify render \
  --component src/components/Cart.tsx \
  --state '{"items": [{"id": 1, "name": "Product", "price": 99}]}' \
  --output cart-with-items.png
```

### 场景 3：验证渲染时间

```bash
# 首次渲染（冷启动）
time ui-verify render --component src/components/Complex.tsx --state '{}'

# 修改代码后再次渲染（应该更快，因为 HMR）
time ui-verify render --component src/components/Complex.tsx --state '{}'
```

## 成功标准

MVP 成功的标准：

1. **功能**：能够渲染 React 组件并输出截图
2. **性能**：首次渲染 < 2s，HMR 后渲染 < 500ms
3. **稳定性**：连续 10 次渲染不崩溃
4. **可用性**：CLI 命令直观易用

## 下一步

MVP 完成后，根据使用反馈决定：

1. 是否需要更复杂的状态注入（Redux 等）
2. 是否需要交互验证（Layer 2）
3. 是否需要与现有 Storybook stories 集成
4. 是否需要 IDE 集成
