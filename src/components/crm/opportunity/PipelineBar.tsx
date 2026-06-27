'use client'

import { useEffect, useRef, useState } from 'react'
import { opportunityStatusBadge } from '@/lib/badges'

type OppStatus = 'open' | 'won' | 'lost' | 'stalled'
type PipelineStage = 'Send Quote' | 'Follow Up on Quote' | 'Quote Accepted' | 'Send Thank You Email'

export const STAGES: PipelineStage[] = [
  'Send Quote',
  'Follow Up on Quote',
  'Quote Accepted',
  'Send Thank You Email',
]

const PIPELINE_STYLES = `
  @keyframes pipeline-pulse {
    0%   { box-shadow: 0 0 0 0 rgba(109, 40, 217, 0.35); }
    60%  { box-shadow: 0 0 0 6px rgba(109, 40, 217, 0); }
    100% { box-shadow: 0 0 0 0 rgba(109, 40, 217, 0); }
  }
  @keyframes won-badge-pop {
    0%   { transform: scale(0.7); opacity: 0; }
    60%  { transform: scale(1.12); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes won-overlay-in {
    0%   { opacity: 0; }
    15%  { opacity: 1; }
    75%  { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes won-trophy {
    0%   { transform: scale(0.3) rotate(-15deg); opacity: 0; }
    50%  { transform: scale(1.15) rotate(4deg); opacity: 1; }
    65%  { transform: scale(1) rotate(0deg); opacity: 1; }
    85%  { transform: scale(1) rotate(0deg); opacity: 1; }
    100% { transform: scale(0.8) rotate(0deg); opacity: 0; }
  }
  @keyframes won-text {
    0%   { transform: translateY(20px); opacity: 0; }
    30%  { transform: translateY(0); opacity: 1; }
    75%  { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(-10px); opacity: 0; }
  }
  @keyframes won-subtext {
    0%   { opacity: 0; }
    45%  { opacity: 0; }
    60%  { opacity: 1; }
    80%  { opacity: 1; }
    100% { opacity: 0; }
  }
  .stage-active-glow {
    animation: pipeline-pulse 1.6s ease-out;
    box-shadow: 0 0 0 3px rgba(109, 40, 217, 0.12);
  }
  .won-badge-pop {
    animation: won-badge-pop 0.4s cubic-bezier(0.25, 1, 0.5, 1) forwards;
  }
  .won-overlay {
    animation: won-overlay-in 2.6s ease-in-out forwards;
  }
  .won-trophy-anim {
    animation: won-trophy 2.4s cubic-bezier(0.25, 1, 0.5, 1) forwards;
  }
  .won-text-anim {
    animation: won-text 2.5s ease-out forwards;
  }
  .won-subtext-anim {
    animation: won-subtext 2.6s ease-out forwards;
  }
  @media (prefers-reduced-motion: reduce) {
    .stage-active-glow,
    .won-badge-pop,
    .won-overlay,
    .won-trophy-anim,
    .won-text-anim,
    .won-subtext-anim { animation: none !important; opacity: 1; transform: none; }
  }
`

const CONFETTI_COLORS = [
  '#7c3aed', '#a78bfa', '#c4b5fd',  // purple family
  '#16a34a', '#4ade80',              // green
  '#f59e0b', '#fcd34d',              // gold
  '#ffffff',                          // white
]

