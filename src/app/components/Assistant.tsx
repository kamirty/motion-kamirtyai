import { useEffect, useRef, useState } from 'react';
import { STARTER_SUGGESTIONS, initialAssistantState, respond, type AssistantState } from '../../assistant/engine';
import type { AssistantAction, AssistantContext, AssistantReply } from '../../assistant/types';

type Message = { from: 'user'; text: string } | { from: 'bot'; reply: AssistantReply };

interface Props {
  context: AssistantContext;
  onAction: (action: AssistantAction) => void;
}

const WELCOME: AssistantReply = {
  text: 'أهلًا! أنا مساعد مولّد الإنفوجرافيك. اسألني عن أي شيء في الأداة، أو اكتب موضوعك وسأقترح عليك أفكارًا لفيديو جاهزة للتعبئة.',
  suggestions: STARTER_SUGGESTIONS,
};

/** Renders reply text safely: plain text, "• " lines become a list. */
function ReplyText({ text }: { text: string }) {
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const line of text.split('\n')) {
    const list = line.startsWith('• ');
    const last = blocks[blocks.length - 1];
    if (last && last.list === list) last.lines.push(list ? line.slice(2) : line);
    else blocks.push({ list, lines: [list ? line.slice(2) : line] });
  }
  return (
    <>
      {blocks.map((b, i) =>
        b.list ? (
          <ul key={i}>{b.lines.map((l, j) => <li key={j}>{l}</li>)}</ul>
        ) : (
          b.lines.map((l, j) => <p key={`${i}-${j}`}>{l}</p>)
        ),
      )}
    </>
  );
}

export function Assistant({ context, onAction }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ from: 'bot', reply: WELCOME }]);
  const [input, setInput] = useState('');
  const [state, setState] = useState<AssistantState>(initialAssistantState);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const ask = (q: string) => {
    const text = q.trim().slice(0, 300);
    if (!text) return;
    const { reply, state: next } = respond(text, context, state);
    setState(next);
    setMessages((m): Message[] => [...m, { from: 'user' as const, text }, { from: 'bot' as const, reply }].slice(-40));
    setInput('');
  };

  const act = (a: AssistantAction) => {
    if (a.type === 'ask') ask(a.text);
    else onAction(a);
  };

  return (
    <>
      <button
        type="button"
        className={`assistant-fab ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="assistant-panel"
        aria-label={open ? 'إغلاق المساعد' : 'المساعد'}
        title={open ? 'إغلاق المساعد' : 'المساعد'}
      >
        {open ? '✕' : '🤖'}
      </button>
      {open && (
        <section id="assistant-panel" className="assistant" role="dialog" aria-label="مساعد مولّد الإنفوجرافيك">
          <header className="assistant-head">
            <b>مساعد المولّد</b>
            <small>يعمل داخل متصفحك · لأسئلة الأداة وأفكار الفيديو</small>
          </header>
          <div className="assistant-list" ref={listRef} aria-live="polite">
            {messages.map((m, i) =>
              m.from === 'user' ? (
                <div key={i} className="msg user">
                  {m.text}
                </div>
              ) : (
                <div key={i} className="msg bot">
                  <ReplyText text={m.reply.text} />
                  {m.reply.ideas?.map((idea) => (
                    <div key={idea.title} className="idea">
                      <b>{idea.title}</b>
                      <p className="muted small">{idea.angle}</p>
                      <div className="idea-kinds">{idea.kinds.map((k) => <span key={k}>{k}</span>)}</div>
                      <details>
                        <summary>عرض الهيكل</summary>
                        <pre>{idea.outline}</pre>
                      </details>
                      <button type="button" className="primary" onClick={() => act({ type: 'useIdea', text: idea.outline })}>
                        استخدم هذه الفكرة
                      </button>
                    </div>
                  ))}
                  {m.reply.buttons && (
                    <div className="msg-buttons">
                      {m.reply.buttons.map((b) => (
                        <button type="button" key={b.label} onClick={() => act(b.action)}>
                          {b.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {i === messages.length - 1 && m.reply.suggestions && (
                    <div className="chips">
                      {m.reply.suggestions.map((s) => (
                        <button type="button" key={s} className="chip" onClick={() => ask(s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
          <form
            className="assistant-input"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} maxLength={300} placeholder="اكتب سؤالك أو موضوع الفيديو…" aria-label="سؤالك" />
            <button type="submit" className="primary" disabled={!input.trim()}>
              إرسال
            </button>
          </form>
        </section>
      )}
    </>
  );
}
