import { useEffect, useState } from 'react'

const SRC = '/logo-cgb.png'
let lightCache: string | null = null

/** Espera a imagem carregar sem travar (decode() pode não resolver em aba em segundo plano). */
const ready = (img: HTMLImageElement) =>
  new Promise<void>((res) => {
    if (img.complete && img.naturalWidth) return res()
    const t = setTimeout(res, 5000)
    img.onload = img.onerror = () => { clearTimeout(t); res() }
  })

/** Gera uma versão da logo com o texto cinza clareado (para fundos escuros), preservando transparência e o losango vinho. */
async function buildLight(): Promise<string> {
  if (lightCache) return lightCache
  const img = new Image()
  img.src = SRC
  await ready(img)
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const d = ctx.getImageData(0, 0, c.width, c.height)
  const px = d.data
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2]
    if (Math.abs(r - g) < 14 && Math.abs(g - b) < 14) {
      px[i] = 238; px[i + 1] = 234; px[i + 2] = 236
    }
  }
  ctx.putImageData(d, 0, 0)
  return (lightCache = c.toDataURL('image/png'))
}

export function BrandLogo({ height = 40, onDark = false, className = '' }: { height?: number; onDark?: boolean; className?: string }) {
  const [light, setLight] = useState<string | null>(lightCache)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (onDark && !light) buildLight().then(setLight).catch(() => undefined)
  }, [onDark, light])
  const src = onDark && light ? light : SRC
  return (
    <img
      src={src}
      alt="CGB"
      draggable={false}
      onLoad={() => setReady(true)}
      className={className}
      style={{
        height,
        width: 'auto',
        opacity: ready ? 1 : 0,
        transition: 'opacity .6s ease',
        filter: 'drop-shadow(0 4px 14px rgba(179,18,47,.25))',
        imageRendering: 'auto',
      }}
    />
  )
}

/** Carrega a logo (versão clara para fundos escuros) como imagem, para desenhar em canvas. */
export async function loadLogo(onDark: boolean): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = onDark ? await buildLight() : SRC
  await ready(img)
  return img
}
