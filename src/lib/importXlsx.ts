import type { NotificacaoInput } from './types'

const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim()
const key = (s: unknown) => norm(s).toLowerCase()
const iso = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : norm(v).slice(0, 10))

/** Lê a aba "Base" (ou a primeira) da planilha de notificações. */
export async function parseWorkbook(file: File): Promise<NotificacaoInput[]> {
  const { readSheet } = await import('read-excel-file/browser')
  let data: unknown[][]
  try {
    data = (await readSheet(file, 'Base')) as unknown[][]
  } catch {
    data = (await readSheet(file)) as unknown[][]
  }
  const h = data.findIndex((r) => r.some((c) => key(c) === 'nº da notificação'))
  if (h < 0) throw new Error('Cabeçalho “Nº da Notificação” não encontrado na planilha.')
  const idx = new Map(data[h].map((c, i) => [key(c), i]))
  const col = (r: unknown[], name: string) => r[idx.get(name.toLowerCase()) ?? -1]
  const out: NotificacaoInput[] = []
  for (const r of data.slice(h + 1)) {
    const nro = Number(col(r, 'Nº da Notificação')) || null
    if (!nro && !norm(col(r, 'Equipe'))) continue
    const dias = col(r, 'Dias')
    out.push({
      notificacao: nro,
      data: iso(col(r, 'Data')),
      inspetor: norm(col(r, 'Inspetor')),
      equipe: norm(col(r, 'Equipe')),
      base: norm(col(r, 'Base')),
      gerencia: norm(col(r, 'Gerência')),
      naoConformidade: norm(col(r, 'Não conformidade')),
      qnt: Number(col(r, 'Qnt') ?? 1) || 1,
      pnt: Number(col(r, 'Pnt') ?? 0) || 0,
      valor: Number(col(r, 'Valor da Multa') ?? 0) || 0,
      tratado: norm(col(r, 'Tratado')).toUpperCase() === 'SIM',
      dias: dias === '' || dias == null ? null : Number(dias),
      inspecao: Number(col(r, 'Nº da Inspeção')) || null,
      coordenador: norm(col(r, 'Coordenador')),
      processo: norm(col(r, 'Processo')),
      status: norm(col(r, 'Status')),
      eletricistas: [1, 2, 3, 4, 5, 6, 7].map((n) => norm(col(r, `ELETRICISTA ${n}`))).filter(Boolean),
    })
  }
  return out
}
