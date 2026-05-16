'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { leadsApi, outreachApi } from '@/lib/api';
import { Lead, Message } from '@/types';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';

interface LeadDetail extends Lead {
  messages: Message[];
  campaignLeads: Array<{
    campaign: { id: string; name: string; status: string };
    currentStep: number;
    status: string;
    nextSendAt: string | null;
  }>;
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyModal, setReplyModal] = useState<{ messageId: string; body: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [autoReply, setAutoReply] = useState('');
  const [generatingReply, setGeneratingReply] = useState(false);

  useEffect(() => {
    leadsApi.get(id).then((data) => {
      setLead(data as LeadDetail);
      setLoading(false);
    });
  }, [id]);

  const handleGenerateReply = async () => {
    if (!replyModal) return;
    setGeneratingReply(true);
    try {
      const result = await outreachApi.autoReply({
        messageId: replyModal.messageId,
        replyText,
        language: 'en',
        send: false,
      });
      setAutoReply(result.body);
    } finally {
      setGeneratingReply(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyModal) return;
    await outreachApi.autoReply({
      messageId: replyModal.messageId,
      replyText,
      language: 'en',
      send: true,
    });
    setReplyModal(null);
    setReplyText('');
    setAutoReply('');
    const data = await leadsApi.get(id);
    setLead(data as LeadDetail);
  };

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;
  if (!lead) return <div className="p-8 text-gray-400">Lead not found</div>;

  const outbound = lead.messages.filter((m) => m.direction === 'OUTBOUND');
  const inbound = lead.messages.filter((m) => m.direction === 'INBOUND');

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-white mb-2 flex items-center gap-1">
        ← Back to leads
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {lead.firstName} {lead.lastName}
          </h1>
          <p className="text-gray-400 mt-1">
            {lead.title}{lead.company ? ` · ${lead.company}` : ''}
          </p>
          {lead.country && <p className="text-gray-500 text-sm">{lead.city ? `${lead.city}, ` : ''}{lead.country}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={lead.status as never}>{lead.status}</Badge>
          <div className="bg-gray-800 rounded-lg px-3 py-1 text-sm font-semibold text-white">
            Score: {lead.score}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Lead info */}
        <div className="col-span-1 space-y-4">
          <Card>
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <div className="p-4 space-y-3 text-sm">
              {lead.email && (
                <div>
                  <p className="text-gray-500 text-xs">Email</p>
                  <a href={`mailto:${lead.email}`} className="text-indigo-400 hover:underline">{lead.email}</a>
                </div>
              )}
              {lead.linkedinUrl && (
                <div>
                  <p className="text-gray-500 text-xs">LinkedIn</p>
                  <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline truncate block">View Profile</a>
                </div>
              )}
              {lead.website && (
                <div>
                  <p className="text-gray-500 text-xs">Website</p>
                  <a href={lead.website} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline truncate block">{lead.website}</a>
                </div>
              )}
              {lead.industry && (
                <div>
                  <p className="text-gray-500 text-xs">Industry</p>
                  <p className="text-white">{lead.industry}</p>
                </div>
              )}
              {lead.companySize && (
                <div>
                  <p className="text-gray-500 text-xs">Company size</p>
                  <p className="text-white">{lead.companySize} employees</p>
                </div>
              )}
            </div>
          </Card>

          {/* Campaigns */}
          {lead.campaignLeads?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Campaigns</CardTitle></CardHeader>
              <div className="p-4 space-y-2">
                {lead.campaignLeads.map((cl, i) => (
                  <div key={i} className="text-sm">
                    <p className="text-white font-medium">{cl.campaign.name}</p>
                    <p className="text-gray-500 text-xs">
                      Step {cl.currentStep + 1} · {cl.status}
                      {cl.nextSendAt && ` · Next: ${new Date(cl.nextSendAt).toLocaleDateString()}`}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Message history */}
        <div className="col-span-2 space-y-4">
          {/* Hot lead prompt */}
          {inbound.some((m) => m.replyClass === 'INTERESTED') && (
            <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-green-400 font-semibold">This lead is interested</p>
                <p className="text-green-300 text-sm">They replied positively. Send a follow-up and book a call.</p>
              </div>
            </div>
          )}

          <Card>
            <CardHeader><CardTitle>Message History ({lead.messages.length})</CardTitle></CardHeader>
            <div className="divide-y divide-gray-800">
              {lead.messages.length === 0 && (
                <p className="p-4 text-gray-500 text-sm">No messages yet</p>
              )}
              {lead.messages.map((msg) => (
                <div key={msg.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        msg.direction === 'OUTBOUND'
                          ? 'bg-indigo-900 text-indigo-300'
                          : 'bg-gray-700 text-gray-300'
                      }`}>
                        {msg.direction === 'OUTBOUND' ? '↑ Sent' : '↓ Received'}
                      </span>
                      {msg.aiGenerated && (
                        <span className="text-xs text-purple-400">AI</span>
                      )}
                      {msg.replyClass && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          msg.replyClass === 'INTERESTED' ? 'bg-green-900 text-green-300' :
                          msg.replyClass === 'NOT_INTERESTED' ? 'bg-red-900 text-red-300' :
                          msg.replyClass === 'UNSUBSCRIBE' ? 'bg-red-900 text-red-300' :
                          'bg-yellow-900 text-yellow-300'
                        }`}>
                          {msg.replyClass}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {msg.sentAt ? new Date(msg.sentAt).toLocaleString() : new Date(msg.createdAt).toLocaleString()}
                      {msg.openedAt && <span className="ml-2 text-green-400">· Opened</span>}
                    </span>
                  </div>
                  {msg.subject && (
                    <p className="text-sm font-medium text-white mb-1">{msg.subject}</p>
                  )}
                  <p className="text-sm text-gray-400 whitespace-pre-wrap line-clamp-4">{msg.body}</p>

                  {msg.direction === 'INBOUND' && msg.replyClass === 'INTERESTED' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      onClick={() => setReplyModal({ messageId: msg.id, body: msg.body })}
                    >
                      Generate auto-reply
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Auto-reply modal */}
      <Modal
        isOpen={!!replyModal}
        onClose={() => { setReplyModal(null); setReplyText(''); setAutoReply(''); }}
        title="Generate reply for interested lead"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-400 mb-2">Their reply:</p>
            <p className="text-sm text-white bg-gray-800 rounded p-3">{replyModal?.body}</p>
          </div>
          <Input
            label="Their reply text (paste if different)"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Paste their reply here..."
          />
          {autoReply && (
            <div>
              <p className="text-sm text-gray-400 mb-2">Generated reply:</p>
              <p className="text-sm text-white bg-gray-800 rounded p-3 whitespace-pre-wrap">{autoReply}</p>
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={handleGenerateReply} loading={generatingReply} variant="secondary">
              Generate
            </Button>
            {autoReply && (
              <Button onClick={handleSendReply}>
                Send reply
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
