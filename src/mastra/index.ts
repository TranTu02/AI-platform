import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraCompositeStore } from '@mastra/core/storage';
import {
  MastraStorageExporter,
  MastraPlatformExporter,
  Observability,
  SensitiveDataFilter,
} from '@mastra/observability';
import { coordinatorAgent } from './agents/coordinator-agent';
import { researchAgent } from './agents/research-agent';
import { opsAgent } from './agents/ops-agent';
import { selfCheckAgent } from './agents/self-check-agent';
import { taskPipelineWorkflow } from './workflows/task-pipeline-workflow';
import { selfCheckWorkflow } from './workflows/self-check-workflow';
import {
  currentTimeTool,
  startScheduleTool,
  stopScheduleTool,
  systemHealthTool,
} from './tools/index';

export const mastra = new Mastra({
  bundler: {
    externals: ['@duckdb/node-bindings'],
  },
  // Agents: the coordinator is the entry point from chat. Sub-agents are
  // also registered here so they can be chatted with directly in Studio.
  agents: { coordinatorAgent, researchAgent, opsAgent, selfCheckAgent },
  // Workflows: deterministic pipeline + scheduled self-check.
  workflows: { taskPipelineWorkflow, selfCheckWorkflow },
  // Tool registry (see src/mastra/tools/index.ts).
  tools: { startScheduleTool, stopScheduleTool, systemHealthTool, currentTimeTool },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new LibSQLStore({
      id: 'mastra-storage',
      url: process.env.TURSO_DATABASE_URL || 'file:./mastra.db',
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    }),
    domains: {
      observability: await new DuckDBStore().getStore('observability'),
    },
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});
