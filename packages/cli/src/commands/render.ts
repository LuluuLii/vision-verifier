import { writeFile } from 'node:fs/promises';
import type { Command } from 'commander';

export function registerRenderCommand(program: Command): void {
  program
    .command('render')
    .description('Render a component and capture screenshot')
    .requiredOption('-c, --component <path>', 'Component file path (relative to project)')
    .option('-s, --state <json>', 'Props as JSON string', '{}')
    .option('-o, --output <file>', 'Output screenshot file path')
    .option('--url <url>', 'Server URL', 'http://localhost:4173')
    .option('--interactions <json>', 'Interactions as JSON array')
    .option('--step-screenshots', 'Capture screenshot after each interaction')
    .action(async (options) => {
      const body: Record<string, unknown> = {
        component: { path: options.component },
        state: { props: JSON.parse(options.state) },
        output: {
          screenshot: true,
          dom: true,
          screenshotAfterEachInteraction: options.stepScreenshots ?? false,
        },
      };

      if (options.interactions) {
        body.interactions = JSON.parse(options.interactions);
      }

      const response = await fetch(`${options.url}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!result.success) {
        console.error('Render failed:', result.errors);
        process.exit(1);
      }

      console.log('Render succeeded');
      console.log(`  Render time: ${result.metrics.renderTime}ms`);
      console.log(`  Total time: ${result.metrics.totalTime}ms`);

      if (result.errors?.length) {
        console.log(`  Warnings: ${result.errors.length}`);
      }

      if (result.stepScreenshots?.length) {
        console.log(`  Step screenshots: ${result.stepScreenshots.length}`);
      }

      // Save screenshot
      if (result.screenshot && options.output) {
        const buffer = Buffer.from(result.screenshot, 'base64');
        await writeFile(options.output, buffer);
        console.log(`  Screenshot saved: ${options.output}`);
      } else if (result.screenshot) {
        console.log('  Screenshot captured (use -o to save)');
      }

      // Print DOM snippet
      if (result.dom) {
        const domPreview =
          result.dom.length > 200
            ? result.dom.slice(0, 200) + '...'
            : result.dom;
        console.log(`  DOM: ${domPreview}`);
      }
    });
}
