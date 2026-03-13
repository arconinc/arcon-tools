'use client'

import { useState, useEffect, useRef } from 'react'
import { TickerConfig, TickerManualItem, BannerStripItem } from '@/types'

const PRESET_LABELS = ['Announce', 'HR', 'Sales', 'IT', 'Finance', 'Operations', 'Reminder', 'Event']

const DEFAULT_CONFIG: Omit<TickerConfig, 'id' | 'updated_at'> = {
  show_birthdays: true,
  birthday_window_days: 0,
  show_anniversaries: true,
  anniversary_window_days: 0,
  show_news: true,
  news_recency_days: 7,
  show_holidays: true,
  holiday_lookahead_days: 7,
  show_clickup: false,
  clickup_api_key: null,
  clickup_team_id: null,
  clickup_list_id: null,
  clickup_due_within_days: 7,
  manual_items: [],
}

function newManualItem(): TickerManualItem {
  return {
    id: crypto.randomUUID(),
    label: 'Announce',
    text: '',
    href: null,
    active_from: null,
    active_until: null,
    enabled: true,
  }
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        on ? 'bg-purple-600' : 'bg-slate-300'
      }`}
      role="switch"
      aria-checked={on}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ── NumInput ───────────────────────────────────────────────────────────────────

function NumInput({
  label, value, min, max, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-600 min-w-0 flex-1">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const v = Math.max(min, Math.min(max, Number(e.target.value)))
            onChange(v)
          }}
          className="w-16 px-2 py-1 text-sm border border-slate-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <span className="text-xs text-slate-400">{unit}</span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BannerStripAdminPage() {
  const [config, setConfig] = useState<Omit<TickerConfig, 'id' | 'updated_at'>>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewItems, setPreviewItems] = useState<BannerStripItem[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/admin/banner-strip')
      .then((r) => r.json())
      .then((data: TickerConfig) => {
        setConfig({
          show_birthdays: data.show_birthdays,
          birthday_window_days: data.birthday_window_days,
          show_anniversaries: data.show_anniversaries,
          anniversary_window_days: data.anniversary_window_days,
          show_news: data.show_news,
          news_recency_days: data.news_recency_days,
          show_holidays: data.show_holidays,
          holiday_lookahead_days: data.holiday_lookahead_days,
          show_clickup: data.show_clickup,
          clickup_api_key: data.clickup_api_key,
          clickup_team_id: data.clickup_team_id ?? null,
          clickup_list_id: data.clickup_list_id,
          clickup_due_within_days: data.clickup_due_within_days,
          manual_items: data.manual_items ?? [],
        })
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load configuration')
        setLoading(false)
      })
  }, [])

  async function save(updated: typeof config) {
    setSaving(true)
    setSaved(false)
    const res = await fetch('/api/admin/banner-strip', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else {
      setError('Save failed — please try again')
    }
  }

  function update(changes: Partial<typeof config>) {
    const updated = { ...config, ...changes }
    setConfig(updated)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(updated), 800)
  }

  async function loadPreview() {
    setPreviewLoading(true)
    const res = await fetch('/api/banner-strip')
    const data = await res.json()
    setPreviewItems(data.items ?? [])
    setPreviewLoading(false)
  }

  // ── Manual items helpers ───────────────────────────────────────────────────

  function addManualItem() {
    update({ manual_items: [...config.manual_items, newManualItem()] })
  }

  function updateManualItem(id: string, changes: Partial<TickerManualItem>) {
    update({
      manual_items: config.manual_items.map((item) =>
        item.id === id ? { ...item, ...changes } : item,
      ),
    })
  }

  function removeManualItem(id: string) {
    if (!confirm('Remove this announcement?')) return
    update({ manual_items: config.manual_items.filter((item) => item.id !== id) })
  }

  function moveManualItem(id: string, dir: -1 | 1) {
    const idx = config.manual_items.findIndex((item) => item.id === id)
    if (idx + dir < 0 || idx + dir >= config.manual_items.length) return
    const updated = [...config.manual_items]
    ;[updated[idx], updated[idx + dir]] = [updated[idx + dir], updated[idx]]
    update({ manual_items: updated })
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-10">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((n) => <div key={n} className="h-24 bg-slate-100 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Banner Strip</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure the scrolling ticker below the hero carousel. Changes save automatically.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {saving && <span className="text-slate-400">Saving…</span>}
          {saved && <span className="text-green-600 font-medium">Saved ✓</span>}
          <button
            onClick={loadPreview}
            disabled={previewLoading}
            className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {previewLoading ? 'Loading…' : 'Preview Strip'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* ── Preview ── */}
      {previewItems.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-100 bg-slate-50">
            Live Preview
          </div>
          <div
            style={{
              background: 'linear-gradient(90deg, #6b1e98, #7c3aed, #9333ea, #6b1e98)',
              height: 36,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div className="flex items-center whitespace-nowrap" style={{ animation: 'marquee 28s linear infinite' }}>
              <style>{`
                @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
              `}</style>
              {[...previewItems, ...previewItems].map((item, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 28px', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '2px 7px', borderRadius: 3 }}>
                      {item.label}
                    </span>
                    {item.text}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 16 }}>·</span>
                </span>
              ))}
            </div>
          </div>
          <div className="text-xs text-slate-400 px-4 py-2 bg-slate-50">
            Showing {previewItems.length} item{previewItems.length !== 1 ? 's' : ''} · Sources: {[...new Set(previewItems.map((i) => i.source))].join(', ')}
          </div>
        </div>
      )}

      {previewItems.length === 0 && !previewLoading && (
        null // no preview until loaded
      )}

      {/* ── Automated Sources ── */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">Automated Sources</h2>
          <p className="text-xs text-slate-500 mt-0.5">Items from these sources appear automatically — no manual entry needed.</p>
        </div>

        <div className="divide-y divide-slate-100">

          {/* Birthdays */}
          <SourceRow
            icon="🎂"
            title="Birthdays"
            description="Shows a message on or before each employee's birthday."
            enabled={config.show_birthdays}
            onToggle={(v) => update({ show_birthdays: v })}
          >
            <NumInput
              label="Show how many days before"
              value={config.birthday_window_days}
              min={0} max={14} unit="days"
              onChange={(v) => update({ birthday_window_days: v })}
            />
          </SourceRow>

          {/* Work Anniversaries */}
          <SourceRow
            icon="🥂"
            title="Work Anniversaries"
            description="Celebrates employees' start-date milestones."
            enabled={config.show_anniversaries}
            onToggle={(v) => update({ show_anniversaries: v })}
          >
            <NumInput
              label="Show how many days before"
              value={config.anniversary_window_days}
              min={0} max={14} unit="days"
              onChange={(v) => update({ anniversary_window_days: v })}
            />
          </SourceRow>

          {/* News Articles */}
          <SourceRow
            icon="📰"
            title="News Articles"
            description="Recently published articles appear as links to the full post."
            enabled={config.show_news}
            onToggle={(v) => update({ show_news: v })}
          >
            <NumInput
              label="Show articles published in the last"
              value={config.news_recency_days}
              min={1} max={30} unit="days"
              onChange={(v) => update({ news_recency_days: v })}
            />
          </SourceRow>

          {/* Holidays */}
          <SourceRow
            icon="🇺🇸"
            title="US Holidays"
            description="US federal and cultural holidays from a built-in list."
            enabled={config.show_holidays}
            onToggle={(v) => update({ show_holidays: v })}
          >
            <NumInput
              label="Start showing holiday countdown"
              value={config.holiday_lookahead_days}
              min={0} max={30} unit="days before"
              onChange={(v) => update({ holiday_lookahead_days: v })}
            />
          </SourceRow>

          {/* ClickUp */}
          <SourceRow
            icon="✅"
            title="ClickUp Tasks"
            description="Upcoming tasks from a ClickUp list. Requires API credentials."
            enabled={config.show_clickup}
            onToggle={(v) => update({ show_clickup: v })}
          >
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={config.clickup_api_key ?? ''}
                  onChange={(e) => update({ clickup_api_key: e.target.value || null })}
                  placeholder="pk_..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Team ID <span className="normal-case font-normal text-purple-600">(required for My Tasks widget)</span>
                </label>
                <input
                  type="text"
                  value={config.clickup_team_id ?? ''}
                  onChange={(e) => update({ clickup_team_id: e.target.value || null })}
                  placeholder="e.g. 90131331624"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <p className="text-xs text-slate-400 mt-1">Found in the ClickUp URL: app.clickup.com/<strong>90131331624</strong>/…</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  List ID
                </label>
                <input
                  type="text"
                  value={config.clickup_list_id ?? ''}
                  onChange={(e) => update({ clickup_list_id: e.target.value || null })}
                  placeholder="e.g. 901234567"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <p className="text-xs text-slate-400 mt-1">Find the List ID in the ClickUp URL when viewing a list. Used for both the ticker and the My Tasks widget.</p>
              </div>
              <NumInput
                label="Show tasks due within"
                value={config.clickup_due_within_days}
                min={1} max={30} unit="days"
                onChange={(v) => update({ clickup_due_within_days: v })}
              />
            </div>
          </SourceRow>

        </div>
      </section>

      {/* ── Manual Announcements ── */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Manual Announcements</h2>
            <p className="text-xs text-slate-500 mt-0.5">Custom items that always appear at the front of the strip.</p>
          </div>
          <button
            onClick={addManualItem}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Item
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {config.manual_items.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              No manual announcements. Click &ldquo;Add Item&rdquo; to create one.
            </div>
          )}

          {config.manual_items.map((item, idx) => (
            <ManualItemRow
              key={item.id}
              item={item}
              index={idx}
              total={config.manual_items.length}
              onChange={(changes) => updateManualItem(item.id, changes)}
              onRemove={() => removeManualItem(item.id)}
              onMove={(dir) => moveManualItem(item.id, dir)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

// ── SourceRow ─────────────────────────────────────────────────────────────────

function SourceRow({
  icon, title, description, enabled, onToggle, children,
}: {
  icon: string
  title: string
  description: string
  enabled: boolean
  onToggle: (v: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-4">
        <span className="text-xl mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-800">{title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{description}</div>
            </div>
            <Toggle on={enabled} onChange={onToggle} />
          </div>
          {enabled && children && (
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ManualItemRow ─────────────────────────────────────────────────────────────

function ManualItemRow({
  item, index, total, onChange, onRemove, onMove,
}: {
  item: TickerManualItem
  index: number
  total: number
  onChange: (c: Partial<TickerManualItem>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div className={`px-5 py-4 ${!item.enabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3 mb-3">
        {/* Reorder */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="w-6 h-5 flex items-center justify-center rounded border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-slate-100 transition-colors"
            title="Move up"
          >
            <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="w-6 h-5 flex items-center justify-center rounded border border-slate-200 text-slate-400 disabled:opacity-30 hover:bg-slate-100 transition-colors"
            title="Move down"
          >
            <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>

        <span className="text-xs font-medium text-slate-400 w-4">{index + 1}</span>

        <Toggle on={item.enabled} onChange={(v) => onChange({ enabled: v })} />

        <div className="flex-1 flex items-center gap-2">
          {/* Label */}
          <select
            value={PRESET_LABELS.includes(item.label) ? item.label : '__custom'}
            onChange={(e) => {
              if (e.target.value !== '__custom') onChange({ label: e.target.value })
            }}
            className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
          >
            {PRESET_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
            {!PRESET_LABELS.includes(item.label) && <option value="__custom">{item.label}</option>}
          </select>

          {/* Text */}
          <input
            type="text"
            value={item.text}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder="Announcement text…"
            className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 transition-colors"
          title="Date range / URL"
        >
          {showAdvanced ? '▲' : '▼'}
        </button>

        <button
          onClick={onRemove}
          className="text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          Remove
        </button>
      </div>

      {showAdvanced && (
        <div className="ml-12 grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Link URL (optional)
            </label>
            <input
              type="url"
              value={item.href ?? ''}
              onChange={(e) => onChange({ href: e.target.value || null })}
              placeholder="https://…"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Active From
            </label>
            <input
              type="date"
              value={item.active_from ?? ''}
              onChange={(e) => onChange({ active_from: e.target.value || null })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Active Until
            </label>
            <input
              type="date"
              value={item.active_until ?? ''}
              onChange={(e) => onChange({ active_until: e.target.value || null })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
        </div>
      )}
    </div>
  )
}
