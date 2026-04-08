# Architecture

## Overview

Opportunity Engine is intentionally small. The codebase is organized as a sequence of composable modules rather than a monolithic app:

`strategy -> opportunity -> scoring -> positioning -> outreach -> pipeline`

The orchestration layer in `engine/` wires these modules together and writes reports plus pipeline state.

## 1. Strategy

Files:
- [strategy/index.mjs](/Users/gianluca/Documents/GitHub/opportunity-engine/strategy/index.mjs)
- [strategy.yaml](/Users/gianluca/Documents/GitHub/opportunity-engine/strategy.yaml)

Responsibilities:
- load profile, goals, constraints, and target opportunity types
- validate the strategic profile
- expose scoring weights and thresholds

This module is the source of truth for what “good” looks like.

## 2. Opportunity

Files:
- [opportunity/index.mjs](/Users/gianluca/Documents/GitHub/opportunity-engine/opportunity/index.mjs)

Responsibilities:
- ingest raw opportunity records from JSON
- normalize shape and identifiers
- classify opportunities into categories such as advisory, partnership, investor, consulting, pilot, speaking, or job

The output is a normalized opportunity object ready for downstream scoring.

## 3. Scoring

Files:
- [scoring/index.mjs](/Users/gianluca/Documents/GitHub/opportunity-engine/scoring/index.mjs)

Responsibilities:
- compute factor ratings
- apply the weighted scoring model
- return a normalized final score and decision

Decision thresholds are strategy-driven:
- `pursue`
- `explore`
- `discard`

## 4. Positioning

Files:
- [positioning/index.mjs](/Users/gianluca/Documents/GitHub/opportunity-engine/positioning/index.mjs)

Responsibilities:
- generate a short pitch
- explain “why me”
- explain “why this company”
- frame a strategic hook

This deliberately replaces CV-generation logic with strategic narrative generation.

## 5. Outreach

Files:
- [outreach/index.mjs](/Users/gianluca/Documents/GitHub/opportunity-engine/outreach/index.mjs)

Responsibilities:
- draft email outreach
- draft LinkedIn DMs
- draft intro requests

The module is message-channel aware, but stays lightweight and text-first.

## 6. Pipeline

Files:
- [pipeline/index.mjs](/Users/gianluca/Documents/GitHub/opportunity-engine/pipeline/index.mjs)
- [pipeline/opportunities.json](/Users/gianluca/Documents/GitHub/opportunity-engine/pipeline/opportunities.json)

Responsibilities:
- persist opportunity lifecycle state
- update or upsert records
- verify the pipeline store
- summarize stage counts

Canonical stages:
- `discovered`
- `qualified`
- `positioning_ready`
- `outreach_drafted`
- `contacted`
- `replied`
- `meeting`
- `won`
- `paused`
- `discarded`

## 7. AI Adapter

Files:
- [shared/openai.mjs](/Users/gianluca/Documents/GitHub/opportunity-engine/shared/openai.mjs)

Responsibilities:
- call an OpenAI-compatible chat completions endpoint
- return structured JSON for scoring, positioning, and outreach
- fall back gracefully when no API key is present

## 8. Orchestration

Files:
- [engine/index.mjs](/Users/gianluca/Documents/GitHub/opportunity-engine/engine/index.mjs)
- [opportunity-engine.mjs](/Users/gianluca/Documents/GitHub/opportunity-engine/opportunity-engine.mjs)

Responsibilities:
- run the end-to-end flow
- write reports to `output/`
- sync the pipeline store

## Data Flow

1. Load strategy from `strategy.yaml`
2. Ingest and classify opportunities
3. Score each opportunity with weights and thresholds
4. Generate positioning for the opportunities worth attention
5. Generate outreach drafts
6. Save lifecycle state into the pipeline store
7. Emit a JSON report for review or downstream automation
