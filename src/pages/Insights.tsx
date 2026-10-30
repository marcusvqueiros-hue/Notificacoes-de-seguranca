import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { useData, usePal } from '../lib/hooks'
import { groupBy, sortDesc } from '../lib/aggregate'
import { donutOption, heatOption, hbarOption, paretoOption } from '../lib/charts'
import { buildInsights } from '../lib/insights'
import { MESES, mesIdx } from '../lib/format'
import { Chart } from '../components/Chart'
import { Panel } from '../components/ui'
import { InsightList } from '../components/InsightList'

export function Insights() {
  const { filtered, filters, except } = useData()
  const toggle = useStore((s) => s.toggleFilter)
  const p = usePal()
  const [by, setBy] = useState<'valor' | 'itens'>('valor')

  const items = useMemo(() => buildInsights(filtered), [filtered])
  const nc = useMemo(() => sortDesc(groupBy(except('naoConformidade'), (n) => n.naoConformidade), 'valor'), [except])
  const proc = useMemo(() => sortDesc(groupBy(except('processo'), (n) => n.processo), by), [except, by])
  const coord = useMemo(() => sortDesc(groupBy(except('coordenador'), (n) => n.coordenador), by), [except, by])
  const insp = useMemo(() => sortDesc(groupBy(except('inspetor'), (n) => n.inspetor), 'itens'), [except])
  const sev = useMemo(() => sortDesc(groupBy(filtered, (n) => `${n.pnt} pts`), by), [filtered, by])

  const heat = useMemo(() => {
    const bases = [...new Set(filtered.map((n) => n.base))].sort()
    const last = filtered.reduce((a, n) => Math.max(a, mesIdx(n.data)), 0)
    const months = MESES.slice(0, last + 1)
    const acc = new Map<string, number>()
    for (const n of filtered) {
      const key = `${mesIdx(n.data)}|${bases.indexOf(n.base)}`
      acc.set(key, (acc.get(key) ?? 0) + (by === 'valor' ? n.valor : n.qnt))
    }
    const cells: [number, number, number][] = []
    bases.forEach((_, y) => months.forEach((_m, x) => cells.push([x, y, acc.get(`${x}|${y}`) ?? 0])))
    return { bases, months, cells }
  }, [filtered, by])

  return (
    <div className="mx-auto max-w-[1700px] space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Leituras automáticas dos dados filtrados. Clique em um insight ou gráfico para investigar.</p>
        <div className="flex rounded-xl border border-line bg-surface p-1 text-xs font-semibold">
          {(['valor', 'itens'] as const).map((v) => (
            <button key={v} onClick={() => setBy(v)} className={`rounded-lg px-3 py-1.5 transition ${by === v ? 'bg-brand text-white' : 'text-muted'}`}>{v === 'valor' ? 'R$ Valor' : 'Qtd. itens'}</button>
          ))}
        </div>
      </div>

      <InsightList items={items} cols="md:grid-cols-2 xl:grid-cols-3" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Pareto das não conformidades" subtitle="Valor de multa e % acumulado — poucas causas geram a maioria do custo" delay={0.05}>
          <Chart height={320} option={paretoOption(p, nc, filters.naoConformidade)} onPick={(n) => toggle('naoConformidade', n)} />
        </Panel>
        <Panel title="Mapa de calor · base × mês" subtitle="Onde e quando as multas se concentram" delay={0.1}>
          <Chart height={320} option={heatOption(p, heat.bases, heat.months, heat.cells, by)} />
        </Panel>
        <Panel title="Distribuição por processo" delay={0.05}>
          <Chart height={280} option={donutOption(p, proc, by, filters.processo)} onPick={(n) => toggle('processo', n)} />
        </Panel>
        <Panel title="Gravidade (pontuação do item)" subtitle="100 pts = infração gravíssima" delay={0.1}>
          <Chart height={280} option={donutOption(p, sev, by, [])} />
        </Panel>
        <Panel title="Por coordenador" delay={0.05}>
          <Chart height={300} option={hbarOption(p, coord, by, filters.coordenador, 10, p.accent)} onPick={(n) => toggle('coordenador', n)} />
        </Panel>
        <Panel title="Apontamentos por inspetor" subtitle="Quantidade de itens" delay={0.1}>
          <Chart height={300} option={hbarOption(p, insp, 'itens', filters.inspetor, 10, '#06b6d4', 28)} onPick={(n) => toggle('inspetor', n)} />
        </Panel>
      </div>
    </div>
  )
}
