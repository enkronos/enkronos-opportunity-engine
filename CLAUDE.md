# Opportunity Engine

This repository is no longer centered on job-search automation.

## Mission

Opportunity Engine helps a strategist, founder, or operator:

- discover high-value opportunities
- score them for leverage and strategic fit
- generate positioning instead of a CV
- draft outreach
- track the resulting pipeline

## Core Files

- `strategy.yaml` is the source of truth for profile, goals, constraints, and score weights
- `examples/opportunities.sample.json` is the reference input format
- `pipeline/opportunities.json` is the lightweight CRM store
- `output/` contains generated reports

## Runtime

- `npm run doctor` validates local readiness
- `npm run demo` runs a sample end-to-end pass
- `npm run engine -- ./path/to/opportunities.json` evaluates real opportunities
- `npm run verify` validates the pipeline store

## Design Rules

- Keep modules small and composable
- Prefer explicit JSON output over hidden state
- Use AI where it sharpens judgment or messaging, not where deterministic logic is clearer
- Do not reintroduce CV-generation workflows into the active runtime
