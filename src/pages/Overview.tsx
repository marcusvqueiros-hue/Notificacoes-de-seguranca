import { useMemo } from 'react'
import { AlarmClockOff, BadgeDollarSign, CheckCircle2, FileWarning, Hourglass, ListChecks, Receipt } from 'lucide-react'
import { useStore } from '../lib/store'
import { useData, usePal } from '../lib/hooks'
import { groupBy, monthly, sortDesc } from '../lib/aggregate'
import { areaOption, columnOption, hbarOption, stackedOption } from '../lib/charts'
import { buildInsights } from '../lib/insights'
import { fmtBRL, fmtDate, fmtNum, short } from '../lib/format'
import { Chart } from '../components/Chart'
import { KpiCard, Panel } from '../components/ui'
import { InsightList } from '../components/InsightList'
import { DataTable, type Col } from '../components/DataTable'
import { hojeIso, resumoVencidas, type Vencida } from '../lib/prazo'
import type { Notificacao } from '../lib/types'

/** Altura do gráfico de ranking: uma linha por item (todas as barras visíveis, o painel rola). */
const ROW_H = 30
const RANK_MAX = 520 // altura máxima do painel antes de rolar
const rankH = (n: number) => Math.max(200, n * ROW_H + 8)

export const Badge = ({ ok }: { ok: boolean }) => (
  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${ok ? 'bg-good/15 text-good' : 'bg-bad/15 text-bad'}`}>{ok ? 'SIM' : 'NÃO'}</span>
)

export function Overview() {
  const { filtered, k, filters, except } = useData()
  const toggle = useStore((s) => s.toggleFilter)
  const setPage = useStore((s) => s.setPage)
  const setFilter = useStore((s) => s.setFilter)
  const isAdmin = useStore((s) => s.session?.role === 'admin')
  const p = usePal()

  const m = useMemo(() => monthly(filtered), [filtered])
  const mAll = useMemo(() => monthly(except('mes')), [except])
  const ger = useMemo(() => sortDesc(groupBy(except('gerencia'), (n) => n.gerencia)), [except])
  const base = useMemo(() => sortDesc(groupBy(except('base'), (n) => n.base)), [except])
  const gerV = useMemo(() => sortDesc(groupBy(except('gerencia'), (n) => n.gerencia), 'valor'), [except])
  const baseV = useMemo(() => sortDesc(groupBy(except('base'), (n) => n.base), 'valor'), [except])
  const nc = useMemo(() => sortDesc(groupBy(except('naoConformidade'), (n) => n.naoConformidade)), [except])
  const eq = useMemo(() => sortDesc(groupBy(except('equipe'), (n) => n.equipe)), [except])
  const insights = useMemo(() => buildInsights(filtered).slice(0, 4), [filtered])

  const hoje = hojeIso()
  const venc = useMemo(() => resumoVencidas(filtered, hoje), [filtered, hoje])
  const vencCols: Col<Vencida>[] = [
    { key: 'n', label: 'Nº', render: (r) => r.notificacao ?? '—', sort: (r) => r.notificacao ?? 0, total: `${fmtNum(venc.list.length)} vencidas` },
    { key: 'eq', label: 'Equipe', render: (r) => r.equipe, sort: (r) => r.equipe },
    { key: 'b', label: 'Base', render: (r) => r.base, sort: (r) => r.base },
    { key: 'nc', label: 'Não conformidade', render: (r) => <span title={r.naoConformidade}>{short(r.naoConformidade, 70)}</span> },
    { key: 'l', label: 'Lançamento', align: 'center', render: (r) => fmtDate(r.lancamento), sort: (r) => r.lancamento },
    { key: 'v', label: 'Venceu em', align: 'center', render: (r) => fmtDate(r.vencimento), sort: (r) => r.vencimento },
    { key: 'a', label: 'Atraso', align: 'center', render: (r) => <span className="inline-flex rounded-full bg-bad/15 px-2 py-0.5 text-[11px] font-bold text-bad">{r.atraso} {r.atraso === 1 ? 'dia útil' : 'dias úteis'}</span>, sort: (r) => r.atraso },
    { key: 'm', label: 'Multa', align: 'right', render: (r) => fmtBRL(r.valor), sort: (r) => r.valor, total: fmtBRL(venc.list.reduce((a, r) => a + r.valor, 0)) },
  ]

  const labels = mAll.map((x) => x.mes)
  const cols: Col<Notificacao>[] = [
    { key: 'n', label: 'Nº', render: (r) => r.notificacao ?? '—', sort: (r) => r.notificacao ?? 0, total: fmtNum(k.notifs) },
    { key: 'data', label: 'Data', render: (r) => fmtDate(r.data), sort: (r) => r.data },
    { key: 'equipe', label: 'Equipe', render: (r) => r.equipe, sort: (r) => r.equipe },
    { key: 'base', label: 'Base', render: (r) => r.base, sort: (r) => r.base },
    { key: 'ger', label: 'Gerência', render: (r) => r.gerencia, sort: (r) => r.gerencia },
    { key: 'nc', label: 'Não conformidade', render: (r) => <span title={r.naoConformidade}>{short(r.naoConformidade, 80)}</span> },
    { key: 'valor', label: 'Multa', align: 'right', render: (r) => fmtBRL(r.valor), sort: (r) => r.valor, total: fmtBRL(k.valor) },
    { key: 'trat', label: 'Tratado', align: 'center', render: (r) => <Badge ok={r.tratado} />, sort: (r) => (r.tratado ? 1 : 0) },
  ]

  return (
    <div className="mx-auto max-w-[1700px] space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard delay={0} label="Notificações" value={k.notifs} format={fmtNum} icon={<ListChecks size={17} />} color={p.brand} spark={m.map((x) => x.notifs)} hint="documentos distintos" />
        <KpiCard delay={0.05} label="Total de multas" value={k.valor} format={fmtBRL} icon={<BadgeDollarSign size={17} />} color={p.warn} spark={m.map((x) => x.valor)} hint="valor acumulado" />
        <KpiCard delay={0.1} label="Itens notificados" value={k.itens} format={fmtNum} icon={<FileWarning size={17} />} color="#8b5cf6" spark={m.map((x) => x.itens)} hint="não conformidades" />
        <KpiCard delay={0.15} label="Tratados" value={k.tratados} format={fmtNum} icon={<CheckCircle2 size={17} />} color={p.good} spark={m.map((x) => x.tratados)} hint={`${(k.pctTratado * 100).toFixed(1).replace('.', ',')}% do total`} onClick={() => setFilter('tratado', filters.tratado.includes('Tratado') ? [] : ['Tratado'])} active={filters.tratado.includes('Tratado')} />
        <KpiCard delay={0.2} label="Em tratamento" value={k.abertos} format={fmtNum} icon={<Hourglass size={17} />} color={p.accent} spark={m.map((x) => x.abertos)} hint="aguardando resposta" onClick={() => setFilter('tratado', filters.tratado.includes('Em tratamento') ? [] : ['Em tratamento'])} active={filters.tratado.includes('Em tratamento')} />
        <KpiCard delay={0.25} label="Multa média / item" value={k.ticket} format={fmtBRL} icon={<Receipt size={17} />} color="#06b6d4" hint="ticket médio" />
      </div>

      <Panel
        title="Notificações vencidas"
        subtitle="Em tratamento com o prazo vencido · dias úteis a partir da data de lançamento, sem fins de semana e feriados nacionais"
        className={venc.list.length ? 'border-bad/40' : ''}
        action={
          <div className="flex items-center gap-2" data-snap-ignore="1">
            {isAdmin && <button className="text-xs font-semibold text-brand hover:underline" onClick={() => setPage('records')}>Abrir Notificações →</button>}
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${venc.list.length ? 'bg-bad/15 text-bad' : 'bg-good/15 text-good'}`}>
              <AlarmClockOff size={13} /> {venc.list.length ? `${fmtNum(venc.list.length)} ${venc.list.length === 1 ? 'vencida' : 'vencidas'}` : 'Nenhuma vencida'}
            </span>
          </div>
        }
      >
        {venc.list.length > 0 ? (
          <DataTable rows={venc.list} cols={vencCols} rowKey={(r) => r.key} pageSize={5} defaultSort={{ key: 'a', dir: 'desc' }} />
        ) : (
          <p className="px-3 py-4 text-sm text-muted">Nenhuma notificação em tratamento está com o prazo vencido.</p>
        )}
        {venc.semPrazo > 0 && (
          <p className="px-3 pb-2 text-[11px] text-muted">
            {fmtNum(venc.semPrazo)} {venc.semPrazo === 1 ? 'item em tratamento está' : 'itens em tratamento estão'} sem data de lançamento ou prazo e não entram nesta conta.
          </p>
        )}
      </Panel>

      {insights.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold">Insights automáticos</h2>
            <button data-snap-ignore="1" className="text-xs font-semibold text-brand hover:underline" onClick={() => setPage('insights')}>Ver todos →</button>
          </div>
          <InsightList items={insights} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Quantidade de notificações por mês" subtitle="Itens notificados · clique para filtrar o mês" delay={0.05}>
          <Chart height={250} option={areaOption(p, labels, mAll.map((x) => x.itens), filters.mes, fmtNum, p.brand, 'Itens')} onPick={(n) => toggle('mes', n)} />
        </Panel>
        <Panel title="Valor de multa por mês" subtitle="R$ acumulado no mês" delay={0.1}>
          <Chart height={250} option={areaOption(p, labels, mAll.map((x) => x.valor), filters.mes, (v) => fmtBRL(v), p.accent, 'Multa')} onPick={(n) => toggle('mes', n)} />
        </Panel>
        <Panel title="Notificações por gerência" subtitle="Tratados × em tratamento" delay={0.05}>
          <Chart height={270} option={stackedOption(p, ger, filters.gerencia)} onPick={(n) => toggle('gerencia', n)} />
        </Panel>
        <Panel title="Notificações por base" subtitle="Tratados × em tratamento" delay={0.1}>
          <Chart height={270} option={stackedOption(p, base, filters.base)} onPick={(n) => toggle('base', n)} />
        </Panel>
        <Panel title="Valor de multa por gerência" delay={0.05}>
          <Chart height={250} option={columnOption(p, gerV, 'valor', filters.gerencia)} onPick={(n) => toggle('gerencia', n)} />
        </Panel>
        <Panel title="Valor de multa por base" delay={0.1}>
          <Chart height={250} option={columnOption(p, baseV, 'valor', filters.base, p.warn)} onPick={(n) => toggle('base', n)} />
        </Panel>
        <Panel title="Ranking de não conformidades" subtitle={`Por quantidade de itens · ${fmtNum(nc.length)} não conformidades${rankH(nc.length) > RANK_MAX ? ' · role para ver todas' : ''}`} delay={0.05}>
          <div className="max-h-[520px] overflow-y-auto pr-1">
            <Chart height={rankH(nc.length)} option={hbarOption(p, nc, 'itens', filters.naoConformidade, nc.length, p.brand, 44)} onPick={(n) => toggle('naoConformidade', nc.find((x) => x.key === n)?.key ?? n)} />
          </div>
        </Panel>
        <Panel title="Ranking de notificações por equipe" subtitle={`Por quantidade de itens · ${fmtNum(eq.length)} equipes${rankH(eq.length) > RANK_MAX ? ' · role para ver todas' : ''}`} delay={0.1}>
          <div className="max-h-[520px] overflow-y-auto pr-1">
            <Chart height={rankH(eq.length)} option={hbarOption(p, eq, 'itens', filters.equipe, eq.length, '#8b5cf6')} onPick={(n) => toggle('equipe', n)} />
          </div>
        </Panel>
      </div>

      <Panel title="Estratificação de notificações" subtitle={`${fmtNum(filtered.length)} registros · clique nos cabeçalhos para ordenar`}>
        <DataTable rows={filtered} cols={cols} rowKey={(r) => r.id} pageSize={10} defaultSort={{ key: 'data', dir: 'desc' }} />
      </Panel>
    </div>
  )
}
