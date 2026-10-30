import { useEffect, useMemo, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { useData } from '../lib/hooks'
import { groupBy, sortDesc } from '../lib/aggregate'
import { buildSlides, downloadDataUrl } from '../lib/snapshot'
import { renderPanel } from '../lib/panelShot'
import { Modal } from './ui'
import type { FilterKey, Notificacao } from '../lib/types'

const LABEL: Record<FilterKey, string> = {
  ano: 'Ano', mes: 'Mês', base: 'Base', gerencia: 'Gerência', processo: 'Processo', coordenador: 'Coordenador',
  tratado: 'Situação', status: 'Status', inspetor: 'Inspetor', equipe: 'Equipe', colaborador: 'Colaborador', naoConformidade: 'Não conformidade',
}

type Mode = 'panel' | 'page' | 'coordenador' | 'base' | 'gerencia'
const MODES: { id: Mode; label: string }[] = [
  { id: 'panel', label: 'Painel completo' },
  { id: 'coordenador', label: 'Por coordenador' },
  { id: 'base', label: 'Por base' },
  { id: 'gerencia', label: 'Por gerência' },
  { id: 'page', label: 'Tela atual (slides)' },
]
const DIM_TITLE: Record<Exclude<Mode, 'panel' | 'page'>, string> = { coordenador: 'Coordenador', base: 'Base', gerencia: 'Gerência' }
const DIM_KEY: Record<Exclude<Mode, 'panel' | 'page'>, (n: Notificacao) => string> = {
  coordenador: (n) => n.coordenador, base: (n) => n.base, gerencia: (n) => n.gerencia,
}

interface Shot { url: string; label: string; file: string }

export function SnapshotButton({ title }: { title: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)} title="Gerar imagem 16:9">
        <Camera size={18} />
        <span className="hidden sm:inline">Fotografia</span>
      </button>
      {open && <SnapshotModal title={title} onClose={() => setOpen(false)} />}
    </>
  )
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()

function SnapshotModal({ title, onClose }: { title: string; onClose: () => void }) {
  const { theme, filters, page, notify } = useStore()
  const { filtered } = useData()
  const [mode, setMode] = useState<Mode>('panel')
  const [shots, setShots] = useState<Shot[] | null>(null)
  const [i, setI] = useState(0)
  const [err, setErr] = useState('')
  const [progress, setProgress] = useState('')
  const dark = theme === 'dark'

  const filterText = useMemo(
    () => (Object.keys(filters) as FilterKey[]).filter((k) => filters[k].length).map((k) => `${LABEL[k]}: ${filters[k].join(', ')}`).join('  ·  '),
    [filters],
  )
  const stamp = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    let cancelled = false
    setShots(null); setErr(''); setI(0); setProgress('')
    ;(async () => {
      try {
        await document.fonts?.ready
        if (mode === 'panel') {
          const url = await renderPanel({ rows: filtered, title: 'Painel de Notificações', subtitle: filterText || 'Todos os dados', dim: null, dark })
          if (!cancelled) setShots([{ url, label: 'Painel completo', file: `notificacoes-cgb-painel-${stamp}.png` }])
        } else if (mode === 'page') {
          const root = document.querySelector<HTMLElement>('[data-snap-root]')?.firstElementChild as HTMLElement | null
          if (!root) throw new Error('Esta tela não pode ser fotografada em slides.')
          const urls = await buildSlides({ root, title, filters: filterText, dark })
          if (!cancelled) setShots(urls.map((url, n) => ({ url, label: `Slide ${n + 1}`, file: `notificacoes-cgb-${page}-${stamp}-${n + 1}.png` })))
        } else {
          const groups = sortDesc(groupBy(filtered, DIM_KEY[mode]), 'valor')
          if (!groups.length) throw new Error('Sem dados para os filtros atuais.')
          const out: Shot[] = []
          for (let n = 0; n < groups.length; n++) {
            if (cancelled) return
            setProgress(`Gerando ${n + 1} de ${groups.length}…`)
            const g = groups[n]
            const rows = filtered.filter((r) => DIM_KEY[mode](r) === g.key)
            const url = await renderPanel({
              rows, title: `${DIM_TITLE[mode]}: ${g.key}`, subtitle: filterText || 'Todos os dados', dim: mode, dark,
            })
            out.push({ url, label: `${DIM_TITLE[mode]} ${g.key}`, file: `notificacoes-cgb-${mode}-${slug(g.key)}-${stamp}.png` })
          }
          if (!cancelled) setShots(out)
        }
      } catch (e) {
        if (!cancelled) setErr((e as Error).message || 'Falha ao gerar a imagem.')
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  async function downloadAll() {
    if (!shots) return
    for (const s of shots) {
      downloadDataUrl(s.url, s.file)
      await new Promise((r) => setTimeout(r, 400))
    }
    notify(shots.length > 1 ? `${shots.length} imagens baixadas.` : 'Imagem baixada.')
  }

  const modes = page === 'records' ? MODES.filter((m) => m.id !== 'page') : MODES
  const cur = shots?.[i]

  return (
    <Modal open onClose={onClose} title="Fotografia" wide>
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist">
        {modes.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${mode === m.id ? 'border-transparent bg-brand text-white shadow-md' : 'border-line bg-surface2 text-ink hover:border-brand'}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="min-h-64">
        {!shots && !err && (
          <div className="grid h-64 place-items-center text-sm text-muted">
            <div className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> {progress || 'Gerando imagem em alta resolução…'}</div>
          </div>
        )}
        {err && <p role="alert" className="py-10 text-center text-sm text-bad">{err}</p>}
        {shots && cur && (
          <>
            <div className="relative overflow-hidden rounded-xl border border-line bg-bg">
              <img src={cur.url} alt={cur.label} className="block w-full" style={{ aspectRatio: '16 / 9' }} />
              {shots.length > 1 && (
                <>
                  <button className="btn absolute top-1/2 left-2 -translate-y-1/2 !p-2" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Anterior"><ChevronLeft size={18} /></button>
                  <button className="btn absolute top-1/2 right-2 -translate-y-1/2 !p-2" disabled={i === shots.length - 1} onClick={() => setI(i + 1)} aria-label="Próxima"><ChevronRight size={18} /></button>
                </>
              )}
            </div>
            {shots.length > 1 && mode !== 'page' && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {shots.map((s, n) => (
                  <button key={s.file} onClick={() => setI(n)} className={`chip ${n === i ? '!bg-brand !text-white' : ''}`}>{s.label.replace(/^[^ ]+ /, '')}</button>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted">
                {mode === 'page' ? '1920 × 1080' : '3840 × 2160'} px (16:9) · {cur.label}{shots.length > 1 ? ` · ${i + 1}/${shots.length}` : ''}
              </span>
              <div className="flex gap-2">
                <button className="btn" onClick={() => { downloadDataUrl(cur.url, cur.file); notify('Imagem baixada.') }}><Download size={16} /> Baixar esta</button>
                {shots.length > 1 && <button className="btn btn-primary" onClick={() => void downloadAll()}><Download size={16} /> Baixar todas ({shots.length})</button>}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
