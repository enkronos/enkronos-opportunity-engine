function normalizeValues(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => String(item?.value ?? item).toLowerCase())
    .filter(Boolean);
}

export function selectStrategy(opportunity, memorySummary) {
  const industry = String(opportunity?.industry ?? opportunity?.sector ?? '').toLowerCase();
  const topIndustries = normalizeValues(memorySummary?.topIndustries ?? memorySummary?.industries);

  if (industry && topIndustries.includes(industry)) {
    return 'exploit';
  }

  if ((opportunity?.score?.confidence ?? 0.5) < 0.4) {
    return 'explore';
  }

  return 'balanced';
}
