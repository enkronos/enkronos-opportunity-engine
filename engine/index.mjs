import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

import { selectAction } from '../actions/index.mjs';
import { executeAction } from '../execution/index.mjs';
import { getSuccessPatterns, loadMemory } from '../memory/index.mjs';
import { loadOpportunities } from '../opportunity/index.mjs';
import { adjustPolicy } from '../policy/index.mjs';
import { buildPositioning } from '../positioning/index.mjs';
import { decisionToStage, loadPipeline, recordExecution, updateOutcome, upsertPipelineItem } from '../pipeline/index.mjs';
import { rankOpportunities } from '../priority/index.mjs';
import { scoreOpportunity } from '../scoring/index.mjs';
import { loadStrategy } from '../strategy/index.mjs';
import { selectStrategy } from '../strategy/strategyEngine.mjs';
import { buildOutreach } from '../outreach/index.mjs';

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function evaluateOpportunitySet({
  inputPath,
  strategyPath,
  pipelinePath,
  outputDir,
  live = false,
  useAI = true,
}) {
  const strategy = loadStrategy(strategyPath);
  let memory = loadMemory();
  let memoryPatterns = getSuccessPatterns(memory);
  let memorySummary = memoryPatterns;
  let policy = adjustPolicy(memory);
  const opportunities = await loadOpportunities({ live, inputPath });
  mkdirSync(outputDir, { recursive: true });

  const evaluations = [];

  for (const [index, opportunity] of opportunities.entries()) {
    console.log(`[ENGINE] Processing opportunity ${index + 1}/${opportunities.length}: ${opportunity.label}`);
    const scorecard = await scoreOpportunity({ opportunity, strategy, useAI });
    console.log('[SCORING] Done');
    const positioning = await buildPositioning({ strategy, opportunity, scorecard, useAI });
    console.log('[POSITIONING] Done');
    const outreach = await buildOutreach({ strategy, opportunity, scorecard, positioning, useAI });
    console.log('[OUTREACH] Done');
    const action = selectAction({ ...opportunity, score: scorecard }, policy, Math.random());
    const strategyMode = selectStrategy({ ...opportunity, score: scorecard }, memorySummary);
    const status = decisionToStage(scorecard.decision);
    const execution = await executeAction({
      action,
      opportunity,
      positioning,
      outreach,
    });
    console.log('[EXECUTION] Done');
    const createdAt = new Date().toISOString();
    const result = {
      id: opportunity.id,
      score: scorecard,
      positioning,
      status: execution?.status ?? status,
      action,
      strategy: strategyMode,
      execution,
      policy,
      createdAt,
      opportunity,
    };

    upsertPipelineItem({
      key: opportunity.id,
      stage: execution?.status ?? status,
      status: execution?.status ?? status,
      classification: opportunity.classification,
      ...result,
      outreach,
    }, pipelinePath);

    const pipelineRecord = recordExecution(opportunity.id, execution, pipelinePath);

    const finalRecord = await updateOutcome(
      opportunity.id,
      execution?.status ?? status,
      pipelinePath,
      {
        opportunity,
        score: scorecard,
        action,
        strategy: strategyMode,
        policy,
        execution,
      }
    );
    console.log(
      `[AGENT] ${opportunity.label} -> action: ${action} -> channel: ${execution?.channel ?? 'none'} -> outcome: ${finalRecord?.status ?? execution?.status ?? status}`
    );

    memory = loadMemory();
    memoryPatterns = getSuccessPatterns(memory);
    memorySummary = memoryPatterns;
    policy = adjustPolicy(memory);

    evaluations.push({
      ...result,
      status: finalRecord?.status ?? status,
      outreach,
      pipeline: {
        key: pipelineRecord.key,
        stage: finalRecord?.stage ?? pipelineRecord.stage,
      },
    });
  }

  const summary = {
    processed: evaluations.length,
    pursue: evaluations.filter((item) => item.score.decision === 'pursue').length,
    explore: evaluations.filter((item) => item.score.decision === 'explore').length,
    discard: evaluations.filter((item) => item.score.decision === 'discard').length,
  };

  const topOpportunities = rankOpportunities(evaluations, memoryPatterns);
  console.log('[PRIORITY] Top opportunities:');
  topOpportunities.forEach((item, index) => {
    const label = item.opportunity?.company ?? item.id;
    console.log(`${index + 1}. ${label} -> EV: ${Math.round(item.score.expectedValue)} -> ${item.mode}`);
  });

  const report = {
    generated_at: new Date().toISOString(),
    strategy: {
      role: strategy.profile.role,
      positioning: strategy.profile.positioning,
      goals: strategy.goals,
    },
    summary,
    memoryPatterns,
    policy,
    topOpportunities,
    evaluations,
    pipeline_summary: loadPipeline(pipelinePath).reduce((accumulator, item) => {
      accumulator[item.stage] = (accumulator[item.stage] || 0) + 1;
      return accumulator;
    }, {}),
  };

  const reportPath = join(outputDir, `opportunity-report-${timestamp()}.json`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  return { report, reportPath };
}
