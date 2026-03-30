import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/layout/AppShell'
import releasesData from '@/data/releases.json'
import type { Release, ReleaseChangeCategory } from '@/types'

const releases = releasesData as Release[]

const categoryConfig: Record<ReleaseChangeCategory, { label: string; color: string }> = {
  feature: { label: 'Features', color: '#7c3aed' },
  improvement: { label: 'Improvements', color: '#2563eb' },
  bug_fix: { label: 'Bug Fixes', color: '#d97706' },
  breaking_change: { label: 'Breaking', color: '#dc2626' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function ReleasesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, email, display_name, is_admin')
    .eq('google_id', user.id)
    .single()

  if (!appUser) redirect('/login')

  return (
    <AppShell user={appUser}>
      <style>{`
        .releases-page { max-width: 860px; margin: 0 auto; padding: 32px 24px 64px; }
        .releases-header { margin-bottom: 32px; }
        .releases-back { display: inline-flex; align-items: center; gap: 6px; color: #6b7280; font-size: 14px; text-decoration: none; margin-bottom: 20px; }
        .releases-back:hover { color: #6b1e98; }
        .releases-title { font-size: 28px; font-weight: 700; color: #111827; margin: 0 0 6px; }
        .releases-subtitle { color: #6b7280; font-size: 15px; margin: 0; }
        .release-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 28px; margin-bottom: 16px; text-decoration: none; display: block; transition: box-shadow 0.15s, border-color 0.15s; }
        .release-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-color: #d1d5db; }
        .release-card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
        .version-badge { font-family: ui-monospace, monospace; font-size: 13px; font-weight: 700; background: #f3e8ff; color: #7c3aed; padding: 4px 10px; border-radius: 20px; }
        .release-card-title { font-size: 18px; font-weight: 600; color: #111827; flex: 1; }
        .release-card-date { font-size: 13px; color: #9ca3af; }
        .release-card-summary { color: #4b5563; font-size: 14px; line-height: 1.6; margin-bottom: 16px; }
        .change-counts { display: flex; gap: 8px; flex-wrap: wrap; }
        .count-chip { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
        .count-chip-feature { background: #f3e8ff; color: #7c3aed; }
        .count-chip-improvement { background: #dbeafe; color: #2563eb; }
        .count-chip-bug_fix { background: #fef3c7; color: #d97706; }
        .count-chip-breaking_change { background: #fee2e2; color: #dc2626; }
        .releases-empty { text-align: center; color: #9ca3af; padding: 48px 0; }
      `}</style>
      <div className="releases-page">
        <div className="releases-header">
          <Link href="/dashboard" className="releases-back">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </Link>
          <h1 className="releases-title">Release Notes</h1>
          <p className="releases-subtitle">A history of what&apos;s been built and shipped in The Arc.</p>
        </div>

        {releases.length === 0 ? (
          <div className="releases-empty">No releases yet.</div>
        ) : (
          releases.map((release) => {
            const counts = (['feature', 'improvement', 'bug_fix', 'breaking_change'] as ReleaseChangeCategory[]).map((cat) => ({
              cat,
              count: release.changes.filter((c) => c.category === cat).length,
            }))

            return (
              <Link key={release.version} href={`/releases/${release.version}`} className="release-card">
                <div className="release-card-header">
                  <span className="version-badge">v{release.version}</span>
                  <span className="release-card-title">{release.title}</span>
                  <span className="release-card-date">{formatDate(release.date)}</span>
                </div>
                <p className="release-card-summary">{release.summary}</p>
                <div className="change-counts">
                  {counts.filter((c) => c.count > 0).map(({ cat, count }) => (
                    <span key={cat} className={`count-chip count-chip-${cat}`}>
                      {count} {categoryConfig[cat].label}
                    </span>
                  ))}
                </div>
              </Link>
            )
          })
        )}
      </div>
    </AppShell>
  )
}
