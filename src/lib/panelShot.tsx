import { createRoot } from 'react-dom/client'
import { SlidePanel, type PanelDim } from '../components/SlidePanel'
import { capture } from './snapshot'
import { loadLogo } from '../components/BrandLogo'
import type { Notificacao } from './types'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Renderiza o painel completo fora da tela e devolve um PNG 16:9 (3840×2160, 2× de 1920×1080). */
let chain: Promise<unknown> = Promise.resolve()
/** Renderizações são enfileiradas: uma por vez evita disputa de CPU e de memória. */
export function renderPanel(opts: PanelOpts): Promise<string> {
  const run = () => renderNow(opts)
  const p = chain.then(run, run)
  chain = p.catch(() => undefined)
  return p
}

interface PanelOpts { rows: Notificacao[]; title: string; subtitle: string; dim: PanelDim; dark: boolean }

async function renderNow(opts: { rows: Notificacao[]; title: string; subtitle: string; dim: PanelDim; dark: boolean }): Promise<string> {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:0;top:0;width:1920px;height:1080px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    const logo = (await loadLogo(opts.dark)).src
    root.render(<SlidePanel rows={opts.rows} title={opts.title} subtitle={opts.subtitle} dim={opts.dim} logo={logo} />)
    await document.fonts?.ready
    await wait(1400) // gráficos desenham sem animação; logo clara é gerada de forma assíncrona
    const c = await capture(host, 2, getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), {
      opacity: '1', position: 'static', left: '0', top: '0', zIndex: 'auto',
    })
    return c.toDataURL('image/png')
  } finally {
    root.unmount()
    host.remove()
  }
}
