#!/usr/bin/env node

import { DEFAULT_PIPELINE_PATH, verifyPipelineStore } from './pipeline/index.mjs';

const { records, errors, warnings, summary } = verifyPipelineStore(DEFAULT_PIPELINE_PATH);

console.log('\nOpportunity Engine pipeline verification\n');
console.log(`Records: ${records.length}`);
console.log(`Summary: ${JSON.stringify(summary)}`);

if (errors.length) {
  console.log('\nErrors:');
  for (const error of errors) {
    console.log(`- ${error}`);
  }
}

if (warnings.length) {
  console.log('\nWarnings:');
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

if (!errors.length && !warnings.length) {
  console.log('\nPipeline is clean.');
}

process.exit(errors.length ? 1 : 0);
