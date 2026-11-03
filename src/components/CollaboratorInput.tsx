import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Plus, UserPlus, X } from 'lucide-react'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
export const MAX_COLLAB = 7

interface Props {
  value: string[]
  onChange: (v: string[]) => void
  /** colaboradores já conhecidos (autocomplete) */
  options: string[]
}

/** Campo de colaboradores com autocomplete e opção de cadastrar um nome novo quando não existir. */
export function CollaboratorInput({ value, onChange, options }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const known = useMemo(() => new Set(options.map(norm)), [options])
  const chosen = useMemo(() => new Set(value.map(norm)), [value])

  const nq = norm(q)
  const matches = useMemo(() => {
    const starts: string[] = []
    const inside: string[] = []
    for (const o of options) {
      const n = norm(o)
      if (chosen.has(n)) continue
      if (!nq) starts.push(o)
      else if (n.startsWith(nq) || n.split(' ').some((w) => w.startsWith(nq))) starts.push(o)
      else if (n.includes(nq)) inside.push(o)
      if (starts.length >= 8) break
    }
    return [...starts, ...inside].slice(0, 8)
  }, [nq, options, chosen])
  const canCreate = nq.length >= 3 && !known.has(nq) && !chosen.has(nq)
  const items: { label: string; create?: boolean }[] = [
    ...matches.map((label) => ({ label })),
    ...(canCreate ? [{ label: q.trim().toUpperCase(), create: true }] : []),
  ]
  const full = value.length >= MAX_COLLAB

  function add(name: string) {
    const n = name.trim().toUpperCase()
    if (!n || full || chosen.has(norm(n))) return
    onChange([...value, n])
    setQ('')
    setHi(0)
    input.current?.focus()
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { if (open && items[hi]) { e.preventDefault(); add(items[hi].label) } else if (q) e.preventDefault() }
    else if (e.key === 'Escape') { if (open) { e.stopPropagation(); setOpen(false) } }
    else if (e.key === 'Backspace' && !q && value.length) onChange(value.slice(0, -1))
  }

  return (
    <div className="relative">
      <div
        className="input flex min-h-[2.6rem] flex-wrap items-center gap-1.5 !py-1.5"
        onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); input.current?.focus() } }}
      >
        {value.map((v) => {
          const isNew = !known.has(norm(v))
          return (
            <span key={v} className={`inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-[11px] font-semibold ${isNew ? 'bg-accent/20 text-warn' : 'bg-brand/15 text-brand'}`}>
              {v}
              {isNew && <em className="text-[9px] font-bold uppercase not-italic opacity-80">novo</em>}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="grid h-4 w-4 place-items-center rounded-full hover:bg-black/15" aria-label={`Remover ${v}`}><X size={11} /></button>
            </span>
          )
        })}
        <input
          ref={input}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-label="Adicionar colaborador"
          value={q}
          disabled={full}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKey}
          placeholder={full ? `Máximo de ${MAX_COLLAB} colaboradores` : value.length ? 'Adicionar outro…' : 'Digite o nome do colaborador…'}
          className="min-w-40 flex-1 bg-transparent py-1 text-sm outline-none"
        />
      </div>
      {open && !full && items.length > 0 && (
        <ul role="listbox" className="card absolute z-20 mt-1 max-h-64 w-full overflow-auto p-1 text-sm shadow-xl">
          {items.map((it, i) => (
            <li
              key={(it.create ? '+' : '') + it.label}
              role="option"
              aria-selected={i === hi}
              onMouseDown={(e) => { e.preventDefault(); add(it.label) }}
              onMouseEnter={() => setHi(i)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 ${i === hi ? 'bg-brand/10' : ''} ${it.create ? 'font-semibold text-brand' : ''}`}
            >
              {it.create ? <><UserPlus size={15} /> Cadastrar novo colaborador “{it.label}”</> : <><Plus size={13} className="text-muted" /> {it.label}</>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[11px] text-muted">{value.length}/{MAX_COLLAB} · escolha na lista ou, se o colaborador não existir, use “Cadastrar novo colaborador”.</p>
    </div>
  )
}
