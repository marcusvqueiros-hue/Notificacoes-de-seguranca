import type { Notificacao } from './types'

/**
 * Prazo de vencimento em DIAS ÚTEIS, contado a partir da data de lançamento:
 * o dia do lançamento não conta (o dia 1 é o próximo dia útil) e sábados, domingos e feriados nacionais são pulados.
 * Feriados estaduais e municipais não entram. Vencida = ainda não tratada e hoje depois do vencimento.
 */

const DAY = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')
const parse = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const toIso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

/** Domingo de Páscoa (algoritmo gregoriano). */
function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(y, month - 1, day))
}

const cache = new Map<number, Set<string>>()
/** Feriados nacionais do ano (YYYY-MM-DD): fixos + Sexta-feira Santa. 20/11 (Consciência Negra) vale desde 2024. */
export function feriadosNacionais(y: number): Set<string> {
  let s = cache.get(y)
  if (s) return s
  s = new Set(['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25'].map((md) => `${y}-${md}`))
  if (y >= 2024) s.add(`${y}-11-20`)
  s.add(toIso(new Date(easter(y).getTime() - 2 * DAY)))
  cache.set(y, s)
  return s
}

export function isDiaUtil(d: Date): boolean {
  const w = d.getUTCDay()
  return w !== 0 && w !== 6 && !feriadosNacionais(d.getUTCFullYear()).has(toIso(d))
}

/** Data de hoje (fuso do computador) em YYYY-MM-DD. */
export function hojeIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Soma `n` dias úteis a partir de `iso` (o próprio `iso` não conta). */
export function somarDiasUteis(iso: string, n: number): string {
  let d = parse(iso)
  let left = Math.max(0, Math.floor(n))
  while (left > 0) {
    d = new Date(d.getTime() + DAY)
    if (isDiaUtil(d)) left--
  }
  return toIso(d)
}

/** Dias úteis entre `de` (não conta) e `ate` (conta). Zero se `ate` não for depois de `de`. */
export function diasUteisEntre(de: string, ate: string): number {
  let d = parse(de)
  const end = parse(ate)
  let n = 0
  while (d.getTime() < end.getTime()) {
    d = new Date(d.getTime() + DAY)
    if (isDiaUtil(d)) n++
  }
  return n
}

type ComPrazo = Pick<Notificacao, 'dataLancamento' | 'dias'>

/** Data de vencimento, ou null quando falta a data de lançamento ou o prazo. */
export function vencimento(n: ComPrazo): string | null {
  if (!n.dataLancamento || n.dias == null) return null
  return somarDiasUteis(n.dataLancamento, n.dias)
}

/** Vencida: não tratada e com o vencimento já passado (no dia do vencimento ainda está no prazo). */
export function isVencida(n: ComPrazo & Pick<Notificacao, 'tratado'>, hoje: string): boolean {
  if (n.tratado) return false
  const v = vencimento(n)
  return v != null && v < hoje
}

/** Dias úteis de atraso (0 se não estiver vencida). */
export function diasAtraso(n: ComPrazo & Pick<Notificacao, 'tratado'>, hoje: string): number {
  const v = vencimento(n)
  return v != null && !n.tratado && v < hoje ? diasUteisEntre(v, hoje) : 0
}

export interface Vencida {
  key: string
  notificacao: number | null
  equipe: string
  base: string
  gerencia: string
  naoConformidade: string
  valor: number
  lancamento: string
  vencimento: string
  atraso: number
}

/** Itens vencidos (uma linha por item/não conformidade, pois cada um tem o seu lançamento, prazo e resposta)
 *  e quantos itens em tratamento ainda não têm como calcular o vencimento. */
export function resumoVencidas(rows: Notificacao[], hoje: string) {
  const list: Vencida[] = []
  let semPrazo = 0
  for (const n of rows) {
    if (n.tratado) continue
    const venc = vencimento(n)
    if (venc == null) { semPrazo++; continue }
    if (venc >= hoje) continue
    list.push({ key: n.id, notificacao: n.notificacao, equipe: n.equipe, base: n.base, gerencia: n.gerencia, naoConformidade: n.naoConformidade, valor: n.valor, lancamento: n.dataLancamento!, vencimento: venc, atraso: diasUteisEntre(venc, hoje) })
  }
  list.sort((a, b) => b.atraso - a.atraso || (a.notificacao ?? 0) - (b.notificacao ?? 0))
  return { list, semPrazo }
}
