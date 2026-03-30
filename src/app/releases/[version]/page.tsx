import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/layout/AppShell'
import releasesData from '@/data/releases.json'
import type { Release, ReleaseChange, ReleaseChangeCategory } from '@/types'

const releases = releasesData as Release[]

const categoryConfig: Record<ReleaseChangeCategory, { label: string; icon: string; chipClass: string; sectionClass: string }> = {
  breaking_change: { label: 'Breaking Changes', icon: '⚠️', chipClass: 'chip-breaking', sectionClass: 'section-breaking' },
  feature:         { label: 'New Features',      icon: '✨', chipClass: 'chip-feature',   sectionClass: 'section-feature'   },
  improvement:     { label: 'Improvements',      icon: '⚡', chipClass: 'chip-improvement',sectionClass: 'section-improvement'},
  bug_fix:         { label: 'Bug Fixes',          icon: '🐛', chipClass: 'chip-bugfix',    sectionClass: 'section-bugfix'    },
}

const SECTION_ORDER: ReleaseChangeCategory[] = ['breaking_change', 'feature', 'improvement', 'bug_fix']

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function groupByCategory(changes: ReleaseChange[]) {
  const groups: Partial<Record<ReleaseChangeCategory, ReleaseChange[]>> = {}
  for (const change of changes) {
    if (!groups[change.category]) groups[change.category] = []
    groups[change.category]!.push(change)
  }
  return groups
}

export default async function ReleaseDetailPage({
  params,
}: {
  params: Promise<{ version: string }>
}) {
  const { version } = await params

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

  const release = releases.find((r) => r.version === version)
  if (!release) notFound()

  const grouped = groupByCategory(release.changes)

  return (
    <AppShell user={appUser}>
      <style>{`
        .release-detail { max-width: 740px; margin: 0 auto; padding: 32px 24px 64px; }
        .release-back { display: inline-flex; align-items: center; gap: 6px; color: #6b7280; font-size: 14px; text-decoration: none; margin-bottom: 24px; }
        .release-back:hover { color: #6b1e98; }
        .release-header { margin-bottom: 32px; }
        .release-header-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
        .version-badge { font-family: ui-monospace, monospace; font-size: 14px; font-weight: 700; background: #f3e8ff; color: #7c3aed; padding: 5px 12px; border-radius: 20px; }
        .release-title { font-size: 26px; font-weight: 700; color: #111827; margin: 0; }
        .release-date { font-size: 14px; color: #9ca3af; }
        .release-summary { font-size: 15px; color: #4b5563; line-height: 1.7; margin: 0; padding: 16px; background: #f9fafb; border-radius: 10px; border-left: 3px solid #e5e7eb; }
        .change-section { margin-bottom: 32px; }
        .section-heading { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid; }
        .section-breaking .section-heading { color: #dc2626; border-color: #fecaca; }
        .section-feature   .section-heading { color: #7c3aed; border-color: #e9d5ff; }
        .section-improvement .section-heading { color: #2563eb; border-color: #bfdbfe; }
        .section-bugfix .section-heading { color: #d97706; border-color: #fde68a; }
        .change-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
        .change-item { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: #374151; line-height: 1.6; padding: 8px 12px; background: #fff; border: 1px solid #f3f4f6; border-radius: 8px; }
        .change-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 7px; }
        .section-breaking .change-dot { background: #dc2626; }
        .section-feature   .change-dot { background: #7c3aed; }
        .section-improvement .change-dot { background: #2563eb; }
        .section-bugfix .change-dot { background: #d97706; }
      `}</style>
      <div className="release-detail">
        <Link href="/releases" className="release-back">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Release Notes
        </Link>

        <div className="release-header">
          <div className="release-header-top">
            <span className="version-badge">v{release.version}</span>
            <h1 className="release-title">{release.title}</h1>
          </div>
          <div className="release-date">{formatDate(release.date)}</div>
        </div>

        <p className="release-summary">{release.summary}</p>

        <div style={{ height: 32 }} />

        {SECTION_ORDER.map((cat) => {
          const items = grouped[cat]
          if (!items || items.length === 0) return null
          const config = categoryConfig[cat]
          return (
            <div key={cat} className={`change-section ${config.sectionClass}`}>
              <div className="section-heading">
                <span>{config.icon}</span>
                <span>{config.label}</span>
                <span style={{ fontWeight: 400, fontSize: 13, marginLeft: 4, opacity: 0.7 }}>({items.length})</span>
              </div>
              <ul className="change-list">
                {items.map((change, i) => (
                  <li key={i} className="change-item">
                    <span className="change-dot" />
                    {change.description}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
