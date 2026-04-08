#!/usr/bin/env node

import { existsSync, mkdirSync } from 'fs';

import { ensurePipelineStore, DEFAULT_PIPELINE_PATH } from './pipeline/index.mjs';
import { hasLanguageModelConfig } from './shared/openai.mjs';
import { DEFAULT_STRATEGY_PATH, loadStrategy, validateStrategy } from './strategy/index.mjs';

const green = (value) => (process.stdout.isTTY ? `\x1b[32m${value}\x1b[0m` : value);
const yellow = (value) => (process.stdout.isTTY ? `\x1b[33m${value}\x1b[0m` : value);
const red = (value) => (process.stdout.isTTY ? `\x1b[31m${value}\x1b[0m` : value);

function pass(label) {
  console.log(`${green('✓')} ${label}`);
}

function warn(label) {
  console.log(`${yellow('!')} ${label}`);
}

function fail(label) {
  console.log(`${red('✗')} ${label}`);
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 18) {
    pass(`Node.js >= 18 detected (${process.versions.node})`);
    return true;
  }

  fail(`Node.js >= 18 required (found ${process.versions.node})`);
  return false;
}

function checkStrategy() {
  if (!existsSync(DEFAULT_STRATEGY_PATH)) {
    fail('strategy.yaml is missing');
    return false;
  }

  try {
    const strategy = loadStrategy(DEFAULT_STRATEGY_PATH);
    const issues = validateStrategy(strategy);
    if (issues.length) {
      fail(`strategy.yaml is invalid: ${issues.join('; ')}`);
      return false;
    }

    pass('strategy.yaml loaded and validated');
    return true;
  } catch (error) {
    fail(`strategy.yaml could not be parsed: ${error.message}`);
    return false;
  }
}

function checkDirectory(path) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
    pass(`${path}/ ready (created)`);
    return true;
  }

  pass(`${path}/ ready`);
  return true;
}

function checkPipeline() {
  try {
    ensurePipelineStore(DEFAULT_PIPELINE_PATH);
    pass('pipeline/opportunities.json ready');
    return true;
  } catch (error) {
    fail(`pipeline store unavailable: ${error.message}`);
    return false;
  }
}

function checkAiConfig() {
  if (hasLanguageModelConfig()) {
    pass('OPENAI_API_KEY detected for reasoning and generation');
    return true;
  }

  warn('OPENAI_API_KEY not set; the engine will use heuristic scoring and template-based copy');
  return true;
}

function checkExecutionConfig() {
  const hasGenericSmtp = Boolean(process.env.SMTP_HOST);
  const hasGmailFallback = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

  if (hasGenericSmtp || hasGmailFallback) {
    pass('Email delivery credentials detected for execution layer');
    return true;
  }

  warn('SMTP credentials not set; outreach will be drafted but not sent automatically');
  return true;
}

console.log('\nOpportunity Engine doctor\n');

const checks = [
  checkNodeVersion(),
  checkStrategy(),
  checkDirectory('strategy'),
  checkDirectory('opportunity'),
  checkDirectory('scoring'),
  checkDirectory('positioning'),
  checkDirectory('outreach'),
  checkDirectory('execution'),
  checkDirectory('pipeline'),
  checkDirectory('output'),
  checkPipeline(),
  checkAiConfig(),
  checkExecutionConfig(),
];

const failed = checks.filter((result) => result === false).length;
console.log('');

if (failed > 0) {
  console.log(`Result: ${failed} blocking issue${failed === 1 ? '' : 's'} found.`);
  process.exit(1);
}

console.log('Result: Opportunity Engine is ready.');
