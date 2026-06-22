'use client';

/**
 * CommentThread (M22-1, S396/S397) — комментарии на записи + @mention + 1-уровневые ответы.
 * @mention: автокомплит по членам с доступом (backend mentionable); вставляет токен @[userId];
 * рендер заменяет @[userId] → @Имя. Soft-delete → «Comment deleted». Edit/delete своих; backend = source-of-truth.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Loader2, AtSign, Send, CornerDownRight, Pencil, Trash2, X, Check } from 'lucide-react';
import { commentsApi, type CommentNode, type CommentUser } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

export default function CommentThread({ recordId }: { recordId: string }) {
  const me = getStoredUser();
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [mentionable, setMentionable] = useState<CommentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [skipped, setSkipped] = useState(0);
  // @mention autocomplete
  const [menu, setMenu] = useState<{ open: boolean; query: string; start: number }>({ open: false, query: '', start: 0 });
  const taRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    commentsApi.list(recordId).then((r) => { setComments(r.comments); setMentionable(r.mentionable); }).catch(() => {}).finally(() => setLoading(false));
  }, [recordId]);
  useEffect(() => { load(); }, [load]);

  // id → имя (для рендера токенов @[userId])
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    mentionable.forEach((u) => m.set(u.id, u.name || u.email));
    comments.forEach((c) => { if (c.author) m.set(c.author.id, c.author.name || c.author.email); c.mentions.forEach((x) => m.set(x.id, x.name || x.email)); (c.replies ?? []).forEach((r) => { if (r.author) m.set(r.author.id, r.author.name || r.author.email); }); });
    return m;
  }, [comments, mentionable]);

  function renderBody(text: string) {
    // @[userId] → @Имя (подсветка)
    const parts = text.split(/(@\[[A-Za-z0-9_-]+\])/g);
    return parts.map((p, i) => {
      const m = p.match(/^@\[([A-Za-z0-9_-]+)\]$/);
      if (m) return <span key={i} className="rounded bg-brand-50 px-1 font-semibold text-brand-700">@{nameById.get(m[1]) ?? 'someone'}</span>;
      return <span key={i}>{p}</span>;
    });
  }

  // отслеживаем @-токен под курсором → открываем меню
  function onBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setBody(v);
    const pos = e.target.selectionStart ?? v.length;
    const before = v.slice(0, pos);
    const m = before.match(/@([A-Za-z0-9._-]*)$/); // @слово прямо перед курсором
    if (m) setMenu({ open: true, query: m[1].toLowerCase(), start: pos - m[0].length });
    else setMenu({ open: false, query: '', start: 0 });
  }
  function pickMention(u: CommentUser) {
    const ta = taRef.current; if (!ta) return;
    const pos = ta.selectionStart ?? body.length;
    const next = body.slice(0, menu.start) + `@[${u.id}] ` + body.slice(pos);
    setBody(next);
    setMenu({ open: false, query: '', start: 0 });
    setTimeout(() => ta.focus(), 0);
  }
  const menuOptions = useMemo(() => mentionable.filter((u) => (u.name + ' ' + u.email).toLowerCase().includes(menu.query)).slice(0, 6), [mentionable, menu.query]);

  async function submit() {
    if (!body.trim() || busy) return;
    setBusy(true); setSkipped(0);
    try {
      const r = await commentsApi.create(recordId, body.trim(), replyTo?.id);
      setSkipped(r.mentionsSkipped.length);
      setBody(''); setReplyTo(null); setMenu({ open: false, query: '', start: 0 });
      load(); window.dispatchEvent(new Event('notifications:refresh'));
    } finally { setBusy(false); }
  }
  async function saveEdit() {
    if (!editing || !editing.body.trim()) return;
    setBusy(true);
    try { await commentsApi.edit(recordId, editing.id, editing.body.trim()); setEditing(null); load(); window.dispatchEvent(new Event('notifications:refresh')); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm('Delete this comment?')) return;
    await commentsApi.remove(recordId, id).catch(() => {});
    load();
  }

  const total = comments.reduce((s, c) => s + 1 + (c.replies?.length ?? 0), 0);

  function CommentRow({ c, isReply }: { c: CommentNode; isReply?: boolean }) {
    const mine = me?.id && c.authorId === me.id;
    return (
      <div className={isReply ? 'mt-1.5 flex gap-2 pl-6' : 'flex gap-2'}>
        {isReply && <CornerDownRight size={13} className="mt-2 shrink-0 text-ink-subtle" />}
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-[10px] font-bold text-white ${c.deleted ? 'opacity-40' : ''}`}>{(c.author?.name || c.author?.email || '?').slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold text-ink">{c.author?.name ?? 'Unknown'}</span>
            <span className="text-[10.5px] text-ink-subtle">· {timeAgo(c.createdAt)}{c.editedAt ? ' · edited' : ''}</span>
            {!c.deleted && mine && !editing && (
              <span className="ml-auto flex items-center gap-1">
                <button type="button" onClick={() => setEditing({ id: c.id, body: c.body })} className="rounded p-0.5 text-ink-subtle hover:text-brand-700"><Pencil size={11} /></button>
                <button type="button" onClick={() => remove(c.id)} className="rounded p-0.5 text-ink-subtle hover:text-rose-600"><Trash2 size={11} /></button>
              </span>
            )}
          </div>
          {c.deleted ? (
            <p className="mt-0.5 text-[12px] italic text-ink-subtle">Comment deleted</p>
          ) : editing?.id === c.id ? (
            <div className="mt-1">
              <textarea value={editing.body} onChange={(e) => setEditing({ id: c.id, body: e.target.value })} rows={2} className="w-full resize-none rounded-lg border border-line bg-surface-2/40 px-2 py-1.5 text-[12px] text-ink focus:border-brand-400 focus:outline-none" />
              <div className="mt-1 flex gap-1.5">
                <button type="button" disabled={busy} onClick={saveEdit} className="inline-flex h-6 items-center gap-1 rounded-md bg-brand-600 px-2 text-[11px] font-semibold text-white hover:bg-brand-700"><Check size={11} /> Save</button>
                <button type="button" onClick={() => setEditing(null)} className="inline-flex h-6 items-center gap-1 rounded-md border border-line px-2 text-[11px] font-semibold text-ink-muted"><X size={11} /> Cancel</button>
              </div>
            </div>
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[12.5px] leading-5 text-ink">{renderBody(c.body)}</p>
          )}
          {!c.deleted && !isReply && (
            <button type="button" onClick={() => { setReplyTo({ id: c.id, author: c.author?.name ?? 'comment' }); taRef.current?.focus(); }} className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-ink-subtle hover:text-brand-700"><CornerDownRight size={10} /> Reply</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-subtle"><MessageSquare size={11} /> Comments {total > 0 && <span className="rounded-full bg-surface-2 px-1.5 text-[10px] font-bold text-ink-muted">{total}</span>}</p>

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-[12px] text-ink-subtle"><Loader2 size={13} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-2.5">
          {comments.length === 0 && <p className="text-[12px] text-ink-subtle">No comments yet. @mention a teammate to loop them in.</p>}
          {comments.map((c) => (
            <div key={c.id}>
              <CommentRow c={c} />
              {(c.replies ?? []).map((r) => <CommentRow key={r.id} c={r} isReply />)}
            </div>
          ))}
        </div>
      )}

      {/* composer */}
      <div className="relative mt-3">
        {replyTo && <div className="mb-1 inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700"><CornerDownRight size={10} /> Replying to {replyTo.author}<button type="button" onClick={() => setReplyTo(null)} className="text-brand-400 hover:text-brand-700"><X size={11} /></button></div>}
        <div className="rounded-xl border border-line bg-surface focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
          <textarea ref={taRef} value={body} onChange={onBodyChange} rows={2} placeholder="Write a comment…  type @ to mention" className="w-full resize-none rounded-t-xl bg-transparent px-3 py-2 text-[12.5px] text-ink outline-none placeholder:text-ink-subtle" />
          <div className="flex items-center gap-2 border-t border-line px-2 py-1.5">
            <span className="inline-flex items-center gap-1 text-[10.5px] text-ink-subtle"><AtSign size={11} /> {mentionable.length} can be mentioned</span>
            <button type="button" disabled={!body.trim() || busy} onClick={submit} className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[11.5px] font-semibold text-white shadow-brand hover:bg-brand-700 disabled:opacity-50">{busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} {replyTo ? 'Reply' : 'Comment'}</button>
          </div>
        </div>
        {/* @mention dropdown */}
        {menu.open && menuOptions.length > 0 && (
          <div className="absolute bottom-full left-2 z-20 mb-1 w-56 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
            {menuOptions.map((u) => (
              <button key={u.id} type="button" onClick={() => pickMention(u)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-ink hover:bg-surface-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-[9px] font-bold text-white">{(u.name || u.email).slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{u.name}</span>
              </button>
            ))}
          </div>
        )}
        {skipped > 0 && <p className="mt-1 text-[11px] text-amber-600">{skipped} mention(s) skipped — no access to this record.</p>}
      </div>
    </div>
  );
}
