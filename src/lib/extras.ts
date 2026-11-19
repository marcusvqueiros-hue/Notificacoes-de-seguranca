import { supabase } from './data'

/** Anexo (PDF ou imagem JPG/PNG) da notificação e da resposta, e observação de cada notificação, por Nº. Somente administradores. */
export const PDF_MAX_BYTES = 4 * 1024 * 1024

/** 'notificacao' = arquivos da notificação recebida; 'resposta' = arquivos da resposta enviada. */
export type PdfKind = 'notificacao' | 'resposta'
/**
 * Onde o anexo fica. Os arquivos da NOTIFICAÇÃO são pelo Nº (todos os itens/não conformidades da mesma notificação
 * compartilham os mesmos); a RESPOSTA é de cada ITEM (id da linha), porque cada não conformidade tem a sua.
 */
export type AnexoRef = { kind: 'notificacao'; numero: number } | { kind: 'resposta'; item: string }
export const anexoKey = (r: AnexoRef | null) => (r ? (r.kind === 'notificacao' ? `n${r.numero}` : `i${r.item}`) : '')
/** Máximo de arquivos por notificação e por tipo (o banco também valida). */
export const ANEXOS_MAX = 10

export interface Anexo { id: number; nome: string; tamanho: number }
export interface Obs { texto: string; por?: string; em?: string }

interface LocalAnexo extends Anexo { tipo: PdfKind; numero?: number; item?: string; base64: string }
const LS_ANEXOS = 'cgb-local-anexos'
const LS_OBS = 'cgb-local-obs'
const localAnexos = (): LocalAnexo[] => JSON.parse(localStorage.getItem(LS_ANEXOS) || '[]')
const saveLocalAnexos = (l: LocalAnexo[]) => localStorage.setItem(LS_ANEXOS, JSON.stringify(l))
const localObs = (): Record<string, Obs> => JSON.parse(localStorage.getItem(LS_OBS) || '{}')
const sameRef = (a: LocalAnexo, r: AnexoRef) => (r.kind === 'notificacao' ? a.tipo === 'notificacao' && a.numero === r.numero : a.tipo === 'resposta' && a.item === r.item)

export const fileToBase64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(new Error('Não foi possível ler o arquivo.'))
    r.readAsDataURL(f)
  })

/** Quantos arquivos cada um tem: por Nº da notificação (kind 'notificacao') ou por id do item (kind 'resposta'). */
export async function anexoContagem(token: string, kind: PdfKind): Promise<Record<string, number>> {
  if (supabase) {
    const { data, error } = kind === 'resposta'
      ? await supabase.rpc('resp_item_contagem', { p_token: token })
      : await supabase.rpc('anexo_contagem', { p_token: token, p_tipo: 'notificacao' })
    if (error) throw new Error(error.message)
    return Object.fromEntries(Object.entries(data as Record<string, number>).map(([k, v]) => [k, Number(v)]))
  }
  const out: Record<string, number> = {}
  for (const a of localAnexos()) if (a.tipo === kind) { const k = kind === 'resposta' ? a.item! : String(a.numero); out[k] = (out[k] ?? 0) + 1 }
  return out
}

export async function anexoList(token: string, ref: AnexoRef): Promise<Anexo[]> {
  if (supabase) {
    const { data, error } = ref.kind === 'resposta'
      ? await supabase.rpc('resp_item_list', { p_token: token, p_item: ref.item })
      : await supabase.rpc('anexo_list', { p_token: token, p_numero: ref.numero, p_tipo: 'notificacao' })
    if (error) throw new Error(error.message)
    return data as Anexo[]
  }
  return localAnexos().filter((a) => sameRef(a, ref)).map(({ id, nome, tamanho }) => ({ id, nome, tamanho }))
}

export async function anexoSave(token: string, ref: AnexoRef, file: File) {
  const base64 = await fileToBase64(file)
  if (supabase) {
    const { error } = ref.kind === 'resposta'
      ? await supabase.rpc('resp_item_save', { p_token: token, p_item: ref.item, p_nome: file.name, p_base64: base64 })
      : await supabase.rpc('anexo_save', { p_token: token, p_numero: ref.numero, p_tipo: 'notificacao', p_nome: file.name, p_base64: base64 })
    if (error) throw new Error(error.message)
    return
  }
  const all = localAnexos()
  all.push({ id: Date.now() + Math.floor(Math.random() * 1000), tipo: ref.kind, ...(ref.kind === 'resposta' ? { item: ref.item } : { numero: ref.numero }), nome: file.name, tamanho: file.size, base64 })
  saveLocalAnexos(all)
}

export async function anexoGet(token: string, id: number): Promise<{ nome: string; base64: string } | null> {
  if (supabase) {
    const { data, error } = await supabase.rpc('anexo_get', { p_token: token, p_id: id })
    if (error) throw new Error(error.message)
    return (data as { nome: string; base64: string } | null) ?? null
  }
  const a = localAnexos().find((x) => x.id === id)
  return a ? { nome: a.nome, base64: a.base64 } : null
}

export async function anexoDelete(token: string, id: number) {
  if (supabase) {
    const { error } = await supabase.rpc('anexo_delete', { p_token: token, p_id: id })
    if (error) throw new Error(error.message)
    return
  }
  saveLocalAnexos(localAnexos().filter((a) => a.id !== id))
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
