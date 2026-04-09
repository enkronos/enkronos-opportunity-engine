export const actions = [
  'ignore',
  'research',
  'outreach',
  'deep_followup',
];

export function selectAction(opportunity, policy = {}, randomValue = 0.5) {
  const probabilityOfSuccess =
    opportunity?.score?.calibratedProbability ??
    opportunity?.score?.probabilityOfSuccess ??
    0.5;
  const confidence = opportunity?.score?.confidence ?? 0.5;
  const outreachThreshold = policy?.outreachThreshold ?? 0.7;
  const explorationRate = policy?.explorationRate ?? 0.2;

  if (probabilityOfSuccess > 0.85 && confidence > 0.75) {
    return 'deep_followup';
  }

  if (probabilityOfSuccess > outreachThreshold && confidence > 0.6) {
    return 'outreach';
  }

  if (randomValue < explorationRate && confidence < 0.6) {
    return 'research';
  }

  if (probabilityOfSuccess > 0.5) {
    return 'research';
  }

  if (probabilityOfSuccess < 0.3) {
    return 'ignore';
  }

  return 'research';
}
