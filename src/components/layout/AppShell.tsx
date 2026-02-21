'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Store } from '@/types'

interface AppShellProps {
  children: React.ReactNode
  user: { email: string; display_name: string; is_admin: boolean }
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/tasks/add-tracking', label: 'Add Tracking', icon: TruckIcon },
]

const adminNavItems = [
  { href: '/admin/stores', label: 'Stores', icon: StoreIcon },
  { href: '/admin/users', label: 'Users', icon: UsersIcon },
  { href: '/admin/audit-log', label: 'Audit Log', icon: LogIcon },
]

export default function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [stores, setStores] = useState<Store[]>([])
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [storeError, setStoreError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/stores')
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) {
          console.error('Failed to load stores:', data.error)
          setStoreError(data.error ?? 'Failed to load stores')
          return
        }
        if (Array.isArray(data)) {
          setStores(data)
          // Restore from sessionStorage
          const savedId = sessionStorage.getItem('selectedStoreId')
          if (savedId) {
            const found = data.find((s: Store) => s.id === savedId)
            if (found) setSelectedStore(found)
          }
        }
      })
      .catch((err) => {
        console.error('Store fetch error:', err)
        setStoreError('Could not reach store API')
      })
  }, [])

  function handleStoreChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const store = stores.find((s) => s.id === e.target.value) ?? null
    setSelectedStore(store)
    if (store) {
      sessionStorage.setItem('selectedStoreId', store.id)
    } else {
      sessionStorage.removeItem('selectedStoreId')
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

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-slate-900 flex flex-col transform transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <span className="font-bold text-white text-lg">Arcon Tools</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tasks</p>
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} Icon={item.icon} active={pathname === item.href} onClick={() => setSidebarOpen(false)} />
          ))}

          {user.is_admin && (
            <>
              <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mt-5 mb-2">Admin</p>
              {adminNavItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} Icon={item.icon} active={pathname.startsWith(item.href)} onClick={() => setSidebarOpen(false)} />
              ))}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.display_name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/settings"
              className="flex-1 text-center text-xs text-slate-400 hover:text-white py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="flex-1 text-xs text-slate-400 hover:text-white py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center gap-3">
          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Store selector */}
          <div className="flex items-center gap-2 flex-1">
            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {storeError ? (
              <span className="text-xs text-red-500 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {storeError}
              </span>
            ) : (
              <select
                value={selectedStore?.id ?? ''}
                onChange={handleStoreChange}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0 max-w-xs"
              >
                <option value="">
                  {stores.length === 0 ? '— No stores configured —' : '— Select a Store —'}
                </option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.store_name}</option>
                ))}
              </select>
            )}
            {selectedStore && (
              <span className="text-xs text-slate-400 hidden sm:inline">
                ID: {selectedStore.store_id}
              </span>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {/* Pass selected store via context or search params */}
          <StoreContext.Provider value={{ selectedStore, setSelectedStore }}>
            {children}
          </StoreContext.Provider>
        </main>
      </div>
    </div>
  )
}

// ── Context ──────────────────────────────────────────────────────────────────

import { createContext, useContext } from 'react'

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

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({
  href, label, Icon, active, onClick,
}: {
  href: string
  label: string
  Icon: React.FC<{ className?: string }>
  active: boolean
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </Link>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function StoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function LogIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )
}
