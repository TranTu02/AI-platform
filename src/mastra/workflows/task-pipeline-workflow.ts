import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Deterministic task pipeline, mirroring the Harness v2 style:
// Normalize -> Plan -> Scope -> Execute -> Evaluate -> Egress.
// Every step is a pure, typed transform — no LLM call inside the pipeline,
// so the same input always produces the same verdict. The coordinator agent
// can hand a task to this workflow, or it can be run directly from Studio
// or `npx mastra api workflow run start task-pipeline`.

const taskRecordSchema = z.object({
  id: z.string(),
  task: z.string(),
  taskType: z.enum(['research', 'ops', 'general']),
  priority: z.enum(['low', 'normal', 'high']),
  route: z.string().optional(),
  plan: z.array(z.string()).optional(),
  status: z.string().optional(),
  score: z.number().optional(),
  verdict: z.string().optional(),
  summary: z.string().optional(),
});

type TaskRecord = z.infer<typeof taskRecordSchema>;

const routeFor = (taskType: TaskRecord['taskType']): string =>
  taskType === 'research'
    ? 'research-agent'
    : taskType === 'ops'
      ? 'ops-agent'
      : 'coordinator-agent';

const normalizeStep = createStep({
  id: 'normalize',
  inputSchema: z.object({
    task: z.string(),
    taskType: z.enum(['research', 'ops', 'general']),
    priority: z.enum(['low', 'normal', 'high']),
  }),
  outputSchema: taskRecordSchema,
  execute: async ({ inputData }) => ({
    id: `task-${Date.now()}`,
    task: inputData.task.trim(),
    taskType: inputData.taskType,
    priority: inputData.priority,
    status: 'normalized',
  }),
});

const planStep = createStep({
  id: 'plan',
  inputSchema: taskRecordSchema,
  outputSchema: taskRecordSchema,
  execute: async ({ inputData }) => ({
    ...inputData,
    route: routeFor(inputData.taskType),
    plan: [
      'normalize',
      'plan',
      'scope',
      'execute',
      'evaluate',
      'egress',
    ],
    status: 'planned',
  }),
});

const scopeStep = createStep({
  id: 'scope',
  inputSchema: taskRecordSchema,
  outputSchema: taskRecordSchema,
  execute: async ({ inputData }) => {
    if (!inputData.task) {
      return { ...inputData, status: 'rejected', verdict: 'rejected' };
    }
    return { ...inputData, status: 'scoped' };
  },
});

const executeStep = createStep({
  id: 'execute',
  inputSchema: taskRecordSchema,
  outputSchema: taskRecordSchema,
  execute: async ({ inputData }) => {
    if (inputData.status === 'rejected') {
      return {
        ...inputData,
        summary: 'Việc bị từ chối ở bước scope: nội dung việc trống.',
        status: 'executed',
      };
    }
    return {
      ...inputData,
      summary: `Đã chuyển cho ${inputData.route}, mức ưu tiên ${inputData.priority}.`,
      status: 'executed',
    };
  },
});

const evaluateStep = createStep({
  id: 'evaluate',
  inputSchema: taskRecordSchema,
  outputSchema: taskRecordSchema,
  execute: async ({ inputData }) => {
    if (inputData.status === 'rejected') {
      return { ...inputData, score: 0, verdict: 'rejected', status: 'evaluated' };
    }
    let score = 0;
    if (inputData.task) score += 1;
    if (inputData.route) score += 1;
    if (['low', 'normal', 'high'].includes(inputData.priority)) score += 1;
    return {
      ...inputData,
      score,
      verdict: score === 3 ? 'pass' : 'review',
      status: 'evaluated',
    };
  },
});

const egressStep = createStep({
  id: 'egress',
  inputSchema: taskRecordSchema,
  outputSchema: taskRecordSchema,
  execute: async ({ inputData }) => ({
    ...inputData,
    summary: `[${inputData.verdict ?? 'pending'}] ${inputData.id}: ${inputData.summary ?? ''}`.trim(),
    status: 'done',
  }),
});

export const taskPipelineWorkflow = createWorkflow({
  id: 'task-pipeline',
  inputSchema: z.object({
    task: z.string(),
    taskType: z.enum(['research', 'ops', 'general']),
    priority: z.enum(['low', 'normal', 'high']),
  }),
  outputSchema: taskRecordSchema,
})
  .then(normalizeStep)
  .then(planStep)
  .then(scopeStep)
  .then(executeStep)
  .then(evaluateStep)
  .then(egressStep)
  .commit();
