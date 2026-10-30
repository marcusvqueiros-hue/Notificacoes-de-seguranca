import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Eye, EyeOff, FileSpreadsheet, Loader2, Pencil, Plus, Search, ShieldCheck, Trash2, UserCheck, UserX, Users as UsersIcon } from 'lucide-react'
import { useStore } from '../lib/store'
import { usrDelete, usrImport, usrList, usrSave } from '../lib/data'
import { fmtNum } from '../lib/format'
import { Field, Modal, Panel, useDebounced } from '../components/ui'
import { KpiCard } from '../components/ui'
import { DataTable, type Col } from '../components/DataTable'
import type { AppUser, AppUserInput } from '../lib/types'

const blank = (): AppUserInput => ({ username: '@', nome: '', role: 'viewer', chapa: null, funcao: '', base: '', processo: '', gerencia: '', ativo: true, senha: '' })

const RoleBadge = ({ role }: { role: AppUser['role'] }) => (
  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${role === 'admin' ? 'bg-brand/15 text-brand' : 'bg-info/15 text-info'}`}>{role === 'admin' ? 'ADMIN' : 'VISUALIZAÇÃO'}</span>
)

function UserForm({ initial, isNew, onSave, onCancel }: { initial: AppUserInput; isNew: boolean; onSave: (u: AppUserInput) => Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState(initial)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof AppUserInput>(k: K, v: AppUserInput[K]) => setF((s) => ({ ...s, [k]: v }))
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try { await onSave({ ...f, senha: f.senha || undefined }) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Field label="Chapa"><input type="number" className="input" value={f.chapa ?? ''} onChange={(e) => set('chapa', e.target.value ? Number(e.target.value) : null)} /></Field>
      <div className="col-span-2 md:col-span-3"><Field label="Nome completo"><input required className="input" value={f.nome} onChange={(e) => set('nome', e.target.value.toUpperCase())} /></Field></div>
      <div className="col-span-2"><Field label="Usuário (login)"><input required className="input" disabled={!isNew} value={f.username} onChange={(e) => set('username', e.target.value.replace(/\s/g, ''))} /></Field></div>
      <div className="col-span-2">
        <Field label={isNew ? 'Senha' : 'Nova senha (deixe em branco para manter)'}>
          <div className="relative">
            <input required={isNew} minLength={5} type={show ? 'text' : 'password'} autoComplete="new-password" className="input !pr-9" value={f.senha ?? ''} onChange={(e) => set('senha', e.target.value)} />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted" aria-label={show ? 'Ocultar' : 'Mostrar'}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          </div>
        </Field>
      </div>
      <div className="col-span-2"><Field label="Função"><input className="input" value={f.funcao} onChange={(e) => set('funcao', e.target.value.toUpperCase())} /></Field></div>
      <Field label="Base"><input className="input" value={f.base} onChange={(e) => set('base', e.target.value.toUpperCase())} /></Field>
      <Field label="Gerência"><input className="input" value={f.gerencia} onChange={(e) => set('gerencia', e.target.value.toUpperCase())} /></Field>
      <div className="col-span-2"><Field label="Processo"><input className="input" value={f.processo} onChange={(e) => set('processo', e.target.value)} /></Field></div>
      <Field label="Perfil">
        <select className="input" value={f.role} onChange={(e) => set('role', e.target.value as 'admin' | 'viewer')}>
          <option value="viewer">Visualização</option>
          <option value="admin">Administrador</option>
        </select>
      </Field>
      <Field label="Situação">
        <select className="input" value={f.ativo === false ? 'nao' : 'sim'} onChange={(e) => set('ativo', e.target.value === 'sim')}>
          <option value="sim">Ativo</option>
          <option value="nao">Inativo (sem acesso)</option>
        </select>
      </Field>
      <p className="col-span-2 text-[11px] text-muted md:col-span-4">Visualização: acessa os painéis. Administrador: também cadastra notificações e gerencia usuários.</p>
      <div className="col-span-2 mt-1 flex justify-end gap-2 md:col-span-4">
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />} Salvar</button>
      </div>
    </form>
  )
}

export function Users() {
  const { session, notify } = useStore()
  const token = session!.token
  const [users, setUsers] = useState<AppUser[] | null>(null)
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [roleF, setRoleF] = useState<'all' | 'admin' | 'viewer' | 'inativo'>('all')
  const [edit, setEdit] = useState<{ u: AppUserInput; isNew: boolean } | null>(null)
  const [del, setDel] = useState<AppUser | null>(null)
  const [imp, setImp] = useState<{ users: AppUserInput[]; invalid: number; fresh: number; existing: number } | null>(null)
  const [reset, setReset] = useState(false)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try { setUsers(await usrList(token)) } catch (e) { notify((e as Error).message, 'err'); setUsers([]) }
  }, [token, notify])
  useEffect(() => { void load() }, [load])

  const list = useMemo(() => {
    const t = dq.trim().toLowerCase()
    return (users ?? []).filter((u) => {
      if (roleF === 'admin' && u.role !== 'admin') return false
      if (roleF === 'viewer' && u.role !== 'viewer') return false
      if (roleF === 'inativo' && u.ativo) return false
      return !t || [u.nome, u.username, u.funcao, u.base, u.gerencia, u.processo, u.chapa ?? ''].join(' ').toLowerCase().includes(t)
    })
  }, [users, dq, roleF])

  const total = users?.length ?? 0
  const admins = users?.filter((u) => u.role === 'admin').length ?? 0
  const inativos = users?.filter((u) => !u.ativo).length ?? 0

  async function save(u: AppUserInput) {
    try {
      await usrSave(token, u)
      notify(edit?.isNew ? 'Usuário criado.' : 'Usuário atualizado.')
      setEdit(null)
      await load()
    } catch (e) { notify((e as Error).message, 'err') }
  }

  async function onFile(f?: File) {
    if (!f) return
    try {
      const { parseUsers } = await import('../lib/importUsers')
      const { users: parsed, invalid } = await parseUsers(f)
      if (!parsed.length) throw new Error('Nenhum usuário válido encontrado na planilha.')
      const have = new Set((users ?? []).map((u) => u.username.toLowerCase()))
      const existing = parsed.filter((u) => have.has(u.username.toLowerCase())).length
      setReset(false)
      setImp({ users: parsed, invalid, existing, fresh: parsed.length - existing })
    } catch (e) { notify((e as Error).message, 'err') }
    if (file.current) file.current.value = ''
  }

  async function runImport() {
    if (!imp) return
    setBusy(true)
    try {
      const r = await usrImport(token, imp.users, reset)
      notify(`Importação concluída: ${r.criados} criados, ${r.atualizados} atualizados${r.ignorados ? `, ${r.ignorados} ignorados` : ''}.`)
      setImp(null)
      await load()
    } catch (e) { notify((e as Error).message, 'err') } finally { setBusy(false) }
  }

  const cols: Col<AppUser>[] = [
    { key: 'ch', label: 'Chapa', render: (u) => u.chapa ?? '—', sort: (u) => u.chapa ?? 0 },
    { key: 'nome', label: 'Nome', render: (u) => <b>{u.nome}</b>, sort: (u) => u.nome },
    { key: 'user', label: 'Usuário', render: (u) => u.username, sort: (u) => u.username },
    { key: 'fn', label: 'Função', render: (u) => u.funcao || '—', sort: (u) => u.funcao },
    { key: 'base', label: 'Base', render: (u) => u.base || '—', sort: (u) => u.base },
    { key: 'ger', label: 'Gerência', render: (u) => u.gerencia || '—', sort: (u) => u.gerencia },
    { key: 'role', label: 'Perfil', align: 'center', render: (u) => <RoleBadge role={u.role} />, sort: (u) => u.role },
    { key: 'st', label: 'Situação', align: 'center', render: (u) => <span className={`text-[11px] font-semibold ${u.ativo ? 'text-good' : 'text-muted'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span>, sort: (u) => (u.ativo ? 1 : 0) },
    {
      key: 'a', label: '', align: 'right',
      render: (u) => (
        <span className="inline-flex gap-1">
          <button className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-ink" aria-label="Editar" onClick={() => setEdit({ u: { ...u, senha: '' }, isNew: false })}><Pencil size={14} /></button>
          {u.username.toLowerCase() !== session!.username.toLowerCase() && (
            <button className="rounded-lg p-1.5 text-muted hover:bg-bad/10 hover:text-bad" aria-label="Excluir" onClick={() => setDel(u)}><Trash2 size={14} /></button>
          )}
        </span>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-[1700px] space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Usuários" value={total} format={fmtNum} icon={<UsersIcon size={17} />} color="#8b5cf6" hint="cadastrados" />
        <KpiCard delay={0.05} label="Administradores" value={admins} format={fmtNum} icon={<ShieldCheck size={17} />} color="#ff4d6a" hint="inserem notificações" onClick={() => setRoleF(roleF === 'admin' ? 'all' : 'admin')} active={roleF === 'admin'} />
        <KpiCard delay={0.1} label="Visualização" value={total - admins} format={fmtNum} icon={<UserCheck size={17} />} color="#22c55e" hint="só painéis" onClick={() => setRoleF(roleF === 'viewer' ? 'all' : 'viewer')} active={roleF === 'viewer'} />
        <KpiCard delay={0.15} label="Inativos" value={inativos} format={fmtNum} icon={<UserX size={17} />} color="#f59e0b" hint="sem acesso" onClick={() => setRoleF(roleF === 'inativo' ? 'all' : 'inativo')} active={roleF === 'inativo'} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1 md:max-w-md">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input className="input !pl-9" placeholder="Buscar nome, usuário, função, base…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <input ref={file} type="file" accept=".xlsx" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
          <button className="btn" onClick={() => file.current?.click()}><FileSpreadsheet size={16} /> Importar planilha</button>
          <button className="btn btn-primary" onClick={() => setEdit({ u: blank(), isNew: true })}><Plus size={16} /> Novo usuário</button>
        </div>
      </div>

      <Panel title="Usuários e acessos" subtitle={`${fmtNum(list.length)} exibidos · senhas são guardadas apenas como hash e nunca aparecem aqui`}>
        {users === null ? <div className="skeleton m-2 h-64" /> : <DataTable rows={list} cols={cols} rowKey={(u) => u.username} defaultSort={{ key: 'nome', dir: 'asc' }} maxH={560} />}
      </Panel>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.isNew ? 'Novo usuário' : 'Editar usuário'} wide>
        {edit && <UserForm initial={edit.u} isNew={edit.isNew} onSave={save} onCancel={() => setEdit(null)} />}
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title="Excluir usuário">
        <p className="text-sm">Excluir <b>{del?.nome}</b> ({del?.username})? A pessoa perde o acesso imediatamente. Para apenas bloquear, marque como Inativo.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn" onClick={() => setDel(null)}>Cancelar</button>
          <button className="btn btn-primary" onClick={async () => {
            try { await usrDelete(token, del!.username); notify('Usuário excluído.'); await load() } catch (e) { notify((e as Error).message, 'err') }
            setDel(null)
          }}>Excluir</button>
        </div>
      </Modal>

      <Modal open={!!imp} onClose={() => !busy && setImp(null)} title="Importar usuários">
        {imp && (
          <div className="space-y-3 text-sm">
            <p><b>{imp.users.length}</b> usuários na planilha: <b className="text-good">{imp.fresh} novos</b> e <b>{imp.existing} já cadastrados</b>{imp.invalid ? <>, <span className="text-bad">{imp.invalid} linhas inválidas ignoradas</span></> : null}.</p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
              <li>Novos usuários entram com perfil <b>Visualização</b> (ou o perfil da coluna PERFIL, se existir).</li>
              <li>Quem já existe tem apenas os dados cadastrais atualizados; <b>perfil e senha são mantidos</b>.</li>
              <li>Você, como administrador, nunca tem o perfil alterado pela importação.</li>
            </ul>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" className="mt-0.5" checked={reset} onChange={(e) => setReset(e.target.checked)} />
              <span>Redefinir também a senha dos usuários já cadastrados com a senha da planilha</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn" disabled={busy} onClick={() => setImp(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void runImport()}>{busy && <Loader2 size={15} className="animate-spin" />} Importar {imp.users.length}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
