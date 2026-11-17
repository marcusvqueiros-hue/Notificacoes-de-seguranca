import { useEffect, useState } from 'react'
import { ExternalLink, FileImage, FileText, Paperclip, Trash2, Undo2, X } from 'lucide-react'
import { ANEXOS_MAX, PDF_MAX_BYTES, anexoGet, anexoList, isImageFile, isPdfFile, openAttachment, prepareAttachment, type Anexo, type PdfKind } from '../lib/extras'

/** Alterações pendentes de um campo de anexos: arquivos novos e ids de arquivos já gravados a remover. */
export interface PdfChange { add: File[]; removeIds: number[] }
export const NO_CHANGE: PdfChange = { add: [], removeIds: [] }

const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
const isImg = (nome: string) => /\.(jpe?g|png)$/i.test(nome)

/** Campo para anexar vários arquivos (PDF ou imagem JPG/PNG) ligados ao nº da notificação: adicionar, ver e remover. */
export function PdfSlot({ label, kind, num, count, value, onChange, token, onError }: {
  label: string
  kind: PdfKind
  num: number | null
  /** quantos arquivos já estão gravados para este nº */
  count: number
  value: PdfChange
  onChange: (v: PdfChange) => void
  token: string
  onError: (msg: string) => void
}) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<Anexo[]>([])
  const noun = kind === 'resposta' ? 'resposta' : 'notificação'

  useEffect(() => {
    let off = false
    if (num == null || !count) { setSaved([]); return }
    anexoList(token, num, kind).then((l) => { if (!off) setSaved(l) }).catch((e) => onError((e as Error).message))
    return () => { off = true }
  }, [num, count, kind, token]) // eslint-disable-line react-hooks/exhaustive-deps

  const kept = saved.filter((a) => !value.removeIds.includes(a.id))
  const total = kept.length + value.add.length

  async function pick(files: FileList | null) {
    setErr('')
    if (!files?.length) return
    setBusy(true)
    try {
      const add = [...value.add]
      const msgs: string[] = []
      for (const file of Array.from(files)) {
        if (!isPdfFile(file) && !isImageFile(file)) { msgs.push(`${file.name}: só PDF, JPG ou PNG.`); continue }
        if (kept.length + add.length >= ANEXOS_MAX) { msgs.push(`Máximo de ${ANEXOS_MAX} arquivos.`); break }
        try {
          const f = await prepareAttachment(file)
          if (f.size > PDF_MAX_BYTES) { msgs.push(`${file.name}: muito grande (${fmtSize(f.size)}), máximo de 4 MB.`); continue }
          if (add.some((x) => x.name === f.name && x.size === f.size)) continue
          add.push(f)
        } catch (e) { msgs.push(`${file.name}: ${(e as Error).message}`) }
      }
      if (add.length !== value.add.length) onChange({ ...value, add })
      if (msgs.length) setErr(msgs.join(' '))
    } finally { setBusy(false) }
  }

  async function view(id: number) {
    try {
      const p = await anexoGet(token, id)
      if (p) openAttachment(p)
      else onError('Arquivo não encontrado.')
    } catch (e) { onError((e as Error).message) }
  }

  const row = 'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold'
  return (
    <div className="block text-xs font-semibold text-muted">
      {label}
      <div className="mt-1 rounded-xl border border-dashed border-line bg-surface2 p-3 font-normal">
        {total === 0 && !saved.length && <p className="mb-2 text-xs text-muted">Nenhum arquivo anexado · PDF ou imagem (JPG/PNG), até 4 MB cada</p>}
        {(saved.length > 0 || value.add.length > 0) && (
          <ul className="mb-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
            {saved.map((a) => {
              const removed = value.removeIds.includes(a.id)
              return (
                <li key={a.id} className={`${row} ${removed ? 'bg-bad/10 text-bad line-through opacity-70' : 'bg-info/15 text-info'}`}>
                  {isImg(a.nome) ? <FileImage size={14} className="shrink-0" /> : <FileText size={14} className="shrink-0" />}
                  <span className="min-w-0 flex-1 truncate" title={a.nome}>{a.nome} · {fmtSize(a.tamanho)}</span>
                  {removed ? (
                    <button type="button" className="shrink-0 text-muted no-underline hover:text-ink" title="Manter o arquivo" aria-label={`Manter ${a.nome}`} onClick={() => onChange({ ...value, removeIds: value.removeIds.filter((i) => i !== a.id) })}><Undo2 size={14} /></button>
                  ) : (
                    <>
                      <button type="button" className="shrink-0 hover:text-ink" title="Ver arquivo" aria-label={`Ver ${a.nome}`} onClick={() => void view(a.id)}><ExternalLink size={14} /></button>
                      <button type="button" className="shrink-0 hover:text-bad" title="Remover arquivo" aria-label={`Remover ${a.nome}`} onClick={() => onChange({ ...value, removeIds: [...value.removeIds, a.id] })}><Trash2 size={14} /></button>
                    </>
                  )}
                </li>
              )
            })}
            {value.add.map((f, i) => (
              <li key={`${f.name}-${i}`} className={`${row} bg-good/15 text-good`}>
                {isImageFile(f) ? <FileImage size={14} className="shrink-0" /> : <FileText size={14} className="shrink-0" />}
                <span className="min-w-0 flex-1 truncate" title={f.name}>{f.name} · {fmtSize(f.size)} <em className="font-normal not-italic opacity-80">(novo)</em></span>
                <button type="button" className="shrink-0 hover:text-ink" title="Desfazer" aria-label={`Desfazer ${f.name}`} onClick={() => onChange({ ...value, add: value.add.filter((_, j) => j !== i) })}><X size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className={`btn !px-3 !py-1.5 text-xs ${busy || total >= ANEXOS_MAX ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
            <Paperclip size={14} /> {busy ? 'Preparando…' : total ? 'Adicionar mais arquivos' : 'Anexar PDF ou imagem'}
            <input type="file" multiple accept="application/pdf,.pdf,image/jpeg,image/png,.jpg,.jpeg,.png" hidden onChange={(e) => { void pick(e.target.files); e.target.value = '' }} />
          </label>
          {total > 0 && <span className="text-[11px] text-muted">{total} de {ANEXOS_MAX} arquivos da {noun}</span>}
        </div>
        {num == null && value.add.length > 0 && <p className="mt-2 text-xs text-warn">Preencha o nº da notificação: os arquivos são gravados junto com ele.</p>}
        {err && <p role="alert" className="mt-2 text-xs text-bad">{err}</p>}
      </div>
    </div>
  )
}
