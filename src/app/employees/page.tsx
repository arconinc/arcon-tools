'use client'

import { useState, useEffect, useMemo } from 'react'
import { EmployeeSummary, OfficeLocation, EmployeeTeam } from '@/types'
import EmployeeCard from '@/components/employees/EmployeeCard'

const OFFICE_LOCATIONS: OfficeLocation[] = ['Remote', 'Minnesota', 'Arizona', 'Colorado']
const TEAMS: EmployeeTeam[] = ['Sales', 'Marketing', 'IT', 'Operations', 'Finance', 'HR']

export default function EmployeeDirectoryPage() {
  const [employees, setEmployees] = useState<EmployeeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState<OfficeLocation | 'All'>('All')
  const [teamFilter, setTeamFilter] = useState<EmployeeTeam | 'All'>('All')

  useEffect(() => {
    fetch('/api/employees')
      .then((r) => r.json())
      .then((data) => { setEmployees(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (locationFilter !== 'All' && e.office_location !== locationFilter) return false
      if (teamFilter !== 'All' && e.team !== teamFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          e.display_name.toLowerCase().includes(q) ||
          (e.job_title?.toLowerCase().includes(q) ?? false) ||
          (e.team?.toLowerCase().includes(q) ?? false)
        )
      }
      return true
    })
  }, [employees, locationFilter, teamFilter, search])

  return (
    <>
      <style>{`
        .dir-page { padding: 2rem; max-width: 1400px; margin: 0 auto; }
        .dir-header { margin-bottom: 1.5rem; }
        .dir-title { font-size: 1.5rem; font-weight: 700; color: #1e293b; }
        .dir-count { font-size: 0.875rem; color: #64748b; margin-top: 0.25rem; }
        .dir-filters { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin-bottom: 1.5rem; }
        .dir-search { flex: 1; min-width: 220px; max-width: 360px; position: relative; }
        .dir-search input { width: 100%; padding: 0.5rem 0.75rem 0.5rem 2.25rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 0.875rem; outline: none; }
        .dir-search input:focus { border-color: #a855f7; }
        .dir-search svg { position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
        .pill-group { display: flex; gap: 0.375rem; flex-wrap: wrap; }
        .pill { padding: 0.375rem 0.875rem; border-radius: 9999px; font-size: 0.8125rem; font-weight: 500; border: 1px solid #e2e8f0; background: white; color: #64748b; cursor: pointer; transition: all 0.15s; }
        .pill:hover { border-color: #c084fc; color: #7c3aed; }
        .pill.active { background: #7c3aed; border-color: #7c3aed; color: white; }
        .team-select { padding: 0.375rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 0.8125rem; color: #374151; outline: none; }
        .team-select:focus { border-color: #a855f7; }
        .dir-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        @media (min-width: 768px) { .dir-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1024px) { .dir-grid { grid-template-columns: repeat(4, 1fr); } }
        .empty-state { grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: #94a3b8; }
        .skeleton { background: #f1f5f9; border-radius: 0.75rem; height: 120px; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
      `}</style>

      <div className="dir-page">
        <div className="dir-header">
          <h1 className="dir-title">Employee Directory</h1>
          <p className="dir-count">{employees.length} {employees.length === 1 ? 'employee' : 'employees'}</p>
        </div>

        <div className="dir-filters">
          <div className="dir-search">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search by name, title, or team…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="pill-group">
            {(['All', ...OFFICE_LOCATIONS] as const).map((loc) => (
              <button
                key={loc}
                className={`pill ${locationFilter === loc ? 'active' : ''}`}
                onClick={() => setLocationFilter(loc)}
              >
                {loc}
              </button>
            ))}
          </div>

          <select
            className="team-select"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value as EmployeeTeam | 'All')}
          >
            <option value="All">All Teams</option>
            {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="dir-grid">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" />)
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <p className="text-lg font-medium">No employees found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            filtered.map((e) => <EmployeeCard key={e.id} employee={e} />)
          )}
        </div>
      </div>
    </>
  )
}
