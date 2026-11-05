import { useState, type FormEvent } from 'react'
import { motion, useAnimation } from 'motion/react'
import { Eye, EyeOff, Lock, User, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useStore } from '../lib/store'
import { isMisconfigured } from '../lib/data'
import { BrandLogo } from './BrandLogo'
import { SafetyBackground } from './SafetyBackground'

export function Logo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff4d6a" />
          <stop offset="1" stopColor="#7a0f24" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#lg)" />
      <path d="M36 10 19 36h11l-4 18 19-27H34z" fill="#ffd45e" style={{ animation: 'bolt 2.4s ease-in-out infinite' }} />
    </svg>
  )
}

export function LoginScreen() {
  const signIn = useStore((s) => s.signIn)
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const shake = useAnimation()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      const ok = await signIn(user, pass)
      if (!ok) {
        setErr('Usuário ou senha inválidos.')
        void shake.start({ x: [0, -12, 12, -8, 8, 0], transition: { duration: 0.45 } })
      }
    } catch (ex) {
      setErr((ex as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden bg-[#0a0710] p-4 text-white">
      <motion.div
        className="absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full bg-[#c8102e] opacity-40 blur-[120px]"
        animate={{ x: [0, 80, 0], y: [0, 50, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-40 -bottom-48 h-[38rem] w-[38rem] rounded-full bg-[#f2a900] opacity-20 blur-[130px]"
        animate={{ x: [0, -70, 0], y: [0, -60, 0] }}
        transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_30%,#0a0710_95%)]" />
      <SafetyBackground />

      <motion.div animate={shake} className="relative z-10 w-full max-w-[26rem]">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
        >
          <div className="flex flex-col items-center gap-2">
            <div style={{ animation: 'floaty 5s ease-in-out infinite' }}><BrandLogo height={52} onDark /></div>
            <div className="text-xs text-white/55">Notificações de segurança</div>
          </div>

          <h1 className="mt-7 text-center font-display text-2xl font-semibold">Bem-vindo de volta</h1>
          <p className="mt-1 text-center text-sm text-white/55">Acesse para acompanhar indicadores e registrar novas notificações.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-white/60">Usuário</span>
              <div className="group mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 transition focus-within:border-[#ff4d6a] focus-within:shadow-[0_0_0_3px_rgba(255,77,106,0.2)]">
                <User size={16} className="text-white/40" />
                <input
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                  placeholder="@usuario"
                  className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-white/25"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-white/60">Senha</span>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 transition focus-within:border-[#ff4d6a] focus-within:shadow-[0_0_0_3px_rgba(255,77,106,0.2)]">
                <Lock size={16} className="text-white/40" />
                <input
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••"
                  className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-white/25"
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="text-white/40 hover:text-white" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {(err || isMisconfigured) && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                {err || 'Supabase não configurado neste ambiente.'}
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              disabled={busy || isMisconfigured}
              className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-[#ff4d6a] to-[#a50f2b] py-3 text-sm font-semibold shadow-[0_12px_30px_-8px_rgba(255,77,106,0.7)] disabled:opacity-60"
            >
              {busy && <Loader2 size={17} className="animate-spin" />}
              {busy ? 'Verificando…' : 'Entrar'}
            </motion.button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-white/40">
            <ShieldCheck size={13} /> Sessão protegida · expira em 12 horas
          </div>
        </motion.div>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-white/35">CGB Energia · SESMT<br />Desenvolvido por Marcus Vinicius Silva Queiros</p>
      </motion.div>
    </div>
  )
}
