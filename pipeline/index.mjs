import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PIPELINE_PATH = process.env.OPPORTUNITY_ENGINE_PIPELINE_PATH
  ? resolve(process.env.OPPORTUNITY_ENGINE_PIPELINE_PATH)
  : join(__dirname, 'opportunities.json');

export const PIPELINE_STAGES = [
  'discovered',
  'contacted',
  'replied',
  'meeting',
  'converted',
  'rejected',
  'qualified',
  'positioning_ready',
  'outreach_drafted',
  'won',
  'paused',
  'discarded',
];

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function pipelineKey(opportunity) {
  return normalizeKey(`${opportunity.company}-${opportunity.title}`);
}

export function ensurePipelineStore(filePath = DEFAULT_PIPELINE_PATH) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(filePath)) {
    writeFileSync(filePath, '[]\n');
  }
}

export function loadPipeline(filePath = DEFAULT_PIPELINE_PATH) {
  ensurePipelineStore(filePath);
  try {
    const content = readFileSync(filePath, 'utf-8').trim();
    if (!content) return [];
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePipeline(records, filePath = DEFAULT_PIPELINE_PATH) {
  ensurePipelineStore(filePath);
  writeFileSync(filePath, `${JSON.stringify(records, null, 2)}\n`);
}

export function decisionToStage(decision) {
  switch (decision) {
    case 'pursue':
      return 'discovered';
    case 'explore':
      return 'discovered';
    default:
      return 'rejected';
  }
}

export function upsertPipelineItem(item, filePath = DEFAULT_PIPELINE_PATH) {
  const records = loadPipeline(filePath);
  const key = item.key ?? pipelineKey(item.opportunity);
  const existingIndex = records.findIndex((record) => record.key === key);
  const existing = existingIndex >= 0 ? records[existingIndex] : null;
  const nextItem = {
    ...item,
    key,
    createdAt: item.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    records[existingIndex] = {
      ...existing,
      ...nextItem,
    };
  } else {
    records.push(nextItem);
  }

  savePipeline(records, filePath);
  return nextItem;
}

function normalizeOutcome(outcome) {
  return String(outcome || '').trim().toLowerCase();
}

export function recordExecution(id, execution = {}, filePath = DEFAULT_PIPELINE_PATH) {
  const records = loadPipeline(filePath);
  const index = records.findIndex((record) => String(record.id ?? record.key) === String(id));
  const existing = index >= 0 ? records[index] : null;
  const executionEntry = {
    ...execution,
    timestamp: new Date().toISOString(),
  };

  const nextRecord = {
    ...(existing ?? {}),
    id: existing?.id ?? String(id),
    key: existing?.key ?? String(id),
    status: execution?.status ?? existing?.status ?? 'discovered',
    stage: execution?.status ?? existing?.stage ?? 'discovered',
    execution: executionEntry,
    executionLog: [...(existing?.executionLog ?? []), executionEntry],
    updated_at: new Date().toISOString(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  if (index >= 0) {
    records[index] = nextRecord;
  } else {
    records.push(nextRecord);
  }

  savePipeline(records, filePath);
  return nextRecord;
}

export async function updateOutcome(id, outcome, filePath = DEFAULT_PIPELINE_PATH, metadata = {}) {
  const normalizedOutcome = normalizeOutcome(outcome);
  const records = loadPipeline(filePath);
  const index = records.findIndex((record) => String(record.id ?? record.key) === String(id));

  const existing = index >= 0 ? records[index] : null;
  const nextRecord = {
    ...(existing ?? {}),
    id: existing?.id ?? String(id),
    key: existing?.key ?? String(id),
    status: normalizedOutcome,
    stage: normalizedOutcome,
    outcome: normalizedOutcome,
    action: metadata?.action ?? existing?.action ?? null,
    strategy: metadata?.strategy ?? existing?.strategy ?? null,
    policy: metadata?.policy ?? existing?.policy ?? null,
    execution: metadata?.execution ?? existing?.execution ?? null,
    outcomeHistory: [
      ...(existing?.outcomeHistory ?? []),
      {
        outcome: normalizedOutcome,
        timestamp: new Date().toISOString(),
      },
    ],
    updated_at: new Date().toISOString(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  if (index >= 0) {
    records[index] = nextRecord;
  } else {
    records.push(nextRecord);
  }

  savePipeline(records, filePath);

  try {
    const memoryModule = await import('../memory/index.mjs');
    memoryModule.storeOutcome(
      metadata?.opportunity ?? existing?.opportunity ?? { id: String(id) },
      metadata?.score ?? existing?.score ?? {},
      normalizedOutcome,
      {
        action: metadata?.action ?? existing?.action ?? null,
        strategy: metadata?.strategy ?? existing?.strategy ?? null,
        policy: metadata?.policy ?? existing?.policy ?? null,
      }
    );
  } catch (error) {
    console.warn(`[PIPELINE] Memory update skipped: ${error.message}`);
  }

  return nextRecord;
}

export function summarizePipeline(records) {
  const counts = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage, 0]));
  for (const record of records) {
    counts[record.stage] = (counts[record.stage] || 0) + 1;
  }
  return counts;
}

export function verifyPipelineStore(filePath = DEFAULT_PIPELINE_PATH) {
  const records = loadPipeline(filePath);
  const errors = [];
  const warnings = [];
  const seen = new Set();

  for (const record of records) {
    if (!PIPELINE_STAGES.includes(record.stage)) {
      errors.push(`Invalid stage "${record.stage}" for ${record.key}`);
    }

    if (seen.has(record.key)) {
      errors.push(`Duplicate pipeline key "${record.key}"`);
    }
    seen.add(record.key);

    if (typeof record.score?.final_score !== 'number') {
      warnings.push(`Missing numeric score for ${record.key}`);
    }
  }

  return { records, errors, warnings, summary: summarizePipeline(records) };
}
