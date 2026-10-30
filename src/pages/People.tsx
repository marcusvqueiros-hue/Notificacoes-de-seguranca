import { useMemo } from 'react'
import { UserRound, BadgeDollarSign, FileWarning, Calculator } from 'lucide-react'
import { useStore } from '../lib/store'
import { useData, usePal } from '../lib/hooks'
import { groupBy, sortDesc, uniq, type Group } from '../lib/aggregate'
import { areaOption, hbarOption } from '../lib/charts'
import { MESES, fmtBRL, fmtNum, mesIdx, short } from '../lib/format'
import { Chart } from '../components/Chart'
import { KpiCard, Panel } from '../components/ui'
import { DataTable, type Col } from '../components/DataTable'

interface Pair { id: string; colaborador: string; nc: string; itens: number; valor: number }

export function People() {
  const { rows, filtered, filters, except } = useData()
  const toggle = useStore((s) => s.toggleFilter)
  const setFilter = useStore((s) => s.setFilter)
  const p = usePal()

  // cada item é atribuído a todos os eletricistas da equipe (como na planilha original)
  const peopleAll = useMemo(() => sortDesc(groupBy(except('colaborador'), (n) => n.eletricistas), 'valor'), [except])
  const sel = filters.colaborador
  const people = useMemo(() => (sel.length ? peopleAll.filter((g) => sel.includes(g.key)) : peopleAll), [peopleAll, sel])
  const pairs = useMemo<Pair[]>(() => {
    const m = new Map<string, Pair>()
    for (const n of filtered)
      for (const c of n.eletricistas) {
        if (sel.length && !sel.includes(c)) continue
        const id = `${c}|${n.naoConformidade}`
        const e = m.get(id) ?? { id, colaborador: c, nc: n.naoConformidade, itens: 0, valor: 0 }
        e.itens += n.qnt
        e.valor += n.valor
        m.set(id, e)
      }
    return [...m.values()].sort((a, b) => b.valor - a.valor)
  }, [filtered, sel])
  const monthly = useMemo(() => {
    const itens = Array(12).fill(0)
    const valor = Array(12).fill(0)
    for (const n of filtered)
      for (const c of n.eletricistas) if (!sel.length || sel.includes(c)) { itens[mesIdx(n.data)] += 1; valor[mesIdx(n.data)] += n.valor }
    const last = Math.max(0, itens.reduce((a, v, i) => (v ? i : a), 0))
    return { labels: MESES.slice(0, last + 1), itens: itens.slice(0, last + 1), valor: valor.slice(0, last + 1) }
  }, [filtered, sel])

  const totalItens = people.reduce((a, g) => a + g.itens, 0)
  const totalValor = people.reduce((a, g) => a + g.valor, 0)
  const ncOptions = useMemo(() => uniq(rows, 'naoConformidade'), [rows])

  const pcols: Col<Group>[] = [
    { key: 'c', label: 'Colaborador', render: (g) => g.key, sort: (g) => g.key, total: `${people.length} colaboradores` },
    { key: 'n', label: 'Notificações', align: 'center', render: (g) => g.notifs, sort: (g) => g.notifs },
    { key: 'i', label: 'Itens', align: 'center', render: (g) => g.itens, sort: (g) => g.itens, total: fmtNum(totalItens) },
    { key: 'v', label: 'Valor', align: 'right', render: (g) => fmtBRL(g.valor), sort: (g) => g.valor, total: fmtBRL(totalValor) },
  ]
  const xcols: Col<Pair>[] = [
    { key: 'c', label: 'Colaborador', render: (r) => r.colaborador, sort: (r) => r.colaborador },
    { key: 'nc', label: 'Não conformidade', render: (r) => <span title={r.nc}>{short(r.nc, 70)}</span>, sort: (r) => r.nc },
    { key: 'i', label: 'Qnt de itens', align: 'center', render: (r) => r.itens, sort: (r) => r.itens, total: fmtNum(totalItens) },
    { key: 'v', label: 'Valor de multas', align: 'right', render: (r) => fmtBRL(r.valor), sort: (r) => r.valor, total: fmtBRL(totalValor) },
  ]

  return (
    <div className="mx-auto max-w-[1700px] space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard label="Itens notificados" value={totalItens} format={fmtNum} icon={<FileWarning size={17} />} color={p.brand} spark={monthly.itens} hint="por colaborador" />
          <KpiCard delay={0.05} label="Valor de multas" value={totalValor} format={fmtBRL} icon={<BadgeDollarSign size={17} />} color={p.warn} spark={monthly.valor} hint="soma por colaborador" />
          <KpiCard delay={0.1} label="Colaboradores" value={people.length} format={fmtNum} icon={<UserRound size={17} />} color="#8b5cf6" hint="citados" />
          <KpiCard delay={0.15} label="Média / colaborador" value={people.length ? totalValor / people.length : 0} format={fmtBRL} icon={<Calculator size={17} />} color={p.accent} />
        </div>
        <label className="w-full text-xs font-semibold text-muted xl:w-96">
          Não conformidade
          <select className="input mt-1" value={filters.naoConformidade[0] ?? ''} onChange={(e) => setFilter('naoConformidade', e.target.value ? [e.target.value] : [])}>
            <option value="">Todas</option>
            {ncOptions.map((o) => <option key={o} value={o}>{short(o, 90)}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Itens notificados por mês" subtitle="Somados por colaborador" delay={0.05}>
          <Chart height={230} option={areaOption(p, monthly.labels, monthly.itens, filters.mes, fmtNum, p.brand, 'Itens')} onPick={(n) => toggle('mes', n)} />
        </Panel>
        <Panel title="Valor de multa por mês" delay={0.1}>
          <Chart height={230} option={areaOption(p, monthly.labels, monthly.valor, filters.mes, (v) => fmtBRL(v), p.accent, 'Multa')} onPick={(n) => toggle('mes', n)} />
        </Panel>
        <Panel title="Colaboradores com maior valor" subtitle="Top 12 · clique para filtrar" delay={0.05}>
          <Chart height={380} option={hbarOption(p, peopleAll, 'valor', filters.colaborador, 12, p.brand, 30)} onPick={(n) => toggle('colaborador', n)} />
        </Panel>
        <Panel title="Colaboradores mais reincidentes" subtitle="Por quantidade de itens" delay={0.1}>
          <Chart height={380} option={hbarOption(p, sortDesc(peopleAll, 'itens'), 'itens', filters.colaborador, 12, '#8b5cf6', 30)} onPick={(n) => toggle('colaborador', n)} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel title="Colaborador" className="xl:col-span-2">
          <DataTable rows={peopleAll} cols={pcols} rowKey={(g) => g.key} pageSize={14} defaultSort={{ key: 'v', dir: 'desc' }} onRow={(g) => toggle('colaborador', g.key)} activeRow={(g) => filters.colaborador.includes(g.key)} />
        </Panel>
        <Panel title="Colaborador × não conformidade" className="xl:col-span-3">
          <DataTable rows={pairs} cols={xcols} rowKey={(r) => r.id} pageSize={14} defaultSort={{ key: 'v', dir: 'desc' }} />
        </Panel>
      </div>
    </div>
  )
}
