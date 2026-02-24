import { resolve } from 'node:path';
import type { Command } from 'commander';

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('Start the fast-verify render server')
    .requiredOption('-p, --project <path>', 'Path to the project root')
    .option('--port <number>', 'Server port', '4173')
    .option('--no-headless', 'Run browser in headed mode')
    .action(async (options) => {
      const { createFastVerifyServer } = await import(
        '@vision-verifier/fast-verify'
      );

      const projectRoot = resolve(options.project);
      console.log(`[ui-verify] Starting server for project: ${projectRoot}`);

      await createFastVerifyServer({
        projectRoot,
        port: parseInt(options.port, 10),
        headless: options.headless,
      });
    });
}
