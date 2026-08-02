import { PageHeader } from '@/components/layout/PageHeader'

export default function SelfPromoPage() {
  return (
    <>
      <PageHeader title="Self-promo" subtitle="Company self-promo presentation" bg="/marketing_bg.png" />

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', boxSizing: 'border-box' }}>
        <iframe
          src="https://promohunt.com/presentations/V6eBtTEH"
          title="Self-promo"
          style={{ width: '100%', flex: 1, border: 'none', display: 'block' }}
          allowFullScreen
        />
      </div>
    </>
  )
}
