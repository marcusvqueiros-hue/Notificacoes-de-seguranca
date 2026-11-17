import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Copy, Download, FileSpreadsheet, FileText, Loader2, MessageSquareReply, Pencil, Plus, Search, StickyNote, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { useData } from '../lib/hooks'
import { uniq } from '../lib/aggregate'
import { fmtBRL, fmtDate, fmtNum, short } from '../lib/format'
import { Field, Modal, Panel, useDebounced } from '../components/ui'
import { DataTable, type Col } from '../components/DataTable'
import { Badge } from './Overview'
import { matchRows, planCleanup } from '../lib/dedupe'
import { CollaboratorInput } from '../components/CollaboratorInput'
import { anexoContagem, anexoDelete, anexoGet, anexoList, anexoSave, obsList, obsSave, openAttachment, type Anexo, type Obs, type PdfKind } from '../lib/extras'
import { NO_CHANGE, PdfSlot, type PdfChange } from '../components/PdfSlot'
import { diasAtraso, hojeIso, isVencida, vencimento } from '../lib/prazo'
import type { Notificacao, NotificacaoInput } from '../lib/types'

const today = () => new Date().toISOString().slice(0, 10)
const blank = (): NotificacaoInput => ({
  notificacao: null, data: today(), inspetor: '', equipe: '', base: '', gerencia: '', naoConformidade: '', qnt: 1, pnt: 5, valor: 500,
  tratado: false, dias: 5, dataLancamento: null, inspecao: null, coordenador: '', processo: '', status: '', eletricistas: [],
})

function Datalist({ id, options }: { id: string; options: string[] }) {
  return <datalist id={id}>{options.map((o) => <option key={o} value={o} />)}</datalist>
}

