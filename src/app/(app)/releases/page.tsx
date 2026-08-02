import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import releasesData from '@/data/releases.json'
import type { Release, ReleaseChangeCategory } from '@/types'
import { PageHeader } from '@/components/layout/PageHeader'

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

  return (
    <>
      <style>{`
        .releases-page { width: 100%; box-sizing: border-box; padding: 32px 24px 64px; }
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
      <PageHeader title="Release Notes" subtitle="A history of what's been built and shipped in The Arc" bg="/admin_bg.png" />

      <div className="releases-page">
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
    </>
  )
}
