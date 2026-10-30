import type { ReactNode } from 'react'
import { BadgeDollarSign, CheckCircle2, FileWarning, Hourglass, ListChecks, Receipt } from 'lucide-react'
import type { Notificacao } from '../lib/types'
import { groupBy, kpis, monthly, sortDesc } from '../lib/aggregate'
import { areaOption, hbarOption, stackedOption } from '../lib/charts'
import { fmtBRL, fmtNum } from '../lib/format'
import { usePal } from '../lib/hooks'
import { Chart } from './Chart'

export type PanelDim = 'coordenador' | 'base' | 'gerencia' | null

const still = <T extends object>(o: T) => ({ ...o, animation: false })

function Cell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card flex min-h-0 min-w-0 flex-col overflow-hidden">
      <h3 className="px-4 pt-3 font-display text-[15px] font-semibold">{title}</h3>
      <div className="min-h-0 flex-1 px-2 pb-2">{children}</div>
    </section>
  )
}

function Kpi({ label, value, icon, color }: { label: string; value: string; icon: ReactNode; color: string }) {
  return (
    <div className="card relative flex items-center gap-4 overflow-hidden px-5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold tracking-wider text-muted uppercase">{label}</div>
        <div className="font-display text-[30px] leading-tight font-bold whitespace-nowrap">{value}</div>
      </div>
    </div>
  )
}

/** Painel completo em um único quadro 16:9 (1920×1080), renderizado fora da tela para fotografia. */
export function SlidePanel({ rows, title, subtitle, dim, logo }: { rows: Notificacao[]; title: string; subtitle: string; dim: PanelDim; logo: string }) {
  const p = usePal()
  const k = kpis(rows)
  const m = monthly(rows)
  const labels = m.map((x) => x.mes)
  const nc = sortDesc(groupBy(rows, (n) => n.naoConformidade))
  const eq = sortDesc(groupBy(rows, (n) => n.equipe))
  const ger = sortDesc(groupBy(rows, (n) => n.gerencia))
  const base = sortDesc(groupBy(rows, (n) => n.base))
  const coord = sortDesc(groupBy(rows, (n) => n.coordenador), 'valor')
  const now = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

  return (
    <div className="flex h-full w-full flex-col gap-3.5 px-10 py-8" style={{ background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
      <header className="flex h-[76px] shrink-0 items-center justify-between">
        <img src={logo} alt="CGB" style={{ height: 58, width: 'auto' }} />
        <div className="text-right">
          <div className="font-display text-[34px] leading-none font-bold">{title}</div>
          <div className="mt-1.5 text-[16px] text-muted">{subtitle}</div>
        </div>
      </header>
      <div className="h-[2px] shrink-0 rounded" style={{ background: 'linear-gradient(90deg, var(--brand-2), var(--accent))' }} />
      <div className="grid h-[96px] shrink-0 grid-cols-6 gap-3.5">
        <Kpi label="Notificações" value={fmtNum(k.notifs)} icon={<ListChecks size={24} />} color={p.brand} />
        <Kpi label="Total de multas" value={fmtBRL(k.valor)} icon={<BadgeDollarSign size={24} />} color={p.warn} />
        <Kpi label="Itens notificados" value={fmtNum(k.itens)} icon={<FileWarning size={24} />} color="#8b5cf6" />
        <Kpi label="Tratados" value={fmtNum(k.tratados)} icon={<CheckCircle2 size={24} />} color={p.good} />
        <Kpi label="Em tratamento" value={fmtNum(k.abertos)} icon={<Hourglass size={24} />} color={p.accent} />
        <Kpi label="Multa média / item" value={fmtBRL(k.ticket)} icon={<Receipt size={24} />} color="#06b6d4" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-3.5">
        <Cell title="Quantidade de notificações por mês">
          <Chart height="100%" option={still(areaOption(p, labels, m.map((x) => x.itens), [], fmtNum, p.brand, 'Itens'))} />
        </Cell>
        <Cell title="Valor de multa por mês">
          <Chart height="100%" option={still(areaOption(p, labels, m.map((x) => x.valor), [], (v) => fmtBRL(v), p.accent, 'Multa'))} />
        </Cell>
        <Cell title="Ranking de não conformidades (itens)">
          <Chart height="100%" option={still(hbarOption(p, nc, 'itens', [], 7, p.brand, 46))} />
        </Cell>
        {dim === 'gerencia' ? (
          <Cell title="Valor de multa por coordenador">
            <Chart height="100%" option={still(hbarOption(p, coord, 'valor', [], 7, p.warn, 30))} />
          </Cell>
        ) : (
          <Cell title="Notificações por gerência">
            <Chart height="100%" option={still(stackedOption(p, ger, []))} />
          </Cell>
        )}
        {dim === 'base' ? (
          <Cell title="Valor de multa por coordenador">
            <Chart height="100%" option={still(hbarOption(p, coord, 'valor', [], 7, p.warn, 30))} />
          </Cell>
        ) : (
          <Cell title="Notificações por base">
            <Chart height="100%" option={still(stackedOption(p, base, []))} />
          </Cell>
        )}
        <Cell title="Ranking de notificações por equipe (itens)">
          <Chart height="100%" option={still(hbarOption(p, eq, 'itens', [], 7, '#8b5cf6', 30))} />
        </Cell>
      </div>
      <footer className="flex h-5 shrink-0 items-center justify-between text-[13px] text-muted">
        <span>Notificações CGB · gerado em {now} · Desenvolvido por Marcus Vinicius Silva Queiros</span>
        <span>{fmtNum(rows.length)} itens analisados</span>
      </footer>
    </div>
  )
}
