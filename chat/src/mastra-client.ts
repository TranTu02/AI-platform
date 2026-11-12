import { MastraClient } from '@mastra/client-js';

// baseUrl rỗng = gọi cùng origin (/api/...). Ở dev, Vite proxy /api sang
// Mastra server :4111; ở production, nginx làm việc đó (chat/nginx.conf).
// Muốn trỏ thẳng sang một server khác thì set VITE_MASTRA_URL.
export const mastraClient = new MastraClient({
  baseUrl: import.meta.env.VITE_MASTRA_URL || '',
});
