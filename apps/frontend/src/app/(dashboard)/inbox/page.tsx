'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import Topbar from '@/components/layout/Topbar';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

type LeadStatus = 'NEW' | 'CONTACTED' | 'REPLIED' | 'HOT' | 'CONVERTED' | 'LOST' | 'UNSUBSCRIBED';
type Direction  = 'OUTBOUND' | 'INBOUND';

interface Conversation {
  leadId:       string;
  firstName:    string;
  lastName:     string;
  company:      string | null;
  email:        string | null;
  status:       LeadStatus;
  messageCount: number;
  lastMessage:  { direction: Direction; subject: string | null; body: string; createdAt: string } | null;
  updatedAt:    string;
}

interface Message {
  id:         string;
  direction:  Direction;
  channel:    string;
  subject:    string | null;
  body:       string;
  sentAt:     string | null;
  openedAt:   string | null;
  clickedAt:  string | null;
  replyClass: string | null;
  createdAt:  string;
}

interface LeadThread {
  id:           string;
  firstName:    string;
  lastName:     string;
  email:        string | null;
  company:      string | null;
  title:        string | null;
  status:       LeadStatus;
  messages:     Message[];
  campaignLeads: { campaign: { id: string; name: string; status: string } }[];
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW:          'bg-gray-800 text-gray-400',
  CONTACTED:    'bg-blue-500/10 text-blue-400',
  REPLIED:      'bg-yellow-500/10 text-yellow-400',
  HOT:          'bg-orange-500/10 text-orange-400',
  CONVERTED:    'bg-green-500/10 text-green-400',
  LOST:         'bg-red-500/10 text-red-400',
  UNSUBSCRIBED: 'bg-gray-800 text-gray-500',
};

function initials(f: string, l: string) {
  return `${f[0] ?? ''}${l[0] ?? ''}`.toUpperCase();
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000)   return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

