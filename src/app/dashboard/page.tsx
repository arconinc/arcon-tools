import Link from 'next/link'

const TASK_CARDS = [
  {
    id: 'add-tracking',
    title: 'Add Tracking Number',
    description: 'Search for an order and attach a UPS, FedEx, or other carrier tracking number, then send a notification email to the customer.',
    icon: TruckIcon,
    href: '/tasks/add-tracking',
    enabled: true,
    badge: null,
  },
  {
    id: 'customer-lookup',
    title: 'Customer Lookup',
    description: 'Search and view customer records, order history, and customer group membership.',
    icon: UserSearchIcon,
    href: '#',
    enabled: false,
    badge: 'Coming Soon',
  },
  {
    id: 'order-history',
    title: 'Order History',
    description: 'Browse and filter all orders for a store with export capability.',
    icon: ClipboardIcon,
    href: '#',
    enabled: false,
    badge: 'Coming Soon',
  },
  {
    id: 'store-config',
    title: 'Store Configuration',
    description: 'View and edit general store settings and display settings via the PromoBullit API.',
    icon: CogIcon,
    href: '#',
    enabled: false,
    badge: 'Coming Soon',
  },
  {
    id: 'inventory',
    title: 'Inventory Management',
    description: 'Browse products and update inventory levels across your stores.',
    icon: BoxIcon,
    href: '#',
    enabled: false,
    badge: 'Coming Soon',
  },
  {
    id: 'discount-codes',
    title: 'Discount Codes',
    description: 'View and manage discount codes for a store.',
    icon: TagIcon,
    href: '#',
    enabled: false,
    badge: 'Coming Soon',
  },
  {
    id: 'email-logs',
    title: 'Email Logs',
    description: 'View store email logs and notification history.',
    icon: MailIcon,
    href: '#',
    enabled: false,
    badge: 'Coming Soon',
  },
  {
    id: 'reporting',
    title: 'Reporting',
    description: 'Basic order and sales summary views for your stores.',
    icon: ChartIcon,
    href: '#',
    enabled: false,
    badge: 'Coming Soon',
  },
]

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Select a task to get started. Make sure a store is selected in the header.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {TASK_CARDS.map((card) => (
          <TaskCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  )
}

function TaskCard({ card }: { card: typeof TASK_CARDS[number] }) {
  const Icon = card.icon

  if (!card.enabled) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 opacity-60 cursor-not-allowed">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <Icon className="w-5 h-5 text-slate-400" />
          </div>
          {card.badge && (
            <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">
              {card.badge}
            </span>
          )}
        </div>
        <h3 className="font-semibold text-slate-700 mb-1">{card.title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{card.description}</p>
      </div>
    )
  }

  return (
    <Link
      href={card.href}
      className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-300 hover:shadow-md transition-all group block"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
        <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <h3 className="font-semibold text-slate-800 mb-1 group-hover:text-blue-700 transition-colors">{card.title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{card.description}</p>
    </Link>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function TruckIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
}
function UserSearchIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7a3 3 0 100 6 3 3 0 000-6z" /></svg>
}
function ClipboardIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
}
function CogIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}
function BoxIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
}
function TagIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
}
function MailIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
}
function ChartIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
}
