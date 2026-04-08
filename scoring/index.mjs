import { scoreWithAI } from './aiScoring.mjs';
import { buildStrategyKeywordSet } from '../strategy/index.mjs';
import {
  computeWeightedPatterns,
  getSuccessPatterns,
  loadMemory,
  summarizeMemory,
} from '../memory/index.mjs';

const FACTORS = [
  'leverage',
  'capital_access',
  'network_value',
  'strategic_alignment',
  'distribution_power',
  'optionality',
  'time_cost',
  'execution_burden',
];

const outcomeValueMap = {
  job: 50,
  advisory: 200,
  consulting: 150,
  partnership: 500,
  investor_intro: 1000,
  investor: 1000,
};

function clampScore(value) {
  return Math.max(0, Math.min(10, Number(value) || 0));
}

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function overlapScore(tokens, keywords) {
  if (!tokens.length || !keywords.size) return 0;
  const hits = tokens.filter((token) => keywords.has(token)).length;
  return Math.min(10, Math.round((hits / Math.max(tokens.length, 1)) * 20));
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function heuristicFactorRatings(opportunity, strategy) {
  const text = [
    opportunity.title,
    opportunity.company,
    opportunity.summary,
    opportunity.description,
    ...(opportunity.tags ?? []),
    ...(opportunity.signals ?? []),
  ]
    .join(' ')
    .toLowerCase();

  const keywords = buildStrategyKeywordSet(strategy);
  const tokens = tokenize(text);

  const leverageBase = {
    advisory: 8,
    partnership: 9,
    investor: 8,
    consulting: 7,
    pilot_customer: 8,
    speaking: 6,
    community: 6,
    job: 5,
    other: 4,
  }[opportunity.classification] ?? 4;

  const leverage = leverageBase + (containsAny(text, ['platform', 'ecosystem', 'portfolio', 'multi-market']) ? 1 : 0);
  const capitalAccess = 3
    + (containsAny(text, ['fund', 'investor', 'venture', 'capital', 'budget', 'revenue']) ? 4 : 0)
    + (containsAny(text, ['enterprise', 'procurement', 'portfolio']) ? 2 : 0);
  const networkValue = 3
    + (containsAny(text, ['founder', 'board', 'c-suite', 'vc', 'investor', 'ecosystem']) ? 4 : 0)
    + (containsAny(text, ['community', 'network', 'speaker']) ? 2 : 0);
  const strategicAlignment = 3 + overlapScore(tokens, keywords);
  const distributionPower = 2
    + (containsAny(text, ['distribution', 'audience', 'channel', 'community', 'platform', 'media']) ? 5 : 0)
    + (containsAny(text, ['enterprise', 'global']) ? 2 : 0);
  const optionality = 3
    + (containsAny(text, ['advisory', 'fractional', 'pilot', 'partnership', 'exploratory']) ? 4 : 0)
    + (containsAny(text, ['part-time', 'hybrid engagement']) ? 2 : 0);
  const timeCost = 2
    + (containsAny(text, ['full-time', 'onsite', 'relocation', 'travel-heavy']) ? 5 : 0)
    + (containsAny(text, ['urgent', 'immediate start', 'always-on']) ? 2 : 0);
  const executionBurden = 2
    + (containsAny(text, ['compliance', 'procurement', 'multi-stakeholder', 'integration-heavy']) ? 4 : 0)
    + (containsAny(text, ['RFP', 'committee', 'legacy']) ? 2 : 0);

  return {
    leverage: clampScore(leverage),
    capital_access: clampScore(capitalAccess),
    network_value: clampScore(networkValue),
    strategic_alignment: clampScore(strategicAlignment),
    distribution_power: clampScore(distributionPower),
    optionality: clampScore(optionality),
    time_cost: clampScore(timeCost),
    execution_burden: clampScore(executionBurden),
  };
}

function computeWeightedScore(ratings, weights) {
  let weightedSum = 0;
  let max = 0;
  let min = 0;

  for (const factor of FACTORS) {
    const weight = weights[factor];
    const value = clampScore(ratings[factor]);
    weightedSum += value * weight;

    if (weight >= 0) {
      max += 10 * weight;
    } else {
      min += 10 * weight;
    }
  }

  const normalized = ((weightedSum - min) / (max - min || 1)) * 100;
  return Math.max(0, Math.min(100, normalized));
}

function buildDecision(finalScore, strategy) {
  if (finalScore >= strategy.scoring.pursue_threshold) return 'pursue';
  if (finalScore >= strategy.scoring.explore_threshold) return 'explore';
  return 'discard';
}

function decisionFromExpectedValue(expectedValue) {
  if (expectedValue >= 120) return 'pursue';
  if (expectedValue >= 35) return 'explore';
  return 'discard';
}

export function calibrateProbability(aiProbability, memory) {
  const fallbackProbability = Number(aiProbability);
  const normalizedAiProbability = Number.isFinite(fallbackProbability) ? fallbackProbability : 0.5;

  if (!memory || !Array.isArray(memory.history) || memory.history.length < 5) {
    return Math.max(0.05, Math.min(0.95, normalizedAiProbability || 0.5));
  }

  const successful = memory.history.filter((item) => ['meeting', 'converted'].includes(item?.outcome)).length;
  const total = memory.history.length;
  const empiricalRate = total > 0 ? successful / total : 0.5;
  const blended = (normalizedAiProbability * 0.6) + (empiricalRate * 0.4);

  return Math.max(0.05, Math.min(0.95, blended || 0.5));
}

export function computeExpectedValue(probability, opportunity) {
  const type = opportunity?.type || opportunity?.classification || 'job';
  const baseValue = outcomeValueMap[type] || 50;
  return Number(((probability || 0.5) * baseValue).toFixed(2));
}

export function applyConfidence(score, confidence = 0.5) {
  const normalizedConfidence = Number.isFinite(Number(confidence)) ? Number(confidence) : 0.5;
  return Number((score * (0.5 + (normalizedConfidence * 0.5))).toFixed(2));
}

function normalizeAIResponse(response) {
  if (!response || typeof response !== 'object') {
    return null;
  }

  return {
    ...response,
    leverage: clampScore(response.leverage),
    capital_access: clampScore(response.capitalAccess ?? response.capital_access),
    network_value: clampScore(response.network ?? response.networkValue ?? response.network_value),
    strategic_alignment: clampScore(response.alignment ?? response.strategicAlignment ?? response.strategic_alignment),
    optionality: clampScore(response.optionality),
    time_cost: clampScore(response.timeCost ?? response.time_cost),
    execution_burden: clampScore(response.executionCost ?? response.execution_burden),
    probabilityOfSuccess: Math.max(0, Math.min(1, Number(response.probabilityOfSuccess))),
    confidence: Math.max(0, Math.min(1, Number(response.confidence ?? 0.5))),
    expectedValue: Number(response.expectedValue ?? response.expected_value ?? 0),
    finalScore: Number(response.finalScore ?? response.final_score ?? response.score ?? 0),
    decision: response.decision,
  };
}

function fallbackRationale(ratings, opportunity) {
  const label = opportunity.label ?? ([opportunity.company, opportunity.title].filter(Boolean).join(' — ') || 'the opportunity');
  const positives = Object.entries(ratings)
    .filter(([factor]) => !['time_cost', 'execution_burden'].includes(factor))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([factor]) => factor.replace(/_/g, ' '));

  const negatives = ['time_cost', 'execution_burden']
    .map((factor) => [factor, ratings[factor]])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1)
    .map(([factor]) => factor.replace(/_/g, ' '));

  return [
    `${label} stands out for ${positives.join(' and ') || 'strategic upside'}.`,
    negatives.length ? `Main drag: ${negatives.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function getMemoryContext() {
  try {
    const memory = loadMemory();
    return getSuccessPatterns(memory);
  } catch (error) {
    console.warn(`[SCORING][MEMORY] Falling back without memory context: ${error.message}`);
    return {
      industries: [],
      roles: [],
      keywords: [],
      count: 0,
    };
  }
}

function normalizeSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return null;
  }

  return {
    topIndustries: Array.isArray(summary.topIndustries) ? summary.topIndustries : [],
    topRoles: Array.isArray(summary.topRoles) ? summary.topRoles : [],
    topCompanyTypes: Array.isArray(summary.topCompanyTypes) ? summary.topCompanyTypes : [],
    keyPatterns: Array.isArray(summary.keyPatterns) ? summary.keyPatterns : [],
    antiPatterns: Array.isArray(summary.antiPatterns) ? summary.antiPatterns : [],
  };
}

function buildFallbackSummary(memoryPatterns, weightedPatterns) {
  const strongSignals = weightedPatterns
    .filter((item) => item.weight > 0)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 5);
  const negativeSignals = weightedPatterns
    .filter((item) => item.weight < 0)
    .slice(0, 5);

  return {
    topIndustries: memoryPatterns.industries?.slice(0, 3).map((item) => item.value ?? item) ?? [],
    topRoles: memoryPatterns.roles?.slice(0, 3).map((item) => item.value ?? item) ?? [],
    topCompanyTypes: [],
    keyPatterns: strongSignals.map((item) => item.opportunity?.title).filter(Boolean),
    antiPatterns: negativeSignals.map((item) => item.opportunity?.title).filter(Boolean),
  };
}

function computePatternBoost(opportunity, weightedPatterns, summary) {
  const haystack = [
    opportunity?.title,
    opportunity?.company,
    opportunity?.industry,
    opportunity?.sector,
    opportunity?.summary,
    opportunity?.description,
    ...(opportunity?.tags ?? []),
    ...(opportunity?.signals ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let boost = 0;

  for (const item of weightedPatterns) {
    const candidateText = [
      item.opportunity?.title,
      item.opportunity?.company,
      item.opportunity?.industry,
      item.opportunity?.sector,
      ...(item.opportunity?.tags ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (candidateText && haystack.includes(candidateText)) {
      boost += item.weight;
    }
  }

  const summarySignals = [
    ...(summary?.topIndustries ?? []),
    ...(summary?.topRoles ?? []),
    ...(summary?.topCompanyTypes ?? []),
    ...(summary?.keyPatterns ?? []),
  ]
    .map((item) => String(item).toLowerCase())
    .filter(Boolean);

  const antiSignals = (summary?.antiPatterns ?? [])
    .map((item) => String(item).toLowerCase())
    .filter(Boolean);

  if (summarySignals.some((signal) => haystack.includes(signal))) {
    boost += 5;
  }

  if (antiSignals.some((signal) => haystack.includes(signal))) {
    boost -= 5;
  }

  return Math.max(-15, Math.min(15, boost));
}

async function requestModelScore(opportunity, strategy, successPatterns) {
  try {
    const ai = await scoreWithAI(opportunity, strategy, successPatterns);
    return normalizeAIResponse(ai);
  } catch (error) {
    console.warn(`[SCORING][AI] Falling back to heuristics: ${error.message}`);
    return null;
  }
}

export async function scoreOpportunity({ opportunity, strategy, useAI = true }) {
  const heuristic = heuristicFactorRatings(opportunity, strategy);
  const memory = loadMemory();
  const memoryPatterns = getSuccessPatterns(memory);
  const weightedPatterns = computeWeightedPatterns(memory);
  const summary = useAI
    ? normalizeSummary(await summarizeMemory(memory))
    : null;
  const patternSummary = summary ?? buildFallbackSummary(memoryPatterns, weightedPatterns);
  const scoringContext = {
    rawPatterns: memoryPatterns,
    weightedPatterns: weightedPatterns.slice(0, 25),
    summary: patternSummary,
  };
  const modelScore = useAI ? await requestModelScore(opportunity, strategy, scoringContext) : null;

  const ratings = {};
  for (const factor of FACTORS) {
    ratings[factor] = clampScore(
      modelScore?.[factor]
      ?? modelScore?.scores?.[factor]
      ?? heuristic[factor]
    );
  }

  if (modelScore && !('distribution_power' in modelScore)) {
    ratings.distribution_power = heuristic.distribution_power;
  }

  const baseScore = Number(computeWeightedScore(ratings, strategy.scoring.weights).toFixed(2));
  const aiProbability = Math.max(0, Math.min(1, Number(modelScore?.probabilityOfSuccess ?? 0.5)));
  const calibratedProbability = calibrateProbability(aiProbability, memory);
  const confidence = Math.max(0, Math.min(1, Number(modelScore?.confidence ?? 0.5)));
  const patternBoost = computePatternBoost(opportunity, weightedPatterns, patternSummary);
  const heuristicExpectedValue = computeExpectedValue(calibratedProbability, opportunity);
  const expectedValue = Number.isFinite(modelScore?.expectedValue) && modelScore.expectedValue > 0
    ? Number(modelScore.expectedValue.toFixed?.(2) ?? modelScore.expectedValue)
    : heuristicExpectedValue;
  const unweightedFinalScore = Number((baseScore + (calibratedProbability * 50) + patternBoost).toFixed(2));
  const finalScore = applyConfidence(unweightedFinalScore, confidence);
  const decision = modelScore?.decision
    ?? decisionFromExpectedValue(expectedValue)
    ?? buildDecision(finalScore, strategy);

  return {
    ratings,
    weights: strategy.scoring.weights,
    baseScore,
    final_score: finalScore,
    finalScore,
    probabilityOfSuccess: aiProbability,
    calibratedProbability,
    confidence,
    expectedValue,
    patternBoost,
    rawFinalScore: unweightedFinalScore,
    decision,
    rationale: modelScore?.rationale ?? fallbackRationale(ratings, opportunity),
    memoryPatterns: scoringContext,
  };
}
