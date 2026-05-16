'use client';

import { useEffect, useState } from 'react';
import { campaignsApi } from '@/lib/api';
import type { Campaign } from '@/types';
import Topbar from '@/components/layout/Topbar';
import PageTransition from '@/components/layout/PageTransition';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import CampaignCard from '@/components/campaigns/CampaignCard';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    channel: 'EMAIL' as 'EMAIL' | 'LINKEDIN',
    targetIndustry: '',
    targetCountry: '',
    targetSize: '',
    dailyLimit: 50,
    abTestEnabled: false,
  });

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const data = await campaignsApi.list();
      setCampaigns(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await campaignsApi.create({
        ...form,
        targetIndustry: form.targetIndustry || undefined,
        targetCountry: form.targetCountry || undefined,
        targetSize: form.targetSize || undefined,
      });
      setShowCreateModal(false);
      setForm({ name: '', channel: 'EMAIL', targetIndustry: '', targetCountry: '', targetSize: '', dailyLimit: 50, abTestEnabled: false });
      fetchCampaigns();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await campaignsApi.start(id);
      fetchCampaigns();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg ?? 'Failed to start campaign');
    }
  };

  const handlePause = async (id: string) => {
    try {
      await campaignsApi.pause(id);
      fetchCampaigns();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <Topbar title="Campaigns" />
      <PageTransition>
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-500">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
          <Button onClick={() => setShowCreateModal(true)}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Campaign
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-48 rounded-xl" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <Card padding="lg" className="text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 mb-4">No campaigns yet. Create one to start automating your outreach.</p>
            <Button onClick={() => setShowCreateModal(true)}>Create first campaign</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onStart={handleStart}
                onPause={handlePause}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Campaign Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Campaign"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Campaign name"
            placeholder="Q3 SaaS Outreach"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <div>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Channel</label>
            <select
              className="mt-1.5 block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/70"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value as 'EMAIL' | 'LINKEDIN' })}
            >
              <option value="EMAIL">Email</option>
              <option value="LINKEDIN">LinkedIn</option>
            </select>
          </div>

          <Input
            label="Target Industry (optional)"
            placeholder="SaaS, Technology..."
            value={form.targetIndustry}
            onChange={(e) => setForm({ ...form, targetIndustry: e.target.value })}
          />
          <Input
            label="Target Country (optional)"
            placeholder="United States, Germany..."
            value={form.targetCountry}
            onChange={(e) => setForm({ ...form, targetCountry: e.target.value })}
          />
          <Input
            label="Target Company Size (optional)"
            placeholder="50-199, 10-49..."
            value={form.targetSize}
            onChange={(e) => setForm({ ...form, targetSize: e.target.value })}
          />
          <Input
            label="Daily send limit"
            type="number"
            min={1}
            max={500}
            value={form.dailyLimit}
            onChange={(e) => setForm({ ...form, dailyLimit: parseInt(e.target.value) || 50 })}
          />

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={form.abTestEnabled}
                onChange={(e) => setForm({ ...form, abTestEnabled: e.target.checked })}
              />
              <div className="w-9 h-5 bg-gray-700 peer-checked:bg-brand-500 rounded-full transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">Enable A/B testing</p>
              <p className="text-xs text-gray-500">Split-test two message variants per sequence step</p>
            </div>
          </label>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleCreate}
              loading={creating}
              disabled={!form.name.trim()}
              className="flex-1"
            >
              Create Campaign
            </Button>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
