export function PageHeader({ title, subtitle, bg = '/company_bg.png' }: { title: string; subtitle?: string; bg?: string }) {
  return (
    <div className="page-header">
      <style>{`
        .page-header { position: relative; width: 100%; overflow: hidden; margin: 0; aspect-ratio: 1330 / 110; min-height: 90px; box-sizing: border-box; display: block; }
        .page-header img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: left center; }
        .page-header-text { position: absolute; left: 30px; top: 50%; transform: translateY(-50%); max-width: 45%; }
        .page-header-text h1 { color: #fff; font-size: clamp(1.1rem, 2.2vw, 1.75rem); font-weight: 700; margin: 0; line-height: 1.2; text-shadow: 0 1px 4px rgba(0,0,0,0.3); }
        .page-header-text p { color: rgba(255,255,255,0.9); font-size: clamp(0.7rem, 1vw, 0.9rem); margin: 0.25rem 0 0; text-shadow: 0 1px 3px rgba(0,0,0,0.25); }
      `}</style>
      <img src={bg} alt="" />
      <div className="page-header-text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  )
}