function RecordForm({ initial, pdfNums, obsMap, onSaved, onDone }: {
  initial: NotificacaoInput
  pdfNums: Record<PdfKind, Record<number, number>>
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
  const [pdfs, setPdfs] = useState<Record<PdfKind, PdfChange>>({ notificacao: NO_CHANGE, resposta: NO_CHANGE })
  const num = f.notificacao
  const cnt = (k: PdfKind) => (num != null ? pdfNums[k][num] ?? 0 : 0)
  const obsMeta = num != null ? obsMap[String(num)] : undefined
  const hoje = hojeIso()
  const venc = vencimento(f)
  const atraso = diasAtraso(f, hoje)
  const prazoMsg = f.tratado ? (
    <span className="text-muted">Notificação tratada: não vence.</span>
  ) : venc ? (
    <span className={atraso ? 'font-semibold text-bad' : 'text-muted'}>
      Vence em {fmtDate(venc)} ({f.dias} {f.dias === 1 ? 'dia útil' : 'dias úteis'} após o lançamento, sem sábados, domingos e feriados nacionais)
      {atraso > 0 && ` · vencida há ${atraso} ${atraso === 1 ? 'dia útil' : 'dias úteis'}`}
    </span>
  ) : (
    <span className="text-muted">Informe a data de lançamento e o prazo para calcular o vencimento (só entram na conta de vencidas as notificações com os dois).</span>
  )
  const opt = useMemo(() => ({
    inspetor: uniq(rows, 'inspetor'), equipe: uniq(rows, 'equipe'), base: uniq(rows, 'base'), gerencia: uniq(rows, 'gerencia'),
    nc: uniq(rows, 'naoConformidade'), coord: uniq(rows, 'coordenador'), proc: uniq(rows, 'processo'),
    colab: uniq(rows, 'colaborador'),
  }), [rows])

  const set = <K extends keyof NotificacaoInput>(k: K, v: NotificacaoInput[K]) => setF((s) => ({ ...s, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if ((pdfs.notificacao.add.length || pdfs.resposta.add.length || obs.trim()) && num == null) {
      notify('Informe o nº da notificação para gravar os anexos e as observações.', 'err')
      return
    }
    setBusy(true)
    try {
      await saveRow({ ...f, eletricistas: elet })
      let extraErr = ''
      if (num != null) {
        try {
          for (const k of ['notificacao', 'resposta'] as PdfKind[]) {
            const p = pdfs[k]
            for (const id of p.removeIds) await anexoDelete(session.token, id)
            for (const file of p.add) await anexoSave(session.token, num, file, k)
          }
          if (obs.trim() !== obsInit.trim()) await obsSave(session.token, num, obs, session.username)
        } catch (ex) {
          extraErr = (ex as Error).message
        }
      }
      onSaved()
      if (extraErr) notify(`Notificação salva, mas o anexo/observação não foi gravado: ${extraErr}`, 'err')
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
      <Field label="Data de lançamento"><input type="date" className="input" value={f.dataLancamento ?? ''} onChange={(e) => set('dataLancamento', e.target.value || null)} /></Field>
      <Field label="Prazo (dias úteis)"><input type="number" min={0} className="input" value={f.dias ?? ''} onChange={(e) => set('dias', e.target.value ? Number(e.target.value) : null)} /></Field>
      <p className="col-span-2 -mt-1 text-[11px] md:col-span-4" aria-live="polite">{prazoMsg}</p>
      <div className="col-span-2 md:col-span-4">
        <Field label="Colaboradores / eletricistas">
          <CollaboratorInput value={elet} onChange={setElet} options={opt.colab} />
        </Field>
      </div>

      <div className="col-span-2 md:col-span-4">
        <div className="grid gap-3 md:grid-cols-2">
          <PdfSlot label="Notificação (PDF ou imagem)" kind="notificacao" num={num} count={cnt('notificacao')} value={pdfs.notificacao} onChange={(v) => setPdfs((p) => ({ ...p, notificacao: v }))} token={session.token} onError={(m) => notify(m, 'err')} />
          <PdfSlot label="Resposta da notificação (PDF ou imagem)" kind="resposta" num={num} count={cnt('resposta')} value={pdfs.resposta} onChange={(v) => setPdfs((p) => ({ ...p, resposta: v }))} token={session.token} onError={(m) => notify(m, 'err')} />
        </div>
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
  const { rows: allRows, filtered } = useData()
  const { session, deleteRow, saveRow, notify, importRows } = useStore()
  const admin = session?.role === 'admin'
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [edit, setEdit] = useState<NotificacaoInput | null>(null)
  const [del, setDel] = useState<Notificacao | null>(null)
  const [importing, setImporting] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const [pdfNums, setPdfNums] = useState<Record<PdfKind, Record<number, number>>>({ notificacao: {}, resposta: {} })
  const [obsMap, setObsMap] = useState<Record<string, Obs>>({})
  const hoje = hojeIso()

  const loadExtras = useCallback(async () => {
    if (!session) return
    try {
      const [p, r, o] = await Promise.all([
        anexoContagem(session.token, 'notificacao'),
        anexoContagem(session.token, 'resposta'), // exige o SQL 07_anexos_multiplos.sql
        obsList(session.token),
      ])
      setPdfNums({ notificacao: p, resposta: r })
      setObsMap(o)
    } catch { /* anexos/observações exigem os SQLs 04 a 07; a lista continua funcionando */ }
  }, [session])
  useEffect(() => { if (admin) void loadExtras() }, [admin, loadExtras])

  const cleanup = useMemo(() => (admin ? planCleanup(allRows) : null), [admin, allRows])
  const [fixOpen, setFixOpen] = useState(false)
  const [fixBusy, setFixBusy] = useState('')

  async function runCleanup() {
    if (!cleanup) return
    try {
      let n = 0
      const total = cleanup.fills.length + cleanup.dup.length
      for (const f of cleanup.fills) {
        setFixBusy(`Atualizando ${++n} de ${total}…`)
        await saveRow({ ...f.existing, notificacao: f.incoming.notificacao, inspecao: f.existing.inspecao ?? f.incoming.inspecao })
        await deleteRow(f.incoming.id)
      }
      for (const r of cleanup.dup) {
        setFixBusy(`Removendo ${++n} de ${total}…`)
        await deleteRow(r.id)
      }
      notify(`${cleanup.dup.length} itens duplicados removidos${cleanup.fills.length ? ` e ${cleanup.fills.length} nº preenchido` : ''}.`)
      setFixOpen(false)
    } catch (e) {
      notify((e as Error).message, 'err')
    } finally {
      setFixBusy('')
    }
  }

  const [picker, setPicker] = useState<{ n: number; kind: PdfKind; list: Anexo[] } | null>(null)
  async function openAnexo(id: number) {
    try {
      const p = await anexoGet(session!.token, id)
      if (p) openAttachment(p)
      else notify('Arquivo não encontrado.', 'err')
    } catch (e) { notify((e as Error).message, 'err') }
  }
  /** Um arquivo abre direto; vários abrem uma lista para escolher. */
  async function openAnexosOf(n: number, kind: PdfKind) {
    try {
      const list = await anexoList(session!.token, n, kind)
      if (list.length === 1) await openAnexo(list[0].id)
      else if (list.length > 1) setPicker({ n, kind, list })
      else notify('Arquivo não encontrado.', 'err')
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
    {
      key: 'venc', label: 'Vencimento', align: 'center',
      sort: (r) => vencimento(r) ?? '',
      render: (r) => {
        const v = vencimento(r)
        if (!v) return <span className="text-muted/40" title="Sem data de lançamento ou prazo">—</span>
        const late = isVencida(r, hoje)
        return (
          <span className={late ? 'font-bold text-bad' : r.tratado ? 'text-muted' : ''} title={late ? `Vencida há ${diasAtraso(r, hoje)} dia(s) útil(eis)` : undefined}>
            {fmtDate(v)}{late && ' ⚠'}
          </span>
        )
      },
    },
    ...(admin ? [
      ...(['notificacao', 'resposta'] as PdfKind[]).map((kind) => ({
        key: kind === 'resposta' ? 'resp' : 'pdf', label: kind === 'resposta' ? 'Resposta' : 'Anexo', align: 'center' as const,
        sort: (r: Notificacao) => (r.notificacao != null ? pdfNums[kind][r.notificacao] ?? 0 : 0),
        render: (r: Notificacao) => {
          const c = r.notificacao != null ? pdfNums[kind][r.notificacao] ?? 0 : 0
          if (!c) return <span className="text-muted/40">—</span>
          const nome = kind === 'resposta' ? 'resposta' : 'notificação'
          return (
            <button
              className={`inline-flex items-center gap-1 rounded-lg p-1.5 ${kind === 'resposta' ? 'text-good hover:bg-good/10' : 'text-info hover:bg-info/10'}`}
              aria-label={`Abrir ${c > 1 ? `os ${c} arquivos` : 'o arquivo'} da ${nome} ${r.notificacao}`}
              title={c > 1 ? `${c} arquivos da ${nome}` : `Abrir arquivo da ${nome} (PDF ou imagem)`}
              onClick={(e) => { e.stopPropagation(); void openAnexosOf(r.notificacao!, kind) }}
            >
              {kind === 'resposta' ? <MessageSquareReply size={15} /> : <FileText size={15} />}
              {c > 1 && <span className="text-[11px] font-bold">{c}</span>}
            </button>
          )
        },
      })),
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
    const head = ['Nº', 'Data', 'Inspetor', 'Equipe', 'Base', 'Gerência', 'Não conformidade', 'Qnt', 'Pnt', 'Valor', 'Tratado', 'Lançamento', 'Prazo (dias úteis)', 'Vencimento', 'Coordenador', 'Processo', 'Status', 'Eletricistas', 'Observação']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = list.map((r) => [r.notificacao ?? '', r.data, r.inspetor, r.equipe, r.base, r.gerencia, r.naoConformidade, r.qnt, r.pnt, r.valor, r.tratado ? 'SIM' : 'NÃO', r.dataLancamento ?? '', r.dias ?? '', vencimento(r) ?? '', r.coordenador, r.processo, r.status, r.eletricistas.join('; '), obsMap[String(r.notificacao)]?.texto ?? ''].map(esc).join(';'))
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
      // a planilha traz todo o histórico: só entra o que ainda não está cadastrado
      const { matched, fills, novos } = matchRows(allRows, parsed)
      if (!novos.length && !fills.length) {
        notify(`Nenhuma notificação nova: os ${parsed.length} itens da planilha já estão cadastrados.`)
        return
      }
      const msg = [
        `A planilha tem ${parsed.length} itens:`,
        `• ${matched.length} já cadastrados (ignorados)`,
        `• ${novos.length} novos (serão adicionados)`,
        fills.length ? `• ${fills.length} já cadastrados sem nº, que agora têm nº (serão atualizados)` : '',
        '',
        'Continuar?',
      ].filter((l, i) => l || i === 4).join('\n')
      if (!confirm(msg)) return
      for (const f of fills) await saveRow({ ...f.existing, notificacao: f.incoming.notificacao, inspecao: f.existing.inspecao ?? f.incoming.inspecao })
      if (novos.length) await importRows(novos)
      notify(`${novos.length} novas notificações importadas${fills.length ? ` e ${fills.length} atualizadas` : ''}. ${matched.length} já existiam.`)
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
          {cleanup && <button className="btn btn-danger" onClick={() => setFixOpen(true)}><Copy size={16} /> Corrigir duplicados ({cleanup.dup.length + cleanup.fills.length})</button>}
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
      <Modal open={!!picker} onClose={() => setPicker(null)} title={picker ? `Arquivos da ${picker.kind === 'resposta' ? 'resposta' : 'notificação'} ${picker.n}` : ''}>
        {picker && (
          <ul className="space-y-2 text-sm">
            {picker.list.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2">
                <FileText size={15} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate" title={a.nome}>{a.nome}</span>
                <button className="btn !px-3 !py-1 text-xs" onClick={() => void openAnexo(a.id)}>Abrir</button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
      <Modal open={fixOpen} onClose={() => !fixBusy && setFixOpen(false)} title="Corrigir duplicados da última importação">
        {cleanup && (
          <div className="space-y-3 text-sm">
            <p>A última importação gravou <b>{fmtNum(cleanup.batch)}</b> itens, mas <b>{fmtNum(cleanup.dup.length + cleanup.fills.length)}</b> deles já estavam cadastrados.</p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
              <li><b className="text-bad">{fmtNum(cleanup.dup.length)}</b> repetidos serão <b>removidos</b> (o cadastro original, com suas edições, é mantido).</li>
              {cleanup.fills.length > 0 && <li><b>{fmtNum(cleanup.fills.length)}</b> serão mesclados: o item antigo recebe o nº da notificação que a planilha trouxe.</li>}
              <li><b className="text-good">{fmtNum(cleanup.novos)}</b> são notificações novas e <b>permanecem</b>.</li>
            </ul>
            <p className="text-xs text-muted">A comparação usa nº da notificação, data, equipe e não conformidade. Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn" disabled={!!fixBusy} onClick={() => setFixOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!!fixBusy} onClick={() => void runCleanup()}>{fixBusy ? <><Loader2 size={15} className="animate-spin" /> {fixBusy}</> : 'Corrigir agora'}</button>
            </div>
          </div>
        )}
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
