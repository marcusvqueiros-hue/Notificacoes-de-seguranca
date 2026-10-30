import type { FilterKey, Filters, Notificacao } from './types'
import { MESES, anoOf, mesIdx } from './format'

export interface Group {
  key: string
  itens: number
  valor: number
  notifs: number
  tratados: number
  abertos: number
}

export const filterValue = (n: Notificacao, k: FilterKey): string[] => {
  switch (k) {
    case 'mes':
      return [MESES[mesIdx(n.data)]]
    case 'ano':
      return [anoOf(n.data)]
    case 'tratado':
      return [n.tratado ? 'Tratado' : 'Em tratamento']
    case 'status':
      return [n.status || 'Sem status']
    case 'colaborador':
      return n.eletricistas
    default:
      return [n[k]]
  }
}

export function applyFilters(rows: Notificacao[], f: Filters, except?: FilterKey): Notificacao[] {
  const active = (Object.keys(f) as FilterKey[]).filter((k) => f[k].length && k !== except)
  if (!active.length) return rows
  return rows.filter((n) => active.every((k) => filterValue(n, k).some((v) => f[k].includes(v))))
}

export function groupBy(rows: Notificacao[], keyFn: (n: Notificacao) => string | string[]): Group[] {
  const m = new Map<string, { g: Group; ids: Set<number | null> }>()
  for (const n of rows) {
    const ks = keyFn(n)
    for (const key of Array.isArray(ks) ? ks : [ks]) {
      if (!key) continue
      let e = m.get(key)
      if (!e) m.set(key, (e = { g: { key, itens: 0, valor: 0, notifs: 0, tratados: 0, abertos: 0 }, ids: new Set() }))
      e.g.itens += 1
      e.g.valor += n.valor
      if (n.tratado) e.g.tratados += 1
      else e.g.abertos += 1
      e.ids.add(n.notificacao)
    }
  }
  return [...m.values()].map(({ g, ids }) => ({ ...g, notifs: ids.size }))
}

export interface Kpis {
  notifs: number
  itens: number
  valor: number
  tratados: number
  abertos: number
  ticket: number
  pctTratado: number
  pontos: number
}

export function kpis(rows: Notificacao[]): Kpis {
  const ids = new Set(rows.map((r) => r.notificacao ?? 0))
  const itens = rows.length
  const valor = rows.reduce((a, r) => a + r.valor, 0)
  const tratados = rows.filter((r) => r.tratado).length
  return {
    notifs: ids.size,
    itens,
    valor,
    tratados,
    abertos: itens - tratados,
    ticket: itens ? valor / itens : 0,
    pctTratado: itens ? tratados / itens : 0,
    pontos: rows.reduce((a, r) => a + r.pnt, 0),
  }
}

/** série mensal (Jan..Dez), com meses vazios zerados até o último mês com dados */
export function monthly(rows: Notificacao[]) {
  const byMonth = groupBy(rows, (n) => MESES[mesIdx(n.data)])
  const last = byMonth.reduce((a, g) => Math.max(a, MESES.indexOf(g.key)), -1)
  return MESES.slice(0, Math.max(last + 1, 1)).map((m) => {
    const g = byMonth.find((x) => x.key === m)
    return { mes: m, itens: g?.itens ?? 0, valor: g?.valor ?? 0, notifs: g?.notifs ?? 0, tratados: g?.tratados ?? 0, abertos: g?.abertos ?? 0 }
  })
}

export const sortDesc = (g: Group[], by: 'itens' | 'valor' = 'itens') =>
  [...g].sort((a, b) => b[by] - a[by] || b.itens - a.itens)

export const uniq = (rows: Notificacao[], k: FilterKey) =>
  [...new Set(rows.flatMap((n) => filterValue(n, k)))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'))
