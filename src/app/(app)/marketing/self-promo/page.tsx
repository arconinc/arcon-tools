'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'

const TABS = [
  { label: 'Promo Items', src: 'https://promohunt.com/presentations/V6eBtTEH' },
  { label: 'Apparel/Hats', src: 'https://promohunt.com/presentations/cTvhmTNh' },
]

export default function SelfPromoPage() {
  const [active, setActive] = useState(0)

  return (
    <>
      <PageHeader title="Self-promo" subtitle="Company self-promo presentation" bg="/marketing_bg.png" />

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e5e7eb', padding: '0 1rem' }}>
          {TABS.map((tab, i) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActive(i)}
              style={{
                padding: '0.75rem 1rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: active === i ? '#7c3aed' : '#6b7280',
                borderBottom: active === i ? '2px solid #7c3aed' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <iframe
          key={TABS[active].src}
          src={TABS[active].src}
          title={TABS[active].label}
          style={{ width: '100%', flex: 1, border: 'none', display: 'block' }}
          allowFullScreen
        />
      </div>
    </>
  )
}
