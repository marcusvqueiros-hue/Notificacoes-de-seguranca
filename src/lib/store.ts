import { create } from 'zustand'
import { EMPTY_FILTERS, type FilterKey, type Filters, type Notificacao, type NotificacaoInput, type Session } from './types'
import * as api from './data'

export type Page = 'overview' | 'teams' | 'people' | 'insights' | 'records' | 'users'
export type Theme = 'light' | 'dark'

const SESSION_KEY = 'cgb-session'
const readSession = (): Session | null => {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}
const readTheme = (): Theme => {
  try {
    const t = localStorage.getItem('cgb-theme')
    if (t === 'light' || t === 'dark') return t
  } catch { /* ignore */ }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

interface State {
  session: Session | null
  theme: Theme
  page: Page
  rows: Notificacao[]
  loading: boolean
  error: string | null
  filters: Filters
  sidebarOpen: boolean
  toast: { msg: string; kind: 'ok' | 'err' } | null

  /** senha digitada no login, só em memória, para dispensar "senha atual" na troca obrigatória */
  loginPass: string | null
  signIn: (user: string, pass: string) => Promise<boolean>
  changePassword: (oldPass: string, newPass: string) => Promise<void>
  signOut: () => void
  load: () => Promise<void>
  setTheme: (t: Theme) => void
  setPage: (p: Page) => void
  toggleSidebar: () => void
  toggleFilter: (k: FilterKey, v: string) => void
  setFilter: (k: FilterKey, v: string[]) => void
  clearFilters: () => void
  saveRow: (n: NotificacaoInput) => Promise<void>
  deleteRow: (id: string) => Promise<void>
  importRows: (rows: NotificacaoInput[]) => Promise<void>
  notify: (msg: string, kind?: 'ok' | 'err') => void
}

export const useStore = create<State>((set, get) => ({
  session: readSession(),
  loginPass: null,
  theme: readTheme(),
  page: 'overview',
  rows: [],
  loading: false,
  error: null,
  filters: EMPTY_FILTERS,
  sidebarOpen: typeof innerWidth === 'undefined' || innerWidth >= 1024,
  toast: null,

  async signIn(user, pass) {
    const s = await api.login(user, pass)
    if (!s) return false
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
    set({ session: s, loginPass: s.mustChange ? pass : null })
    return true
  },
  async changePassword(oldPass, newPass) {
    const s = get().session!
    await api.changePassword(s.token, oldPass, newPass)
    const next = { ...s, mustChange: false }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
    set({ session: next, loginPass: null })
  },
  signOut() {
    const s = get().session
    if (s) void api.logout(s.token).catch(() => undefined)
    sessionStorage.removeItem(SESSION_KEY)
    set({ session: null, loginPass: null, rows: [], filters: EMPTY_FILTERS, page: 'overview' })
  },
  async load() {
    const s = get().session
    if (!s) return
    set({ loading: true, error: null })
    try {
      set({ rows: await api.listAll(s.token), loading: false })
    } catch (e) {
      const msg = (e as Error).message
      if (/sessão inválida/i.test(msg)) get().signOut()
      set({ loading: false, error: msg })
    }
  },
  setTheme(t) {
    try { localStorage.setItem('cgb-theme', t) } catch { /* ignore */ }
    document.documentElement.dataset.theme = t
    set({ theme: t })
  },
  setPage: (page) => set({ page }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleFilter(k, v) {
    set((s) => {
      const cur = s.filters[k]
      return { filters: { ...s.filters, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } }
    })
  },
  setFilter: (k, v) => set((s) => ({ filters: { ...s.filters, [k]: v } })),
  clearFilters: () => set({ filters: EMPTY_FILTERS }),

  async saveRow(n) {
    const s = get().session!
    const saved = await api.save(s.token, n)
    set((st) => {
      const i = st.rows.findIndex((r) => r.id === saved.id)
      const rows = [...st.rows]
      if (i >= 0) rows[i] = saved
      else rows.push(saved)
      return { rows }
    })
  },
  async deleteRow(id) {
    await api.remove(get().session!.token, id)
    set((st) => ({ rows: st.rows.filter((r) => r.id !== id) }))
  },
  async importRows(list) {
    const s = get().session!
    await api.importMany(s.token, list)
    await get().load()
  },
  notify(msg, kind = 'ok') {
    set({ toast: { msg, kind } })
    setTimeout(() => set((s) => (s.toast?.msg === msg ? { toast: null } : s)), 3500)
  },
}))
