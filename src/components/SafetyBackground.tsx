import { useEffect, useRef } from 'react'

/** Ícones (24×24, traço) ligados ao tema de segurança do trabalho. */
const ICONS = {
  shield: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z M9 12l2 2 4-4',
  alert: 'M21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3 M12 9v4 M12 17h.01',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0',
  hat: 'M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5 M14 6a6 6 0 0 1 6 6v3 M4 15v-3a6 6 0 0 1 6-6 M2 16a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z',
  clip: 'M8 2h8v4H8z M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 14l2 2 4-4',
  cone: 'M12 3l5 15H7z M4 21h16 M9 12h6',
} as const
type Kind = keyof typeof ICONS
const KINDS = Object.keys(ICONS) as Kind[]
const PATHS = Object.fromEntries(KINDS.map((k) => [k, typeof Path2D === 'undefined' ? null : new Path2D(ICONS[k])])) as Record<Kind, Path2D | null>

const AMBER = '255,200,61'
const RED = '255,77,106'
const WHITE = '255,255,255'
const GREEN = '52,211,153'

const CARDS: { t: string; s: string; c: string }[] = [
  { t: 'Não conformidade registrada', s: 'Equipe em campo · hoje', c: RED },
  { t: 'Notificação tratada', s: 'Resposta enviada', c: GREEN },
  { t: 'APR revisada', s: 'Análise de risco ok', c: AMBER },
  { t: 'EPI verificado', s: 'Inspeção concluída', c: GREEN },
  { t: 'Atenção: prazo de resposta', s: 'Tratativa pendente', c: AMBER },
  { t: 'Nova notificação', s: 'Aguardando tratamento', c: RED },
]

const rand = (a: number, b: number) => a + Math.random() * (b - a)

interface Icon { kind: Kind; x: number; y: number; s: number; vy: number; sway: number; ph: number; rot: number; vr: number; a: number; c: string }
interface Card { i: number; x: number; y: number; vy: number; a: number }
interface Ping { x: number; y: number; t: number; c: string; kind: Kind }

