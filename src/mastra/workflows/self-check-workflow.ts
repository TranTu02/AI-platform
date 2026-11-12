import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { collectSystemHealth, systemHealthSchema } from '../tools/system-health';

// Scheduled self-check: runs every 30 minutes (Asia/Bangkok) without any
// chat input. Same checks as the system-health tool, plus a rule-based
// verdict. View runs and pause/resume in Studio at /workflows/schedules.
// Delivery is best-effort (Mastra docs): a skipped fire is not replayed.

const checkReportSchema = z.object({
  scope: z.string(),
  verdict: z.enum(['PASS', 'WARN', 'FAIL']),
  summary: z.string(),
  health: systemHealthSchema,
});

const collectStep = createStep({
  id: 'collect-health',
  inputSchema: z.object({ scope: z.string() }),
  outputSchema: z.object({
    scope: z.string(),
    health: systemHealthSchema,
  }),
  execute: async ({ inputData }) => ({
    scope: inputData.scope,
    health: collectSystemHealth(),
  }),
});

const evaluateStep = createStep({
  id: 'evaluate-health',
  inputSchema: z.object({
    scope: z.string(),
    health: systemHealthSchema,
  }),
  outputSchema: checkReportSchema,
  execute: async ({ inputData }) => {
    const { health, scope } = inputData;
    const freeMB = health.memory.freeMB;
    const diskGB = health.diskAvailableGB;

    let verdict: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
    const problems: string[] = [];
    if (!health.ok) {
      verdict = 'FAIL';
      problems.push(
        ...health.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`),
      );
    } else if (freeMB < 1024 || (diskGB >= 0 && diskGB < 5)) {
      verdict = 'WARN';
      if (freeMB < 1024) problems.push(`free memory tight: ${freeMB} MB`);
      if (diskGB >= 0 && diskGB < 5) problems.push(`disk tight: ${diskGB} GB free`);
    }

    return {
      scope,
      verdict,
      summary:
        problems.length > 0
          ? `${verdict} — ${problems.join('; ')}`
          : `${verdict} — all checks ok (free ${freeMB} MB, disk ${diskGB} GB)`,
      health,
    };
  },
});

const reportStep = createStep({
  id: 'report',
  inputSchema: checkReportSchema,
  outputSchema: checkReportSchema,
  execute: async ({ inputData }) => {
    // The run itself is the record (visible in Studio traces + mastra.db).
    // Logging one line keeps the verdict greppable in server logs.
    console.log(`[self-check] ${inputData.scope}: ${inputData.summary}`);
    return inputData;
  },
});

export const selfCheckWorkflow = createWorkflow({
  id: 'self-check',
  inputSchema: z.object({ scope: z.string() }),
  outputSchema: checkReportSchema,
  schedule: {
    cron: '*/30 * * * *',
    timezone: 'Asia/Bangkok',
    inputData: { scope: 'system' },
  },
})
  .then(collectStep)
  .then(evaluateStep)
  .then(reportStep)
  .commit();
