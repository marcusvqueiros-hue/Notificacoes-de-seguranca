import type { AppUserInput } from './types'

const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim()
const key = (s: unknown) => norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()

/** Lê a planilha de usuários (colunas: CHAPA, NOME, FUNÇÃO, BASE, PROCESSO, GERENCIA, USUARIO, SENHA e, opcional, PERFIL). */
export async function parseUsers(file: File): Promise<{ users: AppUserInput[]; invalid: number }> {
  const { readSheet } = await import('read-excel-file/browser')
  const data = (await readSheet(file)) as unknown[][]
  const h = data.findIndex((r) => r.some((c) => key(c) === 'USUARIO') && r.some((c) => key(c) === 'NOME'))
  if (h < 0) throw new Error('Cabeçalho não encontrado. A planilha precisa das colunas NOME, USUARIO e SENHA.')
  const idx = new Map(data[h].map((c, i) => [key(c), i]))
  const col = (r: unknown[], n: string) => r[idx.get(n) ?? -1]
  const users: AppUserInput[] = []
  let invalid = 0
  for (const r of data.slice(h + 1)) {
    if (!r.some((c) => norm(c))) continue
    let username = norm(col(r, 'USUARIO'))
    const nome = norm(col(r, 'NOME'))
    if (!username || !nome) { invalid++; continue }
    if (!username.startsWith('@')) username = '@' + username
    const perfil = key(col(r, 'PERFIL'))
    users.push({
      username,
      nome,
      chapa: Number(col(r, 'CHAPA')) || null,
      funcao: norm(col(r, 'FUNCAO')),
      base: norm(col(r, 'BASE')),
      processo: norm(col(r, 'PROCESSO')),
      gerencia: norm(col(r, 'GERENCIA')),
      senha: norm(col(r, 'SENHA')) || undefined,
      role: perfil.startsWith('ADMIN') ? 'admin' : (perfil ? 'viewer' : undefined) as 'admin' | 'viewer',
    })
  }
  return { users, invalid }
}
