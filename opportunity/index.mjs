import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const TYPE_KEYWORDS = [
  { type: 'advisory', keywords: ['advisor', 'advisory', 'board', 'fractional'] },
  { type: 'partnership', keywords: ['partner', 'partnership', 'alliances', 'channel'] },
  { type: 'investor', keywords: ['investor', 'fund', 'venture', 'capital', 'portfolio'] },
  { type: 'consulting', keywords: ['consulting', 'consultant', 'engagement'] },
  { type: 'pilot_customer', keywords: ['pilot', 'design partner', 'beta customer', 'proof of concept'] },
  { type: 'speaking', keywords: ['conference', 'summit', 'keynote', 'podcast'] },
  { type: 'community', keywords: ['community', 'ecosystem', 'ambassador'] },
  { type: 'job', keywords: ['job', 'role', 'hiring', 'full-time', 'staff engineer', 'head of'] },
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SAMPLE_PATH = join(__dirname, '..', 'examples', 'opportunities.sample.json');

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toSentenceCase(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function deriveCompanyFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'live-web';
  }
}

export function classifyOpportunity(opportunity) {
  const haystack = [
    opportunity.type,
    opportunity.title,
    opportunity.company,
    opportunity.summary,
    opportunity.description,
    ...(opportunity.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const matcher of TYPE_KEYWORDS) {
    if (matcher.keywords.some((keyword) => haystack.includes(keyword))) {
      return matcher.type;
    }
  }

  return 'other';
}

export function normalizeOpportunity(rawOpportunity) {
  const opportunity = {
    id: rawOpportunity.id,
    title: rawOpportunity.title ?? rawOpportunity.role ?? 'Untitled opportunity',
    company: rawOpportunity.company ?? rawOpportunity.organization ?? 'Unknown organization',
    source: rawOpportunity.source ?? 'manual',
    link: rawOpportunity.link ?? rawOpportunity.url ?? '',
    summary: rawOpportunity.summary ?? '',
    description: rawOpportunity.description ?? '',
    tags: Array.isArray(rawOpportunity.tags) ? rawOpportunity.tags : [],
    geography: rawOpportunity.geography ?? rawOpportunity.location ?? 'Unknown',
    type: rawOpportunity.type ?? '',
    signals: Array.isArray(rawOpportunity.signals) ? rawOpportunity.signals : [],
    contactName: rawOpportunity.contactName ?? rawOpportunity.contact?.name ?? '',
    contactEmail: rawOpportunity.contactEmail ?? rawOpportunity.email ?? rawOpportunity.contact?.email ?? '',
    linkedinUrl: rawOpportunity.linkedinUrl ?? rawOpportunity.contact?.linkedin ?? '',
    metadata: rawOpportunity.metadata ?? {},
  };

  const classification = classifyOpportunity(opportunity);
  const id = opportunity.id || slugify(`${opportunity.company}-${opportunity.title}`);

  return {
    ...opportunity,
    id,
    classification,
    label: `${opportunity.company} — ${opportunity.title}`,
  };
}

export function ingestOpportunities(records) {
  if (!Array.isArray(records)) {
    return [normalizeOpportunity(records)];
  }

  return records.map((record) => normalizeOpportunity(record));
}

export function readOpportunityInput(inputPath) {
  const content = readFileSync(inputPath, 'utf-8');
  const payload = safeJsonParse(content, []);
  return ingestOpportunities(payload);
}

export async function fetchFromWeb() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('Playwright is not available in this workspace');
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto('https://jobs.ashbyhq.com', { waitUntil: 'domcontentloaded' });

    const jobs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map((el) => ({
          title: (el.innerText || el.textContent || '').trim(),
          url: el.href || '',
        }))
        .filter((job) => job.title && job.url)
        .slice(0, 20);
    });

    return jobs;
  } finally {
    await browser.close();
  }
}

export async function loadOpportunities({ live = false, inputPath, samplePath = DEFAULT_SAMPLE_PATH } = {}) {
  if (live) {
    try {
      const liveJobs = await fetchFromWeb();
      if (liveJobs.length > 0) {
        return liveJobs.map((job, index) => normalizeOpportunity({
          id: `live-${index + 1}`,
          title: job.title,
          company: deriveCompanyFromUrl(job.url),
          source: 'live',
          link: job.url,
          summary: 'Live opportunity discovered via Playwright',
          description: `Live listing pulled from ${job.url}`,
          tags: ['live', 'web'],
          signals: ['playwright'],
          metadata: {
            source: 'ashbyhq',
            source_url: job.url,
          },
        }));
      }
    } catch (error) {
      console.warn(`[OPPORTUNITY] Live ingestion failed: ${error.message}. Falling back to sample input.`);
    }
  }

  if (inputPath) {
    return readOpportunityInput(inputPath);
  }

  return readOpportunityInput(samplePath);
}

export function describeOpportunity(opportunity) {
  return {
    id: opportunity.id,
    label: opportunity.label,
    classification: toSentenceCase(opportunity.classification),
    source: opportunity.source,
    link: opportunity.link,
  };
}
