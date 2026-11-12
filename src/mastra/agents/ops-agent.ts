import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { currentTimeTool, systemHealthTool } from '../tools/system-health';

export const opsAgent = new Agent({
  id: 'ops-agent',
  name: 'Ops Agent',
  description:
    'Runs system health checks and reports machine status (Node, memory, disk, uptime, mastra.db, API key). Use when the user asks whether the system is healthy.',
  instructions: `You are an operations subagent. When asked about system status, always call the system-health tool first and report exactly what it returns — never guess numbers.
- Answer in Vietnamese unless the user asked in another language.
- Report each check on its own line, then one line with the overall result (OK / NOT OK).
- If OPENAI_API_KEY is missing, say plainly that it must be set in .env.`,
  model: 'openai/gpt-6-luna',
  defaultOptions: { maxSteps: 10 },
  memory: new Memory(),
  tools: {
    system_health: systemHealthTool,
    current_time: currentTimeTool,
  },
});
