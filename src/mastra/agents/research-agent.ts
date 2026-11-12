import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { webFetchTool, webSearchTool } from '@mastra/core/tools';

export const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  description:
    'Gathers factual information from the web and returns sourced bullet-point summaries. Use for any question about current information.',
  instructions: `You are a research subagent. Search the web, fetch the relevant pages, and return a short bullet-point summary with the source of each fact.
- Answer in Vietnamese unless the user asked in another language.
- Never invent facts, numbers or URLs. If a page cannot be fetched, say so.
- Keep the summary short: at most 8 bullets, each one fact.`,
  model: 'openai/gpt-6-luna',
  defaultOptions: { maxSteps: 20 },
  memory: new Memory(),
  tools: {
    web_search: webSearchTool,
    web_fetch: webFetchTool,
  },
});