/** Cenário animado de segurança: radar, faixas de alerta, ícones de EPI e notificações flutuando. */
export function SafetyBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0, h = 0, raf = 0, last = performance.now(), nextPing = 600
    const mouse = { x: 0, y: 0 }
    let icons: Icon[] = []
    let cards: Card[] = []
    let pings: Ping[] = []

    // evita a faixa central, onde fica o cartão de login
    const sideX = (pad = 0) => {
      const mid = w / 2
      const gap = Math.min(300, w * 0.3)
      return Math.random() < 0.5 ? rand(pad, Math.max(pad + 1, mid - gap)) : rand(Math.min(w - pad, mid + gap), Math.max(w - pad, mid + gap + 1))
    }

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      w = cv.clientWidth
      h = cv.clientHeight
      cv.width = w * dpr
      cv.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.round(Math.min(26, Math.max(10, (w * h) / 60000)))
      icons = Array.from({ length: n }, (_, i) => ({
        kind: KINDS[i % KINDS.length], x: Math.random() * w, y: Math.random() * h, s: rand(26, 66), vy: rand(0.12, 0.38),
        sway: rand(8, 26), ph: rand(0, 7), rot: rand(-0.4, 0.4), vr: rand(-0.0006, 0.0006), a: rand(0.1, 0.24),
        c: [AMBER, AMBER, RED, WHITE][i % 4],
      }))
      cards = Array.from({ length: w < 700 ? 3 : 6 }, (_, i) => ({ i: i % CARDS.length, x: Math.max(8, Math.min(sideX(20), w - 256)), y: (h / 6) * i + rand(0, 80), vy: rand(0.16, 0.3), a: rand(0.5, 0.85) }))
    }

    const drawIcon = (k: Kind, x: number, y: number, s: number, rot: number, color: string, alpha: number, lw = 1.7) => {
      const p = PATHS[k]
      if (!p) return
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rot)
      const sc = s / 24
      ctx.scale(sc, sc)
      ctx.translate(-12, -12)
      ctx.lineWidth = lw
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = `rgba(${color},${alpha})`
      ctx.stroke(p)
      ctx.restore()
    }

    const roundRect = (x: number, y: number, rw: number, rh: number, r: number) => {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.arcTo(x + rw, y, x + rw, y + rh, r)
      ctx.arcTo(x + rw, y + rh, x, y + rh, r)
      ctx.arcTo(x, y + rh, x, y, r)
      ctx.arcTo(x, y, x + rw, y, r)
      ctx.closePath()
    }

    const drawCard = (c: Card, px: number, py: number) => {
      const d = CARDS[c.i]
      const cw = 236, ch = 58
      const x = c.x + px, y = c.y + py
      // some perto das bordas verticais da tela
      const edge = Math.min(1, Math.min(y + ch, h - y) / 120)
      const al = c.a * Math.max(0, edge)
      ctx.save()
      ctx.globalAlpha = al
      roundRect(x, y, cw, ch, 12)
      ctx.fillStyle = 'rgba(255,255,255,0.055)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.lineWidth = 1
      ctx.stroke()
      roundRect(x, y, 5, ch, 3)
      ctx.fillStyle = `rgb(${d.c})`
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.78)'
      ctx.font = '600 13px Inter, system-ui, sans-serif'
      ctx.fillText(d.t, x + 18, y + 24)
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.font = '500 11px Inter, system-ui, sans-serif'
      ctx.fillText(d.s, x + 18, y + 42)
      ctx.restore()
    }

    const frame = (now: number) => {
      const dt = Math.min(48, now - last)
      last = now
      const k = dt / 16.7
      ctx.clearRect(0, 0, w, h)
      const px = (mouse.x - w / 2) * 0.012
      const py = (mouse.y - h / 2) * 0.012

      for (const it of icons) {
        if (!reduce) {
          it.y -= it.vy * k
          it.rot += it.vr * dt
          it.ph += 0.0016 * dt
        }
        if (it.y < -80) { it.y = h + 80; it.x = Math.random() * w }
        const depth = it.s / 66
        drawIcon(it.kind, it.x + Math.sin(it.ph) * it.sway + px * depth * 2, it.y + py * depth * 2, it.s, it.rot, it.c, it.a)
      }

      for (const c of cards) {
        if (!reduce) c.y -= c.vy * k
        if (c.y < -80) { c.y = h + 30; c.x = Math.max(8, Math.min(sideX(20), w - 256)); c.i = (c.i + 1 + Math.floor(Math.random() * 3)) % CARDS.length }
        drawCard(c, px * 1.6, py * 1.6)
      }

      if (!reduce) {
        nextPing -= dt
        if (nextPing <= 0) {
          nextPing = rand(1200, 2400)
          pings.push({ x: sideX(40), y: rand(h * 0.12, h * 0.88), t: 0, c: Math.random() < 0.5 ? AMBER : RED, kind: Math.random() < 0.5 ? 'bell' : 'alert' })
        }
        pings = pings.filter((p) => (p.t += dt / 2200) < 1)
      }
      for (const p of pings) {
        const e = 1 - Math.pow(1 - p.t, 3)
        const fade = 1 - p.t
        for (let r = 0; r < 2; r++) {
          const rr = (e - r * 0.25) * 110
          if (rr <= 0) continue
          ctx.beginPath()
          ctx.arc(p.x, p.y, rr, 0, 7)
          ctx.strokeStyle = `rgba(${p.c},${0.5 * fade * (r ? 0.5 : 1)})`
          ctx.lineWidth = 2
          ctx.stroke()
        }
        drawIcon(p.kind, p.x, p.y, 30, 0, p.c, Math.min(1, fade * 1.6) * 0.9, 2)
      }

      if (!reduce) raf = requestAnimationFrame(frame)
    }

    const move = (e: PointerEvent) => { mouse.x = e.clientX; mouse.y = e.clientY }
    resize()
    mouse.x = w / 2
    mouse.y = h / 2
    raf = requestAnimationFrame(frame)
    addEventListener('resize', resize)
    addEventListener('pointermove', move)
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); removeEventListener('pointermove', move) }
  }, [])

  return (
    <>
      <style>{`
        @keyframes hazard-slide { to { background-position-x: 39.6px } }
        .hazard { height: 10px; background: repeating-linear-gradient(135deg, #ffc83d 0 14px, #17110b 14px 28px); background-size: 39.6px 100%;
          animation: hazard-slide 3s linear infinite; opacity: .5;
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent); mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent); }
      `}</style>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {/* radar de varredura */}
        <div
          className="absolute top-1/2 left-1/2 h-[1500px] w-[1500px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: 'repeating-radial-gradient(circle, transparent 0 139px, rgba(255,200,61,.09) 140px 141px)',
            WebkitMaskImage: 'radial-gradient(circle, #000 25%, transparent 70%)',
            maskImage: 'radial-gradient(circle, #000 25%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 h-[1500px] w-[1500px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0deg 292deg, rgba(255,77,106,.20) 352deg, rgba(255,77,106,0) 360deg)',
            WebkitMaskImage: 'radial-gradient(circle, #000 20%, transparent 68%)',
            maskImage: 'radial-gradient(circle, #000 20%, transparent 68%)',
            animation: 'spin-slow 11s linear infinite',
          }}
        />
        {/* faixas de atenção */}
        <div className="hazard absolute top-0 right-0 left-0" />
        <div className="hazard absolute right-0 bottom-0 left-0" />
      </div>
      <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />
    </>
  )
}