export default function InboxPage() {
  const { success, error: toastError } = useToast();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [filter,   setFilter]   = useState<'all' | 'replied' | 'hot'>('all');
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread,   setThread]   = useState<LeadThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replySubject, setReplySubject] = useState('');
  const [replyBody,    setReplyBody]    = useState('');
  const [sending,  setSending]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = async (p = 1, f = filter) => {
    setLoading(true);
    try {
      const r = await api.get(`/inbox?page=${p}&filter=${f}`);
      setConversations(p === 1 ? r.data.conversations : prev => [...prev, ...r.data.conversations]);
      setTotal(r.data.total);
      setPage(p);
    } catch { toastError('Failed to load inbox'); }
    finally { setLoading(false); }
  };

  const loadThread = async (leadId: string) => {
    setSelected(leadId);
    setThread(null);
    setThreadLoading(true);
    try {
      const r = await api.get(`/inbox/${leadId}`);
      setThread(r.data);
      const last = r.data.messages.at(-1);
      if (last?.direction === 'INBOUND') {
        setReplySubject(`Re: ${last.subject ?? ''}`);
      }
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { toastError('Failed to load thread'); }
    finally { setThreadLoading(false); }
  };

  const handleReply = async () => {
    if (!selected || !replyBody.trim()) return;
    setSending(true);
    try {
      await api.post(`/inbox/${selected}/reply`, { subject: replySubject, body: replyBody });
      success('Reply sent');
      setReplyBody('');
      await loadThread(selected);
    } catch { toastError('Failed to send reply'); }
    finally { setSending(false); }
  };

  const setStatus = async (status: LeadStatus) => {
    if (!selected) return;
    try {
      await api.patch(`/inbox/${selected}/status`, { status });
      setThread(prev => prev ? { ...prev, status } : null);
      setConversations(prev => prev.map(c => c.leadId === selected ? { ...c, status } : c));
      success('Status updated');
    } catch { toastError('Failed to update status'); }
  };

  useEffect(() => { loadConversations(1, filter); }, [filter]);

  // Auto-open thread from ?leadId= URL param (e.g. from HOT_LEAD notification)
  useEffect(() => {
    const leadId = searchParams.get('leadId');
    if (leadId && !selected) {
      loadThread(leadId);
    }
  }, [searchParams]);

  const FILTERS = [
    { id: 'all',     label: 'All' },
    { id: 'replied', label: 'Replied' },
    { id: 'hot',     label: 'Hot' },
  ] as const;

  return (
    <>
      <Topbar title="Inbox" subtitle={`${total} conversations`} />
      <main className="flex-1 flex overflow-hidden">

        {/* Left: conversation list */}
        <div className="w-80 flex-shrink-0 border-r border-gray-800/60 flex flex-col bg-[#080b10]">
          {/* Filter tabs */}
          <div className="flex gap-1 p-3 border-b border-gray-800/60">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === f.id ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && conversations.length === 0 ? (
              <div className="space-y-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="p-4 border-b border-gray-800/40">
                    <div className="flex gap-3">
                      <div className="skeleton w-9 h-9 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-3.5 rounded w-32" />
                        <div className="skeleton h-3 rounded w-48" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                <span className="text-3xl mb-2">📬</span>
                <p className="text-gray-500 text-sm">No conversations yet</p>
                <p className="text-gray-600 text-xs mt-1">Start a campaign to see replies here</p>
              </div>
            ) : (
              <>
                {conversations.map(conv => (
                  <button
                    key={conv.leadId}
                    onClick={() => loadThread(conv.leadId)}
                    className={`w-full text-left p-4 border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors ${
                      selected === conv.leadId ? 'bg-gray-800/50 border-l-2 border-l-brand-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500/30 to-purple-500/30 flex items-center justify-center text-xs font-bold text-brand-300 shrink-0">
                        {initials(conv.firstName, conv.lastName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-medium text-white truncate">
                            {conv.firstName} {conv.lastName}
                          </p>
                          <span className="text-[10px] text-gray-600 shrink-0">{timeAgo(conv.updatedAt)}</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{conv.company ?? conv.email ?? '—'}</p>
                        {conv.lastMessage && (
                          <p className={`text-xs truncate mt-0.5 ${conv.lastMessage.direction === 'INBOUND' ? 'text-brand-400' : 'text-gray-600'}`}>
                            {conv.lastMessage.direction === 'INBOUND' ? '← ' : '→ '}
                            {conv.lastMessage.body.slice(0, 60)}
                          </p>
                        )}
                        <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[conv.status]}`}>
                          {conv.status}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
                {conversations.length < total && (
                  <button
                    onClick={() => loadConversations(page + 1)}
                    className="w-full py-3 text-xs text-gray-500 hover:text-gray-300 border-t border-gray-800/40"
                  >
                    Load more
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: thread */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-950">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">Select a conversation</p>
            </div>
          ) : threadLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : thread ? (
            <>
              {/* Thread header */}
              <div className="p-4 border-b border-gray-800/60 flex items-center justify-between bg-gray-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500/30 to-purple-500/30 flex items-center justify-center text-sm font-bold text-brand-300">
                    {initials(thread.firstName, thread.lastName)}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{thread.firstName} {thread.lastName}</p>
                    <p className="text-xs text-gray-500">{thread.email} · {thread.company ?? '—'} · {thread.title ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[thread.status]} border-current/20`}>
                    {thread.status}
                  </span>
                  {/* Quick status actions */}
                  <select
                    className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-300"
                    value={thread.status}
                    onChange={e => setStatus(e.target.value as LeadStatus)}
                  >
                    {(['NEW','CONTACTED','REPLIED','HOT','CONVERTED','LOST','UNSUBSCRIBED'] as LeadStatus[]).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Campaigns */}
              {thread.campaignLeads.length > 0 && (
                <div className="px-4 py-2 border-b border-gray-800/40 flex gap-2 flex-wrap">
                  {thread.campaignLeads.map(cl => (
                    <span key={cl.campaign.id} className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                      {cl.campaign.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <AnimatePresence initial={false}>
                  {thread.messages.map((msg, i) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[75%] ${msg.direction === 'OUTBOUND' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        {msg.subject && (
                          <p className="text-[11px] text-gray-500 px-1">
                            {msg.subject}
                          </p>
                        )}
                        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.direction === 'OUTBOUND'
                            ? 'bg-brand-500/15 border border-brand-500/20 text-gray-100 rounded-tr-sm'
                            : 'bg-gray-800 border border-gray-700/60 text-gray-200 rounded-tl-sm'
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.body.slice(0, 800)}{msg.body.length > 800 ? '…' : ''}</p>
                        </div>
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-[10px] text-gray-600">
                            {new Date(msg.sentAt ?? msg.createdAt).toLocaleString()}
                          </span>
                          {msg.direction === 'OUTBOUND' && (
                            <div className="flex gap-1">
                              {msg.openedAt  && <span title="Opened"  className="text-[10px] text-blue-400">👁</span>}
                              {msg.clickedAt && <span title="Clicked" className="text-[10px] text-green-400">🔗</span>}
                            </div>
                          )}
                          {msg.replyClass && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              msg.replyClass === 'INTERESTED'     ? 'bg-green-500/10 text-green-400' :
                              msg.replyClass === 'NOT_INTERESTED' ? 'bg-red-500/10 text-red-400' :
                              msg.replyClass === 'UNSUBSCRIBE'    ? 'bg-gray-800 text-gray-500' :
                              'bg-yellow-500/10 text-yellow-400'
                            }`}>
                              {msg.replyClass.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={bottomRef} />
              </div>

              {/* Reply composer */}
              <div className="p-4 border-t border-gray-800/60 bg-gray-900/50 space-y-2">
                <input
                  className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                  placeholder="Subject"
                  value={replySubject}
                  onChange={e => setReplySubject(e.target.value)}
                />
                <div className="relative">
                  <textarea
                    className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-brand-500 focus:outline-none resize-none h-28"
                    placeholder={`Reply to ${thread.firstName}… Use {{firstName}}, {{company}} for personalization`}
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-gray-600">Variables: {'{{firstName}}'} {'{{company}}'} {'{{title}}'}</p>
                  <Button
                    size="sm"
                    onClick={handleReply}
                    loading={sending}
                    disabled={!replyBody.trim()}
                  >
                    Send Reply
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </main>
    </>
  );
}
