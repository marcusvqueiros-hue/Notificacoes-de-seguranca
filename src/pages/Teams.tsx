import { useMemo } from 'react'
import { Users, BadgeDollarSign, FileWarning, Repeat } from 'lucide-react'
import { useStore } from '../lib/store'
import { useData, usePal } from '../lib/hooks'
import { groupBy, monthly, sortDesc, type Group } from '../lib/aggregate'
import { areaOption, hbarOption } from '../lib/charts'
import { fmtBRL, fmtDate, fmtNum, fmtPct, short } from '../lib/format'
import { Chart } from '../components/Chart'
import { KpiCard, Panel } from '../components/ui'
import { DataTable, type Col } from '../components/DataTable'
import { Badge } from './Overview'
import type { Notificacao } from '../lib/types'

export function Teams() {
  const { filtered, k, filters, except } = useData()
  const toggle = useStore((s) => s.toggleFilter)
  const p = usePal()
  const teams = useMemo(() => sortDesc(groupBy(except('equipe'), (n) => n.equipe), 'valor'), [except])
  const m = useMemo(() => monthly(except('mes')), [except])
  const nc = useMemo(() => sortDesc(groupBy(except('naoConformidade'), (n) => n.naoConformidade), 'valor'), [except])
  const rein = teams.filter((t) => t.notifs >= 3).length
  const maxV = Math.max(1, ...teams.map((t) => t.valor))
  const detail = filters.equipe.length ? filtered : []

  const cols: Col<Group>[] = [
    { key: 'eq', label: 'Equipe', render: (g) => <b>{g.key}</b>, sort: (g) => g.key, total: `${teams.length} equipes` },
    { key: 'it', label: 'Qnt de itens', align: 'center', render: (g) => g.itens, sort: (g) => g.itens, total: fmtNum(k.itens) },
    { key: 'nt', label: 'Notificações', align: 'center', render: (g) => g.notifs, sort: (g) => g.notifs },
    { key: 'tr', label: '% tratado', align: 'center', render: (g) => fmtPct(g.tratados / g.itens), sort: (g) => g.tratados / g.itens },
    {
      key: 'v', label: 'Total de multas', width: '34%', sort: (g) => g.valor, total: fmtBRL(k.valor),
      render: (g) => (
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line/60">
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent" style={{ width: `${(g.valor / maxV) * 100}%` }} />
          </div>
          <span className="w-20 text-right font-semibold">{fmtBRL(g.valor)}</span>
        </div>
      ),
    },
  ]
  const dcols: Col<Notificacao>[] = [
    { key: 'd', label: 'Data', render: (r) => fmtDate(r.data), sort: (r) => r.data },
    { key: 'e', label: 'Equipe', render: (r) => r.equipe },
    { key: 'b', label: 'Base', render: (r) => r.base },
    { key: 'g', label: 'Gerência', render: (r) => r.gerencia },
    { key: 'n', label: 'Não conformidade', render: (r) => <span title={r.naoConformidade}>{short(r.naoConformidade, 90)}</span> },
    { key: 'v', label: 'Multa', align: 'right', render: (r) => fmtBRL(r.valor), sort: (r) => r.valor },
    { key: 't', label: 'Tratado', align: 'center', render: (r) => <Badge ok={r.tratado} /> },
  ]

  return (
    <div className="mx-auto max-w-[1700px] space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Equipes notificadas" value={teams.length} format={fmtNum} icon={<Users size={17} />} color={p.brand} hint="com ao menos 1 item" />
        <KpiCard delay={0.05} label="Total de multas" value={k.valor} format={fmtBRL} icon={<BadgeDollarSign size={17} />} color={p.warn} spark={m.map((x) => x.valor)} />
        <KpiCard delay={0.1} label="Itens notificados" value={k.itens} format={fmtNum} icon={<FileWarning size={17} />} color="#8b5cf6" spark={m.map((x) => x.itens)} />
        <KpiCard delay={0.15} label="Reincidentes" value={rein} format={fmtNum} icon={<Repeat size={17} />} color={p.accent} hint="3+ notificações" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Equipes por valor de multa" subtitle="Top 12 · clique para filtrar" delay={0.05}>
          <Chart height={400} option={hbarOption(p, teams, 'valor', filters.equipe, 12, p.brand)} onPick={(n) => toggle('equipe', n)} />
        </Panel>
        <div className="grid gap-4">
          <Panel title="Evolução mensal do valor" delay={0.1}>
            <Chart height={175} option={areaOption(p, m.map((x) => x.mes), m.map((x) => x.valor), filters.mes, (v) => fmtBRL(v), p.accent, 'Multa')} onPick={(n) => toggle('mes', n)} />
          </Panel>
          <Panel title="Não conformidades por valor" delay={0.15}>
            <Chart height={175} option={hbarOption(p, nc, 'valor', filters.naoConformidade, 5, p.warn, 40)} onPick={(n) => toggle('naoConformidade', n)} />
          </Panel>
        </div>
      </div>

      <Panel title="Estratificação por equipe" subtitle="Clique numa linha para filtrar a equipe e ver o detalhe abaixo">
        <DataTable rows={teams} cols={cols} rowKey={(g) => g.key} pageSize={12} defaultSort={{ key: 'v', dir: 'desc' }} onRow={(g) => toggle('equipe', g.key)} activeRow={(g) => filters.equipe.includes(g.key)} />
      </Panel>

      {detail.length > 0 && (
        <Panel title="Detalhe das notificações da seleção" subtitle={`${detail.length} registros`}>
          <DataTable rows={detail} cols={dcols} rowKey={(r) => r.id} pageSize={8} defaultSort={{ key: 'd', dir: 'desc' }} />
        </Panel>
      )}
    </div>
  )
}
