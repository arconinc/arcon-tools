'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArtworkUploadModal } from '@/components/crm/customer/ArtworkUploadModal'
import type { ArtworkItem } from '@/hooks/useArtwork'
import { WARNING_LABELS, type ArtworkAnalysis } from '@/lib/artwork/warnings'

type Selection = {
  customerId?: string | null
  customerName?: string | null
  artworkId?: string | null
  styleId?: string | null
  colorId?: string | null
  method?: string | null
  heightIn?: number | null
  offsetYIn?: number | null
}
type AskOption = { label: string; value: string; hex?: string | null }
type Preview = { id: string; dataUrl: string; title: string; heightIn: number; widthIn: number; clamped: boolean; selection: Selection }
type UiMessage = {
  role: 'user' | 'assistant'
  text: string
  activity?: string[]
  ask?: { question: string; options: AskOption[] } | null
  previews?: Preview[]
}
type Style = {
  id: string
  brand: string
  style_number: string
  name: string
  profile: string | null
  hat_decoration_methods: { method: string; minimum_quantity: number | null }[]
}
type Color = { id: string; name: string; hex: string | null; hex_secondary: string | null }
type Artwork = ArtworkItem & { ai_analysis?: ArtworkAnalysis | null }
type Current = { dataUrl: string; title: string; heightIn: number; widthIn: number; clamped: boolean }
type Fidelity = { pass: boolean; pixel_diff: number; text_matches: boolean | null; colors_match: boolean | null; placement_ok: boolean | null; notes: string }

const METHOD_LABELS: Record<string, string> = {
  embroidery: 'Embroidery',
  printing: 'Printing',
  leather_patch: 'Leather patch',
  printed_patch: 'Printed patch',
}
const SIZE_STEP = 0.25
const MOVE_STEP = 0.15

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
  return data as T
}

