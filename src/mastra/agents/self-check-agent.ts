import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { systemHealthTool } from '../tools/system-health';

export const selfCheckAgent = new Agent({
  id: 'self-check-agent',
  name: 'Self-Check Agent',
  description:
    'Runs a system self-check on demand and reports PASS / WARN / FAIL with findings. Use when the user asks for a health check, and as the agent behind the scheduled self-check workflow.',
  instructions: `You are a self-check subagent. Run the system-health tool, then judge the result:
- PASS: every check is ok.
- WARN: all core checks are ok but something is tight (free memory under 1 GB or disk under 5 GB).
- FAIL: any check failed, or OPENAI_API_KEY is missing.
- Answer in Vietnamese unless the user asked in another language.
- Reply with one line for the verdict, then the failing or tight checks only. Do not paste the whole raw JSON.`,
  model: 'openai/gpt-6-luna',
  defaultOptions: { maxSteps: 10 },
  memory: new Memory(),
  tools: {
    system_health: systemHealthTool,
  },
});
