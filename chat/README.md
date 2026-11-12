# Chat production cho AI Platform — giao diện tiếng Việt, chạy bằng Vite + React,
# nói chuyện với coordinator-agent (và các agent khác) qua Mastra server
# bằng @mastra/client-js.

## Chạy dev

```shell
npm install
npm run dev   # http://localhost:5173
```

Cần chạy Mastra server trước (ở thư mục gốc của repo):

```shell
npm run dev   # http://localhost:4111
```

Vite proxy mọi request `/api` sang server :4111 nên không vướng CORS.

## Build và chạy production

```shell
npm run build   # ra thư mục dist/
npm run preview # thử bản build ở :5173
```

Trên homelab, dùng docker-compose ở thư mục gốc (`docker-compose.yml`):
service `chat` build từ `chat/Dockerfile` (nginx), proxy `/api` sang service
`server` (Mastra, cổng 4111).

## Cách hoạt động

- Agent mặc định là **Điều phối viên** (`coordinator-agent`); có thể chuyển sang
  Nghiên cứu / Vận hành / Tự kiểm tra ở ô chọn agent.
- Mỗi agent có một thread riêng, lưu trong `localStorage` của trình duyệt
  (`ai-platform-thread-<agent-id>`) và lưu bền vững trên server (LibSQL
  `mastra.db`), nên agent vẫn nhớ ngữ cảnh sau khi tải lại trang.
- Nút **Đoạn chat mới** tạo thread mới cho agent đang chọn.
- Tin nhắn được stream theo thời gian thực (`agent.stream` + `processDataStream`).

## Lưu ý

- Chat chỉ gọi được model khi Mastra server đã có `OPENAI_API_KEY` thật trong
  `.env`. Chưa có key thì trang vẫn mở được, trạng thái hiện "Đã kết nối",
  nhưng gửi tin sẽ báo lỗi — xem lỗi hiển thị trên trang để biết nguyên nhân.
- Đây là chat nội bộ, chưa có đăng nhập: chỉ mở trong mạng nội bộ hoặc sau
  reverse proxy có auth.
