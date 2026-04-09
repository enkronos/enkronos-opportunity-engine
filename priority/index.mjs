function normalizeText(opportunity) {
  return [
    opportunity?.company,
    opportunity?.title,
    opportunity?.role,
    opportunity?.industry,
    opportunity?.sector,
    opportunity?.summary,
    opportunity?.description,
    ...(Array.isArray(opportunity?.tags) ? opportunity.tags : []),
    ...(Array.isArray(opportunity?.signals) ? opportunity.signals : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function shouldExplore(probability, confidence = 0.5, randomValue = Math.random()) {
  const normalizedProbability = Number.isFinite(Number(probability)) ? Number(probability) : 0.5;
  const normalizedConfidence = Number.isFinite(Number(confidence)) ? Number(confidence) : 0.5;
  const explorationRate = 0.2;

  if (randomValue < explorationRate) return true;
  if (normalizedConfidence < 0.5) return true;
  if (normalizedProbability < 0.4) return true;

  return false;
}

export function matchesPattern(opportunity, memoryPatterns) {
  if (!memoryPatterns) return false;

  const text = normalizeText(opportunity);
  const patternValues = [
    ...(Array.isArray(memoryPatterns.industries) ? memoryPatterns.industries : []),
    ...(Array.isArray(memoryPatterns.roles) ? memoryPatterns.roles : []),
    ...(Array.isArray(memoryPatterns.keywords) ? memoryPatterns.keywords : []),
  ]
    .map((item) => String(item.value ?? item).toLowerCase())
    .filter(Boolean);

  return patternValues.some((value) => text.includes(value));
}

function scoreValue(opportunity) {
  const score = opportunity?.score;
  const expectedValue = score?.expectedValue ?? score?.expected_value ?? 0;
  const probabilityOfSuccess =
    score?.calibratedProbability ??
    score?.calibrated_probability ??
    score?.probabilityOfSuccess ??
    score?.probability_of_success ??
    0.5;

  return (Number(expectedValue) || 0) + ((Number(probabilityOfSuccess) || 0.5) * 100);
}

function applyPriorityBoost(opportunity, memoryPatterns) {
  const candidate = opportunity?.opportunity ?? opportunity;
  const priorityScore = scoreValue(opportunity);
  const probability =
    opportunity?.score?.calibratedProbability ??
    opportunity?.score?.probabilityOfSuccess ??
    0.5;
  const confidence = opportunity?.score?.confidence ?? 0.5;
  const mode = shouldExplore(probability, confidence) ? 'explore' : 'exploit';
  const boosted = matchesPattern(candidate, memoryPatterns);

  return {
    ...opportunity,
    priorityScore,
    memoryBoost: boosted ? 10 : 0,
    mode,
  };
}

export function rankOpportunities(opportunities, memoryPatterns = null) {
  return (Array.isArray(opportunities) ? opportunities : [])
    .map((opportunity) => applyPriorityBoost(opportunity, memoryPatterns))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 5);
}
