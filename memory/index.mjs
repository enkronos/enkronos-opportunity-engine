import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MEMORY_PATH = process.env.OPPORTUNITY_ENGINE_MEMORY_PATH
  ? resolve(process.env.OPPORTUNITY_ENGINE_MEMORY_PATH)
  : join(__dirname, 'memory.json');
export const outcomeWeights = {
  replied: 1,
  meeting: 3,
  converted: 10,
  rejected: -3,
};

function defaultMemory() {
  return { history: [] };
}

function safeParseJson(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') {
      return defaultMemory();
    }

    if (!Array.isArray(parsed.history)) {
      parsed.history = [];
    }

    return parsed;
  } catch {
    return defaultMemory();
  }
}

function ensureMemoryFile(filePath = DEFAULT_MEMORY_PATH) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(filePath)) {
    writeFileSync(filePath, `${JSON.stringify(defaultMemory(), null, 2)}\n`);
  }
}

function extractText(opportunity) {
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

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

export function loadMemory(filePath = DEFAULT_MEMORY_PATH) {
  try {
    ensureMemoryFile(filePath);
    const raw = readFileSync(filePath, 'utf-8');
    return safeParseJson(raw);
  } catch {
    return defaultMemory();
  }
}

export function saveMemory(memory, filePath = DEFAULT_MEMORY_PATH) {
  try {
    ensureMemoryFile(filePath);
    const payload = {
      history: Array.isArray(memory?.history) ? memory.history : [],
    };
    const tmpPath = `${filePath}.tmp`;
    writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`);
    renameSync(tmpPath, filePath);
    return payload;
  } catch {
    return defaultMemory();
  }
}

export function storeOutcome(opportunity, score, outcome, metadataOrPath = {}, maybeFilePath = DEFAULT_MEMORY_PATH) {
  try {
    const metadata = typeof metadataOrPath === 'string' ? {} : (metadataOrPath ?? {});
    const filePath = typeof metadataOrPath === 'string' ? metadataOrPath : maybeFilePath;
    const memory = loadMemory(filePath);
    const entry = {
      id: opportunity?.id ?? `${Date.now()}`,
      opportunity: opportunity ?? {},
      score: score ?? {},
      outcome,
      action: metadata?.action ?? null,
      strategy: metadata?.strategy ?? null,
      policy: metadata?.policy ?? null,
      timestamp: new Date().toISOString(),
    };

    memory.history.push(entry);
    saveMemory(memory, filePath);
    return entry;
  } catch {
    return null;
  }
}

export function getSuccessPatterns(memory = loadMemory()) {
  try {
    const history = Array.isArray(memory?.history) ? memory.history : [];
    const successfulOutcomes = new Set(['replied', 'meeting', 'converted']);
    const successes = history.filter((entry) => successfulOutcomes.has(entry?.outcome));

    const industries = new Map();
    const roles = new Map();
    const keywords = new Map();

    for (const entry of successes) {
      const opportunity = entry?.opportunity ?? {};

      const industry = String(opportunity.industry ?? opportunity.sector ?? '').trim();
      if (industry) {
        industries.set(industry, (industries.get(industry) ?? 0) + 1);
      }

      const role = String(opportunity.title ?? opportunity.role ?? '').trim();
      if (role) {
        roles.set(role, (roles.get(role) ?? 0) + 1);
      }

      for (const token of tokenize(extractText(opportunity))) {
        keywords.set(token, (keywords.get(token) ?? 0) + 1);
      }
    }

    return {
      totalSuccesses: successes.length,
      industries: Array.from(industries.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count })),
      roles: Array.from(roles.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count })),
      keywords: Array.from(keywords.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count })),
    };
  } catch {
    return {
      totalSuccesses: 0,
      industries: [],
      roles: [],
      keywords: [],
    };
  }
}

export function computeWeightedPatterns(memory = loadMemory()) {
  try {
    const history = Array.isArray(memory?.history) ? memory.history : [];
    return history.map((item) => ({
      opportunity: item?.opportunity ?? {},
      weight: outcomeWeights[item?.outcome] || 0,
      outcome: item?.outcome ?? null,
    }));
  } catch {
    return [];
  }
}

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

export async function summarizeMemory(memory = loadMemory()) {
  const history = Array.isArray(memory?.history) ? memory.history : [];
  const usefulHistory = history.filter((item) => ['meeting', 'converted', 'rejected'].includes(item?.outcome));

  if (!process.env.OPENAI_API_KEY || usefulHistory.length === 0) {
    return null;
  }

  try {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `
You are analyzing historical outcomes of business opportunities.

Extract patterns that led to success.
Use only successful outcomes (meeting, converted) to infer success patterns.
Use rejected outcomes only to identify antiPatterns.
Keep the summary compact.

Return JSON:

{
  "topIndustries": [],
  "topRoles": [],
  "topCompanyTypes": [],
  "keyPatterns": [],
  "antiPatterns": []
}

Memory:
${JSON.stringify(usefulHistory)}
`;

    const response = await client.responses.create({
      model: 'gpt-5.2',
      input: prompt,
    });

    return JSON.parse(extractJsonPayload(response.output_text ?? ''));
  } catch (error) {
    console.error('[MEMORY] Failed to parse AI summary');
    return null;
  }
}
