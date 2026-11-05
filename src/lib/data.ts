import { createClient } from '@supabase/supabase-js'
import type { AppUser, AppUserInput, Notificacao, NotificacaoInput, Session } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
/** Sem Supabase configurado, apenas em desenvolvimento, usa dados locais para testar a interface. */
export const isLocalMode = !supabase && import.meta.env.DEV
export const isMisconfigured = !supabase && !import.meta.env.DEV

interface Row {
  id: string
  notificacao: number | null
  data: string
  inspetor: string
  equipe: string
  base: string
  gerencia: string
  nao_conformidade: string
  qnt: number
  pnt: number
  valor: number | string
  tratado: boolean
  dias: number | null
  inspecao: number | null
  coordenador: string
  processo: string
  status: string
  eletricistas: string[] | null
  created_at?: string
}

const fromRow = (r: Row): Notificacao => ({
  id: r.id,
  notificacao: r.notificacao == null ? null : Number(r.notificacao),
  data: r.data,
  inspetor: r.inspetor,
  equipe: r.equipe,
  base: r.base,
  gerencia: r.gerencia,
  naoConformidade: r.nao_conformidade,
  qnt: r.qnt,
  pnt: r.pnt,
  valor: Number(r.valor),
  tratado: r.tratado,
  dias: r.dias,
  inspecao: r.inspecao == null ? null : Number(r.inspecao),
  coordenador: r.coordenador,
  processo: r.processo,
  status: r.status,
  eletricistas: r.eletricistas ?? [],
  criadoEm: r.created_at,
})

// ---------- modo local (somente dev) ----------
const LS_KEY = 'cgb-local-data'
async function localLoad(): Promise<Notificacao[]> {
  if (!import.meta.env.DEV) throw new Error('modo local indisponível em produção')
  const saved = localStorage.getItem(LS_KEY)
  if (saved) return JSON.parse(saved)
  const seed = (await import('../data/seed.json')).default as Notificacao[]
  localStorage.setItem(LS_KEY, JSON.stringify(seed))
  return seed
}
const localSave = (rows: Notificacao[]) => localStorage.setItem(LS_KEY, JSON.stringify(rows))

// ---------- API ----------
export async function login(user: string, pass: string): Promise<Session | null> {
  if (supabase) {
    const { data, error } = await supabase.rpc('app_login', { p_user: user.trim(), p_pass: pass })
    if (error) throw new Error(error.message)
    if (!data) return null
    const d = data as Session & { must_change?: boolean }
    return { token: d.token, username: d.username, nome: d.nome, role: d.role, mustChange: !!d.must_change }
  }
  if (isLocalMode) {
    await new Promise((r) => setTimeout(r, 700))
    if (user.trim().toLowerCase() === '@admin' && pass === 'admin123')
      return { token: 'local', username: '@admin', nome: 'Administrador', role: 'admin' }
    return null
  }
  throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
}

export async function changePassword(token: string, oldPass: string, newPass: string) {
  if (supabase) {
    const { error } = await supabase.rpc('app_change_password', { p_token: token, p_old: oldPass, p_new: newPass })
    if (error) throw new Error(error.message)
  }
}

export async function logout(token: string) {
  if (supabase) await supabase.rpc('app_logout', { p_token: token })
}

export async function listAll(token: string): Promise<Notificacao[]> {
  if (supabase) {
    const { data, error } = await supabase.rpc('nc_list', { p_token: token }).range(0, 19999)
    if (error) throw new Error(error.message)
    return (data as Row[]).map(fromRow)
  }
  return localLoad()
}

export async function save(token: string, n: NotificacaoInput): Promise<Notificacao> {
  if (supabase) {
    const { data, error } = await supabase.rpc('nc_save', { p_token: token, p: n })
    if (error) throw new Error(error.message)
    return fromRow(data as Row)
  }
  const rows = await localLoad()
  const rec: Notificacao = { ...n, id: n.id ?? crypto.randomUUID() }
  const i = rows.findIndex((r) => r.id === rec.id)
  if (i >= 0) rows[i] = rec
  else rows.push(rec)
  localSave(rows)
  return rec
}

