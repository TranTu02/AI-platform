import { useEffect, useRef, useState } from 'react';
import type { ChunkType } from '@mastra/core/stream';
import { mastraClient } from './mastra-client';
import { AGENTS } from './agents';
import './styles.css';

interface ChatMessage {
  role: 'user' | 'agent';
  text: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'error';

const RESOURCE_KEY = 'ai-platform-resource-id';

function getResourceId(): string {
  let id = localStorage.getItem(RESOURCE_KEY);
  if (!id) {
    id = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(RESOURCE_KEY, id);
  }
  return id;
}

function getThreadId(agentId: string): string {
  const key = `ai-platform-thread-${agentId}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = `thread-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function newThread(agentId: string): string {
  const id = `thread-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(`ai-platform-thread-${agentId}`, id);
  return id;
}

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connecting: 'Đang kết nối…',
  connected: 'Đã kết nối',
  error: 'Không kết nối được',
};

export default function App() {
  const [agentId, setAgentId] = useState('coordinator-agent');
  const [messagesByAgent, setMessagesByAgent] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState('');
  const [resourceId] = useState(getResourceId);
  const [threadIds, setThreadIds] = useState<Record<string, string>>({});
  const listRef = useRef<HTMLDivElement>(null);

  const agent = AGENTS.find((a) => a.id === agentId) ?? AGENTS[0];
  const messages = messagesByAgent[agentId] ?? [];

  // Kiểm tra kết nối tới Mastra server khi mở trang.
  useEffect(() => {
    let cancelled = false;
    mastraClient
      .getAgent('coordinator-agent')
      .details()
      .then(() => {
        if (!cancelled) setStatus('connected');
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
          setError('Không kết nối được tới Mastra server. Kiểm tra xem server có đang chạy ở cổng 4111 không.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cuộn xuống cuối mỗi khi có tin nhắn mới.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, streaming]);

  const appendMessage = (role: ChatMessage['role'], text: string) => {
    setMessagesByAgent((prev) => ({
      ...prev,
      [agentId]: [...(prev[agentId] ?? []), { role, text }],
    }));
  };

  const updateLastAgentMessage = (text: string) => {
    setMessagesByAgent((prev) => {
      const list = [...(prev[agentId] ?? [])];
      const last = list[list.length - 1];
      if (last && last.role === 'agent') {
        list[list.length - 1] = { role: 'agent', text };
      }
      return { ...prev, [agentId]: list };
    });
  };

  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || streaming) return;
    setError('');
    setInput('');
    appendMessage('user', prompt);
    appendMessage('agent', '');
    setStreaming(true);

    const thread = threadIds[agentId] ?? getThreadId(agentId);
    if (!threadIds[agentId]) {
      setThreadIds((prev) => ({ ...prev, [agentId]: thread }));
    }

    try {
      const agentClient = mastraClient.getAgent(agentId);
      const stream = await agentClient.stream(prompt, {
        memory: { thread, resource: resourceId },
      });
      let fullText = '';
      // processDataStream trả về Promise<void> — await nó để chờ stream chạy xong.
      await stream.processDataStream({
        onChunk: (chunk: ChunkType) => {
          if (chunk.type === 'text-delta') {
            fullText += chunk.payload.text;
            updateLastAgentMessage(fullText);
          }
        },
      });
      if (!fullText) {
        updateLastAgentMessage('(Agent không trả về nội dung. Thử lại hoặc kiểm tra log của Mastra server.)');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định.';
      updateLastAgentMessage('');
      setError(
        `Không gửi được tin nhắn: ${message} — Kiểm tra Mastra server đang chạy và OPENAI_API_KEY đã được set trong .env chưa.`,
      );
      // Bỏ tin nhắn agent rỗng để lần gửi sau sạch sẽ.
      setMessagesByAgent((prev) => ({
        ...prev,
        [agentId]: (prev[agentId] ?? []).filter((m) => m.text !== ''),
      }));
    } finally {
      setStreaming(false);
    }
  };

  const startNewChat = () => {
    newThread(agentId);
    setThreadIds((prev) => {
      const next = { ...prev };
      delete next[agentId];
      return next;
    });
    setMessagesByAgent((prev) => ({ ...prev, [agentId]: [] }));
    setError('');
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>AI Platform</h1>
          <p className="subtitle">Trò chuyện với trung tâm agent</p>
        </div>
        <span className={`status status-${status}`}>{STATUS_TEXT[status]}</span>
      </header>

      <div className="agent-bar">
        <label htmlFor="agent-select">Agent:</label>
        <select
          id="agent-select"
          value={agentId}
          disabled={streaming}
          onChange={(e) => setAgentId(e.target.value)}
        >
          {AGENTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <span className="agent-desc">{agent.description}</span>
        <button className="btn-ghost" onClick={startNewChat} disabled={streaming}>
          Đoạn chat mới
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="empty">
            <p>
              Chào bạn, mình là <strong>{agent.name}</strong>. {agent.description}
            </p>
            <p>Gợi ý:</p>
            <div className="chips">
              {agent.suggestedPrompts.map((p) => (
                <button key={p} className="chip" disabled={streaming} onClick={() => send(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role === 'user' ? 'message-user' : 'message-agent'}`}>
            {m.role === 'agent' && m.text === '' && streaming ? (
              <span className="thinking">Đang suy nghĩ…</span>
            ) : (
              m.text
            )}
          </div>
        ))}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          value={input}
          rows={2}
          placeholder={`Nhắn cho ${agent.name}… (Enter để gửi, Shift+Enter để xuống dòng)`}
          disabled={streaming || status === 'error'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <button type="submit" disabled={streaming || !input.trim()}>
          {streaming ? 'Đang trả lời…' : 'Gửi'}
        </button>
      </form>

      <footer className="footer">
        Chat production — chạy qua Mastra server (cổng 4111), khác với Studio chỉ dùng để dev. Lịch sử chat
        được lưu theo thread trên server, đổi agent sẽ thấy đoạn chat riêng của agent đó.
      </footer>
    </div>
  );
}
