import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  LayoutDashboard, Users, UserRound, Lightbulb, ListChecks, Sun, Moon, Maximize, Minimize, PanelLeftClose, PanelLeftOpen,
  LogOut, KeyRound, UserCog, FilterX, Search, ChevronDown, X, RefreshCw,
} from 'lucide-react'
import { useStore, type Page } from '../lib/store'
import { BrandLogo } from './BrandLogo'
import { SnapshotButton } from './Snapshot'
import { ChangePasswordModal } from './ChangePassword'
import { uniq } from '../lib/aggregate'
import type { FilterKey } from '../lib/types'

const NAV: { id: Page; label: string; icon: ReactNode; admin?: boolean }[] = [
  { id: 'overview', label: 'Visão geral', icon: <LayoutDashboard size={18} /> },
  { id: 'teams', label: 'Por equipe', icon: <Users size={18} /> },
  { id: 'people', label: 'Por colaborador', icon: <UserRound size={18} /> },
  { id: 'insights', label: 'Insights', icon: <Lightbulb size={18} /> },
  { id: 'records', label: 'Notificações', icon: <ListChecks size={18} />, admin: true },
  { id: 'users', label: 'Usuários', icon: <UserCog size={18} />, admin: true },
]

export const FILTER_DEFS: { key: FilterKey; label: string; searchable?: boolean }[] = [
  { key: 'ano', label: 'Ano' },
  { key: 'mes', label: 'Mês' },
  { key: 'base', label: 'Base' },
  { key: 'gerencia', label: 'Gerência' },
  { key: 'processo', label: 'Processo' },
  { key: 'coordenador', label: 'Coordenador' },
  { key: 'tratado', label: 'Situação' },
  { key: 'status', label: 'Status' },
  { key: 'inspetor', label: 'Inspetor', searchable: true },
  { key: 'equipe', label: 'Equipe', searchable: true },
  { key: 'colaborador', label: 'Colaborador', searchable: true },
]

