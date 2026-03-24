'use client'

import { useState, useEffect, useRef, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Store, CountdownConfig } from '@/types'
import { setGAUser, trackPageView } from '@/lib/analytics'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppShellProps {
  children: React.ReactNode
  user: { email: string; display_name: string; is_admin: boolean; avatar_url?: string | null }
}

type NavBadge = { text: string; variant: 'purple' | 'green' | 'muted' }

type NavItemDef = {
  href: string
  label: string
  icon: React.FC<{ className?: string }>
  badge?: NavBadge
  soon?: boolean
  adminMatch?: boolean // use pathname.startsWith instead of ===
}

type NavSection = {
  label: string
  items: NavItemDef[]
}

// ── Contexts ──────────────────────────────────────────────────────────────────

interface StoreContextValue {
  selectedStore: Store | null
  setSelectedStore: (s: Store | null) => void
}

export const StoreContext = createContext<StoreContextValue>({
  selectedStore: null,
  setSelectedStore: () => {},
})

export function useStore() {
  return useContext(StoreContext)
}

interface UserContextValue {
  user: {
      id: string;
      email: string; display_name: string; is_admin: boolean; avatar_url?: string | null } | null
}

export const UserContext = createContext<UserContextValue>({ user: null })

export function useAppUser() {
  return useContext(UserContext)
}

// ── Nav structure ─────────────────────────────────────────────────────────────

