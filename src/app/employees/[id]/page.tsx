import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { EmployeeProfile } from '@/types'
import EmployeeAvatar from '@/components/employees/EmployeeAvatar'
import OfficeLocationBadge from '@/components/employees/OfficeLocationBadge'
import { TiptapRenderer } from '@/components/news/TiptapRenderer'

function yearsOfService(startDate: string | null): string | null {
  if (!startDate) return null
  const start = new Date(startDate)
  const now = new Date()
  const years = now.getFullYear() - start.getFullYear()
  const months = now.getMonth() - start.getMonth()
  const total = months < 0 ? years - 1 : years
  if (total < 1) return 'Less than 1 year'
  return `${total} ${total === 1 ? 'year' : 'years'}`
}

function formatPhone(raw: string | null): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return raw
}

function formatStartDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: viewerUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()
  if (!viewerUser) redirect('/login')

  const { data: emp, error } = await adminClient
    .from('users')
    .select(`
      id, email, display_name, job_title, team, office_location, employment_type,
      profile_image_url, avatar_url, start_date,
      phone, linkedin_url, timezone,
      bio_html, bio_json, skills, interests,
      manager_id
    `)
    .eq('id', id)
    .single()

  if (error || !emp) notFound()

  // Fetch manager and direct reports separately (self-referential joins are unreliable in PostgREST)
  const [managerResult, directReportsResult] = await Promise.all([
    emp.manager_id
      ? adminClient.from('users').select('id, display_name, job_title, profile_image_url, avatar_url').eq('id', emp.manager_id).single()
      : Promise.resolve({ data: null }),
    adminClient.from('users')
      .select('id, email, display_name, job_title, team, office_location, employment_type, profile_image_url, avatar_url, start_date')
      .eq('manager_id', id)
      .order('display_name'),
  ])

  const profile: EmployeeProfile = {
    ...emp,
    manager: managerResult.data ?? null,
    direct_reports: directReportsResult.data ?? [],
  }
  const isOwnProfile = viewerUser.id === profile.id
  const canEdit = viewerUser.is_admin || isOwnProfile

  return (
    <>
      <style>{`
        .prof-page { max-width: 860px; margin: 0 auto; padding: 2rem; }
        .prof-back { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; color: #64748b; margin-bottom: 1.5rem; text-decoration: none; }
        .prof-back:hover { color: #7c3aed; }
        .prof-card { background: white; border: 1px solid #e2e8f0; border-radius: 1rem; overflow: hidden; }
        .prof-hero { background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 2rem 2rem 1.5rem; display: flex; align-items: flex-end; gap: 1.5rem; }
        .prof-hero-info { flex: 1; }
        .prof-name { font-size: 1.75rem; font-weight: 700; color: white; line-height: 1.2; }
        .prof-title { font-size: 1rem; color: rgba(255,255,255,0.85); margin-top: 0.25rem; }
        .prof-badges { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
        .prof-badge-emp { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background: rgba(255,255,255,0.2); color: white; }
        .prof-edit-btn { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.5rem 1rem; background: white; color: #7c3aed; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; text-decoration: none; flex-shrink: 0; }
        .prof-edit-btn:hover { background: #f5f3ff; }
        .prof-body { padding: 1.5rem 2rem; }
        .prof-meta-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
        .prof-meta-item { }
        .prof-meta-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 0.25rem; }
        .prof-meta-value { font-size: 0.9375rem; color: #1e293b; }
        .prof-meta-link { font-size: 0.9375rem; color: #7c3aed; text-decoration: none; }
        .prof-meta-link:hover { text-decoration: underline; }
        .prof-divider { border: none; border-top: 1px solid #f1f5f9; margin: 1.5rem 0; }
        .prof-section-title { font-size: 0.8125rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 0.75rem; }
        .prof-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .prof-tag { padding: 0.375rem 0.875rem; background: #f1f5f9; color: #475569; border-radius: 9999px; font-size: 0.875rem; }
        .prof-manager-chip { display: inline-flex; align-items: center; gap: 0.625rem; padding: 0.625rem 1rem; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 0.75rem; text-decoration: none; }
        .prof-manager-chip:hover { background: #f5f3ff; }
        .prof-manager-name { font-size: 0.9375rem; font-weight: 600; color: #1e293b; }
        .prof-manager-title { font-size: 0.8125rem; color: #64748b; }
        .prof-reports-list { display: flex; flex-wrap: wrap; gap: 0.625rem; }
        .prof-report-chip { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; text-decoration: none; }
        .prof-report-chip:hover { border-color: #c084fc; background: #faf5ff; }
        .prof-report-name { font-size: 0.875rem; font-weight: 500; color: #1e293b; }
        .bio-wrapper { }
      `}</style>

      <div className="prof-page">
        <Link href="/employees" className="prof-back">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Employee Directory
        </Link>

        <div className="prof-card">
          {/* Hero */}
          <div className="prof-hero">
            <EmployeeAvatar
              displayName={profile.display_name}
              profileImageUrl={profile.profile_image_url}
              avatarUrl={profile.avatar_url}
              size="xl"
              className="ring-4 ring-white/30"
            />
            <div className="prof-hero-info">
              <div className="prof-name">{profile.display_name}</div>
              {profile.job_title && <div className="prof-title">{profile.job_title}</div>}
              <div className="prof-badges">
                {profile.office_location && (
                  <span className="prof-badge-emp">{profile.office_location}</span>
                )}
                {profile.team && (
                  <span className="prof-badge-emp">{profile.team}</span>
                )}
                {profile.employment_type && (
                  <span className="prof-badge-emp" style={{ textTransform: 'capitalize' }}>{profile.employment_type}</span>
                )}
              </div>
            </div>
            {canEdit && (
              <Link
                href={viewerUser.is_admin ? `/admin/employees/${profile.id}` : '/profile'}
                className="prof-edit-btn"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                {isOwnProfile && !viewerUser.is_admin ? 'Edit My Profile' : 'Edit Profile'}
              </Link>
            )}
          </div>

          {/* Body */}
          <div className="prof-body">
            {/* Contact & HR meta */}
            <div className="prof-meta-grid">
              <div className="prof-meta-item">
                <div className="prof-meta-label">Email</div>
                <a href={`mailto:${profile.email}`} className="prof-meta-link">{profile.email}</a>
              </div>
              {profile.phone && (
                <div className="prof-meta-item">
                  <div className="prof-meta-label">Phone</div>
                  <div className="prof-meta-value">{formatPhone(profile.phone)}</div>
                </div>
              )}
              {profile.start_date && (
                <div className="prof-meta-item">
                  <div className="prof-meta-label">Start Date</div>
                  <div className="prof-meta-value">{formatStartDate(profile.start_date)}</div>
                </div>
              )}
              {profile.start_date && (
                <div className="prof-meta-item">
                  <div className="prof-meta-label">Tenure</div>
                  <div className="prof-meta-value">{yearsOfService(profile.start_date)}</div>
                </div>
              )}
              {profile.timezone && (
                <div className="prof-meta-item">
                  <div className="prof-meta-label">Timezone</div>
                  <div className="prof-meta-value">{profile.timezone}</div>
                </div>
              )}
              {profile.linkedin_url && (
                <div className="prof-meta-item">
                  <div className="prof-meta-label">LinkedIn</div>
                  <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="prof-meta-link">
                    View Profile ↗
                  </a>
                </div>
              )}
            </div>

            {/* Bio */}
            {profile.bio_html && (
              <>
                <hr className="prof-divider" />
                <div className="prof-section-title">About</div>
                <div className="bio-wrapper">
                  <TiptapRenderer html={profile.bio_html} />
                </div>
              </>
            )}

            {/* Skills */}
            {profile.skills.length > 0 && (
              <>
                <hr className="prof-divider" />
                <div className="prof-section-title">Skills &amp; Expertise</div>
                <div className="prof-tags">
                  {profile.skills.map((s) => (
                    <span key={s} className="prof-tag">{s}</span>
                  ))}
                </div>
              </>
            )}

            {/* Interests */}
            {profile.interests.length > 0 && (
              <>
                <hr className="prof-divider" />
                <div className="prof-section-title">Interests &amp; Hobbies</div>
                <div className="prof-tags">
                  {profile.interests.map((i) => (
                    <span key={i} className="prof-tag">{i}</span>
                  ))}
                </div>
              </>
            )}

            {/* Manager */}
            {profile.manager && (
              <>
                <hr className="prof-divider" />
                <div className="prof-section-title">Reports To</div>
                <Link href={`/employees/${profile.manager.id}`} className="prof-manager-chip">
                  <EmployeeAvatar
                    displayName={profile.manager.display_name}
                    profileImageUrl={profile.manager.profile_image_url}
                    avatarUrl={profile.manager.avatar_url}
                    size="sm"
                  />
                  <div>
                    <div className="prof-manager-name">{profile.manager.display_name}</div>
                    {profile.manager.job_title && (
                      <div className="prof-manager-title">{profile.manager.job_title}</div>
                    )}
                  </div>
                </Link>
              </>
            )}

            {/* Direct Reports */}
            {profile.direct_reports.length > 0 && (
              <>
                <hr className="prof-divider" />
                <div className="prof-section-title">Direct Reports ({profile.direct_reports.length})</div>
                <div className="prof-reports-list">
                  {profile.direct_reports.map((r) => (
                    <Link key={r.id} href={`/employees/${r.id}`} className="prof-report-chip">
                      <EmployeeAvatar
                        displayName={r.display_name}
                        profileImageUrl={r.profile_image_url}
                        avatarUrl={r.avatar_url}
                        size="sm"
                      />
                      <div>
                        <div className="prof-report-name">{r.display_name}</div>
                        {r.job_title && (
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.job_title}</div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
