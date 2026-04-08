#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const ROOT = process.cwd();

function run(command) {
  try {
    execSync(command, { cwd: ROOT, stdio: 'pipe', timeout: 30000 });
    return true;
  } catch {
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    console.log(`❌ ${message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`✅ ${message}`);
}

console.log('\nOpportunity Engine test suite\n');

const syntaxTargets = [
  'doctor.mjs',
  'verify-pipeline.mjs',
  'opportunity-engine.mjs',
  'shared/yaml.mjs',
  'shared/openai.mjs',
  'actions/index.mjs',
  'execution/index.mjs',
  'execution/emailGenerator.mjs',
  'execution/emailSender.mjs',
  'execution/linkedinGenerator.mjs',
  'memory/index.mjs',
  'policy/index.mjs',
  'strategy/index.mjs',
  'strategy/strategyEngine.mjs',
  'opportunity/index.mjs',
  'scoring/index.mjs',
  'scoring/aiScoring.mjs',
  'positioning/index.mjs',
  'positioning/aiPositioning.mjs',
  'outreach/index.mjs',
  'priority/index.mjs',
  'pipeline/index.mjs',
  'engine/index.mjs',
];

console.log('1. Syntax');
for (const target of syntaxTargets) {
  assert(run(`node --check ${target}`), `${target} parses`);
}

console.log('\n2. Runtime');
assert(run('node doctor.mjs'), 'doctor.mjs runs');
assert(run('node verify-pipeline.mjs'), 'verify-pipeline.mjs runs');
const pipelinePath = 'pipeline/opportunities.json';
const memoryPath = 'memory/memory.json';
const originalPipeline = existsSync(pipelinePath) ? readFileSync(pipelinePath, 'utf-8') : '[]\n';
const originalMemory = existsSync(memoryPath) ? readFileSync(memoryPath, 'utf-8') : '{\n  "history": []\n}\n';
assert(run('node opportunity-engine.mjs demo --no-ai'), 'demo flow runs without AI');
assert(run('node opportunity-engine.mjs pipeline'), 'pipeline command runs');
const demoPipeline = JSON.parse(readFileSync(pipelinePath, 'utf-8'));
const outcomeId = demoPipeline[0]?.id ?? demoPipeline[0]?.key;
assert(Boolean(outcomeId), 'demo created a pipeline record');
assert(run(`node opportunity-engine.mjs --update-outcome ${outcomeId} replied`), 'update-outcome command runs');
const updatedPipeline = JSON.parse(readFileSync(pipelinePath, 'utf-8'));
assert(updatedPipeline.some((record) => record.id === outcomeId && record.status === 'replied'), 'pipeline outcome updated');
writeFileSync(pipelinePath, originalPipeline);
writeFileSync(memoryPath, originalMemory);

console.log('\n3. Structure');
const requiredPaths = [
  'README.md',
  'ARCHITECTURE.md',
  'ROADMAP.md',
  'strategy.yaml',
  'actions/index.mjs',
  'execution/index.mjs',
  'execution/emailGenerator.mjs',
  'execution/emailSender.mjs',
  'execution/linkedinGenerator.mjs',
  'memory/index.mjs',
  'memory/memory.json',
  'policy/index.mjs',
  'strategy/index.mjs',
  'strategy/strategyEngine.mjs',
  'opportunity/index.mjs',
  'scoring/index.mjs',
  'positioning/index.mjs',
  'outreach/index.mjs',
  'priority/index.mjs',
  'pipeline/index.mjs',
  'pipeline/opportunities.json',
  'examples/opportunities.sample.json',
];

for (const target of requiredPaths) {
  assert(existsSync(target), `${target} exists`);
}

console.log('');
if (process.exitCode) {
  console.log('Opportunity Engine tests failed.\n');
} else {
  console.log('Opportunity Engine tests passed.\n');
}
