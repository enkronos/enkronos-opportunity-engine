import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { parseSimpleYaml } from '../shared/yaml.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_STRATEGY_PATH = join(__dirname, '..', 'strategy.yaml');

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export function loadStrategy(filePath = DEFAULT_STRATEGY_PATH) {
  if (!existsSync(filePath)) {
    throw new Error(`Strategy file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  const strategy = parseSimpleYaml(content);
  return normalizeStrategy(strategy);
}

export function normalizeStrategy(strategy) {
  const profile = strategy.profile ?? {};
  const scoring = strategy.scoring ?? {};

  return {
    profile: {
      role: profile.role ?? 'Strategic operator',
      positioning: profile.positioning ?? 'Builds and compounds leverage across product, distribution, and relationships.',
      strengths: normalizeArray(profile.strengths),
      unfair_advantages: normalizeArray(profile.unfair_advantages),
    },
    goals: normalizeArray(strategy.goals),
    constraints: normalizeArray(strategy.constraints),
    target_companies: normalizeArray(strategy.target_companies),
    priority_opportunities: normalizeArray(strategy.priority_opportunities),
    scoring: {
      pursue_threshold: scoring.pursue_threshold ?? 75,
      explore_threshold: scoring.explore_threshold ?? 55,
      weights: {
        leverage: scoring.weights?.leverage ?? 0.22,
        capital_access: scoring.weights?.capital_access ?? 0.15,
        network_value: scoring.weights?.network_value ?? 0.12,
        strategic_alignment: scoring.weights?.strategic_alignment ?? 0.18,
        distribution_power: scoring.weights?.distribution_power ?? 0.13,
        optionality: scoring.weights?.optionality ?? 0.10,
        time_cost: scoring.weights?.time_cost ?? -0.05,
        execution_burden: scoring.weights?.execution_burden ?? -0.05,
      },
    },
  };
}

export function validateStrategy(strategy) {
  const issues = [];

  if (!strategy.profile?.role) {
    issues.push('profile.role is required');
  }

  if (!strategy.goals?.length) {
    issues.push('At least one goal is required');
  }

  if (!strategy.priority_opportunities?.length) {
    issues.push('At least one priority opportunity is required');
  }

  return issues;
}

export function buildStrategyKeywordSet(strategy) {
  const values = [
    strategy.profile.role,
    strategy.profile.positioning,
    ...strategy.profile.strengths,
    ...strategy.profile.unfair_advantages,
    ...strategy.goals,
    ...strategy.constraints,
    ...strategy.target_companies,
    ...strategy.priority_opportunities,
  ];

  return new Set(
    values
      .flatMap((value) => String(value).toLowerCase().split(/[^a-z0-9]+/))
      .filter((token) => token.length > 2)
  );
}

export function summarizeStrategy(strategy) {
  return {
    role: strategy.profile.role,
    positioning: strategy.profile.positioning,
    goals: strategy.goals,
    constraints: strategy.constraints,
    targetCompanies: strategy.target_companies,
    priorityOpportunities: strategy.priority_opportunities,
  };
}
