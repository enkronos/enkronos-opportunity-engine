function fallbackEmail(opportunity = {}, positioning = {}, outreach = {}) {
  const subject =
    outreach?.email_subject
    ?? `Strategic idea for ${opportunity.company ?? 'your team'}`;

  const body =
    outreach?.email_body
    ?? [
      `Hi ${opportunity.contactName ?? opportunity.company ?? 'there'},`,
      '',
      positioning?.short_pitch ?? positioning?.pitch ?? 'I have a concrete angle worth sharing.',
      positioning?.why_me ? `Why me: ${positioning.why_me}` : positioning?.whyMe,
      positioning?.strategic_hook ? `Strategic hook: ${positioning.strategic_hook}` : positioning?.strategicHook,
      'If useful, I can send a one-page memo or jump on a short call.',
    ]
      .filter(Boolean)
      .join('\n');

  return { subject, body };
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

export async function generateEmail(opportunity, positioning, outreach = {}) {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackEmail(opportunity, positioning, outreach);
  }

  try {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `
Write a concise, high-quality cold email.

Constraints:
- 5–7 lines max
- personalized
- no spam tone
- strong strategic hook

Opportunity:
${JSON.stringify(opportunity)}

Positioning:
${JSON.stringify(positioning)}

Output:
{
  "subject": "...",
  "body": "..."
}
`;

    const res = await client.responses.create({
      model: 'gpt-5.2',
      input: prompt,
    });

    const parsed = JSON.parse(extractJsonPayload(res.output_text ?? ''));
    return {
      subject: parsed?.subject ?? fallbackEmail(opportunity, positioning, outreach).subject,
      body: parsed?.body ?? fallbackEmail(opportunity, positioning, outreach).body,
    };
  } catch (error) {
    console.warn(`[EXECUTION] Email generation fallback: ${error.message}`);
    return fallbackEmail(opportunity, positioning, outreach);
  }
}
