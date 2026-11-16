import { useState } from 'react'
import { ExternalLink, FileText, Paperclip, Trash2 } from 'lucide-react'
import { PDF_MAX_BYTES, isImageFile, isPdfFile, openAttachment, pdfGet, prepareAttachment, type PdfKind } from '../lib/extras'
import { Field } from './ui'

export interface PdfChange { file: File | null; remove: boolean }

const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

/** Campo para anexar, ver, substituir ou remover o anexo (PDF ou imagem JPG/PNG) ligado ao nº da notificação. */
export function PdfSlot({ label, kind, num, exists, value, onChange, token, onError }: {
  label: string
  kind: PdfKind
  num: number | null
  exists: boolean
  value: PdfChange
  onChange: (v: PdfChange) => void
  token: string
  onError: (msg: string) => void
}) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const noun = kind === 'resposta' ? 'resposta' : 'notificação'

  async function pick(file?: File) {
    setErr('')
    if (!file) return
    if (!isPdfFile(file) && !isImageFile(file)) return setErr('Selecione um PDF ou uma imagem (JPG ou PNG).')
    setBusy(true)
    try {
      const f = await prepareAttachment(file)
      if (f.size > PDF_MAX_BYTES) return setErr(`Arquivo muito grande (${fmtSize(f.size)}). Máximo de 4 MB.`)
      onChange({ file: f, remove: false })
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  async function view() {
    try {
      const p = await pdfGet(token, num!, kind)
      if (p) openAttachment(p)
      else onError('Arquivo não encontrado.')
    } catch (e) { onError((e as Error).message) }
  }

  const { file, remove } = value
  return (
    <Field label={label}>
      <div className="rounded-xl border border-dashed border-line bg-surface2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {file ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-good/15 px-3 py-1.5 text-xs font-semibold text-good"><FileText size={14} /> {file.name} · {fmtSize(file.size)}</span>
          ) : exists && !remove ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-info/15 px-3 py-1.5 text-xs font-semibold text-info"><FileText size={14} /> Arquivo da {noun} já anexado ({num})</span>
          ) : (
            <span className="text-xs text-muted">Nenhum arquivo anexado · PDF ou imagem (JPG/PNG) de até 4 MB</span>
          )}
          <label className={`btn !px-3 !py-1.5 text-xs ${busy ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>
            <Paperclip size={14} /> {busy ? 'Preparando…' : exists || file ? 'Substituir arquivo' : 'Anexar PDF ou imagem'}
            <input type="file" accept="application/pdf,.pdf,image/jpeg,image/png,.jpg,.jpeg,.png" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {exists && !file && !remove && (
            <>
              <button type="button" className="btn !px-3 !py-1.5 text-xs" onClick={() => void view()}><ExternalLink size={14} /> Ver arquivo</button>
              <button type="button" className="btn btn-danger !px-3 !py-1.5 text-xs" onClick={() => onChange({ file: null, remove: true })}><Trash2 size={14} /> Remover</button>
            </>
          )}
          {file && <button type="button" className="text-xs text-muted underline" onClick={() => onChange({ file: null, remove: false })}>desfazer</button>}
          {remove && <button type="button" className="text-xs text-muted underline" onClick={() => onChange({ file: null, remove: false })}>manter o arquivo</button>}
        </div>
        {num == null && file && <p className="mt-2 text-xs text-warn">Preencha o nº da notificação: o arquivo é gravado junto com ele.</p>}
        {err && <p role="alert" className="mt-2 text-xs text-bad">{err}</p>}
      </div>
    </Field>
  )
}
