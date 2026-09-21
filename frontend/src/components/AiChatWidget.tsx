import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { ChatMessage } from '../types/ai';
import { sendChatMessage } from '../ai/aiApi';

export default function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, loading]);

  if (!available) return null;

  async function send(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const history = [...messages, { role: 'user' as const, content: trimmed }];
    setMessages(history);
    setInput('');
    setLoading(true);
    try {
      const response = await sendChatMessage(history);
      setMessages([...history, { role: 'assistant', content: response.reply }]);
    } catch {
      // AI features must never break the page: fail silently and hide the widget.
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ai-chat-widget">
      {open && (
        <div className="ai-chat-panel" role="dialog" aria-label="VAULT shopping assistant">
          <div className="ai-chat-header">
            <span><span aria-hidden="true">✦</span> VAULT Assistant</span>
            <button type="button" className="ai-chat-close" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
          </div>
          <div className="ai-chat-messages" ref={listRef}>
            {messages.length === 0 && (
              <p className="ai-chat-bubble assistant">สวัสดีค่ะ ถามอะไรเกี่ยวกับสินค้าหรือคำสั่งซื้อของคุณได้เลยค่ะ</p>
            )}
            {messages.map((message, index) => (
              <p key={index} className={`ai-chat-bubble ${message.role}`}>{message.content}</p>
            ))}
            {loading && <p className="ai-chat-bubble assistant ai-chat-typing" aria-live="polite">กำลังพิมพ์…</p>}
          </div>
          <form className="ai-chat-form" onSubmit={send}>
            <input
              type="text"
              value={input}
              placeholder="พิมพ์ข้อความ…"
              disabled={loading}
              onChange={event => setInput(event.target.value)}
              aria-label="Message to the shopping assistant"
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="Send message">↗</button>
          </form>
        </div>
      )}
      <button
        type="button"
        className="ai-chat-toggle"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-label={open ? 'Close shopping assistant' : 'Open shopping assistant'}
      >
        {open ? '×' : '✦'}
      </button>
    </div>
  );
}