export async function remove(token: string, id: string) {
  if (supabase) {
    const { error } = await supabase.rpc('nc_delete', { p_token: token, p_id: id })
    if (error) throw new Error(error.message)
    return
  }
  localSave((await localLoad()).filter((r) => r.id !== id))
}

export async function importMany(token: string, list: NotificacaoInput[]) {
  if (supabase) {
    for (let i = 0; i < list.length; i += 150) {
      const { error } = await supabase.rpc('nc_import', { p_token: token, p: list.slice(i, i + 150) })
      if (error) throw new Error(error.message)
    }
    return
  }
  const rows = await localLoad()
  localSave([...rows, ...list.map((n) => ({ ...n, id: crypto.randomUUID() }))])
}

// ---------- usuários (somente administradores) ----------
const LS_USERS = 'cgb-local-users'
const localUsers = (): AppUser[] => {
  const raw = localStorage.getItem(LS_USERS)
  if (raw) return JSON.parse(raw)
  const base: AppUser[] = [
    { username: '@admin', nome: 'ADMINISTRADOR', role: 'admin', chapa: 1, funcao: 'ADMINISTRADOR', base: 'ALFA', processo: 'Segurança', gerencia: 'GER-A', ativo: true },
  ]
  localStorage.setItem(LS_USERS, JSON.stringify(base))
  return base
}

export async function usrList(token: string): Promise<AppUser[]> {
  if (supabase) {
    const { data, error } = await supabase.rpc('usr_list', { p_token: token })
    if (error) throw new Error(error.message)
    return data as AppUser[]
  }
  return localUsers()
}

export async function usrSave(token: string, u: AppUserInput): Promise<AppUser> {
  if (supabase) {
    const { data, error } = await supabase.rpc('usr_save', { p_token: token, p: u })
    if (error) throw new Error(error.message)
    return data as AppUser
  }
  const list = localUsers()
  const i = list.findIndex((x) => x.username.toLowerCase() === u.username.toLowerCase())
  const rec: AppUser = { ...u, ativo: u.ativo ?? true }
  if (i >= 0) list[i] = rec
  else list.push(rec)
  localStorage.setItem(LS_USERS, JSON.stringify(list))
  return rec
}

export async function usrDelete(token: string, username: string) {
  if (supabase) {
    const { error } = await supabase.rpc('usr_delete', { p_token: token, p_username: username })
    if (error) throw new Error(error.message)
    return
  }
  localStorage.setItem(LS_USERS, JSON.stringify(localUsers().filter((x) => x.username !== username)))
}

export interface ImportResult { criados: number; atualizados: number; ignorados: number }

export async function usrImport(token: string, list: AppUserInput[], reset: boolean): Promise<ImportResult> {
  const total: ImportResult = { criados: 0, atualizados: 0, ignorados: 0 }
  if (supabase) {
    for (let i = 0; i < list.length; i += 40) {
      const { data, error } = await supabase.rpc('usr_import', { p_token: token, p: list.slice(i, i + 40), p_reset: reset })
      if (error) throw new Error(error.message)
      const r = data as ImportResult
      total.criados += r.criados; total.atualizados += r.atualizados; total.ignorados += r.ignorados
    }
    return total
  }
  const cur = localUsers()
  for (const u of list) {
    const i = cur.findIndex((x) => x.username.toLowerCase() === u.username.toLowerCase())
    if (i >= 0) { cur[i] = { ...cur[i], ...u, role: cur[i].role, ativo: cur[i].ativo }; total.atualizados++ }
    else { cur.push({ ...u, role: u.role ?? 'viewer', ativo: true }); total.criados++ }
  }
  localStorage.setItem(LS_USERS, JSON.stringify(cur))
  return total
}
