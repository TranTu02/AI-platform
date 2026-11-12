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
    'Kiểm tra sức khỏe của máy này và Mastra server: phiên bản Node, bộ nhớ, ổ đĩa, thời gian chạy, mastra.db có tồn tại không và OPENAI_API_KEY đã được set chưa. Trả về một mục kiểm tra cho mỗi hạng mục kèm cờ ok tổng thể. Không bao giờ bịa số liệu — khi được hỏi về trạng thái hệ thống thì luôn gọi tool này.',
  inputSchema: z.object({}),
  execute: async () => collectSystemHealth(),
});

export const currentTimeTool = createTool({
  id: 'current-time',
  description: 'Lấy ngày giờ hiện tại, có thể theo một múi giờ IANA (ví dụ Asia/Bangkok).',
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
