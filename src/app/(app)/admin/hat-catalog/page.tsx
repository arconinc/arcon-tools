'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'

type Sync = {
  id: string
  started_at: string
  finished_at: string | null
  trigger: string
  status: string
  styles_seen: number
  colors_seen: number
  requests_made: number
  next_delay_ms: number
  errors: { message: string; url?: string }[]
}
type Geometry = {
  center_x: number
  center_y: number
  px_per_inch: number
  crown_top_y: number
  bill_seam_y: number
  crown_left_x: number
  crown_right_x: number
  confidence: number
  needs_review: boolean
  is_override: boolean
}
type Style = {
  id: string
  brand: string
  style_number: string
  name: string
  profile: string | null
  silhouette: string | null
  is_active: boolean
  last_checked_at: string | null
  hat_colors: { count: number }[]
  hat_style_geometry: Geometry[] | null
}
type Rule = { method: string; max_width_in: number; max_height_in: number; default_height_in: number; notes: string | null }
type Starter = { id: string; template: string; source: string; uses: number; is_pinned: boolean; is_hidden: boolean }
type Overview = { syncs: Sync[]; styles: Style[]; rules: Rule[]; starters: Starter[]; reviewImages: Record<string, string | null> }

const STATUS_STYLE: Record<string, string> = {
  ok: 'bg-green-50 text-green-700',
  paused: 'bg-blue-50 text-blue-700',
  running: 'bg-purple-50 text-purple-700',
  failed: 'bg-red-50 text-red-700',
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data
}

