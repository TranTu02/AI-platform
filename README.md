# AI Platform — bộ khung trung tâm agent (Mastra)

Bộ khung [Mastra](https://mastra.ai) (`@mastra/core` **1.82.0**, đã pin version) cho một trung tâm agent: một agent điều phối (coordinator) điều phối các agent chuyên môn, gọi tool theo registry (danh mục hàm), lưu context (ngữ cảnh) vào bộ nhớ bền vững, chat qua Mastra Studio, và tự kiểm tra hệ thống theo lịch.

## Khung này đáp ứng 5 yêu cầu như thế nào

| Yêu cầu | Chỗ nào trong code |
|---|---|
| **(1) Agent điều phối — bắt buộc** | `src/mastra/agents/coordinator-agent.ts` — supervisor pattern: `agents: { researchAgent, opsAgent, selfCheckAgent }`, tự quyết định giao việc cho ai rồi tổng hợp kết quả. |
| **(2) Agent + function calling (gọi hàm)** | `src/mastra/tools/index.ts` là tool registry; tool khai báo bằng `createTool` + Zod schema, xem `src/mastra/tools/system-health.ts` và `schedule-tools.ts`. |
| **(3) Lưu context (ngữ cảnh)** | Mỗi agent có `Memory` (lịch sử hội thoại theo thread, tiêu đề tự sinh, observational memory ở coordinator), lưu bền vững vào `mastra.db` (LibSQL, có thể đổi sang Turso/Postgres). |
| **(4) Chat** | Mastra Studio ở `http://localhost:4111` — chọn agent **Coordinator** và chat. Chat production tự build sau, dùng Mastra Client SDK. |
| **(5) Tự kiểm tra theo khoảng thời gian** | `src/mastra/workflows/self-check-workflow.ts` — workflow chạy theo cron `*/30 * * * *` (múi giờ `Asia/Bangkok`), chấm PASS/WARN/FAIL, xem lịch sử ở Studio → Schedules. Coordinator cũng có thể tạo/dừng lịch khác qua chat (`start_schedule` / `stop_schedule`). |

Ngoài ra còn có workflow pipeline xác định (deterministic) 6 bước kiểu Harness v2 — `src/mastra/workflows/task-pipeline-workflow.ts`: Normalize → Plan → Scope → Execute → Evaluate → Egress, toàn bước biến đổi có kiểu rõ ràng, không gọi LLM trong pipeline.

## Cấu trúc

```
src/mastra/
  index.ts                        — đăng ký agents, workflows, tools, storage
  agents/
    coordinator-agent.ts          — điều phối viên (supervisor)
    research-agent.ts             — tra cứu web, tóm tắt có nguồn
    ops-agent.ts                  — kiểm tra sức khỏe hệ thống, giờ hiện tại
    self-check-agent.ts           — tự kiểm tra theo yêu cầu (PASS/WARN/FAIL)
  tools/
    index.ts                      — tool registry
    system-health.ts              — tool system-health + current-time (số liệu thật, không bịa)
    schedule-tools.ts             — tạo/dừng lịch lặp cho coordinator
  workflows/
    task-pipeline-workflow.ts     — pipeline 6 bước xác định
    self-check-workflow.ts        — tự kiểm tra định kỳ 30 phút
```

## Chạy thử

```shell
npm install
cp .env.example .env   # rồi điền OPENAI_API_KEY
npm run dev            # Mastra Studio: http://localhost:4111
```

Thử trong Studio (chọn agent **Coordinator**):

- `Hệ thống hiện tại có khỏe không?` → coordinator giao cho self-check-agent, báo PASS/WARN/FAIL.
- `Tìm tin mới nhất về Mastra rồi tóm tắt.` → giao cho research-agent.
- `Mấy giờ rồi ở Bangkok?` → giao cho ops-agent.

Chạy workflow pipeline trực tiếp (không cần chat):

```shell
npx mastra api workflow run start task-pipeline '{"inputData":{"task":"Kiểm tra sức khỏe hệ thống","taskType":"ops","priority":"high"}}'
```

## Chat production (tiếng Việt)

Studio ở cổng 4111 chỉ dùng để dev. Chat production nằm trong thư mục `chat/` (Vite + React, dùng `@mastra/client-js` để nói chuyện với Mastra server, stream theo thời gian thực, giao diện hoàn toàn tiếng Việt).

```shell
# Chạy server trước (thư mục gốc)
npm run dev
# Rồi chạy chat (thư mục chat/)
cd chat && npm install && npm run dev   # http://localhost:5173
```

- Agent mặc định là **Điều phối viên**; có thể chuyển sang Nghiên cứu / Vận hành / Tự kiểm tra ở ô chọn agent.
- Mỗi agent có một thread riêng, lưu trong `localStorage` và bền vững trên server (`mastra.db`), nên agent vẫn nhớ ngữ cảnh sau khi tải lại trang. Nút **Đoạn chat mới** tạo thread mới.
- Chat chỉ trả lời được khi server đã có `OPENAI_API_KEY` thật trong `.env`. Chưa có key thì trang vẫn mở được, nhưng gửi tin sẽ báo lỗi rõ ràng.
- Xem `chat/README.md` để biết cách build production.

## Thêm agent / tool mới

1. Tạo tool mới trong `src/mastra/tools/` bằng `createTool` (xem `system-health.ts`), export qua `src/mastra/tools/index.ts`.
2. Tạo agent mới trong `src/mastra/agents/` (xem `ops-agent.ts`), cho tool vào `tools: {...}`.
3. Muốn coordinator dùng được agent mới: thêm vào `agents: {...}` của `coordinator-agent.ts` và mô tả rõ trong `instructions` khi nào thì giao việc cho nó.
4. Đăng ký agent/workflow/tool mới trong `src/mastra/index.ts`.

## Lưu trữ

Mặc định dùng file `./mastra.db` (LibSQL) để lưu memory, task và schedule. Muốn dùng Turso thì set `TURSO_DATABASE_URL` và `TURSO_AUTH_TOKEN` trong `.env`. Muốn Postgres thì thay `LibSQLStore` bằng `@mastra/pg` (chưa cài sẵn).

## Chạy bằng Docker (tùy chọn, cho homelab)

```shell
cp .env.example .env   # điền OPENAI_API_KEY
docker compose up -d --build
```

- Chat: `http://<host>:5173`, Mastra server + Studio: `http://<host>:4111`.
- `mastra.db` được lưu trong volume `ai-platform-data` nên không mất memory/schedule khi rebuild.
- Chỉ chạy riêng server: `docker build -t ai-platform .` rồi `docker run -d -p 4111:4111 -e OPENAI_API_KEY=... ai-platform`.

Lưu ý: Studio chỉ nên mở trong mạng nội bộ hoặc sau reverse proxy có auth (xác thực); đừng phơi trực tiếp ra internet.

## Lưu ý

- Mastra đổi API nhanh — version đã pin ở `package.json` (`@mastra/core 1.82.0`, `mastra 1.38.0`). Trước khi viết code Mastra mới, đọc docs trong `node_modules/@mastra/core/dist/docs/` (bắt đầu từ `SKILL.md`) như `AGENTS.md` đã dặn.
- Lịch tự kiểm tra chạy theo cơ chế best-effort (cố gắng tối đa): một lần chạy bị lỡ sẽ không tự chạy bù.
- `npm run build` build project, `npm run start` chạy server đã build.
