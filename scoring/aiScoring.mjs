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
  console.warn('[SCORING][AI] Failed to parse AI response. Raw output follows:');
  console.warn(rawResponse);
}

export async function scoreWithAI(opportunity, strategy, successPatterns = {}) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `
You are a strategic analyst predicting opportunity success.

Estimate probability of success based on:
- opportunity data
- strategy
- historical patterns

Return JSON:
{
  "leverage": number,
  "alignment": number,
  "probabilityOfSuccess": number,
  "expectedValue": number,
  "confidence": number,
  "decision": "pursue" | "explore" | "discard"
}

Use realistic probabilities between 0 and 1.
Confidence must be between 0 and 1.
Expected value should reflect the strength of the opportunity times the probability of success.
Decision must be based on expected value, not raw score alone.

Historical Patterns:
${JSON.stringify(successPatterns)}

Also consider these strategic dimensions:
- leverage
- capital access
- network value
- strategic alignment
- optionality
- execution cost (negative)
- time cost (negative)

Opportunity:
${JSON.stringify(opportunity)}

Strategy:
${JSON.stringify(strategy)}
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
    throw new Error(`Unable to parse AI scoring response: ${error.message}`);
  }
}
