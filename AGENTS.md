This is NOT the Mastra you know. Its APIs, conventions, and file structure have changed since your training data, so don't write Mastra code from memory.
Before writing code, load the `mastra` skill if it's available, then read the relevant docs in `node_modules/@mastra/<package>/dist/docs/` (start at `SKILL.md`). Follow deprecation notices.

Register agents, tools, workflows, and scorers in `src/mastra/index.ts`.
Use the `dev` and `build` scripts in `package.json`, not `mastra dev` or `mastra build` directly.

## Project: ai-platform skeleton

- Coordinator-first: `coordinator-agent.ts` is the chat entry point; it delegates to `research-agent`, `ops-agent`, `self-check-agent` via the `agents` field (supervisor pattern, see `node_modules/@mastra/core/dist/docs/references/docs-subagents.md`).
- Tool registry: `src/mastra/tools/index.ts`. New tools go there, then into `src/mastra/index.ts`.
- Deterministic pipeline: `src/mastra/workflows/task-pipeline-workflow.ts` (Normalize → Plan → Scope → Execute → Evaluate → Egress). No LLM calls inside workflow steps.
- Self-check: `src/mastra/workflows/self-check-workflow.ts`, cron `*/30 * * * *` Asia/Bangkok. Same checks as the `system-health` tool.
- Pinned versions: `@mastra/core 1.82.0`, `mastra 1.38.0`. Do not bump without checking the docs in `node_modules/@mastra/core/dist/docs/`.
