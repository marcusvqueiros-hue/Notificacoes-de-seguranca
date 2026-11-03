import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Download, ExternalLink, FileSpreadsheet, FileText, Loader2, Paperclip, Pencil, Plus, Search, StickyNote, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { useData } from '../lib/hooks'
import { uniq } from '../lib/aggregate'
import { fmtBRL, fmtDate, fmtNum, short } from '../lib/format'
import { Field, Modal, Panel, useDebounced } from '../components/ui'
import { DataTable, type Col } from '../components/DataTable'
import { Badge } from './Overview'
import { CollaboratorInput } from '../components/CollaboratorInput'
import { PDF_MAX_BYTES, obsList, obsSave, openPdf, pdfDelete, pdfGet, pdfNumeros, pdfSave, type Obs } from '../lib/extras'
import type { Notificacao, NotificacaoInput } from '../lib/types'

const today = () => new Date().toISOString().slice(0, 10)
const blank = (): NotificacaoInput => ({
  notificacao: null, data: today(), inspetor: '', equipe: '', base: '', gerencia: '', naoConformidade: '', qnt: 1, pnt: 5, valor: 500,
  tratado: false, dias: null, inspecao: null, coordenador: '', processo: '', status: '', eletricistas: [],
})

function Datalist({ id, options }: { id: string; options: string[] }) {
  return <datalist id={id}>{options.map((o) => <option key={o} value={o} />)}</datalist>
}

const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

