#!/usr/bin/env node

import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

import { evaluateOpportunitySet } from './engine/index.mjs';
import { DEFAULT_PIPELINE_PATH, summarizePipeline, updateOutcome, verifyPipelineStore } from './pipeline/index.mjs';
import { DEFAULT_STRATEGY_PATH, loadStrategy, summarizeStrategy } from './strategy/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

function printHelp() {
  console.log(`
Opportunity Engine

Usage:
  node opportunity-engine.mjs run <input.json> [--ai|--no-ai] [--live]
  node opportunity-engine.mjs demo [--ai|--no-ai] [--live]
  node opportunity-engine.mjs strategy
  node opportunity-engine.mjs pipeline
  node opportunity-engine.mjs --update-outcome <id> <status>
`);
}

function parseFlags(args) {
  return {
    live: args.includes('--live'),
    useAI: args.includes('--ai') ? true : !args.includes('--no-ai'),
  };
}

function parseOutcomeUpdate(argv) {
  const flagIndex = argv.indexOf('--update-outcome');
  if (flagIndex === -1) {
    return null;
  }

  const id = argv[flagIndex + 1];
  const outcome = argv[flagIndex + 2];
  if (!id || !outcome) {
    throw new Error('Usage: node opportunity-engine.mjs --update-outcome <id> <status>');
  }

  return { id, outcome };
}

function resolveInput(command, args, live) {
  if (live) {
    return null;
  }

  if (command === 'demo') {
    return join(ROOT, 'examples', 'opportunities.sample.json');
  }

  const candidate = args.find((arg) => !arg.startsWith('--'));
  if (!candidate) {
    return join(ROOT, 'examples', 'opportunities.sample.json');
  }

  return resolve(candidate);
}

async function main() {
  const argv = process.argv.slice(2);
  const [command = 'help', ...args] = argv;
  const outcomeUpdate = parseOutcomeUpdate(argv);
  const flags = parseFlags(args);

  if (outcomeUpdate) {
    const updated = await updateOutcome(outcomeUpdate.id, outcomeUpdate.outcome, DEFAULT_PIPELINE_PATH);
    console.log(`[PIPELINE] Updated ${updated.id ?? updated.key} -> ${updated.status}`);
    return;
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'strategy') {
    console.log(JSON.stringify(summarizeStrategy(loadStrategy(DEFAULT_STRATEGY_PATH)), null, 2));
    return;
  }

  if (command === 'pipeline') {
    const { summary, errors, warnings } = verifyPipelineStore(DEFAULT_PIPELINE_PATH);
    console.log(JSON.stringify({ summary, errors, warnings }, null, 2));
    return;
  }

  if (command !== 'run' && command !== 'demo') {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const inputPath = resolveInput(command, args, flags.live);
  const { report, reportPath } = await evaluateOpportunitySet({
    inputPath,
    strategyPath: DEFAULT_STRATEGY_PATH,
    pipelinePath: DEFAULT_PIPELINE_PATH,
    outputDir: join(ROOT, 'output'),
    live: flags.live,
    useAI: flags.useAI,
  });

  console.log(`Processed ${report.summary.processed} opportunities.`);
  console.log(`Decision split: pursue=${report.summary.pursue}, explore=${report.summary.explore}, discard=${report.summary.discard}`);
  console.log(`Pipeline summary: ${JSON.stringify(summarizePipeline(report.evaluations.map((item) => ({ stage: item.pipeline.stage }))))}`);
  console.log(`Report written to ${reportPath}`);
}

main().catch((error) => {
  console.error(`Opportunity Engine failed: ${error.message}`);
  process.exit(1);
});
