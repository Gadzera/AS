'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { api } from '@/lib/api';
import Topbar from '@/components/layout/Topbar';
import PageTransition from '@/components/layout/PageTransition';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  language?:            string;
  lastRunAt?:           string | null;
}

interface Pipeline {
  discovered: number;
  contacted:  number;
  replied:    number;
  interested: number;
  converted:  number;
  recentHot:  Array<{
    id:        string;
    firstName: string;
    lastName:  string;
    email:     string | null;
    company:   string | null;
    updatedAt: string;
  }>;
}

interface Campaign {
  id:   string;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getInitials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

// ─── Animated count-up ────────────────────────────────────────────────────────

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const start = useRef(0);
  const startTs = useRef<number | null>(null);
  const duration = 800;

  useEffect(() => {
    const from = start.current;
    const to = value;
    start.current = value;
    startTs.current = null;

    if (from === to) { setDisplay(to); return; }

    let raf: number;
    function tick(ts: number) {
      if (!startTs.current) startTs.current = ts;
      const elapsed = ts - startTs.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  function addTag(value: string) {
    const trimmed = value.trim().replace(/,$/, '');
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function handleBlur() {
    if (input.trim()) addTag(input);
  }

  return (
    <div className="flex flex-wrap gap-1.5 min-h-[42px] rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 focus-within:border-brand-500/50 focus-within:ring-1 focus-within:ring-brand-500/20 transition-colors">
      {tags.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-500/15 text-brand-400 rounded-md text-xs font-medium border border-brand-500/20"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter(t => t !== tag))}
            className="text-brand-400/60 hover:text-brand-300 transition-colors leading-none"
          >
            &times;
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-gray-300 placeholder-gray-600 outline-none"
      />
    </div>
  );
}

// ─── Animated progress bar ────────────────────────────────────────────────────

function PipelineBar({
  label,
  value,
  max,
  pct,
  color,
  convRate,
  delay,
}: {
  label: string;
  value: number;
  max:   number;
  pct:   number;
  color: string;
  convRate?: number;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="space-y-1"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400 font-medium">{label}</span>
        <span className="text-white font-semibold tabular-nums">
          <AnimatedNumber value={value} />
        </span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: delay + 0.1, duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      {convRate !== undefined && (
        <p className="text-[10px] text-gray-600">{convRate}% to next stage</p>
      )}
    </motion.div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  color,
  delay,
}: {
  label: string;
  value: number;
  icon:  React.ReactNode;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-card flex items-start gap-4"
    >
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5 tabular-nums">
          <AnimatedNumber value={value} />
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  'Technology', 'SaaS', 'Finance', 'Healthcare', 'E-commerce',
  'Marketing', 'Manufacturing', 'Real Estate', 'Education', 'Other',
];
const COUNTRIES = [
  'United States', 'United Kingdom', 'Germany', 'France', 'Canada',
  'Australia', 'Netherlands', 'Sweden', 'Israel', 'Singapore', 'Other',
];
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Russian' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'it', label: 'Italian' },
  { value: 'nl', label: 'Dutch' },
  { value: 'pl', label: 'Polish' },
];
const SOURCES = [
  { value: 'web',    label: 'Web Search' },
  { value: 'apollo', label: 'Apollo' },
  { value: 'both',   label: 'Both' },
];

const STATIC_ACTIVITY = [
  { id: '1', text: 'Autopilot discovered 12 new leads',              time: '2h ago',  color: 'bg-blue-500'  },
  { id: '2', text: 'Auto-reply sent to Jordan R. at Acme Corp',      time: '4h ago',  color: 'bg-brand-500' },
  { id: '3', text: 'Follow-up sequence triggered for 5 leads',       time: '6h ago',  color: 'bg-purple-500' },
  { id: '4', text: 'Lead classified as HOT: Sarah K. at Notion Inc', time: '9h ago',  color: 'bg-green-500' },
  { id: '5', text: 'Daily discovery limit reached (50 leads)',        time: '12h ago', color: 'bg-yellow-500' },
];

export default function AutopilotPage() {
  const [config, setConfig]       = useState<AutopilotConfig>({ enabled: false });
  const [pipeline, setPipeline]   = useState<Pipeline | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [saving, setSaving]       = useState(false);
  const [running, setRunning]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [runSuccess, setRunSuccess] = useState(false);

  const [keywords, setKeywords] = useState<string[]>([]);
  const [titles, setTitles]     = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [cfgRes, pipeRes, campRes] = await Promise.all([
        api.get<AutopilotConfig>('/autopilot'),
        api.get<Pipeline>('/autopilot/pipeline'),
        api.get<Campaign[]>('/campaigns'),
      ]);
      setConfig(cfgRes.data);
      setPipeline(pipeRes.data);
      setCampaigns(campRes.data);
      setKeywords(cfgRes.data.targetKeywords ?? []);
      setTitles(cfgRes.data.targetTitles ?? []);
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

  const handleRunNow = async () => {
    setRunning(true);
    setRunSuccess(false);
    try {
      await api.post('/autopilot/run');
      setRunSuccess(true);
      setTimeout(() => setRunSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  // Pipeline data
  const p = pipeline ?? { discovered: 0, contacted: 0, replied: 0, interested: 0, converted: 0, recentHot: [] };
  const maxVal = Math.max(p.discovered, 1);

  function rate(a: number, b: number) {
    if (a === 0) return 0;
    return Math.round((b / a) * 100);
  }

  const funnelStages = [
    { label: 'Discovered', value: p.discovered, color: 'bg-blue-500',   convRate: rate(p.discovered, p.contacted) },
    { label: 'Contacted',  value: p.contacted,  color: 'bg-indigo-500', convRate: rate(p.contacted,  p.replied)   },
    { label: 'Replied',    value: p.replied,    color: 'bg-purple-500', convRate: rate(p.replied,    p.interested) },
    { label: 'Interested', value: p.interested, color: 'bg-brand-500',  convRate: rate(p.interested, p.converted) },
    { label: 'Converted',  value: p.converted,  color: 'bg-green-500',  convRate: undefined },
  ];

  const selectClass = 'block w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-colors';
  const labelClass  = 'text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block';
  const inputClass  = 'block w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-colors';

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-950">
        <Topbar title="Autopilot" subtitle="Autonomous lead discovery and outreach" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <Topbar title="Autopilot" subtitle="Autonomous lead discovery and outreach" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── KPI row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Discovered"
            value={p.discovered}
            delay={0}
            color="bg-blue-500/10"
            icon={
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
          <KpiCard
            label="Total Contacted"
            value={p.contacted}
            delay={0.07}
            color="bg-indigo-500/10"
            icon={
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />
          <KpiCard
            label="Total Replied"
            value={p.replied}
            delay={0.14}
            color="bg-purple-500/10"
            icon={
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            }
          />
          <KpiCard
            label="Total Interested"
            value={p.interested}
            delay={0.21}
            color="bg-green-500/10"
            icon={
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          />
        </div>

        {/* ── 3-column grid ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

          {/* ── LEFT: Configuration panel ──────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="bg-gray-900 border border-gray-800 rounded-xl shadow-card"
          >
            {/* Master toggle */}
            <div className="p-5 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Autopilot Status</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {config.enabled
                      ? 'Active — discovering and contacting leads'
                      : 'Paused — enable to start the cycle'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleEnabled}
                  className="relative flex-shrink-0"
                  aria-label="Toggle autopilot"
                >
                  <motion.div
                    animate={{
                      backgroundColor: config.enabled ? '#6366f1' : '#374151',
                      boxShadow: config.enabled
                        ? '0 0 0 3px rgba(99,102,241,0.25), 0 0 12px rgba(99,102,241,0.35)'
                        : '0 0 0 0px transparent',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className="w-14 h-7 rounded-full px-0.5 flex items-center"
                  >
                    <motion.div
                      animate={{ x: config.enabled ? 28 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="w-6 h-6 bg-white rounded-full shadow-md"
                    />
                  </motion.div>
                  <span className={`absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-semibold tracking-widest uppercase whitespace-nowrap transition-colors ${config.enabled ? 'text-brand-400' : 'text-gray-600'}`}>
                    {config.enabled ? 'Active' : 'Paused'}
                  </span>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">

              {/* Target Campaign */}
              <div>
                <label className={labelClass}>Target Campaign</label>
                <select
                  className={selectClass}
                  value={config.targetCampaignId ?? ''}
                  onChange={e => setConfig(c => ({ ...c, targetCampaignId: e.target.value || null }))}
                >
                  <option value="">No campaign selected</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Discovery Source */}
              <div>
                <label className={labelClass}>Discovery Source</label>
                <div className="flex rounded-lg border border-gray-700 overflow-hidden">
                  {SOURCES.map((src, i) => (
                    <button
                      key={src.value}
                      type="button"
                      onClick={() => setConfig(c => ({ ...c, discoverySource: src.value }))}
                      className={`flex-1 py-2 text-xs font-medium transition-colors ${
                        i > 0 ? 'border-l border-gray-700' : ''
                      } ${
                        (config.discoverySource ?? 'web') === src.value
                          ? 'bg-brand-500/20 text-brand-400'
                          : 'bg-gray-900/60 text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      {src.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Keywords */}
              <div>
                <label className={labelClass}>Target Keywords</label>
                <TagInput
                  tags={keywords}
                  onChange={setKeywords}
                  placeholder="SaaS, B2B software, e-commerce..."
                />
                <p className="text-[10px] text-gray-600 mt-1">Press Enter or comma to add</p>
              </div>

              {/* Target Titles */}
              <div>
                <label className={labelClass}>Decision Maker Titles</label>
                <TagInput
                  tags={titles}
                  onChange={setTitles}
                  placeholder="CEO, Head of Sales, Founder..."
                />
              </div>

              {/* Industry & Country */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Industry</label>
                  <select
                    className={selectClass}
                    value={config.targetIndustry ?? ''}
                    onChange={e => setConfig(c => ({ ...c, targetIndustry: e.target.value || null }))}
                  >
                    <option value="">Any</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Country</label>
                  <select
                    className={selectClass}
                    value={config.targetCountry ?? ''}
                    onChange={e => setConfig(c => ({ ...c, targetCountry: e.target.value || null }))}
                  >
                    <option value="">Any</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Daily Discovery Limit */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelClass + ' mb-0'}>Daily Discovery Limit</label>
                  <span className="text-sm font-semibold text-brand-400 tabular-nums">
                    {config.dailyDiscoveryLimit ?? 20}
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={config.dailyDiscoveryLimit ?? 20}
                  onChange={e => setConfig(c => ({ ...c, dailyDiscoveryLimit: parseInt(e.target.value) }))}
                  className="w-full h-1.5 rounded-full appearance-none bg-gray-700 accent-brand-500 cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${((( config.dailyDiscoveryLimit ?? 20) - 5) / 95) * 100}%, #374151 ${(((config.dailyDiscoveryLimit ?? 20) - 5) / 95) * 100}%, #374151 100%)`,
                  }}
                />
                <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                  <span>5</span>
                  <span>100</span>
                </div>
              </div>

              {/* Language */}
              <div>
                <label className={labelClass}>Outreach Language</label>
                <select
                  className={selectClass}
                  value={config.language ?? 'en'}
                  onChange={e => setConfig(c => ({ ...c, language: e.target.value }))}
                >
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-800 pt-4 space-y-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Auto-Reply Settings</h3>

                {/* Auto-reply toggle */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={config.autoReplyEnabled ?? false}
                      onChange={e => setConfig(c => ({ ...c, autoReplyEnabled: e.target.checked }))}
                    />
                    <motion.div
                      animate={{
                        backgroundColor: (config.autoReplyEnabled ?? false) ? '#6366f1' : '#374151',
                      }}
                      transition={{ duration: 0.2 }}
                      className="w-9 h-5 rounded-full"
                    >
                      <motion.div
                        animate={{ x: (config.autoReplyEnabled ?? false) ? 16 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow"
                      />
                    </motion.div>
                  </div>
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                    Auto-reply to interested leads
                  </span>
                </label>

                <AnimatePresence>
                  {config.autoReplyEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3 overflow-hidden"
                    >
                      <div>
                        <label className={labelClass}>Calendly / Meeting URL</label>
                        <input
                          type="url"
                          className={inputClass}
                          value={config.calendlyUrl ?? ''}
                          onChange={e => setConfig(c => ({ ...c, calendlyUrl: e.target.value || null }))}
                          placeholder="https://calendly.com/you/30min"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Sender Name</label>
                          <input
                            className={inputClass}
                            value={config.senderName ?? ''}
                            onChange={e => setConfig(c => ({ ...c, senderName: e.target.value || null }))}
                            placeholder="Your Name"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Sender Title</label>
                          <input
                            className={inputClass}
                            value={config.senderTitle ?? ''}
                            onChange={e => setConfig(c => ({ ...c, senderTitle: e.target.value || null }))}
                            placeholder="Head of Sales"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Follow-up delay */}
              <div>
                <label className={labelClass}>Follow-up after (days)</label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  className={inputClass}
                  value={config.followUpDelayDays ?? 3}
                  onChange={e => setConfig(c => ({ ...c, followUpDelayDays: parseInt(e.target.value) || 3 }))}
                />
              </div>

              {/* Save */}
              <div className="pt-1">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-brand-500 to-purple-600 hover:from-brand-600 hover:to-purple-700 text-white text-sm font-semibold shadow-glow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving && (
                    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {saving ? 'Saving...' : 'Save Settings'}
                </motion.button>
              </div>

            </div>
          </motion.div>

          {/* ── CENTER: Pipeline funnel ────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.4 }}
            className="bg-gray-900 border border-gray-800 rounded-xl shadow-card"
          >
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Pipeline Funnel</h2>
                {config.lastRunAt && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Last run: {timeAgo(config.lastRunAt)}
                  </p>
                )}
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.03 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                onClick={handleRunNow}
                disabled={running}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  runSuccess
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-brand-500/15 text-brand-400 border border-brand-500/25 hover:bg-brand-500/25'
                } disabled:opacity-50`}
              >
                {running ? (
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                  </svg>
                )}
                {running ? 'Queuing...' : runSuccess ? 'Queued!' : 'Run Now'}
              </motion.button>
            </div>

            <div className="p-5 space-y-4">
              {funnelStages.map((stage, i) => (
                <PipelineBar
                  key={stage.label}
                  label={stage.label}
                  value={stage.value}
                  max={maxVal}
                  pct={maxVal > 0 ? Math.max((stage.value / maxVal) * 100, stage.value > 0 ? 3 : 0) : 0}
                  color={stage.color}
                  convRate={stage.convRate}
                  delay={0.2 + i * 0.07}
                />
              ))}
            </div>

            {/* Overall conversion */}
            <div className="px-5 pb-5">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center border border-gray-700/50">
                <p className="text-xs text-gray-500">Overall conversion rate</p>
                <p className="text-xl font-bold text-white mt-0.5 tabular-nums">
                  {p.discovered > 0 ? ((p.converted / p.discovered) * 100).toFixed(1) : '0.0'}%
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5">Discovered &rarr; Converted</p>
              </div>
            </div>
          </motion.div>

          {/* ── RIGHT: Hot leads + activity ───────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.4 }}
            className="space-y-4"
          >
            {/* Hot Leads */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-card">
              <div className="p-5 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">Recent Hot Leads</h2>
                  <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs font-semibold rounded-full border border-green-500/20">
                    {p.recentHot.length} hot
                  </span>
                </div>
              </div>

              <div className="p-3">
                {p.recentHot.length === 0 ? (
                  <div className="py-8 text-center text-gray-600 text-sm">
                    No hot leads yet
                  </div>
                ) : (
                  <div className="space-y-1">
                    {p.recentHot.map((lead, i) => (
                      <motion.a
                        key={lead.id}
                        href={`/inbox?leadId=${lead.id}`}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.05, duration: 0.3 }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800/60 transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500/70 to-purple-600/70 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                          {getInitials(lead.firstName, lead.lastName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white group-hover:text-brand-300 transition-colors truncate">
                            {lead.firstName} {lead.lastName}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {lead.company ?? lead.email ?? 'Unknown'}
                          </p>
                        </div>
                        <span className="text-[10px] text-gray-600 flex-shrink-0">
                          {timeAgo(lead.updatedAt)}
                        </span>
                      </motion.a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Activity Log */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-card">
              <div className="p-5 border-b border-gray-800">
                <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
              </div>
              <div className="p-3 space-y-1">
                {STATIC_ACTIVITY.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.05, duration: 0.3 }}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${item.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 leading-relaxed">{item.text}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{item.time}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
