'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type SavedMockup = {
  id: string
  title: string
  image_url: string
  realism_image_url: string | null
  placement: { height_in: number; width_in: number }
  created_at: string
}

/** Saved hat mockups on the customer page, plus a link to make a new one. */
export function CustomerMockupsGrid({ customerId }: { customerId: string }) {
  const [items, setItems] = useState<SavedMockup[] | null>(null)

  useEffect(() => {
    fetch(`/api/marketing/mockups?customer_id=${customerId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => setItems([]))
  }, [customerId])

  return (
    <div className="space-y-4 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Hat Mockups{items ? ` (${items.length})` : ''}</h2>
        <Link
          href={`/marketing/mockups?customer_id=${customerId}`}
          className="px-3 py-1.5 bg-purple-700 text-white text-sm font-semibold rounded-lg hover:bg-purple-800 transition-colors"
        >
          + New mockup
        </Link>
      </div>
      {items === null && <div className="text-center py-6 text-sm text-slate-400">Loading mockups…</div>}
      {items?.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-400">No hat mockups yet.</div>
      )}
      {!!items?.length && (
        <div className="grid grid-cols-3 gap-4">
          {items.map((m) => (
            <a
              key={m.id}
              href={m.realism_image_url ?? m.image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-purple-300"
            >
              <img src={m.realism_image_url ?? m.image_url} alt={m.title} className="w-full aspect-square object-contain bg-white" />
              <div className="p-3 text-sm">
                <div className="font-semibold text-slate-800 truncate" title={m.title}>{m.title}</div>
                <div className="text-xs text-slate-400">
                  {m.placement.height_in} × {m.placement.width_in} in ·{' '}
                  {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
