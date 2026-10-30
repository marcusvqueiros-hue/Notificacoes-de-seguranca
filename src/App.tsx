import { Suspense, lazy, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useStore } from './lib/store'
import { LoginScreen } from './components/LoginScreen'
import { Shell } from './components/Shell'
import { ChangePasswordScreen } from './components/ChangePassword'
import { Overview } from './pages/Overview'

const Teams = lazy(() => import('./pages/Teams').then((m) => ({ default: m.Teams })))
const People = lazy(() => import('./pages/People').then((m) => ({ default: m.People })))
const Insights = lazy(() => import('./pages/Insights').then((m) => ({ default: m.Insights })))
const Users = lazy(() => import('./pages/Users').then((m) => ({ default: m.Users })))
const Records = lazy(() => import('./pages/Records').then((m) => ({ default: m.Records })))

function Skeleton() {
  return (
    <div className="mx-auto max-w-[1700px] space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-28" />)}</div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2"><div className="skeleton h-72" /><div className="skeleton h-72" /></div>
    </div>
  )
}

export default function App() {
  const { session, page, load, rows, loading, error } = useStore()
  const mustChange = !!session?.mustChange
  useEffect(() => { if (session && !mustChange) void load() }, [session, mustChange, load])

  if (!session) return <LoginScreen />
  if (mustChange) return <ChangePasswordScreen />
  const isAdmin = session.role === 'admin'
  const view = (page === 'records' || page === 'users') && !isAdmin ? 'overview' : page
  return (
    <Shell>
      {error && (
        <div role="alert" className="card mb-4 flex items-center justify-between gap-3 border-bad/40 p-4 text-sm">
          <span>Não foi possível carregar os dados: {error}</span>
          <button className="btn" onClick={() => void load()}>Tentar novamente</button>
        </div>
      )}
      {loading && !rows.length ? (
        <Skeleton />
      ) : !rows.length && !error ? (
        <div className="card mx-auto mt-16 max-w-md p-8 text-center">
          <h2 className="font-display text-lg font-bold">Nenhuma notificação cadastrada</h2>
          <p className="mt-2 text-sm text-muted">Importe a planilha ou cadastre a primeira notificação em “Notificações”.</p>
          <button className="btn btn-primary mt-4" onClick={() => useStore.getState().setPage('records')}>Ir para Notificações</button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={view} data-snap-root initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <Suspense fallback={<Skeleton />}>
              {view === 'overview' && <Overview />}
              {view === 'teams' && <Teams />}
              {view === 'people' && <People />}
              {view === 'insights' && <Insights />}
              {view === 'records' && <Records />}
              {view === 'users' && <Users />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      )}
    </Shell>
  )
}
