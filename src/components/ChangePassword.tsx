import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { Check, Eye, EyeOff, KeyRound, Loader2, LogOut, TriangleAlert } from 'lucide-react'
import { useStore } from '../lib/store'
import { GridCanvas } from './LoginScreen'
import { BrandLogo } from './BrandLogo'
import { Modal } from './ui'

function strength(p: string) {
  let s = 0
  if (p.length >= 8) s++
  if (p.length >= 12) s++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++
  if (/\d/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return Math.min(s, 4)
}
const LEVEL = [
  { t: 'Muito fraca', c: '#ef4444' },
  { t: 'Fraca', c: '#f97316' },
  { t: 'Razoável', c: '#eab308' },
  { t: 'Boa', c: '#22c55e' },
  { t: 'Forte', c: '#10b981' },
]

/** Formulário de troca de senha. `dark` usa as cores da tela de login. */
function PasswordForm({ dark, onDone, submitLabel }: { dark?: boolean; onDone: () => void; submitLabel: string }) {
  const { loginPass, changePassword, notify } = useStore()
  const [oldPass, setOld] = useState(loginPass ?? '')
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const askOld = loginPass == null
  const sc = strength(p1)
  const match = p1.length > 0 && p1 === p2
  const ok = p1.length >= 8 && p1 !== oldPass && match && !!oldPass

  const field = dark
    ? 'flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 transition focus-within:border-[#ff4d6a] focus-within:shadow-[0_0_0_3px_rgba(255,77,106,0.2)]'
    : 'flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3 transition focus-within:border-brand'
  const input = `w-full bg-transparent py-3 text-sm outline-none ${dark ? 'placeholder:text-white/25' : ''}`
  const label = `text-xs font-semibold ${dark ? 'text-white/60' : 'text-muted'}`

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    setErr('')
    try {
      await changePassword(oldPass, p1)
      notify('Senha alterada com sucesso.')
      onDone()
    } catch (ex) {
      setErr((ex as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const pw = (value: string, set: (v: string) => void, ac: string, ph = '••••••••') => (
    <div className={`mt-1.5 ${field}`}>
      <KeyRound size={16} className={dark ? 'text-white/40' : 'text-muted'} />
      <input value={value} onChange={(e) => set(e.target.value)} type={show ? 'text' : 'password'} autoComplete={ac} required placeholder={ph} className={input} />
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-4">
      {askOld && <label className="block"><span className={label}>Senha atual</span>{pw(oldPass, setOld, 'current-password')}</label>}
      <label className="block">
        <span className={label}>Nova senha</span>
        <div className={`mt-1.5 ${field}`}>
          <KeyRound size={16} className={dark ? 'text-white/40' : 'text-muted'} />
          <input value={p1} onChange={(e) => setP1(e.target.value)} type={show ? 'text' : 'password'} autoComplete="new-password" required placeholder="Mínimo de 8 caracteres" className={input} autoFocus />
          <button type="button" onClick={() => setShow((s) => !s)} className={dark ? 'text-white/40 hover:text-white' : 'text-muted'} aria-label={show ? 'Ocultar senhas' : 'Mostrar senhas'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        {p1 && (
          <div className="mt-2 flex items-center gap-2" aria-live="polite">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: i < sc || (sc === 4 && i < 4) ? LEVEL[sc].c : dark ? 'rgba(255,255,255,.12)' : 'var(--border)' }} />)}
            </div>
            <span className="text-[11px] font-semibold" style={{ color: LEVEL[sc].c }}>{LEVEL[sc].t}</span>
          </div>
        )}
      </label>
      <label className="block"><span className={label}>Confirmar nova senha</span>{pw(p2, setP2, 'new-password', 'Repita a nova senha')}</label>

      <ul className={`space-y-1 text-[11px] ${dark ? 'text-white/50' : 'text-muted'}`}>
        {[
          { t: 'Mínimo de 8 caracteres', ok: p1.length >= 8 },
          { t: 'Diferente da senha atual', ok: p1.length > 0 && p1 !== oldPass },
          { t: 'As duas senhas conferem', ok: match },
        ].map((r) => (
          <li key={r.t} className={`flex items-center gap-1.5 ${r.ok ? 'text-good' : ''}`}>
            <Check size={12} className={r.ok ? 'opacity-100' : 'opacity-30'} /> {r.t}
          </li>
        ))}
      </ul>

      {err && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {err}
        </div>
      )}
      <button disabled={!ok || busy} className="btn btn-primary w-full justify-center !py-3 disabled:opacity-50">
        {busy && <Loader2 size={16} className="animate-spin" />} {submitLabel}
      </button>
    </form>
  )
}

/** Tela obrigatória exibida no primeiro acesso (ou após redefinição da senha por um administrador). */
export function ChangePasswordScreen() {
  const { session, signOut } = useStore()
  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden bg-[#0a0710] p-4 text-white">
      <div className="absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full bg-[#c8102e] opacity-40 blur-[120px]" />
      <div className="absolute -right-40 -bottom-48 h-[38rem] w-[38rem] rounded-full bg-[#f2a900] opacity-20 blur-[130px]" />
      <GridCanvas />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[26rem] rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
      >
        <div className="flex flex-col items-center gap-2"><BrandLogo height={46} onDark /></div>
        <h1 className="mt-6 text-center font-display text-2xl font-semibold">Crie sua nova senha</h1>
        <p className="mt-1 text-center text-sm text-white/55">
          Olá, <b className="text-white/80">{session?.nome.split(' ')[0]}</b>! Este é o seu primeiro acesso. Troque a senha provisória por uma só sua para continuar.
        </p>
        <div className="mt-6">
          <PasswordForm dark submitLabel="Salvar e entrar" onDone={() => undefined} />
        </div>
        <button onClick={signOut} className="mx-auto mt-5 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80"><LogOut size={13} /> Sair</button>
      </motion.div>
    </div>
  )
}

/** Troca voluntária de senha, disponível no menu lateral. */
export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Alterar minha senha">
      {open && <PasswordForm submitLabel="Alterar senha" onDone={onClose} />}
    </Modal>
  )
}