function RecordForm({ initial, pdfNums, obsMap, onSaved, onDone }: {
  initial: NotificacaoInput
  pdfNums: Set<number>
  obsMap: Record<string, Obs>
  onSaved: () => void
  onDone: () => void
}) {
  const session = useStore((s) => s.session)!
  const rows = useStore((s) => s.rows)
  const saveRow = useStore((s) => s.saveRow)
  const notify = useStore((s) => s.notify)
  const [f, setF] = useState(initial)
  const [valorManual, setValorManual] = useState(!!initial.id)
  const [busy, setBusy] = useState(false)
  const [elet, setElet] = useState<string[]>(initial.eletricistas)
  const obsInit = (initial.notificacao != null ? obsMap[String(initial.notificacao)]?.texto : '') ?? ''
  const [obs, setObs] = useState(obsInit)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [removePdf, setRemovePdf] = useState(false)
  const [pdfErr, setPdfErr] = useState('')
  const num = f.notificacao
  const hasPdf = num != null && pdfNums.has(num)
  const obsMeta = num != null ? obsMap[String(num)] : undefined
  const opt = useMemo(() => ({
    inspetor: uniq(rows, 'inspetor'), equipe: uniq(rows, 'equipe'), base: uniq(rows, 'base'), gerencia: uniq(rows, 'gerencia'),
    nc: uniq(rows, 'naoConformidade'), coord: uniq(rows, 'coordenador'), proc: uniq(rows, 'processo'),
    colab: uniq(rows, 'colaborador'),
  }), [rows])

  function pickPdf(file?: File) {
    setPdfErr('')
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return setPdfErr('Selecione um arquivo PDF.')
    if (file.size > PDF_MAX_BYTES) return setPdfErr(`PDF muito grande (${fmtSize(file.size)}). Máximo de 4 MB.`)
    setPdfFile(file)
    setRemovePdf(false)
  }

  async function openCurrent() {
    try {
      const p = await pdfGet(session.token, num!)
      if (p) openPdf(p)
      else notify('PDF não encontrado.', 'err')
    } catch (e) { notify((e as Error).message, 'err') }
  }
  const set = <K extends keyof NotificacaoInput>(k: K, v: NotificacaoInput[K]) => setF((s) => ({ ...s, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if ((pdfFile || obs.trim()) && num == null) {
      notify('Informe o nº da notificação para gravar o PDF e as observações.', 'err')
      return
    }
    setBusy(true)
    try {
      await saveRow({ ...f, eletricistas: elet })
      let extraErr = ''
      if (num != null) {
        try {
          if (pdfFile) await pdfSave(session.token, num, pdfFile)
          else if (removePdf && hasPdf) await pdfDelete(session.token, num)
          if (obs.trim() !== obsInit.trim()) await obsSave(session.token, num, obs, session.username)
        } catch (ex) {
          extraErr = (ex as Error).message
        }
      }
      onSaved()
      if (extraErr) notify(`Notificação salva, mas o PDF/observação não foi gravado: ${extraErr}`, 'err')
      else notify(f.id ? 'Notificação atualizada.' : 'Notificação cadastrada.')
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
        <Field label="Colaboradores / eletricistas">
          <CollaboratorInput value={elet} onChange={setElet} options={opt.colab} />
        </Field>
      </div>

      <div className="col-span-2 md:col-span-4">
        <Field label="Notificação em PDF">
          <div className="rounded-xl border border-dashed border-line bg-surface2 p-3">
            {(
              <div className="flex flex-wrap items-center gap-2">
                {pdfFile ? (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-good/15 px-3 py-1.5 text-xs font-semibold text-good"><FileText size={14} /> {pdfFile.name} · {fmtSize(pdfFile.size)}</span>
                ) : hasPdf && !removePdf ? (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-info/15 px-3 py-1.5 text-xs font-semibold text-info"><FileText size={14} /> PDF já anexado à notificação {num}</span>
                ) : (
                  <span className="text-xs text-muted">Nenhum PDF anexado · arquivo .pdf de até 4 MB</span>
                )}
                <label className="btn !px-3 !py-1.5 cursor-pointer text-xs">
                  <Paperclip size={14} /> {hasPdf || pdfFile ? 'Substituir PDF' : 'Anexar PDF'}
                  <input type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { pickPdf(e.target.files?.[0]); e.target.value = '' }} />
                </label>
                {hasPdf && !pdfFile && !removePdf && (
                  <>
                    <button type="button" className="btn !px-3 !py-1.5 text-xs" onClick={() => void openCurrent()}><ExternalLink size={14} /> Ver PDF</button>
                    <button type="button" className="btn btn-danger !px-3 !py-1.5 text-xs" onClick={() => setRemovePdf(true)}><Trash2 size={14} /> Remover</button>
                  </>
                )}
                {pdfFile && <button type="button" className="text-xs text-muted underline" onClick={() => setPdfFile(null)}>desfazer</button>}
                {removePdf && <button type="button" className="text-xs text-muted underline" onClick={() => setRemovePdf(false)}>manter o PDF</button>}
              </div>
            )}
            {num == null && pdfFile && <p className="mt-2 text-xs text-warn">Preencha o nº da notificação: o PDF é gravado junto com ele.</p>}
            {pdfErr && <p role="alert" className="mt-2 text-xs text-bad">{pdfErr}</p>}
          </div>
        </Field>
      </div>

      <div className="col-span-2 md:col-span-4">
        <Field label="Observações">
          <textarea
            rows={3}
            maxLength={4000}
            className="input"
            placeholder="Observações sobre esta notificação (visível só para administradores)…"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
          />
        </Field>
        <p className="mt-1 text-[11px] text-muted">
          {obs.length}/4000 · vale para todos os itens da notificação {num ?? ''}
          {obsMeta?.por && <> · última edição por {obsMeta.por}{obsMeta.em ? ` em ${new Date(obsMeta.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}</>}
        </p>
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
  const [pdfNums, setPdfNums] = useState<Set<number>>(new Set())
  const [obsMap, setObsMap] = useState<Record<string, Obs>>({})

  const loadExtras = useCallback(async () => {
    if (!session) return
    try {
      const [p, o] = await Promise.all([pdfNumeros(session.token), obsList(session.token)])
      setPdfNums(new Set(p))
      setObsMap(o)
    } catch { /* PDF/observações exigem o SQL 04_anexos_pdf.sql; a lista continua funcionando */ }
  }, [session])
  useEffect(() => { if (admin) void loadExtras() }, [admin, loadExtras])

  async function openPdfOf(n: number) {
    try {
      const p = await pdfGet(session!.token, n)
      if (p) openPdf(p)
      else notify('PDF não encontrado.', 'err')
    } catch (e) { notify((e as Error).message, 'err') }
  }

  const list = useMemo(() => {
    const t = dq.trim().toLowerCase()
    if (!t) return filtered
    return filtered.filter((r) => [r.notificacao ?? '', r.equipe, r.naoConformidade, r.inspetor, r.base, r.coordenador, obsMap[String(r.notificacao)]?.texto ?? '', ...r.eletricistas].join(' ').toLowerCase().includes(t))
  }, [filtered, dq, obsMap])

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
    ...(admin ? [
      {
        key: 'pdf', label: 'PDF', align: 'center' as const,
        sort: (r: Notificacao) => (r.notificacao != null && pdfNums.has(r.notificacao) ? 1 : 0),
        render: (r: Notificacao) => r.notificacao != null && pdfNums.has(r.notificacao)
          ? <button className="rounded-lg p-1.5 text-info hover:bg-info/10" aria-label={`Abrir PDF da notificação ${r.notificacao}`} title="Abrir PDF" onClick={(e) => { e.stopPropagation(); void openPdfOf(r.notificacao!) }}><FileText size={15} /></button>
          : <span className="text-muted/40">—</span>,
      },
      {
        key: 'obs', label: 'Observação',
        render: (r: Notificacao) => {
          const o = r.notificacao != null ? obsMap[String(r.notificacao)] : undefined
          return o ? <span className="inline-flex items-center gap-1.5" title={o.texto}><StickyNote size={13} className="shrink-0 text-accent" />{short(o.texto, 46)}</span> : <span className="text-muted/40">—</span>
        },
      },
    ] : []),
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
    const head = ['Nº', 'Data', 'Inspetor', 'Equipe', 'Base', 'Gerência', 'Não conformidade', 'Qnt', 'Pnt', 'Valor', 'Tratado', 'Coordenador', 'Processo', 'Status', 'Eletricistas', 'Observação']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = list.map((r) => [r.notificacao ?? '', r.data, r.inspetor, r.equipe, r.base, r.gerencia, r.naoConformidade, r.qnt, r.pnt, r.valor, r.tratado ? 'SIM' : 'NÃO', r.coordenador, r.processo, r.status, r.eletricistas.join('; '), obsMap[String(r.notificacao)]?.texto ?? ''].map(esc).join(';'))
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
        {edit && <RecordForm initial={edit} pdfNums={pdfNums} obsMap={obsMap} onSaved={() => void loadExtras()} onDone={() => setEdit(null)} />}
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
