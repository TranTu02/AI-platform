// Tool registry: every tool the platform offers lives here.
// Agents import tools from this file; src/mastra/index.ts registers the
// same set on the Mastra instance so Studio and the API can see them.

export { systemHealthTool, currentTimeTool, collectSystemHealth } from './system-health';
export type { SystemHealth } from './system-health';
export { startScheduleTool, stopScheduleTool } from './schedule-tools';

import { systemHealthTool, currentTimeTool } from './system-health';
import { startScheduleTool, stopScheduleTool } from './schedule-tools';

export const tools = {
  systemHealthTool,
  currentTimeTool,
  startScheduleTool,
  stopScheduleTool,
};
