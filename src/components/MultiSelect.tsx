import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { short } from '../lib/format'

/** Lista suspensa com caixas de seleção: permite marcar várias opções (com busca, para listas longas). */
export function MultiSelect({ label, options, value, onChange, allLabel = 'Todas', noun = 'selecionadas', maxLabel = 60 }: {
  label: string
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
  /** texto quando nada está marcado (= sem filtro) */
  allLabel?: string
  /** plural usado no resumo, ex.: "3 selecionadas" */
  noun?: string
  maxLabel?: number
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? options.filter((o) => o.toLowerCase().includes(t)) : options
  }, [options, q])

  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o])
  const summary = value.length === 0 ? allLabel : value.length === 1 ? short(value[0], maxLabel) : `${value.length} ${noun}`

  return (
    <div ref={root} className="relative text-xs font-semibold text-muted">
      <span id={`${id}-l`}>{label}</span>
      <button
        type="button"
        className="input mt-1 flex w-full items-center justify-between gap-2 text-left font-normal"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-l ${id}-b`}
        onClick={() => setOpen((o) => !o)}
      >
        <span id={`${id}-b`} className={`min-w-0 flex-1 truncate ${value.length ? 'font-semibold text-ink' : ''}`} title={value.length === 1 ? value[0] : undefined}>{summary}</span>
        <ChevronDown size={15} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="card absolute top-full right-0 left-0 z-40 mt-1 min-w-72 p-2 font-normal shadow-2xl">
          <div className="relative mb-2">
            <Search size={13} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
            <input autoFocus className="input !py-1.5 !pl-8 text-xs" placeholder="Buscar…" aria-label={`Buscar em ${label}`} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="mb-1.5 flex items-center justify-between px-1 text-[11px]">
            <span className="text-muted">{value.length ? `${value.length} marcada${value.length > 1 ? 's' : ''}` : 'Nenhuma marcada (mostra todas)'}</span>
            <span className="flex gap-3">
              {shown.length > 0 && shown.length < 200 && q && (
                <button type="button" className="font-semibold text-brand hover:underline" onClick={() => onChange([...new Set([...value, ...shown])])}>Marcar encontradas</button>
              )}
              {value.length > 0 && <button type="button" className="font-semibold text-brand hover:underline" onClick={() => onChange([])}>Limpar</button>}
            </span>
          </div>
          <ul role="listbox" aria-multiselectable="true" aria-label={label} className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
            {shown.map((o) => {
              const on = value.includes(o)
              return (
                <li key={o} role="option" aria-selected={on}>
                  <label className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs leading-snug transition hover:bg-surface2 ${on ? 'bg-brand/10 text-ink' : 'text-ink'}`}>
                    <input type="checkbox" className="mt-0.5 shrink-0 accent-[var(--brand)]" checked={on} onChange={() => toggle(o)} />
                    <span>{o}</span>
                  </label>
                </li>
              )
            })}
            {!shown.length && <li className="px-2 py-3 text-center text-xs text-muted">Nada encontrado</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