function launchConfetti() {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999'
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!

  type Particle = {
    x: number; y: number
    vx: number; vy: number
    color: string
    size: number
    rotation: number
    rotationSpeed: number
    shape: 'rect' | 'circle'
    opacity: number
  }

  const cx = window.innerWidth / 2
  const cy = window.innerHeight * 0.45

  const particles: Particle[] = Array.from({ length: 120 }, () => {
    const angle = (Math.random() * Math.PI * 1.6) - Math.PI * 1.3  // mostly upward arc
    const speed = 6 + Math.random() * 14
    return {
      x: cx + (Math.random() - 0.5) * 160,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 5 + Math.random() * 9,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.25,
      shape: Math.random() > 0.4 ? 'rect' : 'circle',
      opacity: 1,
    }
  })

  const start = performance.now()
  const duration = 2400

  function frame(now: number) {
    const elapsed = now - start
    const progress = Math.min(elapsed / duration, 1)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.45  // gravity
      p.vx *= 0.99  // air resistance
      p.rotation += p.rotationSpeed
      p.opacity = Math.max(0, 1 - Math.max(0, (progress - 0.55) / 0.45))

      ctx.save()
      ctx.globalAlpha = p.opacity
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.fillStyle = p.color

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      } else {
        ctx.beginPath()
        ctx.arc(0, 0, p.size / 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    if (progress < 1) {
      requestAnimationFrame(frame)
    } else {
      canvas.remove()
    }
  }

  requestAnimationFrame(frame)
}

export function PipelineBar({
  currentStage,
  status,
  onStageClick,
  onClose,
  disabled,
  onWonAnimationComplete,
  oppName,
}: {
  currentStage: PipelineStage | null
  status: OppStatus
  onStageClick: (stage: PipelineStage) => void
  onClose: (result: 'won' | 'lost') => void
  disabled: boolean
  onWonAnimationComplete?: () => void
  oppName?: string
}) {
  const isClosed = status === 'won' || status === 'lost'
  const currentIdx = currentStage ? STAGES.indexOf(currentStage) : -1
  const prevStatusRef = useRef(status)
  const [showWonOverlay, setShowWonOverlay] = useState(false)
  const [wonBadgeKey, setWonBadgeKey] = useState(0)

  useEffect(() => {
    if (prevStatusRef.current !== 'won' && status === 'won') {
      setWonBadgeKey((k) => k + 1)

      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!prefersReduced) launchConfetti()

      setShowWonOverlay(true)
      const t = setTimeout(() => {
        setShowWonOverlay(false)
        onWonAnimationComplete?.()
      }, 2700)
      return () => clearTimeout(t)
    }
    prevStatusRef.current = status
  }, [status])

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3">
      <style dangerouslySetInnerHTML={{ __html: PIPELINE_STYLES }} />

      {/* Close Won celebration overlay */}
      {showWonOverlay && (
        <div
          className="won-overlay fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'radial-gradient(ellipse at center, rgba(22,163,74,0.18) 0%, rgba(0,0,0,0.55) 100%)' }}
          aria-live="assertive"
          aria-label="Deal won!"
        >
          <div className="won-trophy-anim text-[96px] leading-none select-none mb-4" aria-hidden="true">🏆</div>
          <div className="won-text-anim text-center">
            <div className="text-4xl font-extrabold text-white tracking-tight" style={{ textShadow: '0 2px 24px rgba(0,0,0,0.4)' }}>
              Deal Won!
            </div>
            {oppName && (
              <div className="won-subtext-anim mt-2 text-lg text-green-200 font-medium" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>
                {oppName}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-semibold text-slate-700">Pipeline Stage</span>
        {isClosed && (
          <span
            key={wonBadgeKey}
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${opportunityStatusBadge(status)} ${status === 'won' ? 'won-badge-pop' : ''}`}
          >
            {status === 'won' ? '🏆 Won' : '❌ Lost'}
          </span>
        )}
      </div>


      {/* Stage steps */}
      <div className="flex items-center gap-0 mb-4">
        {STAGES.map((stage, idx) => {
          const isActive = stage === currentStage
          const isPast = currentIdx > idx
          const isClickable = !disabled && !isClosed

          return (
            <div key={stage} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => isClickable && onStageClick(stage)}
                disabled={!isClickable}
                title={stage}
                style={{ transition: 'background-color 0.2s, color 0.2s, border-color 0.2s, transform 0.15s, box-shadow 0.2s' }}
                className={[
                  'flex-1 px-2 py-2 text-xs font-medium text-center rounded-none first:rounded-l-xl last:rounded-r-xl border relative',
                  isActive
                    ? 'bg-purple-700 text-white border-purple-700 stage-active-glow'
                    : isPast
                    ? 'bg-purple-100 text-purple-700 border-purple-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200',
                  isClickable && !isActive && !isPast ? 'hover:-translate-y-0.5 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 cursor-pointer' : '',
                  isClickable && isPast ? 'hover:bg-purple-200 cursor-pointer' : '',
                  disabled ? 'cursor-default' : '',
                ].join(' ')}
              >
                {isPast ? (
                  <span className="flex items-center justify-center gap-1">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="truncate">{stage}</span>
                  </span>
                ) : (
                  <span className="block truncate">{stage}</span>
                )}
              </button>
              {idx < STAGES.length - 1 && (
                <div className={`w-0 h-0 border-t-[16px] border-b-[16px] border-l-[10px] border-t-transparent border-b-transparent z-10 -mx-0.5 flex-shrink-0 ${
                  isPast || isActive ? 'border-l-purple-200' : 'border-l-slate-200'
                }`} style={{ transition: 'border-left-color 0.2s' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Close Won / Close Lost */}
      {!isClosed && (
        <div className="flex gap-2">
          <button
            onClick={() => !disabled && onClose('won')}
            disabled={disabled}
            style={{ transition: 'background-color 0.15s, transform 0.1s, box-shadow 0.15s' }}
            className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            🏆 Close Won
          </button>
          <button
            onClick={() => !disabled && onClose('lost')}
            disabled={disabled}
            style={{ transition: 'background-color 0.15s, transform 0.1s, box-shadow 0.15s' }}
            className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            ❌ Close Lost
          </button>
        </div>
      )}
      {isClosed && (
        <div className="flex gap-2">
          <button
            onClick={() => !disabled && onClose('won')}
            disabled={disabled}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Re-open as Open
          </button>
        </div>
      )}
    </div>
  )
}
