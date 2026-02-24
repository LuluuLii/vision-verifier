#!/usr/bin/env node

import { Command } from 'commander';
import { registerServeCommand } from './commands/serve.js';
import { registerRenderCommand } from './commands/render.js';

const program = new Command();

program
  .name('ui-verify')
  .description('Vision Verifier CLI — UI verification for AI coding agents')
  .version('0.1.0');

registerServeCommand(program);
registerRenderCommand(program);

program.parse();
