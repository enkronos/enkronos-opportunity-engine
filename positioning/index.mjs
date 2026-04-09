import { generatePositioning } from './aiPositioning.mjs';

function buildFallbackPitch({ strategy, opportunity, scorecard }) {
  const label = opportunity.label ?? ([opportunity.company, opportunity.title].filter(Boolean).join(' — ') || 'the opportunity');
  const classification = opportunity.classification ?? opportunity.type ?? 'opportunity';
  const lines = [
    `${strategy.profile.role} focused on turning ambiguous openings into durable leverage.`,
    `Best fit here is a ${String(classification).replace(/_/g, ' ')} angle with ${label}, not a generic application.`,
    `The opportunity scores ${scorecard.final_score}/100 because it can compound strategy, relationships, and optionality at the same time.`,
  ];

  return lines.join('\n');
}

function buildWhyMe(strategy) {
  const strengths = strategy.profile.strengths.slice(0, 3).join(', ');
  return `${strategy.profile.role} with strengths in ${strengths || 'strategic execution'} and a positioning angle centered on ${strategy.profile.positioning.toLowerCase()}.`;
}

function buildWhyThisCompany(strategy, opportunity) {
  const company = opportunity.company ?? opportunity.organization ?? 'the company';
  const firstGoal = strategy.goals[0] ?? 'high-leverage growth';
  return `${company} is interesting because it sits close to ${firstGoal} and offers a more leveraged path than a standard job search motion.`;
}

function buildStrategicHook(opportunity) {
  const company = opportunity.company ?? opportunity.organization ?? 'the company';
  return `Lead with a concrete idea for ${company}: show how you would unlock leverage and distribution quickly, then ask for the smallest high-trust next step.`;
}

async function requestModelPositioning({ strategy, opportunity, scorecard }) {
  try {
    return await generatePositioning(opportunity, strategy, scorecard);
  } catch (error) {
    console.warn(`[POSITIONING][AI] Falling back to heuristics: ${error.message}`);
    return null;
  }
}

export async function buildPositioning({ strategy, opportunity, scorecard, useAI = true }) {
  const draft = useAI
    ? await requestModelPositioning({ strategy, opportunity, scorecard })
    : null;

  const shortPitch = draft?.pitch ?? draft?.shortPitch ?? draft?.short_pitch ?? buildFallbackPitch({ strategy, opportunity, scorecard });
  const whyMe = draft?.whyMe ?? draft?.why_me ?? buildWhyMe(strategy);
  const whyThisCompany = draft?.whyThisCompany ?? draft?.why_this_company ?? buildWhyThisCompany(strategy, opportunity);
  const strategicHook = draft?.strategicHook ?? draft?.strategic_hook ?? buildStrategicHook(opportunity);
  const angle = draft?.angle ?? opportunity.classification;

  return {
    pitch: shortPitch,
    whyMe,
    strategicHook,
    angle,
    short_pitch: shortPitch,
    why_me: whyMe,
    why_this_company: whyThisCompany,
    strategic_hook: strategicHook,
  };
}
