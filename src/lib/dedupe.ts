import type { Notificacao } from './types'

type Keyed = Pick<Notificacao, 'notificacao' | 'data' | 'equipe' | 'naoConformidade'>

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
/** identidade de um item: nº + data + equipe + não conformidade (campos de tratativa podem mudar sem afetar) */
const k1 = (r: Keyed) => [r.notificacao ?? '', r.data, norm(r.equipe), norm(r.naoConformidade)].join('|')
/** mesma identidade sem o nº — para itens que ainda não tinham número e receberam um */
const k2 = (r: Keyed) => [r.data, norm(r.equipe), norm(r.naoConformidade)].join('|')

export interface Match<T> { incoming: T; existing: Notificacao }

/**
 * Compara linhas de entrada (planilha) com as já cadastradas, item a item (permite itens idênticos repetidos):
 * - matched: já existem, não devem entrar de novo;
 * - fills: existiam sem nº de notificação e agora a planilha traz o nº (atualizar o existente);
 * - novos: realmente novos.
 */
export function matchRows<T extends Keyed>(existing: Notificacao[], incoming: T[]) {
  const pool = new Map<string, Notificacao[]>()
  for (const r of existing) {
    const k = k1(r)
    const arr = pool.get(k)
    if (arr) arr.push(r)
    else pool.set(k, [r])
  }
  const matched: Match<T>[] = []
  const left: T[] = []
  for (const r of incoming) {
    const e = pool.get(k1(r))?.shift()
    if (e) matched.push({ incoming: r, existing: e })
    else left.push(r)
  }
  const rest = [...pool.values()].flat().filter((r) => r.notificacao == null)
  const fills: Match<T>[] = []
  const novos: T[] = []
  for (const r of left) {
    const i = r.notificacao != null ? rest.findIndex((o) => k2(o) === k2(r)) : -1
    if (i >= 0) {
      fills.push({ incoming: r, existing: rest[i] })
      rest.splice(i, 1)
    } else novos.push(r)
  }
  return { matched, fills, novos }
}

export interface CleanupPlan {
  /** linhas da última importação que repetem itens já existentes (a remover) */
  dup: Notificacao[]
  /** linhas da última importação que só trazem o nº faltante de um item antigo */
  fills: Match<Notificacao>[]
  /** linhas da última importação que são realmente novas (permanecem) */
  novos: number
  batch: number
}

/** Detecta, na última importação (linhas criadas até 15 min antes do último registro), o que já existia antes. */
export function planCleanup(rows: Notificacao[]): CleanupPlan | null {
  const dated = rows.filter((r) => r.criadoEm)
  if (!dated.length) return null
  const max = dated.reduce((a, r) => (r.criadoEm! > a ? r.criadoEm! : a), '')
  const cutoff = new Date(new Date(max).getTime() - 15 * 60_000).toISOString()
  const batch = rows.filter((r) => (r.criadoEm ?? '') >= cutoff)
  const older = rows.filter((r) => (r.criadoEm ?? '') < cutoff)
  if (batch.length < 2 || !older.length) return null
  const m = matchRows(older, batch)
  if (!m.matched.length && !m.fills.length) return null
  return { dup: m.matched.map((x) => x.incoming), fills: m.fills, novos: m.novos.length, batch: batch.length }
}
