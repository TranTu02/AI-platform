export interface ChatAgent {
  id: string;
  name: string;
  description: string;
  suggestedPrompts: string[];
}

// Các agent của bộ khung (khớp với src/mastra/agents/). Coordinator là
// điểm vào mặc định — nó tự giao việc cho các agent chuyên môn.
export const AGENTS: ChatAgent[] = [
  {
    id: 'coordinator-agent',
    name: 'Điều phối viên',
    description: 'Nhận yêu cầu, giao việc cho agent chuyên môn rồi tổng hợp kết quả.',
    suggestedPrompts: [
      'Hệ thống hiện tại có khỏe không?',
      'Tìm tin mới nhất về Mastra rồi tóm tắt.',
      'Mấy giờ rồi ở Bangkok?',
    ],
  },
  {
    id: 'research-agent',
    name: 'Nghiên cứu',
    description: 'Tra cứu thông tin mới trên web, trả về tóm tắt có nguồn.',
    suggestedPrompts: ['Tin mới nhất về AI agent hôm nay là gì?'],
  },
  {
    id: 'ops-agent',
    name: 'Vận hành',
    description: 'Kiểm tra sức khỏe hệ thống và giờ hiện tại.',
    suggestedPrompts: ['Kiểm tra sức khỏe hệ thống.'],
  },
  {
    id: 'self-check-agent',
    name: 'Tự kiểm tra',
    description: 'Chạy tự kiểm tra và báo cáo PASS / WARN / FAIL.',
    suggestedPrompts: ['Chạy tự kiểm tra hệ thống.'],
  },
];
