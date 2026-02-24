import type { RenderRequest } from './types.js';

/**
 * Generate the wrapper TSX code that isolates and renders a user component
 * with injected props and context.
 *
 * The generated code:
 * 1. Imports the user's component
 * 2. Wraps it in an ErrorBoundary
 * 3. Injects props
 * 4. Sets window.__UI_VERIFY_RENDERED__ = true after mount
 * 5. Sets window.__UI_VERIFY_ERROR__ on errors
 */
export function generateWrapperCode(request: RenderRequest): string {
  const { component, state } = request;

  // Resolve component import path: from .ui-verify/ back to project root
  const importPath = `../${component.path}`;
  const exportName = component.exportName ?? 'default';
  const importStatement =
    exportName === 'default'
      ? `import Component from '${importPath}';`
      : `import { ${exportName} as Component } from '${importPath}';`;

  const propsJson = state?.props ? JSON.stringify(state.props) : '{}';

  // Build context wrappers
  let contextOpenTags = '';
  let contextCloseTags = '';
  if (state?.contexts?.length) {
    for (const ctx of state.contexts) {
      contextOpenTags += `<${ctx.provider} value={${JSON.stringify(ctx.value)}}>\n`;
      contextCloseTags = `</${ctx.provider}>\n` + contextCloseTags;
    }
  }

  return `
import React from 'react';
import { createRoot } from 'react-dom/client';
${importStatement}

// ErrorBoundary to catch render errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    window.__UI_VERIFY_ERROR__ = error.message;
    console.error('[ui-verify] Render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: { color: 'red', padding: '16px', fontFamily: 'monospace' },
      }, 'Render Error: ' + (this.state.error?.message || 'Unknown error'));
    }
    return this.props.children;
  }
}

// Wrapper component that signals render completion
function Wrapper() {
  React.useEffect(() => {
    window.__UI_VERIFY_RENDERED__ = true;
  }, []);

  const props = ${propsJson};

  return (
    <ErrorBoundary>
      ${contextOpenTags}<Component {...props} />${contextCloseTags}
    </ErrorBoundary>
  );
}

// Mount
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<Wrapper />);
`.trim();
}

/**
 * Generate the index.html that loads the wrapper TSX via Vite.
 */
export function generateIndexHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>UI Verify</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./wrapper.tsx"></script>
</body>
</html>`;
}
