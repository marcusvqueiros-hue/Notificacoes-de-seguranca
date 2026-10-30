import type { Notificacao } from './types'
import { groupBy, kpis, monthly, sortDesc } from './aggregate'
import { fmtBRL, fmtNum, fmtPct, short } from './format'

export interface Insight {
  tone: 'alert' | 'warn' | 'good' | 'info'
  title: string
  text: string
  /** filtro aplicável ao clicar */
  filter?: { key: 'base' | 'equipe' | 'naoConformidade' | 'gerencia' | 'colaborador' | 'inspetor' | 'tratado'; value: string }
}

const MES_NOME: Record<string, string> = {
  jan: 'Janeiro', fev: 'Fevereiro', mar: 'Março', abr: 'Abril', mai: 'Maio', jun: 'Junho',
  jul: 'Julho', ago: 'Agosto', set: 'Setembro', out: 'Outubro', nov: 'Novembro', dez: 'Dezembro',
}

export function buildInsights(rows: Notificacao[]): Insight[] {
  if (!rows.length) return []
  const out: Insight[] = []
  const k = kpis(rows)
  const months = monthly(rows).filter((m) => m.itens > 0)
  const lastDate = rows.reduce((a, r) => (r.data > a ? r.data : a), '')
  const lastDay = Number(lastDate.slice(8, 10))
  const partial = lastDay > 0 && lastDay < 28

  // tendência mensal
  if (months.length >= 2) {
    const cur = months[months.length - 1]
    const prev = months[months.length - 2]
    const d = prev.valor ? (cur.valor - prev.valor) / prev.valor : 0
    out.push({
      tone: partial ? 'info' : d > 0.1 ? 'alert' : d < -0.1 ? 'good' : 'info',
      title: partial ? `${MES_NOME[cur.mes]} (parcial até dia ${lastDay}): ${fmtBRL(cur.valor)} em multas` : `${MES_NOME[cur.mes]}: multas ${d >= 0 ? 'subiram' : 'caíram'} ${fmtPct(Math.abs(d))}`,
      text: partial ? `Já são ${fmtNum(cur.itens)} itens no mês, ${fmtPct(prev.valor ? cur.valor / prev.valor : 0)} do total de ${MES_NOME[prev.mes]} (${fmtBRL(prev.valor)}). O mês ainda não fechou.` : `${fmtBRL(cur.valor)} em ${fmtNum(cur.itens)} itens contra ${fmtBRL(prev.valor)} em ${MES_NOME[prev.mes]}.`,
    })
    const peak = [...months].sort((a, b) => b.valor - a.valor)[0]
    out.push({
      tone: 'warn',
      title: `Pico de multas em ${MES_NOME[peak.mes]}`,
      text: `${fmtBRL(peak.valor)} (${fmtPct(peak.valor / k.valor)} do total) e ${fmtNum(peak.itens)} itens notificados.`,
    })
  }

  // pareto de não conformidades
  const ncs = sortDesc(groupBy(rows, (n) => n.naoConformidade), 'valor')
  if (ncs.length) {
    let acc = 0
    let n80 = 0
    for (const g of ncs) {
      acc += g.valor
      n80++
      if (acc / k.valor >= 0.8) break
    }
    out.push({
      tone: 'info',
      title: `${n80} de ${ncs.length} não conformidades geram 80% das multas`,
      text: `Ataque primeiro: “${short(ncs[0].key, 80)}” soma ${fmtBRL(ncs[0].valor)} (${fmtPct(ncs[0].valor / k.valor)}).`,
      filter: { key: 'naoConformidade', value: ncs[0].key },
    })
  }

  // base mais crítica
  const bases = sortDesc(groupBy(rows, (n) => n.base), 'valor')
  if (bases.length > 1) {
    out.push({
      tone: 'alert',
      title: `Base ${bases[0].key} concentra ${fmtPct(bases[0].valor / k.valor)} das multas`,
      text: `${fmtBRL(bases[0].valor)} em ${fmtNum(bases[0].itens)} itens. Ticket médio da base: ${fmtBRL(bases[0].valor / bases[0].itens)}.`,
      filter: { key: 'base', value: bases[0].key },
    })
  }

  // equipes reincidentes
  const eq = sortDesc(groupBy(rows, (n) => n.equipe), 'valor').filter((g) => g.key !== 'ALOJAMENTO')
  if (eq.length) {
    const rein = eq.filter((g) => g.notifs >= 3).length
    out.push({
      tone: 'warn',
      title: `Equipe ${eq[0].key} lidera em valor`,
      text: `${fmtBRL(eq[0].valor)} em ${fmtNum(eq[0].notifs)} notificações. ${rein} equipes têm 3 ou mais notificações (reincidência).`,
      filter: { key: 'equipe', value: eq[0].key },
    })
  }

  // criticidade
  const graves = rows.filter((r) => r.pnt >= 100)
  if (graves.length) {
    const v = graves.reduce((a, r) => a + r.valor, 0)
    out.push({
      tone: 'alert',
      title: `${fmtNum(graves.length)} itens de gravidade máxima (100 pts)`,
      text: `Representam ${fmtPct(graves.length / rows.length)} dos itens, mas ${fmtPct(v / k.valor)} do valor (${fmtBRL(v)}).`,
    })
  }

  // tratativa
  out.push({
    tone: k.abertos ? 'warn' : 'good',
    title: k.abertos ? `${fmtNum(k.abertos)} itens ainda em tratamento` : 'Todas as notificações tratadas',
    text: `${fmtPct(k.pctTratado, 1)} dos itens já foram tratados. ${k.abertos ? 'Priorize a resposta para evitar perda de prazo.' : ''}`,
    filter: k.abertos ? { key: 'tratado', value: 'Em tratamento' } : undefined,
  })

  // colaboradores
  const col = sortDesc(groupBy(rows, (n) => n.eletricistas), 'valor')
  if (col.length) {
    out.push({
      tone: 'info',
      title: `${col[0].key} é o colaborador mais citado`,
      text: `${fmtNum(col[0].itens)} itens, ${fmtBRL(col[0].valor)} em multas. Considere reciclagem/treinamento direcionado.`,
      filter: { key: 'colaborador', value: col[0].key },
    })
  }

  // inspetor
  const ins = sortDesc(groupBy(rows, (n) => n.inspetor))
  if (ins.length > 1) {
    out.push({
      tone: 'info',
      title: `${short(ins[0].key, 30)} gerou ${fmtPct(ins[0].itens / k.itens)} dos apontamentos`,
      text: `${fmtNum(ins[0].itens)} itens de ${ins.length} inspetores. Útil para calibrar o foco das inspeções.`,
      filter: { key: 'inspetor', value: ins[0].key },
    })
  }

  return out
}