const post = <T,>(url: string, body: unknown) =>
  getJson<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export function HatMockupAssistant({
  initialCustomer,
  realismEnabled,
}: {
  initialCustomer: { id: string; name: string } | null
  realismEnabled: boolean
}) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [starters, setStarters] = useState<{ recent: string[]; team: string[] }>({ recent: [], team: [] })

  const [sel, setSel] = useState<Selection>(initialCustomer ? { customerId: initialCustomer.id, customerName: initialCustomer.name } : {})
  const [current, setCurrent] = useState<Current | null>(null)
  const [rendering, setRendering] = useState(false)
  const [compare, setCompare] = useState<Preview[]>([])

  const [styles, setStyles] = useState<Style[]>([])
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [colors, setColors] = useState<Color[]>([])
  const [logos, setLogos] = useState<Artwork[]>([])
  const [customerQuery, setCustomerQuery] = useState(initialCustomer?.name ?? '')
  const [customerHits, setCustomerHits] = useState<{ id: string; name: string }[]>([])
  const [uploadOpen, setUploadOpen] = useState(false)

  const [realism, setRealism] = useState<{ status: 'idle' | 'loading' | 'done'; dataUrl?: string | null; fidelity?: Fidelity | null; error?: string }>({ status: 'idle' })
  const [showRealistic, setShowRealistic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<{ title: string } | null>(null)

  const logRef = useRef<HTMLDivElement>(null)
  const renderSeq = useRef(0)

  useEffect(() => {
    getJson<{ styles: Style[]; syncedAt: string | null }>('/api/marketing/mockups/catalog')
      .then((d) => {
        setStyles(d.styles)
        setSyncedAt(d.syncedAt)
      })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    const q = sel.customerId ? `?customer_id=${sel.customerId}` : ''
    getJson<{ recent: string[]; team: string[] }>(`/api/marketing/mockups/starters${q}`)
      .then(setStarters)
      .catch(() => {})
  }, [sel.customerId])

  useEffect(() => {
    if (!sel.styleId) return setColors([])
    getJson<{ colors: Color[] }>(`/api/marketing/mockups/catalog?style_id=${sel.styleId}`)
      .then((d) => setColors(d.colors))
      .catch(() => setColors([]))
  }, [sel.styleId])

  useEffect(() => {
    if (!sel.customerId) return setLogos([])
    getJson<Artwork[]>(`/api/marketing/artwork?customer_id=${sel.customerId}`)
      .then(setLogos)
      .catch(() => setLogos([]))
  }, [sel.customerId])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  // Customer typeahead
  useEffect(() => {
    const q = customerQuery.trim()
    if (q.length < 2 || q === sel.customerName) return setCustomerHits([])
    const t = setTimeout(() => {
      getJson<{ customers: { id: string; name: string }[] }>(`/api/marketing/customers?search=${encodeURIComponent(q)}&limit=8`)
        .then((d) => setCustomerHits(d.customers ?? []))
        .catch(() => setCustomerHits([]))
    }, 250)
    return () => clearTimeout(t)
  }, [customerQuery, sel.customerName])

  const style = useMemo(() => styles.find((s) => s.id === sel.styleId) ?? null, [styles, sel.styleId])
  const logo = useMemo(() => logos.find((l) => l.id === sel.artworkId) ?? null, [logos, sel.artworkId])
  const renderable = !!(sel.colorId && sel.artworkId && sel.method)

  const render = useCallback(async (next: Selection) => {
    if (!(next.colorId && next.artworkId && next.method)) return
    const seq = ++renderSeq.current
    setRendering(true)
    setError(null)
    try {
      const r = await post<Current & { offsetYIn: number; styleId: string }>('/api/marketing/mockups/render', { selection: next })
      if (seq !== renderSeq.current) return
      setCurrent(r)
      setSel((s) => ({ ...s, heightIn: r.heightIn, offsetYIn: r.offsetYIn, styleId: r.styleId }))
      setRealism({ status: 'idle' })
      setShowRealistic(false)
      setSaved(null)
    } catch (e) {
      if (seq === renderSeq.current) setError((e as Error).message)
    } finally {
      if (seq === renderSeq.current) setRendering(false)
    }
  }, [])

  /** Picker change: update selection and re-render without the model. */
  function pick(patch: Selection) {
    const next = { ...sel, ...patch }
    if (patch.styleId !== undefined && patch.styleId !== sel.styleId) {
      next.colorId = null
      const methods = styles.find((s) => s.id === patch.styleId)?.hat_decoration_methods ?? []
      if (next.method && !methods.some((m) => m.method === next.method)) next.method = methods[0]?.method ?? null
      if (!next.method) next.method = methods[0]?.method ?? null
    }
    if (patch.customerId !== undefined && patch.customerId !== sel.customerId) next.artworkId = null
    if (patch.artworkId !== undefined || patch.colorId !== undefined || patch.method !== undefined) next.heightIn = null
    setSel(next)
    setCompare([])
    render(next)
  }

  function adjust(dh: number, dy: number) {
    const next = { ...sel, heightIn: (sel.heightIn ?? 2) + dh, offsetYIn: (sel.offsetYIn ?? 0) + dy }
    setSel(next)
    render(next)
  }

  async function send(text: string) {
    const message = text.trim()
    if (!message || busy) return
    setMessages((m) => [...m, { role: 'user', text: message }])
    setInput('')
    setBusy(true)
    setError(null)
    try {
      const r = await post<{
        session_id: string
        reply: string
        ask: UiMessage['ask']
        previews: Preview[]
        activity: string[]
        state: Selection
      }>('/api/marketing/mockups/chat', { session_id: sessionId, customer_id: sel.customerId, message, selection: sel })
      setSessionId(r.session_id)
      setMessages((m) => [...m, { role: 'assistant', text: r.reply, activity: r.activity, ask: r.ask, previews: r.previews }])
      setSel((s) => ({ ...s, ...r.state }))
      if (r.state.customerName) setCustomerQuery(r.state.customerName)
      if (r.previews.length) {
        const last = r.previews.at(-1)!
        setCurrent(last)
        setSel((s) => ({ ...s, ...r.state, ...last.selection }))
        setCompare(r.previews.length > 1 ? r.previews : [])
        setRealism({ status: 'idle' })
        setShowRealistic(false)
        setSaved(null)
      }
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: (e as Error).message }])
    } finally {
      setBusy(false)
    }
  }

  function choosePreview(p: Preview) {
    setCurrent(p)
    setSel((s) => ({ ...s, ...p.selection }))
    setRealism({ status: 'idle' })
    setShowRealistic(false)
    setSaved(null)
  }

  async function makeRealistic() {
    setRealism({ status: 'loading' })
    try {
      const r = await post<{ dataUrl: string | null; fidelity: Fidelity | null; error?: string }>('/api/marketing/mockups/realism', { selection: sel })
      setRealism({ status: 'done', dataUrl: r.dataUrl, fidelity: r.fidelity, error: r.error })
      setShowRealistic(!!r.dataUrl)
    } catch (e) {
      setRealism({ status: 'done', dataUrl: null, fidelity: null, error: (e as Error).message })
    }
  }

  async function save() {
    const customerId = sel.customerId ?? logo?.customer_id
    if (!customerId) return setError('Pick the customer to save this mockup to')
    setSaving(true)
    setError(null)
    try {
      const useRealism = showRealistic && realism.dataUrl && realism.fidelity?.pass
      const r = await post<{ title: string }>('/api/marketing/mockups', {
        session_id: sessionId,
        customer_id: customerId,
        selection: sel,
        realism: useRealism ? { data_url: realism.dataUrl, fidelity: realism.fidelity } : undefined,
      })
      setSaved({ title: r.title })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setSessionId(null)
    setMessages([])
    setCurrent(null)
    setCompare([])
    setSaved(null)
    setRealism({ status: 'idle' })
    setSel(initialCustomer ? { customerId: initialCustomer.id, customerName: initialCustomer.name } : {})
    setCustomerQuery(initialCustomer?.name ?? '')
  }

  const shown = showRealistic && realism.dataUrl ? realism.dataUrl : current?.dataUrl
  const methodInfo = style?.hat_decoration_methods.find((m) => m.method === sel.method)
  const warnings = (logo?.ai_analysis?.warnings ?? []).map((w) => WARNING_LABELS[w])

  return (
    <div className="w-full p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Start however you like: a customer, a hat, a logo, or what the hats are for. Or use the pickers on the right.
        </p>
        <button onClick={reset} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-purple-300">
          New mockup
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Conversation */}
        <section className="bg-white border border-slate-200 rounded-2xl flex flex-col min-h-[560px] lg:h-[calc(100vh-240px)]">
          <h2 className="px-4 py-3 border-b border-slate-200 text-xs font-semibold tracking-wider uppercase text-slate-500 flex justify-between">
            <span>Conversation</span>
            {sel.customerName && <span className="normal-case tracking-normal font-medium">Customer: {sel.customerName}</span>}
          </h2>
          <div ref={logRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                {starters.recent.length > 0 && <StarterGroup label="Your recent" items={starters.recent} onPick={setInput} />}
                {starters.team.length > 0 && <StarterGroup label="Popular with the team" items={starters.team} onPick={setInput} />}
                <p className="text-xs text-slate-400">Click a suggestion to fill the box, edit it, then send.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'space-y-2'}>
                {m.activity?.map((a, j) => (
                  <div key={j} className="inline-flex mr-2 items-center gap-1.5 text-xs text-slate-500 bg-purple-50 border border-slate-200 rounded-md px-2 py-1">
                    <span className="text-green-600 font-bold">✓</span>
                    {a}
                  </div>
                ))}
                {m.text && (
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] bg-purple-700 text-white rounded-xl rounded-br-sm px-3 py-2 text-sm whitespace-pre-wrap'
                        : 'max-w-[92%] bg-white border border-slate-200 rounded-xl rounded-bl-sm px-3 py-2 text-sm whitespace-pre-wrap'
                    }
                  >
                    {m.text}
                  </div>
                )}
                {m.previews && m.previews.length > 1 && (
                  <div className="flex gap-2 flex-wrap">
                    {m.previews.map((p) => (
                      <button key={p.id} onClick={() => choosePreview(p)} className="w-28 border border-slate-200 rounded-lg p-1 hover:border-purple-600 text-xs text-slate-600">
                        <img src={p.dataUrl} alt={p.title} className="rounded" />
                        {p.title.split(' – ')[0]}
                      </button>
                    ))}
                  </div>
                )}
                {m.ask && i === messages.length - 1 && !busy && (
                  <div className="flex flex-wrap gap-2">
                    {m.ask.options.map((o) => (
                      <button
                        key={o.value + o.label}
                        onClick={() => send(o.value && o.value !== o.label ? `${o.label} [${o.value}]` : o.label)}
                        className="inline-flex items-center gap-1.5 bg-white border border-purple-300 text-purple-700 rounded-full px-3 py-1.5 text-sm font-semibold hover:bg-purple-50"
                      >
                        {o.hex && <span className="w-3.5 h-3.5 rounded-full border border-slate-300" style={{ backgroundColor: o.hex }} />}
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="text-xs text-slate-400">Working…</div>}
          </div>
          <form
            className="flex gap-2 p-3 border-t border-slate-200"
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
          >
            <input
              id="mockup-message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Richardson trucker with the vertical logo for Rapal"
              className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              aria-label="Message"
            />
            <button type="submit" disabled={busy || !input.trim()} className="px-4 bg-purple-700 text-white rounded-lg text-sm font-semibold disabled:opacity-40">
              Send
            </button>
          </form>
        </section>

        {/* Mockup + pickers */}
        <section className="bg-white border border-slate-200 rounded-2xl flex flex-col lg:h-[calc(100vh-240px)]">
          <h2 className="px-4 py-3 border-b border-slate-200 text-xs font-semibold tracking-wider uppercase text-slate-500 flex justify-between">
            <span>Mockup</span>
            <span className="normal-case tracking-normal font-medium">{rendering ? 'Rendering…' : current?.title ?? 'Waiting for a hat'}</span>
          </h2>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            <div className="relative mx-auto w-full max-w-[460px] aspect-square bg-white border border-slate-200 rounded-lg overflow-hidden">
              {shown ? (
                <img src={shown} alt={current?.title ?? 'Hat mockup'} className={`w-full h-full object-contain ${rendering ? 'opacity-60' : ''}`} />
              ) : (
                <div className="absolute inset-0 grid place-items-center text-sm text-slate-400 p-6 text-center">
                  The mockup appears here as you narrow down the hat.
                </div>
              )}
            </div>

            {compare.length > 1 && (
              <div className="grid grid-cols-3 gap-2 max-w-[460px] mx-auto">
                {compare.map((p) => (
                  <button key={p.id} onClick={() => choosePreview(p)} className={`border rounded-md p-1 text-xs ${current?.dataUrl === p.dataUrl ? 'border-purple-700' : 'border-slate-200'}`}>
                    <img src={p.dataUrl} alt={p.title} />
                  </button>
                ))}
              </div>
            )}

            {/* Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <label className="block relative">
                <span className="text-xs font-semibold text-slate-500">Customer</span>
                <input
                  id="mockup-customer"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Search customers"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1.5"
                />
                {customerHits.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow">
                    {customerHits.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        className="block w-full text-left px-3 py-1.5 hover:bg-purple-50"
                        onClick={() => {
                          setCustomerQuery(c.name)
                          setCustomerHits([])
                          pick({ customerId: c.id, customerName: c.name })
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Logo</span>
                <div className="mt-1 flex gap-2">
                  <select
                    id="mockup-logo"
                    value={sel.artworkId ?? ''}
                    onChange={(e) => pick({ artworkId: e.target.value || null })}
                    disabled={!sel.customerId}
                    className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50"
                  >
                    <option value="">{sel.customerId ? 'Choose a logo' : 'Pick a customer first'}</option>
                    {logos.map((l) => (
                      <option key={l.id} value={l.id} disabled={l.is_drive_link || !!l.dropbox_url}>
                        {l.name}
                        {l.is_drive_link || l.dropbox_url ? ' (link, not usable)' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!sel.customerId}
                    onClick={() => setUploadOpen(true)}
                    className="px-2 border border-slate-200 rounded-lg text-xs disabled:opacity-40"
                  >
                    Upload
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Hat</span>
                <select
                  id="mockup-style"
                  value={sel.styleId ?? ''}
                  onChange={(e) => pick({ styleId: e.target.value || null })}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5"
                >
                  <option value="">{styles.length ? 'Choose a hat' : 'Catalog not synced yet'}</option>
                  {styles.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.brand} {s.style_number} · {s.name.replace(`${s.brand} `, '')}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Decoration</span>
                <select
                  id="mockup-method"
                  value={sel.method ?? ''}
                  onChange={(e) => pick({ method: e.target.value || null })}
                  disabled={!style}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50"
                >
                  <option value="">Choose decoration</option>
                  {(style?.hat_decoration_methods ?? []).map((m) => (
                    <option key={m.method} value={m.method}>
                      {METHOD_LABELS[m.method] ?? m.method}
                      {m.minimum_quantity ? ` (min ${m.minimum_quantity})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {colors.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-slate-500">Color ({colors.length})</span>
                <div className="mt-1 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {colors.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      title={c.name}
                      aria-label={c.name}
                      onClick={() => pick({ colorId: c.id })}
                      className={`w-7 h-7 rounded-full border-2 ${sel.colorId === c.id ? 'border-purple-700' : 'border-slate-200'}`}
                      style={{ background: c.hex_secondary ? `linear-gradient(135deg, ${c.hex ?? '#ccc'} 50%, ${c.hex_secondary} 50%)` : c.hex ?? '#ccc' }}
                    />
                  ))}
                </div>
                {sel.colorId && <p className="text-xs text-slate-500 mt-1">{colors.find((c) => c.id === sel.colorId)?.name}</p>}
              </div>
            )}

            {current && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-slate-500">Size</dt>
                <dd className="font-medium">
                  {current.heightIn} in tall × {current.widthIn} in wide{current.clamped ? ' (limited by placement rules)' : ''}
                </dd>
                {methodInfo && (
                  <>
                    <dt className="text-slate-500">Decoration</dt>
                    <dd className="font-medium">
                      {METHOD_LABELS[methodInfo.method] ?? methodInfo.method}
                      {methodInfo.minimum_quantity ? `, minimum ${methodInfo.minimum_quantity}` : ''}
                    </dd>
                  </>
                )}
                {warnings.length > 0 && (
                  <>
                    <dt className="text-slate-500">Logo check</dt>
                    <dd className="text-amber-700 font-medium">Embroidery: {warnings.join(', ')}</dd>
                  </>
                )}
              </dl>
            )}

            {renderable && (
              <div className="flex flex-wrap gap-2">
                <AdjustButton label="Smaller" onClick={() => adjust(-SIZE_STEP, 0)} disabled={rendering} />
                <AdjustButton label="Bigger" onClick={() => adjust(SIZE_STEP, 0)} disabled={rendering} />
                <AdjustButton label="Up" onClick={() => adjust(0, -MOVE_STEP)} disabled={rendering} />
                <AdjustButton label="Down" onClick={() => adjust(0, MOVE_STEP)} disabled={rendering} />
                {realismEnabled && current && (
                  <AdjustButton
                    label={realism.status === 'loading' ? 'Making it realistic…' : 'Realistic version'}
                    onClick={makeRealistic}
                    disabled={rendering || realism.status === 'loading'}
                  />
                )}
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || rendering || !current}
                  className="ml-auto px-3 py-1.5 bg-purple-700 text-white rounded-lg text-sm font-semibold disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Save to customer'}
                </button>
              </div>
            )}

            {realism.status === 'done' && (
              <div className={`text-xs rounded-lg px-3 py-2 ${realism.dataUrl ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
                {realism.dataUrl ? (
                  <span className="flex items-center gap-3">
                    Realistic version passed the logo check.
                    <button className="underline" onClick={() => setShowRealistic((v) => !v)}>
                      Show {showRealistic ? 'flat' : 'realistic'}
                    </button>
                  </span>
                ) : (
                  realism.error ?? `Realistic version changed the logo (${realism.fidelity?.notes || 'failed the check'}), so the flat mockup is kept.`
                )}
              </div>
            )}

            {saved && (
              <div className="text-sm rounded-lg px-3 py-2 border border-green-600 bg-green-50 text-green-700">
                Saved as <b>{saved.title}</b>.{' '}
                {sel.customerId && (
                  <Link className="text-purple-700 font-semibold" href={`/sales/customers/${sel.customerId}`}>
                    Open customer
                  </Link>
                )}
              </div>
            )}

            {error && <div className="text-sm rounded-lg px-3 py-2 bg-red-50 text-red-700">{error}</div>}

            <p className="text-xs text-slate-500 bg-purple-50 border border-slate-200 rounded-lg px-3 py-2">
              <b className="text-slate-700">Catalog source:</b> RushOrderTees saved copy
              {syncedAt ? `, synced ${new Date(syncedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}. Mockups
              are not production proofs; artwork approval stays with a person.
            </p>
          </div>
        </section>
      </div>

      {sel.customerId && (
        <ArtworkUploadModal
          open={uploadOpen}
          customerId={sel.customerId}
          onClose={() => setUploadOpen(false)}
          onAdded={(item) => {
            setLogos((l) => [item, ...l])
            setUploadOpen(false)
            pick({ artworkId: item.id })
          }}
        />
      )}
    </div>
  )
}

function StarterGroup({ label, items, onPick }: { label: string; items: string[]; onPick: (t: string) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-bold tracking-wider uppercase text-slate-400">{label}</div>
      {items.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onPick(t)}
          className="block w-full text-left bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm hover:border-purple-300 hover:bg-purple-50"
        >
          {t}
        </button>
      ))}
    </div>
  )
}

function AdjustButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm hover:border-purple-300 disabled:opacity-40"
    >
      {label}
    </button>
  )
}
