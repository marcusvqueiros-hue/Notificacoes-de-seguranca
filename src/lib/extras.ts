import { supabase } from './data'

/** PDF e observação de cada notificação (por Nº). Somente administradores. */
export const PDF_MAX_BYTES = 4 * 1024 * 1024

export interface Obs { texto: string; por?: string; em?: string }

const LS_PDF = 'cgb-local-pdfs'
const LS_OBS = 'cgb-local-obs'
const localPdfs = (): Record<string, { nome: string; base64: string }> => JSON.parse(localStorage.getItem(LS_PDF) || '{}')
const localObs = (): Record<string, Obs> => JSON.parse(localStorage.getItem(LS_OBS) || '{}')

export const fileToBase64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(new Error('Não foi possível ler o arquivo.'))
    r.readAsDataURL(f)
  })

export async function pdfNumeros(token: string): Promise<number[]> {
  if (supabase) {
    const { data, error } = await supabase.rpc('pdf_numeros', { p_token: token })
    if (error) throw new Error(error.message)
    return (data as number[]).map(Number)
  }
  return Object.keys(localPdfs()).map(Number)
}

export async function pdfSave(token: string, numero: number, file: File) {
  const base64 = await fileToBase64(file)
  if (supabase) {
    const { error } = await supabase.rpc('pdf_save', { p_token: token, p_numero: numero, p_nome: file.name, p_base64: base64 })
    if (error) throw new Error(error.message)
    return
  }
  const all = localPdfs()
  all[numero] = { nome: file.name, base64 }
  localStorage.setItem(LS_PDF, JSON.stringify(all))
}

export async function pdfGet(token: string, numero: number): Promise<{ nome: string; base64: string } | null> {
  if (supabase) {
    const { data, error } = await supabase.rpc('pdf_get', { p_token: token, p_numero: numero })
    if (error) throw new Error(error.message)
    return (data as { nome: string; base64: string } | null) ?? null
  }
  return localPdfs()[numero] ?? null
}

export async function pdfDelete(token: string, numero: number) {
  if (supabase) {
    const { error } = await supabase.rpc('pdf_delete', { p_token: token, p_numero: numero })
    if (error) throw new Error(error.message)
    return
  }
  const all = localPdfs()
  delete all[numero]
  localStorage.setItem(LS_PDF, JSON.stringify(all))
}

/** Abre o PDF em nova aba (ou baixa, se o navegador bloquear). */
export function openPdf(p: { nome: string; base64: string }) {
  const bytes = Uint8Array.from(atob(p.base64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
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
