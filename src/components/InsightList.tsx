import { motion } from 'motion/react'
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, MousePointerClick } from 'lucide-react'
import type { Insight } from '../lib/insights'
import { useStore } from '../lib/store'

const TONE = {
  alert: { icon: <AlertOctagon size={16} />, c: 'var(--bad)' },
  warn: { icon: <AlertTriangle size={16} />, c: 'var(--warn)' },
  good: { icon: <CheckCircle2 size={16} />, c: 'var(--good)' },
  info: { icon: <Info size={16} />, c: 'var(--info)' },
}

export function InsightList({ items, cols = 'md:grid-cols-2 2xl:grid-cols-4' }: { items: Insight[]; cols?: string }) {
  const setFilter = useStore((s) => s.setFilter)
  const filters = useStore((s) => s.filters)
  return (
    <div className={`grid grid-cols-1 gap-3 ${cols}`}>
      {items.map((it, i) => {
        const t = TONE[it.tone]
        const f = it.filter
        const apply = () => {
          if (!f) return
          const k = f.key === 'tratado' ? 'tratado' : f.key
          setFilter(k, filters[k].includes(f.value) ? [] : [f.value])
        }
        return (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={apply}
            className={`card relative overflow-hidden p-4 ${f ? 'cursor-pointer transition hover:-translate-y-0.5' : ''}`}
          >
            <span className="absolute inset-y-0 left-0 w-1" style={{ background: t.c }} />
            <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: t.c }}>
              {t.icon}
              <span className="text-ink">{it.title}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{it.text}</p>
            {f && <span data-snap-ignore="1" className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-brand"><MousePointerClick size={11} /> Clique para filtrar</span>}
          </motion.div>
        )
      })}
    </div>
  )
}
