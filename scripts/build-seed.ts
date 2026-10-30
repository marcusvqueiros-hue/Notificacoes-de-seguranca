// Converte a planilha de notificações em src/data/seed.json e supabase/seed.sql
import * as XLSX from 'xlsx'
import { writeFileSync } from 'node:fs'

const src = process.argv[2]
if (!src) throw new Error('uso: bun scripts/build-seed.ts <planilha.xlsx>')
const wb = XLSX.readFile(src, { cellDates: true })
const raw = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['Base'], { range: 1, raw: true })

const get = (r: Record<string, any>, name: string) => {
  const k = Object.keys(r).find((x) => x.replace(/\s+/g, ' ').trim().toLowerCase() === name.toLowerCase())
  return k ? r[k] : undefined
}
const str = (v: any) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())
const iso = (v: any) => (v instanceof Date ? v.toISOString().slice(0, 10) : str(v).slice(0, 10))

const rows = raw
  .filter((r) => get(r, 'Nº da Notificação') != null)
  .map((r, i) => ({
    notificacao: Number(get(r, 'Nº da Notificação')),
    data: iso(get(r, 'Data')),
    inspetor: str(get(r, 'Inspetor')),
    equipe: str(get(r, 'Equipe')),
    base: str(get(r, 'Base')),
    gerencia: str(get(r, 'Gerência')),
    nao_conformidade: str(get(r, 'Não conformidade')),
    qnt: Number(get(r, 'Qnt') ?? 1),
    pnt: Number(get(r, 'Pnt') ?? 0),
    valor: Number(get(r, 'Valor da Multa') ?? 0),
    tratado: str(get(r, 'Tratado')).toUpperCase() === 'SIM',
    dias: get(r, 'Dias') === '' || get(r, 'Dias') == null ? null : Number(get(r, 'Dias')),
    inspecao: get(r, 'Nº da Inspeção') == null ? null : Number(get(r, 'Nº da Inspeção')),
    coordenador: str(get(r, 'Coordenador')),
    processo: str(get(r, 'Processo')),
    status: str(get(r, 'Status')),
    eletricistas: [1, 2, 3, 4, 5, 6, 7].map((n) => str(get(r, `ELETRICISTA ${n}`))).filter(Boolean),
    ord: i + 1,
  }))

writeFileSync(
  'src/data/seed.json',
  JSON.stringify(
    rows.map((r) => ({
      id: `seed-${r.ord}`,
      notificacao: r.notificacao,
      data: r.data,
      inspetor: r.inspetor,
      equipe: r.equipe,
      base: r.base,
      gerencia: r.gerencia,
      naoConformidade: r.nao_conformidade,
      qnt: r.qnt,
      pnt: r.pnt,
      valor: r.valor,
      tratado: r.tratado,
      dias: r.dias,
      inspecao: r.inspecao,
      coordenador: r.coordenador,
      processo: r.processo,
      status: r.status,
      eletricistas: r.eletricistas,
    })),
  ),
)

const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const n = (v: number | null) => (v == null || Number.isNaN(v) ? 'null' : String(v))
const values = rows
  .map(
    (r) =>
      `(${n(r.notificacao)},${q(r.data)},${q(r.inspetor)},${q(r.equipe)},${q(r.base)},${q(r.gerencia)},${q(r.nao_conformidade)},${n(r.qnt)},${n(r.pnt)},${n(r.valor)},${r.tratado},${n(r.dias)},${n(r.inspecao)},${q(r.coordenador)},${q(r.processo)},${q(r.status)},array[${r.eletricistas.map(q).join(',')}]::text[])`,
  )
  .join(',\n')
writeFileSync(
  'supabase/seed.sql',
  `-- Carga inicial gerada da planilha (${rows.length} itens)\ninsert into public.notificacoes (notificacao,data,inspetor,equipe,base,gerencia,nao_conformidade,qnt,pnt,valor,tratado,dias,inspecao,coordenador,processo,status,eletricistas) values\n${values};\n`,
)
console.log(rows.length, 'linhas;', 'soma valor =', rows.reduce((a, r) => a + r.valor, 0))
