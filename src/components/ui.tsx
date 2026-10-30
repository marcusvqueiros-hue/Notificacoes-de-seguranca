import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { animate, motion } from 'motion/react'
import { X } from 'lucide-react'

export function useCountUp(value: number, format: (v: number) => string) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(0)
  useEffect(() => {
    const c = animate(prev.current, value, {
      duration: 0.9,
      ease: 'easeOut',
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = format(Math.round(v))
      },
    })
    prev.current = value
    return () => c.stop()
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  return ref
}

export function Counter({ value, format }: { value: number; format: (v: number) => string }) {
  const ref = useCountUp(value, format)
  return <span ref={ref}>{format(0)}</span>
}

export function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="h-8" />
  const max = Math.max(...data, 1)
  const w = 100
  const h = 28
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - (v / max) * (h - 6)])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} opacity={0.14} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function KpiCard(p: {
  label: string
  value: number
  format: (v: number) => string
  icon: ReactNode
  color: string
  spark?: number[]
  hint?: string
  delay?: number
  onClick?: () => void
  active?: boolean
}) {
  return (
    <motion.button
      type="button"
      onClick={p.onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: p.delay ?? 0, duration: 0.45 }}
      whileHover={{ y: -3 }}
      className={`card relative overflow-hidden p-4 text-left ${p.onClick ? 'cursor-pointer' : 'cursor-default'} ${p.active ? 'ring-2 ring-brand' : ''}`}
    >
      <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-20 blur-2xl" style={{ background: p.color }} />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-muted uppercase">{p.label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${p.color} 16%, transparent)`, color: p.color }}>
          {p.icon}
        </span>
      </div>
      <div className="mt-2 font-display text-[1.45rem] leading-none whitespace-nowrap font-bold tracking-tight">
        <Counter value={p.value} format={p.format} />
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <span className="text-[11px] text-muted">{p.hint}</span>
        {p.spark && <div className="w-20 shrink-0"><Sparkline data={p.spark} color={p.color} /></div>}
      </div>
    </motion.button>
  )
}

export function Panel({
  title,
  subtitle,
  children,
  className = '',
  action,
  delay = 0,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  action?: ReactNode
  delay?: number
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45 }}
      className={`card flex min-w-0 flex-col overflow-hidden ${className}`}
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-1">
        <div>
          <h3 className="font-display text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="min-h-0 flex-1 px-2 pb-2">{children}</div>
    </motion.section>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', h)
    return () => removeEventListener('keydown', h)
  }, [open, onClose])
  // portal: o cabeçalho tem backdrop-filter, que prenderia um elemento fixed dentro dele
  return createPortal(
    <>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
            aria-label={title}
            className={`card max-h-[92vh] w-full overflow-auto ${wide ? 'max-w-3xl' : 'max-w-md'}`}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-3.5">
              <h2 className="font-display text-base font-semibold">{title}</h2>
              <button className="rounded-lg p-1 text-muted hover:bg-surface2 hover:text-ink" onClick={onClose} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </>,
    document.body,
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-muted">
      {label}
      <div className="mt-1 font-normal">{children}</div>
    </label>
  )
}

export function useDebounced<T>(v: T, ms = 200) {
  const [d, setD] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return d
}
