import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart, HeatmapChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, MarkLineComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption, ECharts } from 'echarts/core'
import { useStore } from '../lib/store'

echarts.use([BarChart, LineChart, PieChart, HeatmapChart, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, MarkLineComponent, DataZoomComponent, CanvasRenderer])

export const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export const palette = () => ({
  brand: css('--brand'),
  brand2: css('--brand-2'),
  accent: css('--accent'),
  good: css('--good'),
  warn: css('--warn'),
  muted: css('--muted'),
  text: css('--text'),
  line: css('--border'),
  surface: css('--surface'),
})

interface Props {
  option: EChartsCoreOption
  height?: number | string
  onPick?: (name: string, params: { seriesName?: string; data?: unknown }) => void
}

export function Chart({ option, height = 260, onPick }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const inst = useRef<ECharts | null>(null)
  const pick = useRef(onPick)
  pick.current = onPick
  const theme = useStore((s) => s.theme)

  useEffect(() => {
    const chart = echarts.init(el.current!, undefined, { renderer: 'canvas' })
    inst.current = chart
    chart.on('click', (p) => {
      const name = (p.name as string) || String((p.data as { name?: string })?.name ?? '')
      if (name) pick.current?.(name, { seriesName: p.seriesName, data: p.data })
    })
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(el.current!)
    return () => {
      ro.disconnect()
      chart.dispose()
    }
  }, [])

  useEffect(() => {
    const p = palette()
    inst.current?.setOption(
      {
        backgroundColor: 'transparent',
        textStyle: { fontFamily: 'Inter, system-ui, sans-serif', color: p.muted },
        animationDuration: 700,
        animationEasing: 'cubicOut',
        tooltip: {
          backgroundColor: p.surface,
          borderColor: p.line,
          textStyle: { color: p.text, fontSize: 12 },
          extraCssText: 'box-shadow:0 12px 32px -8px rgba(0,0,0,.35);border-radius:10px;',
          confine: true,
        },
        ...option,
      },
      true,
    )
  }, [option, theme])

  return <div ref={el} style={{ height, width: '100%', cursor: onPick ? 'pointer' : 'default' }} />
}
