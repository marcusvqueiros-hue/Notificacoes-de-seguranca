import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Download, FileSpreadsheet, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { useData } from '../lib/hooks'
import { uniq } from '../lib/aggregate'
import { fmtBRL, fmtDate, fmtNum, short } from '../lib/format'
import { Field, Modal, Panel, useDebounced } from '../components/ui'
import { DataTable, type Col } from '../components/DataTable'
import { Badge } from './Overview'
import type { Notificacao, NotificacaoInput } from '../lib/types'

const today = () => new Date().toISOString().slice(0, 10)
const blank = (): NotificacaoInput => ({
  notificacao: null, data: today(), inspetor: '', equipe: '', base: '', gerencia: '', naoConformidade: '', qnt: 1, pnt: 5, valor: 500,
  tratado: false, dias: null, inspecao: null, coordenador: '', processo: '', status: '', eletricistas: [],
})

function Datalist({ id, options }: { id: string; options: string[] }) {
  return <datalist id={id}>{options.map((o) => <option key={o} value={o} />)}</datalist>
}

function RecordForm({ initial, onDone }: { initial: NotificacaoInput; onDone: () => void }) {
  const rows = useStore((s) => s.rows)
  const saveRow = useStore((s) => s.saveRow)
  const notify = useStore((s) => s.notify)
  const [f, setF] = useState(initial)
  const [valorManual, setValorManual] = useState(!!initial.id)
  const [busy, setBusy] = useState(false)
  const [eletText, setEletText] = useState(initial.eletricistas.join('\n'))
  const opt = useMemo(() => ({
    inspetor: uniq(rows, 'inspetor'), equipe: uniq(rows, 'equipe'), base: uniq(rows, 'base'), gerencia: uniq(rows, 'gerencia'),
    nc: uniq(rows, 'naoConformidade'), coord: uniq(rows, 'coordenador'), proc: uniq(rows, 'processo'),
  }), [rows])
  const set = <K extends keyof NotificacaoInput>(k: K, v: NotificacaoInput[K]) => setF((s) => ({ ...s, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await saveRow({ ...f, eletricistas: eletText.split('\n').map((x) => x.trim().toUpperCase()).filter(Boolean) })
      notify(f.id ? 'Notificação atualizada.' : 'Notificação cadastrada.')
      onDone()
    } catch (ex) {
      notify((ex as Error).message, 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Field label="Nº da notificação"><input type="number" className="input" value={f.notificacao ?? ''} onChange={(e) => set('notificacao', e.target.value ? Number(e.target.value) : null)} /></Field>
      <Field label="Data"><input required type="date" className="input" value={f.data} onChange={(e) => set('data', e.target.value)} /></Field>
      <Field label="Nº da inspeção"><input type="number" className="input" value={f.inspecao ?? ''} onChange={(e) => set('inspecao', e.target.value ? Number(e.target.value) : null)} /></Field>
      <Field label="Inspetor"><input list="dl-insp" className="input" value={f.inspetor} onChange={(e) => set('inspetor', e.target.value.toUpperCase())} /></Field>
      <Field label="Equipe"><input required list="dl-eq" className="input" value={f.equipe} onChange={(e) => set('equipe', e.target.value.toUpperCase())} /></Field>
      <Field label="Base"><input required list="dl-base" className="input" value={f.base} onChange={(e) => set('base', e.target.value.toUpperCase())} /></Field>
      <Field label="Gerência"><input required list="dl-ger" className="input" value={f.gerencia} onChange={(e) => set('gerencia', e.target.value.toUpperCase())} /></Field>
      <Field label="Coordenador"><input list="dl-coord" className="input" value={f.coordenador} onChange={(e) => set('coordenador', e.target.value.toUpperCase())} /></Field>
      <div className="col-span-2 md:col-span-4">
        <Field label="Não conformidade"><input required list="dl-nc" className="input" value={f.naoConformidade} onChange={(e) => set('naoConformidade', e.target.value)} /></Field>
      </div>
      <Field label="Processo"><input list="dl-proc" className="input" value={f.processo} onChange={(e) => set('processo', e.target.value.toUpperCase())} /></Field>
      <Field label="Qnt"><input type="number" min={1} className="input" value={f.qnt} onChange={(e) => { const qnt = Number(e.target.value); setF((s) => ({ ...s, qnt, valor: valorManual ? s.valor : s.pnt * 100 * qnt })) }} /></Field>
      <Field label="Pontos">
        <input type="number" min={0} className="input" value={f.pnt} onChange={(e) => { const pnt = Number(e.target.value); setF((s) => ({ ...s, pnt, valor: valorManual ? s.valor : pnt * 100 * s.qnt })) }} />
      </Field>
      <Field label="Valor da multa (R$)">
        <input type="number" min={0} step="0.01" className="input" value={f.valor} onChange={(e) => { setValorManual(true); set('valor', Number(e.target.value)) }} />
      </Field>
      <Field label="Tratado">
        <select className="input" value={f.tratado ? 'sim' : 'nao'} onChange={(e) => set('tratado', e.target.value === 'sim')}>
          <option value="nao">Não (em tratamento)</option>
          <option value="sim">Sim</option>
        </select>
      </Field>
      <Field label="Status">
        <select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">—</option><option>NC RESPONDIDA</option><option>NC CONTESTADA</option>
        </select>
      </Field>
      <Field label="Dias de tratativa"><input type="number" min={0} className="input" value={f.dias ?? ''} onChange={(e) => set('dias', e.target.value ? Number(e.target.value) : null)} /></Field>
      <div className="col-span-2 md:col-span-4">
        <Field label="Eletricistas / colaboradores (um por linha)">
          <textarea rows={3} className="input" value={eletText} onChange={(e) => setEletText(e.target.value)}/>
        </Field>
      </div>
      <Datalist id="dl-insp" options={opt.inspetor} /><Datalist id="dl-eq" options={opt.equipe} /><Datalist id="dl-base" options={opt.base} />
      <Datalist id="dl-ger" options={opt.gerencia} /><Datalist id="dl-nc" options={opt.nc} /><Datalist id="dl-coord" options={opt.coord} />
      <Datalist id="dl-proc" options={opt.proc} />
      <div className="col-span-2 mt-2 flex justify-end gap-2 md:col-span-4">
        <button type="button" className="btn" onClick={onDone}>Cancelar</button>
        <button className="btn btn-primary" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />} Salvar</button>
      </div>
    </form>
  )
}

export function Records() {
  const { filtered } = useData()
  const { session, deleteRow, notify, importRows } = useStore()
  const admin = session?.role === 'admin'
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [edit, setEdit] = useState<NotificacaoInput | null>(null)
  const [del, setDel] = useState<Notificacao | null>(null)
  const [importing, setImporting] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const list = useMemo(() => {
    const t = dq.trim().toLowerCase()
    if (!t) return filtered
    return filtered.filter((r) => [r.notificacao ?? '', r.equipe, r.naoConformidade, r.inspetor, r.base, r.coordenador, ...r.eletricistas].join(' ').toLowerCase().includes(t))
  }, [filtered, dq])

  const cols: Col<Notificacao>[] = [
    { key: 'n', label: 'Nº', render: (r) => r.notificacao ?? '—', sort: (r) => r.notificacao ?? 0 },
    { key: 'd', label: 'Data', render: (r) => fmtDate(r.data), sort: (r) => r.data },
    { key: 'e', label: 'Equipe', render: (r) => <b>{r.equipe}</b>, sort: (r) => r.equipe },
    { key: 'b', label: 'Base', render: (r) => r.base, sort: (r) => r.base },
    { key: 'g', label: 'Gerência', render: (r) => r.gerencia, sort: (r) => r.gerencia },
    { key: 'nc', label: 'Não conformidade', render: (r) => <span title={r.naoConformidade}>{short(r.naoConformidade, 70)}</span> },
    { key: 'i', label: 'Inspetor', render: (r) => short(r.inspetor, 22), sort: (r) => r.inspetor },
    { key: 'p', label: 'Pts', align: 'center', render: (r) => r.pnt, sort: (r) => r.pnt },
    { key: 'v', label: 'Multa', align: 'right', render: (r) => fmtBRL(r.valor), sort: (r) => r.valor, total: fmtBRL(list.reduce((a, r) => a + r.valor, 0)) },
    { key: 't', label: 'Tratado', align: 'center', render: (r) => <Badge ok={r.tratado} />, sort: (r) => (r.tratado ? 1 : 0) },
    ...(admin ? [{
      key: 'a', label: '', align: 'right' as const,
      render: (r: Notificacao) => (
        <span className="inline-flex gap-1">
          <button className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-ink" aria-label="Editar" onClick={(e) => { e.stopPropagation(); setEdit(r) }}><Pencil size={14} /></button>
          <button className="rounded-lg p-1.5 text-muted hover:bg-bad/10 hover:text-bad" aria-label="Excluir" onClick={(e) => { e.stopPropagation(); setDel(r) }}><Trash2 size={14} /></button>
        </span>
      ),
    }] : []),
  ]

  function exportCsv() {
    const head = ['Nº', 'Data', 'Inspetor', 'Equipe', 'Base', 'Gerência', 'Não conformidade', 'Qnt', 'Pnt', 'Valor', 'Tratado', 'Coordenador', 'Processo', 'Status', 'Eletricistas']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = list.map((r) => [r.notificacao ?? '', r.data, r.inspetor, r.equipe, r.base, r.gerencia, r.naoConformidade, r.qnt, r.pnt, r.valor, r.tratado ? 'SIM' : 'NÃO', r.coordenador, r.processo, r.status, r.eletricistas.join('; ')].map(esc).join(';'))
    const blob = new Blob(['﻿' + [head.map(esc).join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `notificacoes-${today()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function onFile(f?: File) {
    if (!f) return
    setImporting(true)
    try {
      const { parseWorkbook } = await import('../lib/importXlsx')
      const parsed = await parseWorkbook(f)
      if (!parsed.length) throw new Error('Nenhuma linha válida encontrada.')
      if (!confirm(`Importar ${parsed.length} itens da planilha? Eles serão ADICIONADOS aos registros existentes.`)) return
      await importRows(parsed)
      notify(`${parsed.length} itens importados.`)
    } catch (e) {
      notify((e as Error).message, 'err')
    } finally {
      setImporting(false)
      if (file.current) file.current.value = ''
    }
  }

  return (
    <div className="mx-auto max-w-[1700px] space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1 md:max-w-md">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input className="input !pl-9" placeholder="Buscar nº, equipe, não conformidade, colaborador…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="text-xs text-muted">{fmtNum(list.length)} registros</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="btn" onClick={exportCsv}><Download size={16} /> Exportar CSV</button>
          {admin && (
            <>
              <input ref={file} type="file" accept=".xlsx" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
              <button className="btn" disabled={importing} onClick={() => file.current?.click()}>
                {importing ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Importar planilha
              </button>
              <button className="btn btn-primary" onClick={() => setEdit(blank())}><Plus size={16} /> Nova notificação</button>
            </>
          )}
        </div>
      </div>

      <Panel title="Notificações registradas" subtitle="Respeita os filtros do menu lateral">
        <DataTable rows={list} cols={cols} rowKey={(r) => r.id} pageSize={15} defaultSort={{ key: 'd', dir: 'desc' }} onRow={admin ? (r) => setEdit(r) : undefined} />
      </Panel>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar notificação' : 'Nova notificação'} wide>
        {edit && <RecordForm initial={edit} onDone={() => setEdit(null)} />}
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title="Excluir notificação">
        <p className="text-sm">Excluir a notificação <b>{del?.notificacao ?? 's/ nº'}</b> — {del?.equipe}? Esta ação não pode ser desfeita.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn" onClick={() => setDel(null)}>Cancelar</button>
          <button className="btn btn-primary" onClick={async () => {
            try { await deleteRow(del!.id); notify('Notificação excluída.') } catch (e) { notify((e as Error).message, 'err') }
            setDel(null)
          }}>Excluir</button>
        </div>
      </Modal>
    </div>
  )
}
