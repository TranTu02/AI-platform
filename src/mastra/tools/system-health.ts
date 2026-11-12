import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { freemem, loadavg, platform, release, totalmem, uptime } from 'node:os';
import { existsSync, statSync, statfsSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Shared health model: used by the system-health tool AND by the scheduled
// self-check workflow, so both report the same checks the same way.
// ---------------------------------------------------------------------------

export const healthCheckSchema = z.object({
  name: z.string(),
  ok: z.boolean(),
  detail: z.string(),
});

export const systemHealthSchema = z.object({
  checkedAt: z.string(),
  platform: z.string(),
  nodeVersion: z.string(),
  uptimeSeconds: z.number(),
  memory: z.object({
    totalMB: z.number(),
    freeMB: z.number(),
    rssMB: z.number(),
  }),
  loadAverage: z.array(z.number()),
  diskAvailableGB: z.number(),
  mastraDbPresent: z.boolean(),
  openaiKeyConfigured: z.boolean(),
  checks: z.array(healthCheckSchema),
  ok: z.boolean(),
});

export type SystemHealth = z.infer<typeof systemHealthSchema>;

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

export function collectSystemHealth(): SystemHealth {
  const freeMB = Math.round(freemem() / MB);
  const totalMB = Math.round(totalmem() / MB);

  let diskAvailableGB = -1;
  try {
    const stats = statfsSync('.');
    diskAvailableGB = Math.round((stats.bavail * stats.bsize) / GB * 10) / 10;
  } catch {
    diskAvailableGB = -1; // filesystem does not support statfs; check reports it
  }

  const mastraDbPresent = existsSync('./mastra.db')
    ? statSync('./mastra.db').size >= 0
    : false;
  const openaiKeyConfigured = Boolean(process.env.OPENAI_API_KEY);

  const checks: z.infer<typeof healthCheckSchema>[] = [
    {
      name: 'node',
      ok: true,
      detail: `Node ${process.version} on ${platform()} ${release()}`,
    },
    {
      name: 'memory',
      ok: freeMB >= 256,
      detail: `${freeMB} MB free of ${totalMB} MB`,
    },
    {
      name: 'disk',
      ok: diskAvailableGB >= 1,
      detail:
        diskAvailableGB >= 0
          ? `${diskAvailableGB} GB available in working directory`
          : 'disk size unavailable on this filesystem',
    },
    {
      name: 'mastra-db',
      ok: true,
      detail: mastraDbPresent
        ? 'mastra.db exists (memory/schedules persisted)'
        : 'mastra.db not created yet (first run)',
    },
    {
      name: 'openai-key',
      ok: openaiKeyConfigured,
      detail: openaiKeyConfigured
        ? 'OPENAI_API_KEY is set'
        : 'OPENAI_API_KEY is missing — set it in .env',
    },
  ];

  return {
    checkedAt: new Date().toISOString(),
    platform: `${platform()} ${release()}`,
    nodeVersion: process.version,
    uptimeSeconds: Math.round(uptime()),
    memory: {
      totalMB,
      freeMB,
      rssMB: Math.round(process.memoryUsage().rss / MB),
    },
    loadAverage: loadavg().map((v) => Math.round(v * 100) / 100),
    diskAvailableGB,
    mastraDbPresent,
    openaiKeyConfigured,
    checks,
    ok: checks.every((c) => c.ok),
  };
}

// ---------------------------------------------------------------------------
// Tools (tool registry entries). Agents get these via the registry in
// src/mastra/tools/index.ts, not by importing them one by one.
// ---------------------------------------------------------------------------

export const systemHealthTool = createTool({
  id: 'system-health',
  description:
    'Check the health of this machine and the Mastra server: Node version, memory, disk, uptime, mastra.db presence and whether OPENAI_API_KEY is set. Returns one check per item plus an overall ok flag. Never invent numbers — always call this tool when asked about system status.',
  inputSchema: z.object({}),
  execute: async () => collectSystemHealth(),
});

export const currentTimeTool = createTool({
  id: 'current-time',
  description: 'Get the current date and time, optionally in a given IANA timezone (e.g. Asia/Bangkok).',
  inputSchema: z.object({
    timezone: z
      .string()
      .optional()
      .describe('IANA timezone, e.g. Asia/Bangkok. Defaults to UTC.'),
  }),
  execute: async ({ timezone }) => {
    const tz = timezone || 'UTC';
    let local: string;
    try {
      local = new Date().toLocaleString('en-GB', { timeZone: tz });
    } catch {
      local = new Date().toLocaleString('en-GB', { timeZone: 'UTC' });
    }
    return { now: new Date().toISOString(), timezone: tz, local };
  },
});
