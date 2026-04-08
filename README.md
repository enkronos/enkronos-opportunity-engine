# Opportunity Engine

Opportunity Engine is a modular AI system for discovering, qualifying, and executing high-value opportunities. It replaces job-search automation with a founder-style operating loop:

- discover opportunities, not just job posts
- score them for leverage, access, alignment, and optionality
- generate positioning instead of a CV
- draft outreach across email, LinkedIn, and intro channels
- track everything in a CRM-like pipeline

## Core Shift

Old repo focus:
- job search automation
- CV generation
- skill-match scoring

New repo focus:
- opportunity discovery
- strategic scoring
- founder-level positioning
- opportunity creation and execution

## Module Layout

- `strategy/` loads profile, goals, constraints, and scoring weights from `strategy.yaml`
- `opportunity/` ingests raw opportunities and classifies them
- `scoring/` runs the weighted strategic scoring engine
- `positioning/` builds short pitch, why-me, why-this-company, and hook
- `outreach/` drafts email, LinkedIn DM, and intro requests
- `pipeline/` persists opportunity lifecycle state in `pipeline/opportunities.json`
- `engine/` orchestrates the full flow

## Scoring Model

Each opportunity is scored across:

- leverage
- capital access
- network value
- strategic alignment
- distribution power
- optionality
- time cost
- execution burden

The engine returns a weighted final score plus a decision:

- `pursue`
- `explore`
- `discard`

## Quick Start

1. Review and edit `strategy.yaml`.
2. Run `npm run doctor`.
3. Try the end-to-end demo with `npm run demo`.
4. Run real opportunity files with `npm run engine -- ./path/to/opportunities.json`.

Sample opportunity input lives in [examples/opportunities.sample.json](/Users/gianluca/Documents/GitHub/opportunity-engine/examples/opportunities.sample.json).

## AI Integration

If `OPENAI_API_KEY` is present, the engine can use OpenAI-compatible chat completions for:

- reasoning over opportunity quality
- structured scoring support
- positioning generation
- outreach copy generation

Without an API key, the system falls back to deterministic heuristics and templates.

## Current Output

Running the engine produces:

- a JSON report in `output/`
- updated pipeline records in [pipeline/opportunities.json](/Users/gianluca/Documents/GitHub/opportunity-engine/pipeline/opportunities.json)

That gives the repo a clear strategic operating loop without overbuilding an application framework around it.
