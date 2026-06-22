'use client';

/* ──────────────────────────────────────────────────────────────────────────
   Ask AISDR (/ask) — модуль 10, M26-1. Полный экран ассистента: рейл тредов
   (recent chats + New chat) + панель AskAssistant. Deep-link: ?chat=<id>
   открывает тред, ?q=<question> автоматически отправляет вопрос (с homepage).
   ────────────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { askApi, type AskChatListItem } from '@/lib/api';
import { Sparkles, ShieldCheck, Plus, MessageSquare, Trash2, Loader2 } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import AskAssistant from '@/components/ask/AskAssistant';

export default function AskPage() {
  const [chats, setChats] = useState<AskChatListItem[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [autoSend, setAutoSend] = useState<string | undefined>(undefined);
  const [panelKey, setPanelKey] = useState(0); // форс-ремоунт панели при New chat
  const initedRef = useRef(false);

  async function loadChats() {
    setLoadingChats(true);
    try { setChats(await askApi.chats()); } catch { /* */ }
    setLoadingChats(false);
  }

  // первичная инициализация из URL (?chat / ?q)
  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    const sp = new URLSearchParams(window.location.search);
    const chat = sp.get('chat');
    const q = sp.get('q');
    if (chat) setActiveChat(chat);
    if (q) setAutoSend(q);
    void loadChats();
  }, []);

  function newChat() {
    setActiveChat(null);
    setAutoSend(undefined);
    setPanelKey((k) => k + 1);
  }

  function openChat(id: string) {
    setActiveChat(id);
    setAutoSend(undefined);
    setPanelKey((k) => k + 1);
  }

  async function removeChat(id: string, e: MouseEvent) {
    e.stopPropagation();
    try { await askApi.deleteChat(id); } catch { /* */ }
    if (activeChat === id) newChat();
    void loadChats();
  }

  return (
    <>
      <Topbar title="Ask AISDR" subtitle="Intelligence · ask the agent about your workspace" icon={<Sparkles size={18} strokeWidth={1.85} />} />

      <div className="flex min-h-0 flex-1">
        {/* рейл тредов (sidebar Chats) */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface/60 md:flex">
          <div className="p-3">
            <button type="button" onClick={newChat} className="brand-gradient inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5">
              <Plus size={14} /> New chat
            </button>
          </div>
          <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-subtle">Recent chats</div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {loadingChats ? (
              <div className="flex items-center gap-1.5 px-2 py-3 text-[12px] text-ink-subtle"><Loader2 size={12} className="animate-spin" /> Loading…</div>
            ) : chats.length === 0 ? (
              <p className="px-2 py-3 text-[11.5px] leading-4 text-ink-subtle">No chats yet. Ask a question to start one.</p>
            ) : (
              <ul className="space-y-0.5">
                {chats.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => openChat(c.id)} className={`group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${activeChat === c.id ? 'bg-brand-50 text-brand-800' : 'text-ink-muted hover:bg-surface-2'}`}>
                      <MessageSquare size={13} className={activeChat === c.id ? 'text-brand-500' : 'text-ink-subtle'} />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{c.title || 'New chat'}</span>
                      <span role="button" tabIndex={0} onClick={(e) => removeChat(c.id, e)} className="opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"><Trash2 size={12} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-line px-3 py-2">
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-emerald-700"><ShieldCheck size={12} /> Grounded on data you can access</span>
          </div>
        </aside>

        {/* панель ассистента */}
        <AskAssistant key={panelKey} chatId={activeChat} autoSend={autoSend} onChatId={(id) => { setActiveChat(id); void loadChats(); }} />
      </div>
    </>
  );
}
