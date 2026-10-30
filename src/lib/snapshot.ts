import { getFontEmbedCSS, toSvg } from 'html-to-image'
import { loadLogo } from '../components/BrandLogo'

export const SLIDE_W = 1920
export const SLIDE_H = 1080

/** Espera a imagem carregar, sem travar caso o navegador demore (decode() pode não resolver em aba em segundo plano). */
const loaded = (img: HTMLImageElement, ms = 4000) =>
  new Promise<void>((res) => {
    if (img.complete && img.naturalWidth) return res()
    const t = setTimeout(res, ms)
    img.onload = img.onerror = () => { clearTimeout(t); res() }
  })

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('tempo esgotado ao gerar a imagem')), ms))])

/** CSS das fontes embutido uma única vez (reaproveitado em todas as fotos). */
let fontCSS: Promise<string> | null = null
const latinOnly = (css: string) =>
  (css.match(/@font-face\s*{[^}]*}/g) ?? []).filter((b) => /unicode-range:\s*U\+0000-00FF/i.test(b)).join('\n')
const fonts = () => (fontCSS ??= withTimeout(getFontEmbedCSS(document.body), 25000).then(latinOnly).catch(() => ''))

/** Mantém só as primeiras linhas das tabelas rolantes (a foto mostra a parte visível). */
const keep = (n: Node) =>
  !(n instanceof HTMLElement && n.dataset.snapIgnore) &&
  !(n instanceof HTMLTableRowElement && n.parentElement?.tagName === 'TBODY' && n.rowIndex > 14)

/**
 * html-to-image → SVG → canvas. Os <canvas> dos gráficos são trocados por <img> durante a captura
 * (evita travar o clone de canvas) e restaurados em seguida.
 */
export async function capture(el: HTMLElement, pixelRatio: number, backgroundColor: string, style?: Partial<CSSStyleDeclaration>) {
  const swaps: [HTMLCanvasElement, HTMLImageElement][] = []
  for (const cv of el.querySelectorAll('canvas')) {
    const img = new Image()
    img.src = cv.toDataURL()
    await loaded(img)
    img.className = cv.className
    img.style.cssText = cv.style.cssText
    img.style.width = cv.clientWidth + 'px'
    img.style.height = cv.clientHeight + 'px'
    cv.parentNode!.replaceChild(img, cv)
    swaps.push([cv, img])
  }
  try {
    const url = await withTimeout(toSvg(el, { backgroundColor, filter: keep, style, fontEmbedCSS: await fonts() }), 30000)
    const img = new Image()
    img.src = url
    await loaded(img, 20000)
    const c = document.createElement('canvas')
    c.width = Math.round(el.offsetWidth * pixelRatio)
    c.height = Math.round(el.offsetHeight * pixelRatio)
    const g = c.getContext('2d')!
    g.imageSmoothingQuality = 'high'
    g.drawImage(img, 0, 0, c.width, c.height)
    return c
  } finally {
    for (const [cv, img] of swaps) img.parentNode?.replaceChild(cv, img)
  }
}

const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()

interface Opts {
  root: HTMLElement
  title: string
  filters: string
  dark: boolean
}

/**
 * Fotografa o conteúdo da tela e o distribui em slides 16:9 (1920×1080).
 * Os cortes só ocorrem entre cartões (gráficos/KPIs), nunca no meio de um.
 */
export async function buildSlides({ root, title, filters, dark }: Opts): Promise<string[]> {
  const W = root.offsetWidth
  const H = root.offsetHeight
  const bg = css('--bg')
  const pixelRatio = Math.min(2, 15000 / H)
  const shot = await capture(root, pixelRatio, bg)
  const k = shot.width / W // px de origem por px CSS

  const MX = 80
  const bodyTop = 150
  const bodyH = SLIDE_H - bodyTop - 56
  const scale = Math.min((SLIDE_W - MX * 2) / W, 1.8)
  const offX = (SLIDE_W - W * scale) / 2
  const maxSrc = bodyH / scale // altura CSS máxima por slide

  // cortes válidos: abaixo de cada cartão, desde que nenhum outro cartão atravesse a linha
  const rr = root.getBoundingClientRect()
  const cards = [...root.querySelectorAll<HTMLElement>('.card')].map((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top - rr.top, bottom: r.bottom - rr.top }
  })
  const cuts = [...new Set(cards.map((c) => Math.round(c.bottom) + 8))]
    .filter((y) => y < H && !cards.some((c) => c.top + 1 < y - 8 && c.bottom - 1 > y - 8))
    .sort((a, b) => a - b)

  const ranges: [number, number][] = []
  let y = 0
  while (y < H - 1) {
    let end = Math.min(H, y + maxSrc)
    if (end < H) {
      const ok = cuts.filter((c) => c > y + 40 && c <= end)
      end = ok.length ? ok[ok.length - 1] : end
    }
    ranges.push([y, end])
    y = end
  }

  const logo = await loadLogo(dark).catch(() => null)
  const now = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  const text = css('--text')
  const muted = css('--muted')
  const brand = css('--brand')
  const total = ranges.length

  return ranges.map(([a, b], i) => {
    const c = document.createElement('canvas')
    c.width = SLIDE_W
    c.height = SLIDE_H
    const g = c.getContext('2d')!
    g.imageSmoothingQuality = 'high'
    g.fillStyle = bg
    g.fillRect(0, 0, SLIDE_W, SLIDE_H)
    // faixa de destaque no topo
    const grad = g.createLinearGradient(0, 0, SLIDE_W, 0)
    grad.addColorStop(0, css('--brand-2'))
    grad.addColorStop(1, css('--accent'))
    g.fillStyle = grad
    g.fillRect(0, 0, SLIDE_W, 8)

    if (logo) {
      const lh = 64
      g.drawImage(logo, MX, 34, (logo.naturalWidth / logo.naturalHeight) * lh, lh)
    }
    g.textBaseline = 'alphabetic'
    g.fillStyle = text
    g.font = '700 38px "Space Grotesk", Inter, sans-serif'
    g.textAlign = 'right'
    g.fillText(title, SLIDE_W - MX, 66)
    g.fillStyle = muted
    g.font = '500 20px Inter, sans-serif'
    const f = filters.length > 120 ? filters.slice(0, 119) + '…' : filters
    g.fillText(f || 'Sem filtros aplicados', SLIDE_W - MX, 100)
    g.fillStyle = css('--border')
    g.fillRect(MX, bodyTop - 24, SLIDE_W - MX * 2, 2)

    const sh = b - a
    g.drawImage(shot, 0, a * k, shot.width, sh * k, offX, bodyTop, W * scale, sh * scale)

    g.font = '500 18px Inter, sans-serif'
    g.fillStyle = muted
    g.textAlign = 'left'
    g.fillText(`Notificações CGB · gerado em ${now} · Desenvolvido por Marcus Vinicius Silva Queiros`, MX, SLIDE_H - 24)
    g.textAlign = 'right'
    g.fillStyle = brand
    g.fillText(`${i + 1} / ${total}`, SLIDE_W - MX, SLIDE_H - 24)
    return c.toDataURL('image/png')
  })
}

export function downloadDataUrl(url: string, name: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}