function buildNavSections(isAdmin: boolean): NavSection[] {
  const sections: NavSection[] = [
    {
      label: 'Home',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
      ],
    },
    {
      label: 'CRM',
      items: [
        { href: '/crm', label: 'Dashboard', icon: CrmDashIcon, adminMatch: true },
        { href: '/crm/customers', label: 'Customers', icon: CrmCustomersIcon, adminMatch: true },
        { href: '/crm/vendors', label: 'Vendors', icon: BuildingIcon, adminMatch: true },
        { href: '/crm/contacts', label: 'Contacts', icon: CrmContactsIcon, adminMatch: true },
        { href: '/crm/opportunities', label: 'Opportunities', icon: CrmOppsIcon, adminMatch: true },
        { href: '/crm/tasks', label: 'Tasks', icon: TaskCheckIcon, adminMatch: true },
      ],
    },
    {
      label: 'Tasks',
      items: [
        { href: '/my-tasks', label: 'My Tasks', icon: TaskCheckIcon, adminMatch: true },
        { href: '#', label: 'Team Board', icon: BoardIcon },
        { href: '#', label: 'Backlog', icon: ArchiveIcon },
      ],
    },
    {
      label: 'Company',
      items: [
        { href: '/news', label: 'News & Announcements', icon: MegaphoneIcon, adminMatch: true },
        { href: '#', label: 'Birthdays & Anniversaries', icon: CakeIcon },
        { href: '#', label: 'Employee Directory', icon: UsersIcon },
      ],
    },
    {
      label: 'E-Commerce',
      items: [
        { href: '/tasks/add-tracking', label: 'Add Tracking', icon: PackageIcon },
        { href: '#', label: 'Customer Lookup', icon: SearchIcon, soon: true },
        { href: '#', label: 'Order History', icon: ClipboardListIcon, soon: true },
        { href: '#', label: 'Reporting', icon: ChartBarIcon, soon: true },
      ],
    },
    {
      label: 'HR',
      items: [
        { href: '#', label: 'Documents', icon: DocumentIcon },
        { href: '#', label: 'PTO Request', icon: CalendarIcon },
      ],
    },
  ]

  if (isAdmin) {
    sections.push({
      label: 'Admin',
      items: [
        { href: '/admin/banner', label: 'Banner', icon: BannerIcon, adminMatch: true },
        { href: '/admin/banner-strip', label: 'Banner Strip', icon: TickerIcon, adminMatch: true },
        { href: '/admin/countdown', label: 'Countdown', icon: CountdownIcon, adminMatch: true },
        { href: '/admin/news', label: 'News', icon: MegaphoneIcon, adminMatch: true },
        { href: '/admin/crm-goals', label: 'Sales Goals', icon: GoalIcon, adminMatch: true },
        { href: '/admin/crm-tags', label: 'CRM Tags', icon: TagIcon, adminMatch: true },
        { href: '/admin/crm-import', label: 'CRM Import', icon: UploadIcon, adminMatch: true },
        { href: '/admin/stores', label: 'Stores', icon: StoreIcon, adminMatch: true },
        { href: '/admin/users', label: 'Users', icon: UserAdminIcon, adminMatch: true },
        { href: '/admin/audit-log', label: 'Audit Log', icon: LogIcon, adminMatch: true },
      ],
    })
  }

  return sections
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export default function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [stores, setStores] = useState<Store[]>([])
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ label: string; y: number } | null>(null)
  const [countdown, setCountdown] = useState<CountdownConfig | null>(null)
  const [countdownDisplay, setCountdownDisplay] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const countdownRef = useRef<CountdownConfig | null>(null)

  useEffect(() => {
    fetch('/api/stores')
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) {
          setStoreError(data.error ?? 'Failed to load stores')
          return
        }
        if (Array.isArray(data)) {
          setStores(data)
          const savedId = sessionStorage.getItem('selectedStoreId')
          if (savedId) {
            const found = data.find((s: Store) => s.id === savedId)
            if (found) setSelectedStore(found)
          }
        }
      })
      .catch(() => setStoreError('Could not reach store API'))
  }, [])

  useEffect(() => {
    fetch('/api/countdown')
      .then(r => r.ok ? r.json() : null)
      .then((data: CountdownConfig | null) => {
        if (data?.enabled) {
          setCountdown(data)
          countdownRef.current = data
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const tick = () => {
      const cfg = countdownRef.current
      if (!cfg?.enabled) return
      const diff = new Date(cfg.target_date).getTime() - Date.now()
      if (diff <= 0) { setCountdownDisplay('Now!'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdownDisplay(d > 0 ? `${d}d ${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    countdownRef.current = countdown
  }, [countdown])

  // ── Analytics ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setGAUser(user.email)
  }, [user.email])

  useEffect(() => {
    trackPageView(window.location.href, user.email)
  }, [pathname, user.email])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery.trim())}`, '_blank', 'noopener,noreferrer')
    setSearchQuery('')
  }

  function handleStoreChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const store = stores.find((s) => s.id === e.target.value) ?? null
    setSelectedStore(store)
    if (store) {
      sessionStorage.setItem('selectedStoreId', store.id)
    } else {
      sessionStorage.removeItem('selectedStoreId')
    }
  }

  function handleHamburger() {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setSidebarCollapsed(c => !c)
      setTooltip(null)
    } else {
      setSidebarOpen(o => !o)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    sessionStorage.clear()
    router.push('/login')
  }

  const initials = user.display_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const navSections = buildNavSections(user.is_admin)
  const sidebarWidth = sidebarCollapsed ? 52 : 228

  return (
    <UserContext.Provider value={{ user }}>
      <StoreContext.Provider value={{ selectedStore, setSelectedStore }}>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f5f5f5' }}>

          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-20 lg:hidden"
              style={{ background: 'rgba(0,0,0,0.4)' }}
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* ── Sidebar ──────────────────────────────────────────────── */}
          <aside
            className={`fixed lg:static inset-y-0 left-0 z-30 flex flex-col transform transition-transform duration-200 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
            }`}
            style={{
              width: sidebarWidth,
              minWidth: sidebarWidth,
              background: '#111111',
              height: '100vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              transition: 'width 0.2s ease, min-width 0.2s ease',
            }}
          >
            {/* Logo */}
            <div style={{ padding: '18px 0 16px', borderBottom: '1px solid #222', flexShrink: 0, overflow: 'hidden' }}>
              {sidebarCollapsed ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 36 }}>
                  <span style={{ color: '#6b1e98', fontSize: 22, fontWeight: 900, lineHeight: 1 }}>.</span>
                </div>
              ) : (
                <div style={{ padding: '0 16px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', border: '2px solid #fff', padding: '6px 10px' }}>
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      The Arc
                    </span>
                    <span style={{ color: '#6b1e98', fontSize: 18, fontWeight: 900, lineHeight: 1, marginLeft: 1 }}>.</span>
                  </div>
                  <div style={{ color: '#666', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 8 }}>
                    Intranet
                  </div>
                </div>
              )}
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, paddingBottom: 16 }}>
              {navSections.map((section, si) => (
                <div key={si}>
                  {si > 0 && <div style={{ height: 1, background: '#1e1e1e', margin: '4px 0' }} />}
                  <div style={{ paddingTop: sidebarCollapsed ? 4 : 14, paddingBottom: 2 }}>
                    {!sidebarCollapsed && (
                      <div style={{ color: '#444', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 16px 6px' }}>
                        {section.label}
                      </div>
                    )}
                    {section.items.map((item) => {
                      const active = item.href !== '#' && (
                        item.adminMatch
                          ? pathname.startsWith(item.href)
                          : pathname === item.href
                      )
                      return (
                        <SidebarNavItem
                          key={item.href + item.label}
                          item={item}
                          active={active}
                          onClick={() => setSidebarOpen(false)}
                          collapsed={sidebarCollapsed}
                          onHover={sidebarCollapsed ? (y) => setTooltip({ label: item.label, y }) : undefined}
                          onHoverEnd={sidebarCollapsed ? () => setTooltip(null) : undefined}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* User footer */}
            <div style={{
              padding: sidebarCollapsed ? '12px 0' : '12px 16px',
              borderTop: '1px solid #222',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: 10,
              flexShrink: 0,
            }}>
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.display_name} referrerPolicy="no-referrer" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 30, height: 30, background: '#6b1e98', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                  {initials}
                </div>
              )}
              {!sidebarCollapsed && (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#ddd', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user.display_name}
                    </div>
                    <div style={{ color: '#555', fontSize: 10 }}>
                      {user.is_admin ? 'Admin' : 'Team Member'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <Link href="/settings" style={{ color: '#555', fontSize: 10, textDecoration: 'none' }}>
                      Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      style={{ color: '#555', fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </aside>

          {/* ── Main ─────────────────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

            {/* Purple stripe */}
            <div style={{ height: 3, background: 'linear-gradient(90deg, #6b1e98, #9333ea)', flexShrink: 0 }} />

            {/* Topbar */}
            <header className="app-topbar" style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              {/* Hamburger — always visible */}
              <button
                onClick={handleHamburger}
                style={{ width: 34, height: 34, borderRadius: 6, background: '#f5f5f5', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#777', flexShrink: 0 }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Store selector — E-Commerce pages only */}
              {pathname.startsWith('/tasks') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, background: '#16a34a', borderRadius: '50%' }} />
                  {storeError ? (
                    <span style={{ fontSize: 13, color: '#dc2626' }}>{storeError}</span>
                  ) : (
                    <select
                      value={selectedStore?.id ?? ''}
                      onChange={handleStoreChange}
                      style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 12px', fontSize: 13, color: '#555', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="">{stores.length === 0 ? '— No stores configured —' : '— Select a Store —'}</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>{s.store_name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Countdown pill */}
              {countdown?.enabled && countdownDisplay && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  background: '#6b1e98',
                  color: '#fff',
                  borderRadius: 7,
                  padding: '5px 11px',
                  fontSize: 12,
                  fontWeight: 600,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.75, flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
                  </svg>
                  <span style={{ opacity: 0.8, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {countdown.label}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{countdownDisplay}</span>
                </div>
              )}

              {/* Google Search */}
              <form
                onSubmit={handleSearchSubmit}
                style={{ flex: 1, display: 'flex', alignItems: 'center' }}
              >
                <div style={{ position: 'relative', width: '100%' }}>
                  <svg
                    width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#999', pointerEvents: 'none' }}
                  >
                    <circle cx="11" cy="11" r="8" strokeWidth={2} />
                    <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search Google…"
                    style={{
                      width: '100%',
                      padding: '7px 12px 7px 32px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 7,
                      fontSize: 13,
                      color: '#333',
                      background: '#f9f9f9',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#9333ea'; e.currentTarget.style.background = '#fff' }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#f9f9f9' }}
                  />
                </div>
              </form>

              {/* Right side */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Gmail */}
                <a
                  href="https://mail.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Gmail"
                  style={{ width: 34, height: 34, borderRadius: 6, background: '#f5f5f5', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#777', textDecoration: 'none', flexShrink: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.color = '#777' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                </a>

                {/* Notifications */}
                <div style={{ width: 34, height: 34, borderRadius: 6, background: '#f5f5f5', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#777', position: 'relative', flexShrink: 0 }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <div style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, background: '#6b1e98', borderRadius: '50%', border: '1.5px solid #fff' }} />
                </div>

                {/* Avatar */}
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.display_name} referrerPolicy="no-referrer" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 32, height: 32, background: '#6b1e98', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                    {initials}
                  </div>
                )}
              </div>
            </header>

            {/* Page content */}
            <main style={{ flex: 1, overflowY: 'auto' }}>
              {children}
            </main>
          </div>

          {/* Tooltip for collapsed sidebar */}
          {sidebarCollapsed && tooltip && (
            <div
              style={{
                position: 'fixed',
                left: 60,
                top: tooltip.y,
                transform: 'translateY(-50%)',
                background: '#1e1e1e',
                color: '#e0e0e0',
                fontSize: 12,
                fontWeight: 500,
                padding: '5px 10px',
                borderRadius: 5,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                zIndex: 200,
                border: '1px solid #333',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}
            >
              {tooltip.label}
            </div>
          )}

        </div>
      </StoreContext.Provider>
    </UserContext.Provider>
  )
}

// ── SidebarNavItem ────────────────────────────────────────────────────────────

function SidebarNavItem({
  item,
  active,
  onClick,
  collapsed,
  onHover,
  onHoverEnd,
}: {
  item: NavItemDef
  active: boolean
  onClick: () => void
  collapsed?: boolean
  onHover?: (y: number) => void
  onHoverEnd?: () => void
}) {
  const Icon = item.icon

  if (collapsed) {
    const collapsedStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 32,
      color: active ? '#fff' : '#888',
      borderRadius: 4,
      margin: '1px auto',
      textDecoration: 'none',
      background: active ? '#6b1e98' : 'transparent',
      cursor: item.soon ? 'default' : 'pointer',
      transition: 'background 0.1s, color 0.1s',
    }

    const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
      if (!active) {
        e.currentTarget.style.background = '#1e1e1e'
        e.currentTarget.style.color = '#ddd'
      }
      if (onHover) {
        const rect = e.currentTarget.getBoundingClientRect()
        onHover(rect.top + rect.height / 2)
      }
    }

    const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
      if (!active) {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = '#888'
      }
      if (onHoverEnd) onHoverEnd()
    }

    if (item.soon || item.href === '#') {
      return (
        <div style={collapsedStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <Icon className="w-[15px] h-[15px] flex-shrink-0" />
        </div>
      )
    }

    return (
      <Link href={item.href} onClick={onClick} style={collapsedStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <Icon className="w-[15px] h-[15px] flex-shrink-0" />
      </Link>
    )
  }

  // ── Expanded mode ──────────────────────────────────────────────────────────

  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: '7px 14px',
    color: active ? '#fff' : '#888',
    fontSize: 13,
    borderRadius: 4,
    margin: '1px 8px',
    textDecoration: 'none',
    background: active ? '#6b1e98' : 'transparent',
    cursor: item.soon ? 'default' : 'pointer',
    transition: 'background 0.1s, color 0.1s',
  }

  const content = (
    <>
      <Icon className="w-[15px] h-[15px] flex-shrink-0" />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge && (
        <span style={{
          background: item.badge.variant === 'green' ? '#15803d' : item.badge.variant === 'muted' ? '#333' : '#6b1e98',
          color: item.badge.variant === 'muted' ? '#888' : '#fff',
          fontSize: item.badge.variant === 'muted' ? 9 : 10,
          fontWeight: 700,
          padding: '1px 6px',
          borderRadius: 10,
        }}>
          {item.badge.text}
        </span>
      )}
      {item.soon && (
        <span style={{ background: '#333', color: '#888', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>
          Soon
        </span>
      )}
    </>
  )

  if (item.soon || item.href === '#') {
    return <div style={baseStyle}>{content}</div>
  }

  return (
    <Link
      href={item.href}
      onClick={onClick}
      style={baseStyle}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = '#1e1e1e'; e.currentTarget.style.color = '#ddd' } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888' } }}
    >
      {content}
    </Link>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function HomeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M4 10v10h6v-6h4v6h6V10" /></svg>
}

function PackageIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8 5-8-5m16 0v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7m16 0l-8-5-8 5" /></svg>
}

function SearchIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" strokeWidth={2} /><path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35" /></svg>
}

function ClipboardListIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
}

function ChartBarIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
}

function TaskCheckIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
}

function BoardIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={2} /><rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={2} /><rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={2} /><rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={2} /></svg>
}

function ArchiveIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" /></svg>
}

function MegaphoneIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
}

function CakeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6l3-3 3 3M9 6h6M9 6a3 3 0 01-3 3m12-3a3 3 0 01-3 3" /></svg>
}

function UsersIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}

function DocumentIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
}

function CalendarIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
}

function BuildingIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
}

function StoreIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
}

function UserAdminIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
}

function LogIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
}

function BannerIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 15h4m-4-2h8" /></svg>
}

function TickerIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 8h14M5 16h6" /></svg>
}

function CountdownIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" /></svg>
}

function CrmDashIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h6" /></svg>
}

function CrmCustomersIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-10h2m-2 4h2m6-4h2m-2 4h2" /></svg>
}

function CrmContactsIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
}

function CrmOppsIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
}

function GoalIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
}

function TagIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
}

function UploadIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
}
