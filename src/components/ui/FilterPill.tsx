'use client'

import { type CSSProperties, type ReactNode } from 'react'

export type FilterPillColor = 'purple' | 'green' | 'amber' | 'red' | 'blue' | 'slate'

const COLOR_ACTIVE: Record<FilterPillColor, string> = {
  purple: 'bg-purple-700 text-white border-purple-700 hover:bg-purple-800',
  green:  'bg-green-700  text-white border-green-700  hover:bg-green-800',
  amber:  'bg-amber-600  text-white border-amber-600  hover:bg-amber-700',
  red:    'bg-red-600    text-white border-red-600    hover:bg-red-700',
  blue:   'bg-blue-700   text-white border-blue-700   hover:bg-blue-800',
  slate:  'bg-slate-600  text-white border-slate-600  hover:bg-slate-700',
}

const COLOR_INACTIVE = 'bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:text-purple-700'

export type FilterPillOption<V extends string = string> = {
  value: V
  label: string
  icon?: ReactNode
  color?: FilterPillColor
  count?: number
}

type FilterPillProps<V extends string = string> = FilterPillOption<V> & {
  active: boolean
  onClick: () => void
  style?: CSSProperties
}

export function FilterPill<V extends string = string>({
  label,
  icon,
  color = 'purple',
  count,
  active,
  onClick,
  style,
}: FilterPillProps<V>) {
  const colorClass = active ? COLOR_ACTIVE[color] : COLOR_INACTIVE

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-1 ${colorClass}`}
      style={style}
      aria-pressed={active}
    >
      {icon && (
        <span className="shrink-0 [&>svg]:h-3 [&>svg]:w-3" aria-hidden="true">
          {icon}
        </span>
      )}
      {label}
      {count !== undefined && (
        <span
          className={`ml-0.5 rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums leading-none ${
            active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

type FilterPillGroupProps<V extends string = string> = {
  options: FilterPillOption<V>[]
  value: V
  onChange: (value: V) => void
  label?: string
}

export function FilterPillGroup<V extends string = string>({
  options,
  value,
  onChange,
  label,
}: FilterPillGroupProps<V>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap items-center gap-2"
    >
      {options.map((opt) => (
        <FilterPill
          key={opt.value}
          {...opt}
          active={value === opt.value}
          onClick={() => onChange(opt.value)}
        />
      ))}
    </div>
  )
}
