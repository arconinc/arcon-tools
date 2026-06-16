export function Field({
  label,
  value,
  multiline,
  link,
  email,
}: {
  label: string
  value: string | null | undefined
  multiline?: boolean
  link?: boolean
  email?: boolean
}) {
  const display = value ? (
    link ? (
      <a href={value} target="_blank" rel="noopener noreferrer" className="text-purple-700 hover:underline break-all">
        {value.replace(/^https?:\/\//, '')}
      </a>
    ) : email ? (
      <a href={`mailto:${value}`} className="text-purple-700 hover:underline">
        {value}
      </a>
    ) : (
      <span className={multiline ? 'whitespace-pre-wrap' : ''}>{value}</span>
    )
  ) : (
    <span className="text-slate-400">—</span>
  )

  return (
    <div>
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-sm text-slate-800">{display}</div>
    </div>
  )
}

export function FieldInput({
  label,
  name,
  value,
  onChange,
  type = 'text',
  textarea = false,
  rows = 3,
}: {
  label: string
  name: string
  value: string
  onChange: (n: string, v: string) => void
  type?: string
  textarea?: boolean
  rows?: number
}) {
  const cls =
    'w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white'

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{label}</label>
      {textarea ? (
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          className={cls + ' resize-none'}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          className={cls}
        />
      )}
    </div>
  )
}
