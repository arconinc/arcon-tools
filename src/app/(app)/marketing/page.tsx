'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'

const MARKETING_LINKS = [
  {
    title: 'Calendar',
    description: 'LinkedIn, MailChimp, Instagram, and Facebook content calendar.',
    href: '/marketing/calendar',
  },
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
  {
    title: 'Vendor Relations',
    description: 'Define vendor demo time slots and see who has booked a spot.',
    href: '/marketing/vendor-relations',
  },
]

const UPCOMING_LINKS = [
  'Social Media',
  'Self Promo',
]

export default function MarketingHomePage() {
  return (
    <>
      <PageHeader title="Marketing Dashboard" subtitle="Content calendar, spec samples, vendor relations, and marketing resources" bg="/marketing_bg.png" />

      <div className="w-full px-6 py-8">
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
    </>
  )
}
