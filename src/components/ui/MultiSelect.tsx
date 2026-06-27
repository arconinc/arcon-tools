'use client'

import { useState, useRef, useEffect, useId } from 'react'

export type MultiSelectOption = {
  value: string
  label: string
  /** Shorter label shown inside chips; falls back to label */
  chipLabel?: string
  /** Renders a color dot in the option row and tints the chip */
  color?: string
  /** Renders a circular avatar in the option row and chip */
  avatar?: { name: string; url?: string | null }
  /** Small gray text rendered flush-right in the option row */
  meta?: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  /** Only one value selectable at a time; closes after each selection */
  single?: boolean
  className?: string
  /** Accessible label for the control */
  label?: string
  /** Max px width of the dropdown panel. Defaults to 320. */
  dropdownWidth?: number
  /**
   * Render-prop for extra action rows at the top of the dropdown.
   * Receives a `close` callback to close the dropdown after acting.
   * Use ms-opt / ms-check classes to match option row styling.
   */
  topActions?: (close: () => void) => React.ReactNode
  /** Cap list height and scroll. Default true. */
  scrollable?: boolean
}

function Avatar({ name, url, chip = false }: { name: string; url?: string | null; chip?: boolean }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  const size = chip ? 14 : 22
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      background: '#ede9fe', color: '#6b1e98',
      fontSize: chip ? 7 : 9, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, overflow: 'hidden',
    }}>
      {url
        ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        : initials}
    </span>
  )
}

const MS_STYLES = `
.ms-box{display:flex;align-items:center;min-height:36px;background:#fff;border:1.5px solid #e5e7eb;border-radius:8px;cursor:pointer;transition:border-color 0.15s,box-shadow 0.15s;position:relative;user-select:none;}
.ms-box:hover{border-color:#9333ea;}
.ms-box.ms-open{border-color:#6b1e98;box-shadow:0 0 0 3px rgba(107,30,152,0.12);}
.ms-chips{flex:1;display:flex;flex-wrap:wrap;gap:5px;padding:5px 8px;min-width:0;}
.ms-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 6px 2px 5px;background:#ede9fe;color:#5b21b6;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;max-width:160px;}
.ms-chip-rm{display:flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;border:none;background:transparent;color:#7c3aed;cursor:pointer;padding:0;flex-shrink:0;font-size:14px;line-height:1;}
.ms-chip-rm:hover{background:#c4b5fd;}
.ms-chevron{display:flex;align-items:center;justify-content:center;padding:0 10px;color:#9ca3af;flex-shrink:0;}
.ms-dropdown{position:absolute;top:calc(100% + 6px);left:0;min-width:100%;width:max-content;background:#fff;border:1.5px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:200;overflow:hidden;}
.ms-scroll{max-height:240px;overflow-y:auto;overscroll-behavior:contain;}
.ms-opt{display:flex;align-items:center;gap:9px;width:100%;padding:8px 12px;font-size:13px;font-weight:500;color:#222;border:none;background:transparent;text-align:left;cursor:pointer;transition:background 0.08s;white-space:nowrap;}
.ms-opt:hover{background:#f5f3ff;}
.ms-opt.ms-sel{background:#f5f3ff;color:#6b21a8;font-weight:600;}
.ms-check{width:16px;height:16px;border-radius:4px;border:1.5px solid #d1d5db;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background 0.1s,border-color 0.1s;}
.ms-check.ms-on{background:#6b1e98;border-color:#6b1e98;}
.ms-divider{height:1px;background:#f3f4f6;margin:4px 0;}
.ms-clear{display:flex;align-items:center;gap:8px;width:100%;padding:7px 12px;font-size:12px;border:none;background:transparent;text-align:left;cursor:pointer;color:#9ca3af;font-weight:500;}
.ms-clear:hover{color:#ef4444;background:#fff5f5;}
.ms-meta{font-size:11px;color:#aaa;margin-left:auto;padding-left:10px;flex-shrink:0;}
@media(prefers-reduced-motion:reduce){.ms-box,.ms-check,.ms-chip-rm{transition:none !important;}}
`

