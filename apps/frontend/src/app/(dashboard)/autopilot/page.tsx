'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import Topbar from '@/components/layout/Topbar';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface AutopilotConfig {
  enabled:              boolean;
  targetCampaignId?:    string | null;
  discoverySource?:     string;
  targetKeywords?:      string[];
  targetIndustry?:      string | null;
  targetCountry?:       string | null;
  targetTitles?:        string[];
  dailyDiscoveryLimit?: number;
  autoReplyEnabled?:    boolean;
  calendlyUrl?:         string | null;
  senderName?:          string | null;
  senderTitle?:         string | null;
  followUpDelayDays?:   number;
  totalDiscovered?:     number;
  totalContacted?:      number;
  totalReplied?:        number;
  totalInterested?:     number;
  lastRunAt?:           string | null;
}

interface Pipeline {
  discovered: number;
  contacted:  number;
  replied:    number;
  interested: number;
  converted:  number;
  recentHot:  Array<{ id: string; firstName: string; lastName: string; email: string | null; company: string | null; updatedAt: string }>;
}

interface Campaign {
  id:   string;
  name: string;
}

export default function AutopilotPage() {
  const [config, setConfig]       = useState<AutopilotConfig>({ enabled: false });
  const [pipeline, setPipeline]   = useState<Pipeline | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);

  const [keywordsInput, setKeywordsInput] = useState('');
  const [titlesInput, setTitlesInput]     = useState('');

  const loadData = useCallback(async () => {
    try {
      const [cfgRes, pipelineRes, campaignsRes] = await Promise.all([
        api.get<AutopilotConfig>('/autopilot'),
        api.get<Pipeline>('/autopilot/pipeline'),
        api.get<Campaign[]>('/campaigns'),
      ]);
      setConfig(cfgRes.data);
      setPipeline(pipelineRes.data);
      setCampaigns(campaignsRes.data);
      setKeywordsInput((cfgRes.data.targetKeywords ?? []).join(', '));
      setTitlesInput((cfgRes.data.targetTitles ?? []).join(', '));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const keywords = keywordsInput.split(',').map(s => s.trim()).filter(Boolean);
      const titles   = titlesInput.split(',').map(s => s.trim()).filter(Boolean);
      const res = await api.put<AutopilotConfig>('/autopilot', {
        ...config,
        targetKeywords: keywords,
        targetTitles:   titles,
      });
      setConfig(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async () => {
    const next = !config.enabled;
    setConfig(c => ({ ...c, enabled: next }));
    await api.put('/autopilot', { enabled: next }).catch(() => {
      setConfig(c => ({ ...c, enabled: !next }));
    });
  };

  const funnelSteps = pipeline ? [
    { label: 'Найдено',        value: pipeline.discovered, color: 'bg-gray-500' },
    { label: 'Контактировано', value: pipeline.contacted,  color: 'bg-blue-500' },
    { label: 'Ответили',       value: pipeline.replied,    color: 'bg-yellow-500' },
    { label: 'Заинтересованы', value: pipeline.interested, color: 'bg-orange-500' },
    { label: 'Конвертировано', value: pipeline.converted,  color: 'bg-green-500' },
  ] : [];

  const maxVal = Math.max(...funnelSteps.map(s => s.value), 1);

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-950">
        <Topbar title="Autopilot" subtitle="Автономный поиск и работа с клиентами" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <Topbar title="Autopilot" subtitle="Автономный поиск и работа с клиентами" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Toggle */}
        <Card>
          <div className="flex items-center justify-between p-6">
            <div>
              <h2 className="text-base font-semibold text-white">Автопилот</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {config.enabled
                  ? 'Активен — самостоятельно ищет клиентов и ведёт переписку'
                  : 'Выключен — включите чтобы запустить автономный цикл продаж'}
              </p>
            </div>
            <button
              onClick={toggleEnabled}
              className={`relative w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-brand-500' : 'bg-gray-700'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.enabled ? 'translate-x-6' : ''}`}
              />
            </button>
          </div>
        </Card>

        {/* Pipeline */}
        {pipeline && (
          <Card>
            <div className="p-6">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">Воронка продаж</h3>
              <div className="space-y-3">
                {funnelSteps.map((step) => (
                  <div key={step.label} className="flex items-center gap-4">
                    <span className="w-36 text-sm text-gray-400 text-right">{step.label}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-6 overflow-hidden">
                      <div
                        className={`h-full ${step.color} rounded-full transition-all duration-500 flex items-center justify-end pr-3`}
                        style={{ width: `${Math.max((step.value / maxVal) * 100, step.value > 0 ? 4 : 0)}%` }}
                      >
                        {step.value > 0 && (
                          <span className="text-xs font-semibold text-white">{step.value}</span>
                        )}
                      </div>
                    </div>
                    {step.value === 0 && <span className="text-sm text-gray-600">0</span>}
                  </div>
                ))}
              </div>

              {pipeline.recentHot.length > 0 && (
                <div className="mt-6 border-t border-gray-800 pt-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Горячие лиды</h4>
                  <div className="space-y-2">
                    {pipeline.recentHot.map(lead => (
                      <div key={lead.id} className="flex items-center justify-between text-sm">
                        <a
                          href={`/leads/${lead.id}`}
                          className="text-white hover:text-brand-400 transition-colors"
                        >
                          {lead.firstName} {lead.lastName}
                        </a>
                        <span className="text-gray-500">{lead.company ?? lead.email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Config */}
        <Card>
          <div className="p-6 space-y-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Настройки поиска</h3>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5 block">
                Ключевые слова (через запятую)
              </label>
              <Input
                value={keywordsInput}
                onChange={e => setKeywordsInput(e.target.value)}
                placeholder="SaaS, B2B software, marketing agency, e-commerce"
              />
              <p className="text-xs text-gray-600 mt-1">По этим словам система ищет компании в интернете</p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5 block">
                Должности ЛПР (через запятую)
              </label>
              <Input
                value={titlesInput}
                onChange={e => setTitlesInput(e.target.value)}
                placeholder="CEO, Founder, Head of Sales, Marketing Director"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5 block">Отрасль</label>
                <Input
                  value={config.targetIndustry ?? ''}
                  onChange={e => setConfig(c => ({ ...c, targetIndustry: e.target.value || null }))}
                  placeholder="Technology, E-commerce..."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5 block">Страна</label>
                <Input
                  value={config.targetCountry ?? ''}
                  onChange={e => setConfig(c => ({ ...c, targetCountry: e.target.value || null }))}
                  placeholder="United States, Germany..."
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5 block">
                Кампания для добавления лидов
              </label>
              <select
                className="block w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                value={config.targetCampaignId ?? ''}
                onChange={e => setConfig(c => ({ ...c, targetCampaignId: e.target.value || null }))}
              >
                <option value="">Не выбрана</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5 block">
                Лидов в день
              </label>
              <Input
                type="number"
                min={1}
                max={100}
                value={config.dailyDiscoveryLimit ?? 10}
                onChange={e => setConfig(c => ({ ...c, dailyDiscoveryLimit: parseInt(e.target.value) || 10 }))}
              />
            </div>

            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide pt-2 border-t border-gray-800">
              Автоответ на заинтересованных
            </h3>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoReplyEnabled ?? true}
                onChange={e => setConfig(c => ({ ...c, autoReplyEnabled: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-300">Автоматически отвечать на INTERESTED ответы</span>
            </label>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5 block">
                Calendly / ссылка на демо
              </label>
              <Input
                value={config.calendlyUrl ?? ''}
                onChange={e => setConfig(c => ({ ...c, calendlyUrl: e.target.value || null }))}
                placeholder="https://calendly.com/yourname/30min"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5 block">
                  Имя отправителя
                </label>
                <Input
                  value={config.senderName ?? ''}
                  onChange={e => setConfig(c => ({ ...c, senderName: e.target.value || null }))}
                  placeholder="Иван Иванов"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5 block">
                  Должность
                </label>
                <Input
                  value={config.senderTitle ?? ''}
                  onChange={e => setConfig(c => ({ ...c, senderTitle: e.target.value || null }))}
                  placeholder="Head of Partnerships"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5 block">
                Follow-up через (дней)
              </label>
              <Input
                type="number"
                min={1}
                max={30}
                value={config.followUpDelayDays ?? 3}
                onChange={e => setConfig(c => ({ ...c, followUpDelayDays: parseInt(e.target.value) || 3 }))}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} loading={saving}>Сохранить настройки</Button>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
