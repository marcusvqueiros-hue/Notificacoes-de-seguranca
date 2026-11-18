const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('pt-BR')

export const fmtBRL = (v: number) => brl.format(v)
export const fmtNum = (v: number) => num.format(v)
export const fmtPct = (v: number, d = 0) => `${(v * 100).toFixed(d).replace('.', ',')}%`
export const fmtCompact = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')} mi`
    : v >= 1000
      ? `R$ ${(v / 1000).toFixed(v >= 100000 ? 0 : 1).replace('.', ',')} mil`
      : `R$ ${v}`
export const fmtDate = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '')

/** Data e hora no fuso do navegador, ex.: 18/11/2026 17:32 */
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const mesIdx = (iso: string) => Number(iso.slice(5, 7)) - 1
export const anoOf = (iso: string) => iso.slice(0, 4)
export const short = (s: string, n = 38) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
