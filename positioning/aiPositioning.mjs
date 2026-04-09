function extractJsonPayload(text) {
  const fenced = String(text).match(/```json\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }

  const firstBrace = String(text).indexOf('{');
  const lastBrace = String(text).lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return String(text).slice(firstBrace, lastBrace + 1);
  }

  return String(text).trim();
}

function logRawResponse(rawResponse) {
  console.warn('[POSITIONING][AI] Failed to parse AI response. Raw output follows:');
  console.warn(rawResponse);
}

export async function generatePositioning(opportunity, strategy, score) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `
You are a founder-level strategist.

Generate a concise positioning message for this opportunity.

Output JSON:

{
  "pitch": "...",
  "whyMe": "...",
  "strategicHook": "...",
  "angle": "..."
}

Opportunity:
${JSON.stringify(opportunity)}

Strategy:
${JSON.stringify(strategy)}

Score:
${JSON.stringify(score)}
`;

  const response = await client.responses.create({
    model: 'gpt-5.2',
    input: prompt,
  });

  const raw = response.output_text ?? '';
  try {
    return JSON.parse(extractJsonPayload(raw));
  } catch (error) {
    logRawResponse(raw);
    throw new Error(`Unable to parse AI positioning response: ${error.message}`);
  }
}