function FilterGroup({ k, label, searchable }: { k: FilterKey; label: string; searchable?: boolean }) {
  const rows = useStore((s) => s.rows)
  const selected = useStore((s) => s.filters[k])
  const toggle = useStore((s) => s.toggleFilter)
  const [open, setOpen] = useState(['ano', 'mes', 'base', 'gerencia'].includes(k))
  const [q, setQ] = useState('')
  const options = useMemo(() => {
    const all = uniq(rows, k)
    if (k === 'mes') return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'].filter((m) => all.includes(m))
    return all
  }, [rows, k])
  const shown = q ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options

  return (
    <div className="border-b border-line/70 py-1.5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-xs font-semibold text-muted hover:text-ink">
        <span className="flex items-center gap-2">
          {label}
          {selected.length > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] text-white">{selected.length}</span>}
        </span>
        <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {searchable && (
              <div className="relative mb-1.5">
                <Search size={12} className="absolute top-1/2 left-2 -translate-y-1/2 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="input !py-1 !pl-7 text-xs" />
              </div>
            )}
            <div className={`flex flex-wrap gap-1.5 pb-1.5 ${options.length > 14 ? 'max-h-44 overflow-y-auto pr-1' : ''}`}>
              {shown.map((o) => {
                const on = selected.includes(o)
                return (
                  <button
                    key={o}
                    onClick={() => toggle(k, o)}
                    aria-pressed={on}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${on ? 'border-transparent bg-brand text-white shadow-md' : 'border-line bg-surface2 text-ink hover:border-brand'}`}
                  >
                    {o}
                  </button>
                )
              })}
              {!shown.length && <span className="px-1 text-[11px] text-muted">Sem opções</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { page, setPage, theme, setTheme, sidebarOpen, toggleSidebar, session, signOut, filters, clearFilters, toggleFilter, load, loading, toast } = useStore()
  const [full, setFull] = useState(!!document.fullscreenElement)
  const [pwd, setPwd] = useState(false)
  useEffect(() => {
    const h = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  const active = (Object.keys(filters) as FilterKey[]).flatMap((k) => filters[k].map((v) => ({ k, v })))
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => undefined))

  return (
    <div className="flex h-full">
      {/* mobile backdrop */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={toggleSidebar} />}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line bg-surface lg:static"
          >
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="leading-tight">
                <BrandLogo height={30} onDark={theme === 'dark'} />
                <div className="mt-1 text-[11px] font-semibold tracking-wide text-muted">Notificações</div>
              </div>
              <button className="ml-auto rounded-lg p-1.5 text-muted hover:bg-surface2 lg:hidden" onClick={toggleSidebar} aria-label="Fechar menu"><X size={18} /></button>
            </div>

            <nav className="space-y-1 px-3">
              {NAV.filter((n) => !n.admin || session?.role === 'admin').map((n) => (
                <button
                  key={n.id}
                  onClick={() => { setPage(n.id); if (innerWidth < 1024) toggleSidebar() }}
                  className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${page === n.id ? 'text-white' : 'text-muted hover:bg-surface2 hover:text-ink'}`}
                >
                  {page === n.id && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand to-brand2 shadow-lg" transition={{ type: 'spring', damping: 24, stiffness: 300 }} />}
                  <span className="relative">{n.icon}</span>
                  <span className="relative">{n.label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-4 flex items-center justify-between px-4">
              <span className="text-[11px] font-bold tracking-wider text-muted uppercase">Filtros</span>
              {active.length > 0 && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"><FilterX size={12} /> Limpar ({active.length})</button>
              )}
            </div>
            <div className="mt-1 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {FILTER_DEFS.map((f) => <FilterGroup key={f.key} k={f.key} label={f.label} searchable={f.searchable} />)}
            </div>

            <div className="border-t border-line px-4 pt-2 text-center text-[10px] text-muted">Desenvolvido por Marcus Vinicius Silva Queiros</div>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand to-accent text-sm font-bold text-white">{session?.nome[0]}</div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-semibold">{session?.nome}</div>
                <div className="text-[11px] text-muted">{session?.role === 'admin' ? 'Administrador' : 'Visualização'}</div>
              </div>
              <button onClick={() => setPwd(true)} className="rounded-lg p-2 text-muted hover:bg-surface2 hover:text-ink" aria-label="Alterar minha senha" title="Alterar minha senha"><KeyRound size={18} /></button>
              <button onClick={signOut} className="rounded-lg p-2 text-muted hover:bg-surface2 hover:text-bad" aria-label="Sair" title="Sair"><LogOut size={18} /></button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line bg-surface/80 px-4 py-2.5 backdrop-blur">
          <button className="btn !p-2" onClick={toggleSidebar} aria-label="Alternar menu lateral">
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <h1 className="font-display text-lg font-bold">{NAV.find((n) => n.id === page)?.label}</h1>
          <div className="ml-3 hidden min-w-0 flex-1 flex-wrap items-center gap-1.5 md:flex">
            {active.slice(0, 6).map(({ k, v }) => (
              <button key={k + v} className="chip" onClick={() => toggleFilter(k, v)} title="Remover filtro">
                {v} <X size={11} />
              </button>
            ))}
            {active.length > 6 && <span className="text-xs text-muted">+{active.length - 6}</span>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn !p-2" onClick={() => void load()} aria-label="Atualizar dados" title="Atualizar dados"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
            <button className="btn !p-2" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Alternar tema" title="Tema claro/escuro">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {page !== 'users' && <SnapshotButton title={NAV.find((n) => n.id === page)?.label ?? ''} />}
            <button className="btn" onClick={toggleFull} title="Tela cheia">
              {full ? <Minimize size={18} /> : <Maximize size={18} />}
              <span className="hidden sm:inline">{full ? 'Sair da tela cheia' : 'Tela cheia'}</span>
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-4">{children}</main>
      </div>

      <ChangePasswordModal open={pwd} onClose={() => setPwd(false)} />
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
            className={`fixed right-4 bottom-4 z-[60] rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-2xl ${toast.kind === 'ok' ? 'bg-good' : 'bg-bad'}`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
