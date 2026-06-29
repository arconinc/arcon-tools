'use client'

import Link from 'next/link'

const MARKETING_LINKS = [
  {
    title: 'Documents',
    description: 'Brand assets, flyers, graphics, Canva designs, photos, videos, and presentations.',
    href: '/documents/marketing',
  },
  {
    title: 'Spec Samples',
    description: 'Track samples, customer follow-ups, proofs, PO numbers, suppliers, and sent dates.',
    href: '/marketing/specs',
  },
]

const UPCOMING_LINKS = [
  'Content Calendar',
  'Vendor Relations',
  'Social Media',
  'Self Promo',
]

export default function MarketingHomePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-slate-50 p-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-purple-600">Marketing</p>
        <h1 className="text-3xl font-bold text-slate-950">Marketing Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Marketing workspace foundation is ready. Upcoming phases will add weekly plan calendar,
          content calendar, vendor relations, social links, and self promo catalog.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {MARKETING_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-purple-200 hover:shadow-md"
          >
            <h2 className="text-lg font-bold text-slate-950">{link.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{link.description}</p>
            <div className="mt-4 text-sm font-semibold text-purple-700">Open {link.title} →</div>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Planned Next</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {UPCOMING_LINKS.map((name) => (
            <span key={name} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
