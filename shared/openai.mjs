const DEFAULT_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

function extractText(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.type === 'text') return item.text;
        return '';
      })
      .join('\n');
  }

  return '';
}

function extractJsonBlock(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();

  const inline = text.match(/\{[\s\S]*\}/);
  return inline ? inline[0] : text;
}

export function hasLanguageModelConfig() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateStructuredOutput({
  systemPrompt,
  userPrompt,
  temperature = 0.2,
  maxTokens = 1200,
}) {
  if (!hasLanguageModelConfig()) {
    return null;
  }

  const response = await fetch(`${DEFAULT_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${message}`);
  }

  const payload = await response.json();
  const text = extractText(payload?.choices?.[0]?.message?.content ?? '');
  if (!text.trim()) {
    throw new Error('OpenAI response was empty');
  }

  return JSON.parse(extractJsonBlock(text));
}

export async function maybeGenerateStructuredOutput(options) {
  try {
    return await generateStructuredOutput(options);
  } catch {
    return null;
  }
}
