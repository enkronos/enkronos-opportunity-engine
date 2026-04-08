function fallbackLinkedIn(opportunity = {}, positioning = {}, outreach = {}) {
  return {
    body:
      outreach?.linkedin_dm
      ?? [
        `Hi ${opportunity.contactName ?? ''}`.trim(),
        positioning?.pitch ?? positioning?.short_pitch ?? `I have a concrete angle for ${opportunity.company ?? 'your team'}.`,
        positioning?.strategicHook ?? positioning?.strategic_hook ?? 'Happy to share a short strategic note if useful.',
      ]
        .filter(Boolean)
        .join('\n'),
    safeMode: true,
    nextStep: 'manual_send',
  };
}

function extractJsonPayload(text) {
  const fenced = String(text ?? '').match(/```json\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }

  const firstBrace = String(text ?? '').indexOf('{');
  const lastBrace = String(text ?? '').lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return String(text).slice(firstBrace, lastBrace + 1);
  }

  return String(text ?? '').trim();
}

export async function generateLinkedInDm(opportunity, positioning, outreach = {}) {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackLinkedIn(opportunity, positioning, outreach);
  }

  try {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `
Write a concise LinkedIn DM draft in safe mode.

Constraints:
- 3-5 short lines
- personalized
- sharp, strategic tone
- no hype, no spam, no forced urgency
- this is draft-only for manual sending

Opportunity:
${JSON.stringify(opportunity)}

Positioning:
${JSON.stringify(positioning)}

Output:
{
  "body": "...",
  "safeMode": true,
  "nextStep": "manual_send"
}
`;

    const res = await client.responses.create({
      model: 'gpt-5.2',
      input: prompt,
    });

    const parsed = JSON.parse(extractJsonPayload(res.output_text ?? ''));
    return {
      body: parsed?.body ?? fallbackLinkedIn(opportunity, positioning, outreach).body,
      safeMode: parsed?.safeMode ?? true,
      nextStep: parsed?.nextStep ?? 'manual_send',
    };
  } catch (error) {
    console.warn(`[EXECUTION] LinkedIn draft fallback: ${error.message}`);
    return fallbackLinkedIn(opportunity, positioning, outreach);
  }
}
