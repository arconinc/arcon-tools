import Link from 'next/link'

interface Props {
  searchParams: Promise<{ resource?: string; role?: string }>
}

export default async function AccessDeniedPage({ searchParams }: Props) {
  const { resource, role } = await searchParams
  const params = new URLSearchParams()
  if (resource) params.set('resource', resource)
  if (role) params.set('role', role)

  return (
    <>
      <style>{`
        .ad-wrap {
          min-height: 60vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
        }
        .ad-card {
          max-width: 480px;
          width: 100%;
          text-align: center;
        }
        .ad-icon {
          width: 56px;
          height: 56px;
          background: #f3f4f6;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          color: #9ca3af;
        }
        .ad-title {
          font-size: 20px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 8px;
        }
        .ad-body {
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 28px;
          line-height: 1.6;
        }
        .ad-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .ad-btn-primary {
          display: inline-block;
          padding: 9px 20px;
          background: #7c3aed;
          color: #fff;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
        }
        .ad-btn-secondary {
          display: inline-block;
          padding: 9px 20px;
          background: #f3f4f6;
          color: #374151;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
        }
        .ad-role-badge {
          display: inline-block;
          padding: 2px 10px;
          background: #ede9fe;
          color: #5b21b6;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 16px;
          text-transform: capitalize;
        }
      `}</style>
      <div className="ad-wrap">
        <div className="ad-card">
          <div className="ad-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          {role && <div className="ad-role-badge">{role} role required</div>}
          <h1 className="ad-title">Access Restricted</h1>
          <p className="ad-body">
            You don&apos;t have permission to view this area.
            {role && <> Access requires the <strong>{role}</strong> role.</>}
            {' '}You can request access below and an administrator will be notified.
          </p>
          <div className="ad-actions">
            <Link href={`/access-requests/new?${params.toString()}`} className="ad-btn-primary">
              Request Access
            </Link>
            <Link href="/dashboard" className="ad-btn-secondary">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
