'use client';

import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Filter, ArrowDownUp, Plus } from 'lucide-react';
import { campaignsApi } from '@/lib/api';
import type { Campaign, CampaignStatus } from '@/types';
import Topbar from '@/components/layout/Topbar';
import { ViewTabsRow } from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import { useSelection } from '@/lib/selection';
import FilterChip from '@/components/ui/_stubs/FilterChip';
import ViewToggle, { type CampaignsView } from '@/components/campaigns/ViewToggle';
import KanbanBoard from '@/components/campaigns/KanbanBoard';
import CampaignsTable from '@/components/campaigns/CampaignsTable';
import NewCampaignModal from '@/components/campaigns/NewCampaignModal';
import EmptyCampaignsState from '@/components/campaigns/EmptyCampaignsState';
import {
  KanbanSkeleton,
  TableSkeleton,
} from '@/components/campaigns/CampaignsSkeleton';
import CampaignsBulkFooter from '@/components/campaigns/CampaignsBulkFooter';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CampaignsView>('kanban');
  const [showCreate, setShowCreate] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<CampaignStatus>('DRAFT');
  const [toast, setToast] = useState<string | null>(null);
  const { clear, selected } = useSelection();

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await campaignsApi.list();
      setCampaigns(data);
    } catch (err) {
      console.error(err);
      setToast('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
    return () => clear();
  }, [fetchCampaigns, clear]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleAdd = (status: CampaignStatus) => {
    setDefaultStatus(status);
    setShowCreate(true);
  };

  const handleBulkStart = async () => {
    const ids = Array.from(selected);
    await Promise.allSettled(ids.map((id) => campaignsApi.start(id)));
    clear();
    fetchCampaigns();
  };

  const handleBulkPause = async () => {
    const ids = Array.from(selected);
    await Promise.allSettled(ids.map((id) => campaignsApi.pause(id)));
    clear();
    fetchCampaigns();
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (!confirm(`Delete ${ids.length} campaign${ids.length === 1 ? '' : 's'}?`)) {
      return;
    }
    await Promise.allSettled(ids.map((id) => campaignsApi.delete(id)));
    clear();
    fetchCampaigns();
  };

  return (
    <>
      <Topbar
        icon={<Megaphone size={16} strokeWidth={1.75} />}
        title="Campaigns"
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm">
              Import / Export
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} strokeWidth={2} />
              <span>New campaign</span>
            </Button>
          </div>
        }
      />

      <ViewTabsRow
        left={[
          <ViewToggle key="vt" view={view} onChange={setView} />,
          <FilterChip key="sort">
            <ArrowDownUp size={12} strokeWidth={1.75} />
            Sorted by Created at
          </FilterChip>,
          <FilterChip key="filter">
            <Filter size={12} strokeWidth={1.75} />
            Filter
          </FilterChip>,
        ]}
      />

      {/* Content */}
      {loading ? (
        view === 'kanban' ? <KanbanSkeleton /> : <TableSkeleton />
      ) : campaigns.length === 0 ? (
        <EmptyCampaignsState onCreate={() => setShowCreate(true)} />
      ) : view === 'kanban' ? (
        <KanbanBoard
          campaigns={campaigns}
          onChange={setCampaigns}
          onError={(m) => setToast(m)}
          onAdd={handleAdd}
        />
      ) : (
        <div className="px-5 pt-4 pb-24">
          <CampaignsTable campaigns={campaigns} />
        </div>
      )}

      <CampaignsBulkFooter
        onStart={handleBulkStart}
        onPause={handleBulkPause}
        onDelete={handleBulkDelete}
      />

      <NewCampaignModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchCampaigns}
        defaultStatus={defaultStatus}
      />

      {/* Inline toast (until Agent 5 ships proper Toast) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-white border border-[var(--border)] rounded-lg shadow-popover px-3 h-10 flex items-center text-[13.5px] text-[var(--text)]">
          {toast}
        </div>
      )}
    </>
  );
}
