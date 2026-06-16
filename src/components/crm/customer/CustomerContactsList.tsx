type ContactItem = {
  id: string
  first_name: string
  last_name: string
  title: string | null
  email: string | null
  department: string | null
}

export function CustomerContactsList({
  contacts,
  onAddClick,
  onContactClick,
}: {
  contacts: ContactItem[]
  onAddClick: () => void
  onContactClick: (id: string) => void
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-700">Contacts ({contacts.length})</h2>
        <button
          onClick={onAddClick}
          className="text-xs font-semibold text-purple-700 hover:text-purple-900"
        >
          + Add
        </button>
      </div>
      {contacts.length === 0 ? (
        <div className="px-5 py-5 text-sm text-slate-400 text-center">No contacts linked.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {contacts.map((c) => (
            <div
              key={c.id}
              onClick={() => onContactClick(c.id)}
              className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
                {c.first_name[0]}
                {c.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800">
                  {c.first_name} {c.last_name}
                </div>
                {(c.title || c.department) && (
                  <div className="text-xs text-slate-400">
                    {[c.title, c.department].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <div className="text-xs text-slate-400 truncate max-w-[120px]">{c.email ?? ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
