import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { startScheduleTool, stopScheduleTool } from '../tools/schedule-tools';
import { researchAgent } from './research-agent';
import { opsAgent } from './ops-agent';
import { selfCheckAgent } from './self-check-agent';

export const coordinatorAgent = new Agent({
  id: 'coordinator-agent',
  name: 'Coordinator',
  description:
    'Central coordinator: receives the user request from chat, delegates to specialized sub-agents, and synthesizes their results into one answer.',
  metadata: {
    suggestedPrompts: [
      'Hệ thống hiện tại có khỏe không?',
      'Tìm tin mới nhất về Mastra rồi tóm tắt.',
      'Mấy giờ rồi ở Bangkok?',
    ],
  },
  instructions: `You are the central coordinator of this agent platform. You receive requests from chat, decide which specialist handles each part, delegate, then synthesize the results into one short answer in Vietnamese.

Available sub-agents:
- research-agent: gathers current information from the web, returns sourced bullet points. Use for news, prices, docs, or anything that needs fresh facts.
- ops-agent: checks machine health (Node, memory, disk, uptime, mastra.db, API key) and the current time. Use when the user asks about system status or the time.
- self-check-agent: runs a full self-check and reports PASS / WARN / FAIL. Use when the user asks for a health check or a system review.

Rules:
- Delegate instead of answering from memory: for facts, delegate to research-agent; for system numbers, delegate to ops-agent or self-check-agent. Never invent numbers or facts.
- Split multi-part requests and delegate each part to the right sub-agent, then combine the results yourself. Do not just forward a sub-agent's raw output.
- If a delegation fails, say which part failed and try a different sub-agent or a simpler approach.
- You can also start or stop recurring schedules with start_schedule / stop_schedule when the user asks for something repeated (e.g. "check the system every 30 minutes"). The self-check workflow already runs every 30 minutes by default.
- Keep the final answer short and in Vietnamese unless the user wrote in another language.`,
  model: 'openai/gpt-6.1-sol',
  defaultOptions: {
    maxSteps: 50,
    autoResumeSuspendedTools: true,
  },
  memory: new Memory({
    options: {
      generateTitle: true,
      observationalMemory: {
        model: 'openai/gpt-6-luna',
      },
    },
  }),
  // Supervisor pattern: the coordinator delegates to these sub-agents.
  // Mastra exposes each one as a delegation tool and uses its description
  // to decide when to call it.
  agents: { researchAgent, opsAgent, selfCheckAgent },
  tools: {
    start_schedule: startScheduleTool,
    stop_schedule: stopScheduleTool,
  },
});