export default function HatCatalogAdminPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [newStarter, setNewStarter] = useState('')

  async function load() {
    setData(await send('/api/admin/hat-catalog', 'GET'))
  }
  useEffect(() => {
    load().catch((e) => setNotice(e.message))
  }, [])

  async function syncNow() {
    setSyncing(true)
    setNotice(null)
    try {
      const r = await send('/api/admin/hat-catalog/sync', 'POST')
      setNotice(r.message)
      await load()
    } catch (e) {
      setNotice((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  async function act(fn: () => Promise<unknown>) {
    setNotice(null)
    try {
      await fn()
      await load()
    } catch (e) {
      setNotice((e as Error).message)
    }
  }

  if (!data) return <div className="p-6 text-sm text-slate-400">{notice ?? 'Loading…'}</div>

  const review = data.styles.filter((s) => s.hat_style_geometry?.[0]?.needs_review)
  const running = data.syncs.some((s) => s.status === 'running')

  return (
    <>
      <PageHeader title="Hat Catalog" subtitle="RushOrderTees catalog sync, placement rules and starter prompts" />
      <div className="w-full p-6 space-y-8">
        {notice && <div className="text-sm rounded-lg px-3 py-2 bg-purple-50 text-purple-800">{notice}</div>}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Catalog sync</h2>
              <p className="text-xs text-slate-500">
                Runs nightly 1–5 a.m. Central, one request every 5+ seconds, at most 40 per run. &quot;Sync now&quot; runs one batch with the same limits.
              </p>
            </div>
            <button
              onClick={syncNow}
              disabled={syncing || running}
              className="px-3 py-1.5 bg-purple-700 text-white text-sm font-semibold rounded-lg disabled:opacity-40"
            >
              {syncing ? 'Syncing (a few minutes)…' : running ? 'Sync running' : 'Sync now'}
            </button>
          </div>
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 text-left">
                <tr>
                  {['Started', 'Finished', 'Trigger', 'Status', 'Styles', 'Colors', 'Requests', 'Next delay', 'Last error'].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.syncs.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-slate-400">No syncs yet. Click &quot;Sync now&quot; to start the first one.</td>
                  </tr>
                )}
                {data.syncs.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 tabular-nums">{fmt(s.started_at)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmt(s.finished_at)}</td>
                    <td className="px-3 py-2">{s.trigger}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[s.status] ?? ''}`}>{s.status}</span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{s.styles_seen}</td>
                    <td className="px-3 py-2 tabular-nums">{s.colors_seen}</td>
                    <td className="px-3 py-2 tabular-nums">{s.requests_made}</td>
                    <td className="px-3 py-2 tabular-nums">{Math.round(s.next_delay_ms / 1000)}s</td>
                    <td className="px-3 py-2 text-xs text-red-700 max-w-xs truncate" title={s.errors.at(-1)?.message}>
                      {s.errors.at(-1)?.message ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {review.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Needs review ({review.length})</h2>
            <p className="text-xs text-slate-500">
              The logo position for these hats was uncertain. The box shows where a 2 in logo lands. Nudge it and save; the sync won&apos;t overwrite your change.
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {review.map((s) => (
                <GeometryReview
                  key={s.id}
                  style={s}
                  image={data.reviewImages[s.id]}
                  onSave={(g) => act(() => send(`/api/admin/hat-catalog/geometry/${s.id}`, 'PUT', g))}
                />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Placement rules</h2>
          <p className="text-xs text-slate-500">Front decoration limits in inches. Replace the placeholders with Arcon&apos;s application sheets.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {data.rules.map((r) => (
              <RuleEditor key={r.method} rule={r} onSave={(v) => act(() => send('/api/admin/hat-catalog/rules', 'PUT', v))} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Starter prompts</h2>
          <p className="text-xs text-slate-500">
            Shown in an empty conversation. &quot;Learned&quot; ones are rebuilt nightly from what reps type once there are 20 saved sessions. Pinned ones always show.
            Use {'{customer}'} for the customer name.
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              act(() => send('/api/admin/hat-catalog/starters', 'POST', { template: newStarter })).then(() => setNewStarter(''))
            }}
          >
            <input
              id="new-starter"
              value={newStarter}
              onChange={(e) => setNewStarter(e.target.value)}
              placeholder="e.g. Leather patch on a 112 for {customer}"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
            />
            <button disabled={!newStarter.trim()} className="px-3 py-1.5 bg-purple-700 text-white text-sm font-semibold rounded-lg disabled:opacity-40">
              Add
            </button>
          </form>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {data.starters.map((s) => (
              <div key={s.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${s.is_hidden ? 'opacity-50' : ''}`}>
                <span className="text-[11px] uppercase tracking-wider text-slate-400 w-16">{s.source}</span>
                <span className="flex-1">{s.template}</span>
                {s.source === 'learned' && <span className="text-xs text-slate-400 tabular-nums">{s.uses} uses</span>}
                <button className="text-xs text-purple-700" onClick={() => act(() => send('/api/admin/hat-catalog/starters', 'PUT', { id: s.id, is_pinned: !s.is_pinned }))}>
                  {s.is_pinned ? 'Unpin' : 'Pin'}
                </button>
                <button className="text-xs text-slate-500" onClick={() => act(() => send('/api/admin/hat-catalog/starters', 'PUT', { id: s.id, is_hidden: !s.is_hidden }))}>
                  {s.is_hidden ? 'Show' : 'Hide'}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Styles ({data.styles.length})</h2>
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 text-left">
                <tr>
                  {['Style', 'Name', 'Shape', 'Profile', 'Colors', 'Logo position', 'Checked', 'Active'].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.styles.map((s) => {
                  const g = s.hat_style_geometry?.[0]
                  return (
                    <tr key={s.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold">{s.brand} {s.style_number}</td>
                      <td className="px-3 py-2">{s.name}</td>
                      <td className="px-3 py-2">{s.silhouette ?? '—'}</td>
                      <td className="px-3 py-2">{s.profile ?? '—'}</td>
                      <td className="px-3 py-2 tabular-nums">{s.hat_colors?.[0]?.count ?? 0}</td>
                      <td className="px-3 py-2 text-xs">
                        {!g ? 'Not measured' : g.is_override ? 'Adjusted by admin' : g.needs_review ? 'Needs review' : `Calculated (${Math.round(g.confidence * 100)}%)`}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-xs">{fmt(s.last_checked_at)}</td>
                      <td className="px-3 py-2">{s.is_active ? 'Yes' : 'No'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  )
}

function GeometryReview({ style, image, onSave }: { style: Style; image: string | null | undefined; onSave: (g: { center_x: number; center_y: number; px_per_inch: number }) => void }) {
  const g = style.hat_style_geometry![0]
  const [cx, setCx] = useState(+g.center_x)
  const [cy, setCy] = useState(+g.center_y)
  const [ppi, setPpi] = useState(+g.px_per_inch)
  const box = (2 * ppi) / 1000 // 2 in logo height as a fraction of image width (square images)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
      <div className="text-sm font-semibold">{style.brand} {style.style_number}</div>
      <div className="relative aspect-square bg-slate-50 rounded-lg overflow-hidden">
        {image ? <img src={image} alt={style.name} className="w-full h-full object-contain" /> : <div className="p-4 text-xs text-slate-400">No cached image</div>}
        <div
          className="absolute border-2 border-orange-500"
          style={{ left: `${(cx - box * 0.75) * 100}%`, top: `${(cy - box / 2) * 100}%`, width: `${box * 150}%`, height: `${box * 100}%` }}
        />
        <div className="absolute left-0 right-0 border-t border-red-500" style={{ top: `${g.crown_top_y * 100}%` }} />
        <div className="absolute left-0 right-0 border-t border-green-500" style={{ top: `${g.bill_seam_y * 100}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <NumberField id={`cx-${style.id}`} label="Left/right" value={cx} step={0.01} onChange={setCx} />
        <NumberField id={`cy-${style.id}`} label="Up/down" value={cy} step={0.01} onChange={setCy} />
        <NumberField id={`ppi-${style.id}`} label="Scale (px/in)" value={ppi} step={2} onChange={setPpi} />
      </div>
      <button onClick={() => onSave({ center_x: cx, center_y: cy, px_per_inch: ppi })} className="px-3 py-1.5 bg-purple-700 text-white text-xs font-semibold rounded-lg">
        Save position
      </button>
    </div>
  )
}

function NumberField({ id, label, value, step, onChange }: { id: string; label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-slate-500">{label}</span>
      <input
        id={id}
        type="number"
        step={step}
        value={Number(value.toFixed(3))}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 w-full border border-slate-200 rounded px-2 py-1"
      />
    </label>
  )
}

function RuleEditor({ rule, onSave }: { rule: Rule; onSave: (r: Rule) => void }) {
  const [r, setR] = useState<Rule>({ ...rule, max_width_in: +rule.max_width_in, max_height_in: +rule.max_height_in, default_height_in: +rule.default_height_in })
  const label = rule.method.replace('_', ' ')
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
      <div className="text-sm font-semibold capitalize">{label}</div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <NumberField id={`mw-${rule.method}`} label="Max width (in)" value={r.max_width_in} step={0.125} onChange={(v) => setR({ ...r, max_width_in: v })} />
        <NumberField id={`mh-${rule.method}`} label="Max height (in)" value={r.max_height_in} step={0.125} onChange={(v) => setR({ ...r, max_height_in: v })} />
        <NumberField id={`dh-${rule.method}`} label="Default height (in)" value={r.default_height_in} step={0.125} onChange={(v) => setR({ ...r, default_height_in: v })} />
      </div>
      <div className="flex items-center gap-2">
        <input
          id={`notes-${rule.method}`}
          value={r.notes ?? ''}
          onChange={(e) => setR({ ...r, notes: e.target.value })}
          placeholder="Notes"
          className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs"
        />
        <button onClick={() => onSave(r)} className="px-3 py-1 bg-purple-700 text-white text-xs font-semibold rounded-lg">
          Save
        </button>
      </div>
    </div>
  )
}