/**
 * Shared pill-chip multi-select (or single-select) dropdown.
 * Embeds its own <style> tag so layout always works regardless of global CSS loading order.
 *
 * Multi:   <MultiSelect options={opts} value={ids} onChange={setIds} placeholder="All Owners" />
 * Single:  <MultiSelect single options={opts} value={val ? [val] : []} onChange={([v='']) => setVal(v)} placeholder="All Stages" />
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  single = false,
  className = '',
  label,
  dropdownWidth = 320,
  topActions,
  scrollable = true,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const id = useId()

  function close() { setOpen(false) }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  function toggle(optValue: string) {
    if (single) {
      onChange(value[0] === optValue ? [] : [optValue])
      setOpen(false)
      return
    }
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue))
    } else {
      onChange([...value, optValue])
    }
  }

  function clearAll() {
    onChange([])
    if (single) setOpen(false)
  }

  const selectedOptions = options.filter((o) => value.includes(o.value))
  const hasValue = value.length > 0

  const list = (
    <div className="ms-scroll" style={scrollable ? undefined : { maxHeight: 'none' }}>
      {options.map((opt) => {
        const sel = value.includes(opt.value)
        return (
          <button key={opt.value} className={`ms-opt${sel ? ' ms-sel' : ''}`} onClick={() => toggle(opt.value)}>
            <span className={`ms-check${sel ? ' ms-on' : ''}`}>
              {sel && <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </span>
            {opt.avatar && <Avatar name={opt.avatar.name} url={opt.avatar.url} />}
            {opt.color && !opt.avatar && (
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
            {opt.meta && <span className="ms-meta">{opt.meta}</span>}
          </button>
        )
      })}
    </div>
  )

  return (
    <>
      <style>{MS_STYLES}</style>
      <div ref={containerRef} style={{ position: 'relative' }} className={className}>
        <div
          id={id}
          className={`ms-box${open ? ' ms-open' : ''}`}
          onClick={() => setOpen((o) => !o)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) }
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label ?? placeholder}
        >
          <div className="ms-chips">
            {!hasValue
              ? <span style={{ fontSize: 13, color: '#888', padding: '1px 2px' }}>{placeholder}</span>
              : selectedOptions.map((opt) => (
                <span
                  key={opt.value}
                  className="ms-chip"
                  style={opt.color ? { background: opt.color + '22', color: opt.color } : undefined}
                >
                  {opt.avatar && <Avatar name={opt.avatar.name} url={opt.avatar.url} chip />}
                  {opt.color && !opt.avatar && (
                    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.chipLabel ?? opt.label}</span>
                  <button
                    className="ms-chip-rm"
                    style={opt.color ? { color: opt.color } : undefined}
                    onClick={(e) => { e.stopPropagation(); toggle(opt.value) }}
                    aria-label={`Remove ${opt.label}`}
                  >
                    ×
                  </button>
                </span>
              ))
            }
          </div>
          <div className="ms-chevron">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {open && (
          <div className="ms-dropdown" style={{ maxWidth: dropdownWidth }}>
            {/* "All / clear" header */}
            <div style={{ padding: '4px 0 2px' }}>
              {!single && hasValue ? (
                <button className="ms-clear" onClick={clearAll}>
                  <span style={{ width: 16 }} />
                  Clear all ({value.length} selected)
                </button>
              ) : (
                <button className={`ms-opt${!hasValue ? ' ms-sel' : ''}`} onClick={clearAll}>
                  <span className={`ms-check${!hasValue ? ' ms-on' : ''}`}>
                    {!hasValue && <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </span>
                  {placeholder}
                </button>
              )}
              {topActions?.(close)}
            </div>
            <div className="ms-divider" />
            {list}
            <div style={{ height: 4 }} />
          </div>
        )}
      </div>
    </>
  )
}
