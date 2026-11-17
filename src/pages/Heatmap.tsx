import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import { useStore } from '../lib/store'
import { useData } from '../lib/hooks'
import { uniq } from '../lib/aggregate'
import { MESES, fmtNum, mesIdx } from '../lib/format'
import { Panel } from '../components/ui'

type Mode = 'colaborador' | 'equipe'
const MODES: { id: Mode; label: string }[] = [
  { id: 'colaborador', label: 'Colaborador' },
  { id: 'equipe', label: 'Equipe' },
]

const TIP_W = 360
const TIP_MAX_ITEMS = 8

/** Célula sob o mouse (ou com foco): mês (null = ano todo) e posição na tela. */
interface Tip { key: string; i: number | null; rect: DOMRect }

/** Mapa de calor: itens notificados por mês para cada colaborador (ou equipe), com filtros de base e gerência.
 *  Ao passar o mouse numa célula, mostra as não conformidades daquele colaborador/equipe no mês. */
export function Heatmap() {
  const { filters, except } = useData()
  const toggle = useStore((s) => s.toggleFilter)
  const [mode, setMode] = useState<Mode>('colaborador')
  const [baseSel, setBase] = useState('')
  const [gerSel, setGer] = useState('')
  const [q, setQ] = useState('')
  const [tip, setTip] = useState<Tip | null>(null)

  // respeita os filtros do menu lateral, exceto o da própria dimensão (as demais linhas continuam visíveis)
  const scoped = useMemo(() => except(mode), [except, mode])
  const bases = useMemo(() => uniq(scoped, 'base'), [scoped])
  const gers = useMemo(() => uniq(scoped, 'gerencia'), [scoped])
  const base = bases.includes(baseSel) ? baseSel : ''
  const ger = gers.includes(gerSel) ? gerSel : ''

  const data = useMemo(() => {
    const m = new Map<string, number[]>()
    let last = 0
    let semColab = 0
    for (const n of scoped) {
      if (base && n.base !== base) continue
      if (ger && n.gerencia !== ger) continue
      const keys = (mode === 'colaborador' ? n.eletricistas : [n.equipe]).filter(Boolean)
      if (!keys.length) { semColab++; continue }
      const i = mesIdx(n.data)
      last = Math.max(last, i)
      for (const k of keys) {
        let a = m.get(k)
        if (!a) m.set(k, (a = Array(12).fill(0)))
        a[i]++
      }
    }
    const rows = [...m.entries()]
      .map(([key, v]) => ({ key, v, total: v.reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key, 'pt-BR'))
    const max = rows.reduce((a, r) => Math.max(a, ...r.v), 0)
    return { rows, max, months: MESES.slice(0, last + 1), semColab }
  }, [scoped, mode, base, ger])

  // não conformidades da célula sob o mouse, da mais frequente para a menos
  const tipData = useMemo(() => {
    if (!tip) return null
    const m = new Map<string, number>()
    let n = 0
    for (const r of scoped) {
      if (base && r.base !== base) continue
      if (ger && r.gerencia !== ger) continue
      if (tip.i != null && mesIdx(r.data) !== tip.i) continue
      if (!(mode === 'colaborador' ? r.eletricistas.includes(tip.key) : r.equipe === tip.key)) continue
      n++
      m.set(r.naoConformidade, (m.get(r.naoConformidade) ?? 0) + 1)
    }
    const list = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    return { n, list }
  }, [tip, scoped, base, ger, mode])

  const term = q.trim().toLowerCase()
  const shown = term ? data.rows.filter((r) => r.key.toLowerCase().includes(term)) : data.rows
  const selected = filters[mode]
  const noun = mode === 'colaborador' ? 'colaboradores' : 'equipes'
  const cols = `minmax(190px, 1.6fr) repeat(${data.months.length}, minmax(36px, 1fr)) 56px`

  const show = (key: string, i: number | null) => (e: { currentTarget: HTMLElement }) => setTip({ key, i, rect: e.currentTarget.getBoundingClientRect() })
  const hide = () => setTip(null)

  // tooltip ao lado da célula; vira para a esquerda/para cima quando falta espaço
  const tipStyle = (() => {
    if (!tip) return undefined
    const { rect } = tip
    const left = rect.right + 10 + TIP_W > window.innerWidth - 8 ? Math.max(8, rect.left - 10 - TIP_W) : rect.right + 10
    return rect.top > window.innerHeight / 2
      ? { left, bottom: Math.max(8, window.innerHeight - rect.bottom) }
      : { left, top: Math.max(8, rect.top) }
  })()

  return (
    <div className="mx-auto max-w-[1700px]">
      <Panel
        title={`Mapa de calor por ${mode}`}
        subtitle={`Itens notificados por mês ao longo do ano · passe o mouse para ver as não conformidades · clique no nome para filtrar${mode === 'colaborador' ? ' · cada item conta para todos os eletricistas da equipe' : ''}`}
      >
        <div className="space-y-3 px-2 pt-2 pb-1">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <span className="mb-1 block text-xs font-semibold text-muted">Ver por</span>
              <div className="flex rounded-xl border border-line bg-surface p-1 text-xs font-semibold" role="group" aria-label="Ver mapa por">
                {MODES.map((o) => (
                  <button key={o.id} type="button" aria-pressed={mode === o.id} onClick={() => setMode(o.id)} className={`rounded-lg px-3 py-1.5 transition ${mode === o.id ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`}>{o.label}</button>
                ))}
              </div>
            </div>
            <label className="block text-xs font-semibold text-muted">
              Base
              <select className="input mt-1 min-w-36" value={base} onChange={(e) => setBase(e.target.value)}>
                <option value="">Todas</option>
                {bases.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-muted">
              Gerência
              <select className="input mt-1 min-w-36" value={ger} onChange={(e) => setGer(e.target.value)}>
                <option value="">Todas</option>
                {gers.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <div className="relative min-w-48 flex-1 md:max-w-xs">
              <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <input className="input !pl-9" placeholder={`Buscar ${mode}…`} aria-label={`Buscar ${mode}`} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="ml-auto flex items-center gap-2 text-[11px] text-muted" aria-hidden>
              menos
              <span className="h-2.5 w-24 rounded-full" style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--brand) 22%, var(--surface-2)), var(--brand))' }} />
              {data.max ? `${fmtNum(data.max)}` : 'mais'}
            </div>
          </div>

          {!shown.length ? (
            <p className="py-10 text-center text-sm text-muted">Nenhum {mode} com notificações nesta seleção.</p>
          ) : (
            <div className="max-h-[max(420px,calc(100vh-320px))] overflow-auto rounded-xl border border-line" role="table" aria-label={`Itens notificados por mês, por ${mode}`} onScroll={hide} onMouseLeave={hide}>
              <div className="min-w-max" style={{ minWidth: 190 + data.months.length * 36 + 56 }}>
                <div role="row" className="sticky top-0 z-20 grid gap-1 border-b border-line bg-surface px-2 py-2 text-[11px] font-semibold text-muted" style={{ gridTemplateColumns: cols }}>
                  <div role="columnheader" className="sticky left-0 z-10 bg-surface pl-1 capitalize">{mode}</div>
                  {data.months.map((m) => <div role="columnheader" key={m} className="text-center">{m}</div>)}
                  <div role="columnheader" className="text-center">Total</div>
                </div>
                <div className="space-y-1 p-2">
                  {shown.map((r) => {
                    const on = selected.includes(r.key)
                    return (
                      <div role="row" key={r.key} className="grid items-center gap-1" style={{ gridTemplateColumns: cols }}>
                        <button
                          type="button"
                          role="rowheader"
                          onClick={() => toggle(mode, r.key)}
                          aria-pressed={on}
                          title={`${r.key} — clique para filtrar`}
                          className={`sticky left-0 z-10 truncate rounded-md px-1.5 py-1 text-left text-xs font-semibold transition hover:text-brand ${on ? 'bg-brand/15 text-brand' : 'bg-surface text-ink'}`}
                        >
                          {r.key}
                        </button>
                        {data.months.map((m, i) => {
                          const c = r.v[i]
                          const t = data.max ? c / data.max : 0
                          return (
                            <div
                              role="cell"
                              key={m}
                              tabIndex={c ? 0 : undefined}
                              aria-label={c ? `${r.key}, ${m}: ${fmtNum(c)} ${c === 1 ? 'item' : 'itens'}` : undefined}
                              onMouseEnter={c ? show(r.key, i) : undefined}
                              onMouseLeave={c ? hide : undefined}
                              onFocus={c ? show(r.key, i) : undefined}
                              onBlur={c ? hide : undefined}
                              className={`grid h-7 place-items-center rounded-md bg-surface2 text-[11px] font-semibold tabular-nums ${c ? 'cursor-help outline-none transition hover:ring-2 hover:ring-ink/60 focus-visible:ring-2 focus-visible:ring-ink/60' : ''}`}
                              style={c ? { background: `color-mix(in srgb, var(--brand) ${Math.round(22 + 78 * t)}%, var(--surface-2))`, color: t > 0.55 ? '#fff' : undefined } : undefined}
                            >
                              {c || ''}
                            </div>
                          )
                        })}
                        <div
                          role="cell"
                          tabIndex={0}
                          aria-label={`${r.key}, ano todo: ${fmtNum(r.total)} ${r.total === 1 ? 'item' : 'itens'}`}
                          onMouseEnter={show(r.key, null)}
                          onMouseLeave={hide}
                          onFocus={show(r.key, null)}
                          onBlur={hide}
                          className="cursor-help rounded-md py-1 text-center text-xs font-bold tabular-nums outline-none hover:bg-surface2 focus-visible:bg-surface2"
                        >
                          {fmtNum(r.total)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          <p className="text-[11px] text-muted">
            {fmtNum(shown.length)} de {fmtNum(data.rows.length)} {noun}
            {mode === 'colaborador' && data.semColab > 0 && <> · {fmtNum(data.semColab)} itens sem colaborador cadastrado não aparecem aqui</>}
          </p>
        </div>
      </Panel>

      {tip && tipData && tipStyle && createPortal(
        <div role="tooltip" style={{ ...tipStyle, width: TIP_W }} className="pointer-events-none fixed z-[60] rounded-xl border border-line bg-surface p-3 text-xs shadow-2xl">
          <p className="font-display text-sm font-bold leading-tight">{tip.key}</p>
          <p className="mb-2 text-[11px] text-muted">
            {tip.i != null ? MESES[tip.i] : 'Ano todo'} · {fmtNum(tipData.n)} {tipData.n === 1 ? 'item notificado' : 'itens notificados'} · {fmtNum(tipData.list.length)} {tipData.list.length === 1 ? 'não conformidade' : 'não conformidades'}
          </p>
          <ul className="space-y-1.5">
            {tipData.list.slice(0, TIP_MAX_ITEMS).map(([nc, n]) => (
              <li key={nc} className="flex items-start gap-2">
                <span className="mt-px min-w-6 shrink-0 rounded-md bg-brand/15 px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums text-brand">{n}×</span>
                <span className="leading-snug">{nc}</span>
              </li>
            ))}
          </ul>
          {tipData.list.length > TIP_MAX_ITEMS && <p className="mt-2 text-[11px] text-muted">+ {tipData.list.length - TIP_MAX_ITEMS} outras não conformidades</p>}
        </div>,
        document.body,
      )}
    </div>
  )
}
