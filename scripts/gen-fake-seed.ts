// Gera dados FICTÍCIOS (determinísticos) para demonstração: src/data/seed.json e supabase/seed.sql
// uso: bun scripts/gen-fake-seed.ts
import { writeFileSync } from 'node:fs'

let state = 20260101
const rnd = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296)
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]

const bases = ['ALFA', 'BETA', 'GAMA', 'DELTA', 'SIGMA', 'OMEGA']
const gerencias = ['GER-A', 'GER-B', 'GER-C', 'GER-D']
const processos = ['PLANTÃO', 'CONSTRUÇÃO', 'INSPEÇÃO', 'LINHA VIVA', 'ADM']
const coordenadores = ['ANDRE', 'BEATRIZ', 'CARLOS', 'DIANA', 'EDUARDO']
const inspetores = ['INSPETOR EXEMPLO UM', 'INSPETOR EXEMPLO DOIS', 'INSPETOR EXEMPLO TRES', 'INSPETOR EXEMPLO QUATRO']
const nomes = ['ALEX', 'BRUNO', 'CAMILA', 'DANIEL', 'ELAINE', 'FABIO', 'GISELE', 'HUGO', 'IRIS', 'JOAO', 'KARLA', 'LEO', 'MARTA', 'NELSON', 'OLGA', 'PAULO']
const sobrenomes = ['ALMEIDA', 'BARROS', 'CARDOSO', 'DUARTE', 'ESTEVES', 'FARIAS', 'GOMES', 'HENRIQUES']
const ncs = [
  'Utilizando protetor facial danificado',
  'Colaboradores desatentos à execução das tarefas',
  'APR preenchida parcialmente/incorretamente',
  'Colaboradores não possuem crachá de identificação',
  'Utilizando ferramentas em desacordo com a norma',
  'Transportando EPI/EPC e materiais sem acondicionamento',
  'Não possui manga isolante',
  'Utilizando vara de manobra em fibra de vidro danificada',
  'Sistema de comunicação sonoro inoperante',
  'Tarefa sendo executada com pressa',
  'Realizando a tarefa sem sinalização adequada',
  'Local sem condições de conservação e limpeza',
]
const pnts = [0, 2, 3, 5, 5, 5, 5, 10, 10, 100]

const equipes = Array.from({ length: 24 }, (_, i) => `EQ-${bases[i % bases.length]}-E${String(100 + i)}`)
const elet = Array.from({ length: 40 }, () => `${pick(nomes)} ${pick(sobrenomes)} ${pick(sobrenomes)}`)

const rows: Record<string, unknown>[] = []
let id = 1
for (let n = 0; n < 90; n++) {
  const mes = Math.min(9, Math.floor(n / 9))
  const dia = 1 + Math.floor(rnd() * 27)
  const data = `2026-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  const equipe = pick(equipes)
  const base = equipe.split('-')[1]
  const gerencia = pick(gerencias)
  const coordenador = pick(coordenadores)
  const processo = pick(processos)
  const inspetor = pick(inspetores)
  const eletricistas = [pick(elet), pick(elet)].filter((v, i, a) => a.indexOf(v) === i)
  const notificacao = 90000 + n * 7
  const itens = 1 + Math.floor(rnd() * 3)
  const tratado = mes < 9 || rnd() > 0.5
  for (let k = 0; k < itens; k++) {
    const pnt = pick(pnts)
    rows.push({
      id: `demo-${id++}`, notificacao, data, inspetor, equipe, base, gerencia, naoConformidade: pick(ncs),
      qnt: 1, pnt, valor: pnt * 100, tratado, dias: tratado ? 1 + Math.floor(rnd() * 20) : null, inspecao: 500000 + n,
      coordenador, processo, status: tratado ? 'NC RESPONDIDA' : '', eletricistas,
    })
  }
}

writeFileSync('src/data/seed.json', JSON.stringify(rows))
const q = (s: unknown) => `'${String(s).replace(/'/g, "''")}'`
const values = rows
  .map((r: any) => `(${r.notificacao},${q(r.data)},${q(r.inspetor)},${q(r.equipe)},${q(r.base)},${q(r.gerencia)},${q(r.naoConformidade)},${r.qnt},${r.pnt},${r.valor},${r.tratado},${r.dias ?? 'null'},${r.inspecao},${q(r.coordenador)},${q(r.processo)},${q(r.status)},array[${r.eletricistas.map(q).join(',')}]::text[])`)
  .join(',\n')
writeFileSync(
  'supabase/seed.sql',
  `-- Dados FICTÍCIOS de demonstração (${rows.length} itens). Gerados por scripts/gen-fake-seed.ts\ninsert into public.notificacoes (notificacao,data,inspetor,equipe,base,gerencia,nao_conformidade,qnt,pnt,valor,tratado,dias,inspecao,coordenador,processo,status,eletricistas) values\n${values};\n`,
)
console.log(rows.length, 'linhas fictícias geradas')
