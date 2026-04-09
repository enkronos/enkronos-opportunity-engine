import { maybeGenerateStructuredOutput } from '../shared/openai.mjs';

function fallbackEmail({ opportunity, positioning }) {
  return [
    `Hi ${opportunity.company} team,`,
    '',
    positioning.short_pitch,
    '',
    `Why me: ${positioning.why_me}`,
    `Why now: ${positioning.why_this_company}`,
    '',
    `Strategic hook: ${positioning.strategic_hook}`,
    '',
    'If useful, I can send a one-page opportunity memo or jump on a short call.',
  ].join('\n');
}

function fallbackLinkedInDm({ opportunity, positioning }) {
  return [
    `Hi — I’ve been looking at ${opportunity.company} through a strategic lens rather than a standard application flow.`,
    positioning.strategic_hook,
    'If relevant, happy to share a brief note with a concrete angle.',
  ].join(' ');
}

function fallbackIntroRequest({ opportunity, positioning }) {
  return `Would you be open to introducing me to the right person at ${opportunity.company}? I have a concrete angle: ${positioning.strategic_hook}`;
}

async function requestModelOutreach({ strategy, opportunity, scorecard, positioning }) {
  return maybeGenerateStructuredOutput({
    systemPrompt: [
      'You generate concise strategic outreach.',
      'Return strict JSON with email_subject, email_body, linkedin_dm, intro_request.',
      'Keep it sharp, specific, and avoid sounding like a job application.',
    ].join(' '),
    userPrompt: JSON.stringify({ strategy, opportunity, scorecard, positioning }),
    temperature: 0.5,
  });
}

export async function buildOutreach({ strategy, opportunity, scorecard, positioning, useAI = true }) {
  const draft = useAI
    ? await requestModelOutreach({ strategy, opportunity, scorecard, positioning })
    : null;

  return {
    email_subject: draft?.email_subject ?? `Strategic idea for ${opportunity.company}`,
    email_body: draft?.email_body ?? fallbackEmail({ opportunity, positioning }),
    linkedin_dm: draft?.linkedin_dm ?? fallbackLinkedInDm({ opportunity, positioning }),
    intro_request: draft?.intro_request ?? fallbackIntroRequest({ opportunity, positioning }),
  };
}
