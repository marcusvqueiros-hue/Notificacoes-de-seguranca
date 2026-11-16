import { supabase } from './data'

/** Anexo (PDF ou imagem JPG/PNG) da notificação e da resposta, e observação de cada notificação, por Nº. Somente administradores. */
export const PDF_MAX_BYTES = 4 * 1024 * 1024

/** 'notificacao' = PDF da notificação recebida; 'resposta' = PDF da resposta enviada. */
export type PdfKind = 'notificacao' | 'resposta'
const RPC: Record<PdfKind, { numeros: string; save: string; get: string; del: string }> = {
  notificacao: { numeros: 'pdf_numeros', save: 'pdf_save', get: 'pdf_get', del: 'pdf_delete' },
  resposta: { numeros: 'resp_numeros', save: 'resp_save', get: 'resp_get', del: 'resp_delete' },
}

export interface Obs { texto: string; por?: string; em?: string }

const lsPdf = (k: PdfKind) => `cgb-local-pdfs${k === 'resposta' ? '-resp' : ''}`
const LS_OBS = 'cgb-local-obs'
const localPdfs = (k: PdfKind): Record<string, { nome: string; base64: string }> => JSON.parse(localStorage.getItem(lsPdf(k)) || '{}')
const localObs = (): Record<string, Obs> => JSON.parse(localStorage.getItem(LS_OBS) || '{}')

export const fileToBase64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(new Error('Não foi possível ler o arquivo.'))
    r.readAsDataURL(f)
  })

export async function pdfNumeros(token: string, kind: PdfKind = 'notificacao'): Promise<number[]> {
  if (supabase) {
    const { data, error } = await supabase.rpc(RPC[kind].numeros, { p_token: token })
    if (error) throw new Error(error.message)
    return (data as number[]).map(Number)
  }
  return Object.keys(localPdfs(kind)).map(Number)
}

export async function pdfSave(token: string, numero: number, file: File, kind: PdfKind = 'notificacao') {
  const base64 = await fileToBase64(file)
  if (supabase) {
    const { error } = await supabase.rpc(RPC[kind].save, { p_token: token, p_numero: numero, p_nome: file.name, p_base64: base64 })
    if (error) throw new Error(error.message)
    return
  }
  const all = localPdfs(kind)
  all[numero] = { nome: file.name, base64 }
  localStorage.setItem(lsPdf(kind), JSON.stringify(all))
}

export async function pdfGet(token: string, numero: number, kind: PdfKind = 'notificacao'): Promise<{ nome: string; base64: string } | null> {
  if (supabase) {
    const { data, error } = await supabase.rpc(RPC[kind].get, { p_token: token, p_numero: numero })
    if (error) throw new Error(error.message)
    return (data as { nome: string; base64: string } | null) ?? null
  }
  return localPdfs(kind)[numero] ?? null
}

export async function pdfDelete(token: string, numero: number, kind: PdfKind = 'notificacao') {
  if (supabase) {
    const { error } = await supabase.rpc(RPC[kind].del, { p_token: token, p_numero: numero })
    if (error) throw new Error(error.message)
    return
  }
  const all = localPdfs(kind)
  delete all[numero]
  localStorage.setItem(lsPdf(kind), JSON.stringify(all))
}

/** Tipo do anexo pelos primeiros bytes (PDF, JPEG ou PNG); o banco valida o mesmo no 06_anexos_imagem.sql. */
function sniffMime(b: Uint8Array): string {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  return 'application/pdf'
}

export const isPdfFile = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
export const isImageFile = (f: File) => /^image\/(jpeg|png)$/.test(f.type) || /\.(jpe?g|png)$/i.test(f.name)

/** Fotos grandes (celular/scanner) são reduzidas e salvas como JPEG para caber no limite do anexo. PDFs e imagens pequenas passam direto. */
export async function prepareAttachment(f: File): Promise<File> {
  if (!isImageFile(f) || f.size <= 1.5 * 1024 * 1024) return f
  const bmp = await createImageBitmap(f).catch(() => null)
  if (!bmp) throw new Error('Não foi possível ler a imagem.')
  const scale = Math.min(1, 2200 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff' // PNG com transparência vira fundo branco no JPEG
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.85))
  if (!blob) throw new Error('Não foi possível reduzir a imagem.')
  return new File([blob], f.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}

/** Abre o anexo (PDF ou imagem) em nova aba (ou baixa, se o navegador bloquear). */
export function openAttachment(p: { nome: string; base64: string }) {
  const bytes = Uint8Array.from(atob(p.base64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: sniffMime(bytes) }))
  if (!window.open(url, '_blank')) {
    const a = document.createElement('a')
    a.href = url
    a.download = p.nome
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function obsList(token: string): Promise<Record<string, Obs>> {
  if (supabase) {
    const { data, error } = await supabase.rpc('obs_list', { p_token: token })
    if (error) throw new Error(error.message)
    return data as Record<string, Obs>
  }
  return localObs()
}

export async function obsSave(token: string, numero: number, texto: string, autor: string) {
  if (supabase) {
    const { error } = await supabase.rpc('obs_save', { p_token: token, p_numero: numero, p_texto: texto })
    if (error) throw new Error(error.message)
    return
  }
  const all = localObs()
  if (texto.trim()) all[numero] = { texto: texto.trim(), por: autor, em: new Date().toISOString() }
  else delete all[numero]
  localStorage.setItem(LS_OBS, JSON.stringify(all))
}
