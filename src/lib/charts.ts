import type { EChartsCoreOption } from 'echarts/core'
import type { Group } from './aggregate'
import { fmtBRL, fmtNum, short } from './format'

export interface Pal {
  brand: string; brand2: string; accent: string; good: string; warn: string
  muted: string; text: string; line: string; surface: string
}

const axisText = (p: Pal) => ({ color: p.muted, fontSize: 11 })
const split = (p: Pal) => ({ lineStyle: { color: p.line, type: 'dashed' as const, opacity: 0.7 } })

const grad = (c1: string, c2: string, horizontal = false) => ({
  type: 'linear' as const, x: 0, y: 0, x2: horizontal ? 1 : 0, y2: horizontal ? 0 : 1,
  colorStops: [{ offset: 0, color: c1 }, { offset: 1, color: c2 }],
})

/** Área suave por mês (clique seleciona o mês) */
export function areaOption(p: Pal, labels: string[], values: number[], selected: string[], fmt: (v: number) => string, color = p.brand, name = ''): EChartsCoreOption {
  return {
    grid: { left: 8, right: 16, top: 28, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmt(v) },
    xAxis: { type: 'category', data: labels, boundaryGap: false, axisLine: { lineStyle: { color: p.line } }, axisTick: { show: false }, axisLabel: axisText(p) },
    yAxis: { type: 'value', axisLabel: { ...axisText(p), formatter: (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v)) }, splitLine: split(p) },
    series: [{
      name, type: 'line', smooth: 0.35, symbolSize: 9, data: values.map((v, i) => ({ value: v, name: labels[i], itemStyle: { color: selected.length && !selected.includes(labels[i]) ? p.line : color, borderColor: p.surface, borderWidth: 2 } })),
      lineStyle: { width: 3, color }, areaStyle: { color: grad(color + '66', color + '05') },
      label: { show: true, position: 'top', color: p.muted, fontSize: 10, formatter: (x: { value: number }) => fmt(x.value) },
      emphasis: { focus: 'series', scale: 1.4 },
    }],
  }
}

/** Barras horizontais ranqueadas */
export function hbarOption(p: Pal, g: Group[], by: 'itens' | 'valor', selected: string[], limit = 12, color = p.brand, labelLen = 34): EChartsCoreOption {
  const rows = g.slice(0, limit)
  const fmt = by === 'valor' ? fmtBRL : fmtNum
  return {
    grid: { left: 8, right: 56, top: 4, bottom: 4, containLabel: true },
    tooltip: { trigger: 'item', formatter: (x: { name: string; value: number }) => `<b>${x.name}</b><br/>${fmt(x.value)}` },
    xAxis: { type: 'value', show: false },
    yAxis: { type: 'category', inverse: true, data: rows.map((r) => r.key), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { ...axisText(p), color: p.text, formatter: (v: string) => short(v, labelLen) } },
    series: [{
      type: 'bar', barMaxWidth: 16,
      data: rows.map((r) => ({ name: r.key, value: r[by], itemStyle: { borderRadius: [0, 8, 8, 0], color: selected.length && !selected.includes(r.key) ? p.line : grad(color + 'aa', color, true) } })),
      label: { show: true, position: 'right', color: p.text, fontSize: 11, fontWeight: 600, formatter: (x: { value: number }) => fmt(x.value) },
      emphasis: { itemStyle: { shadowBlur: 12, shadowColor: color + '88' } },
    }],
  }
}

/** Barras verticais empilhadas: tratados × em tratamento */
export function stackedOption(p: Pal, g: Group[], selected: string[]): EChartsCoreOption {
  const cats = g.map((x) => x.key)
  const dim = (k: string) => (selected.length && !selected.includes(k) ? 0.28 : 1)
  return {
    grid: { left: 8, right: 8, top: 30, bottom: 4, containLabel: true },
    legend: { top: 0, right: 4, data: ['Tratados', 'Em tratamento'], textStyle: { color: p.muted, fontSize: 11 }, itemWidth: 10, itemHeight: 10, icon: 'roundRect' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'category', data: cats, axisLine: { lineStyle: { color: p.line } }, axisTick: { show: false }, axisLabel: { ...axisText(p), color: p.text, fontWeight: 600 } },
    yAxis: { type: 'value', splitLine: split(p), axisLabel: axisText(p) },
    series: [
      { name: 'Tratados', type: 'bar', stack: 's', barMaxWidth: 44, itemStyle: { color: '#22c55e' }, label: { show: true, position: 'inside', color: '#fff', fontSize: 11, fontWeight: 600, formatter: (x: { value: number }) => (x.value >= 8 ? String(x.value) : '') }, data: g.map((x) => ({ name: x.key, value: x.tratados, itemStyle: { color: grad('#34d399', '#15803d'), opacity: dim(x.key) } })), emphasis: { focus: 'series' } },
      { name: 'Em tratamento', type: 'bar', stack: 's', itemStyle: { color: '#ff4d6a' }, data: g.map((x) => ({ name: x.key, value: x.abertos, itemStyle: { color: grad('#ff4d6a', '#c8102e'), borderRadius: [8, 8, 0, 0], opacity: dim(x.key) } })), emphasis: { focus: 'series' } },
      { name: 'Total', type: 'line', symbol: 'circle', symbolSize: 0, lineStyle: { width: 0, opacity: 0 }, silent: true, tooltip: { show: false }, data: g.map((x) => ({ name: x.key, value: x.itens })), label: { show: true, position: 'top', distance: 6, color: p.text, fontSize: 12, fontWeight: 700, lineHeight: 14, rich: { r: { color: '#ff4d6a', fontSize: 10, fontWeight: 700 } }, formatter: (x: { dataIndex: number; value: number }) => (g[x.dataIndex].abertos ? `{r|${g[x.dataIndex].abertos} em trat.}
${x.value}` : String(x.value)) }, z: 5 },
    ],
  }
}

/** Colunas simples (valor por base/gerência) */
export function columnOption(p: Pal, g: Group[], by: 'itens' | 'valor', selected: string[], color = p.brand): EChartsCoreOption {
  const fmt = by === 'valor' ? fmtBRL : fmtNum
  return {
    grid: { left: 8, right: 8, top: 26, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => fmt(v) },
    xAxis: { type: 'category', data: g.map((x) => x.key), axisLine: { lineStyle: { color: p.line } }, axisTick: { show: false }, axisLabel: { ...axisText(p), color: p.text, fontWeight: 600 } },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'bar', barMaxWidth: 44,
      data: g.map((x) => ({ name: x.key, value: x[by], itemStyle: { borderRadius: [10, 10, 0, 0], color: selected.length && !selected.includes(x.key) ? p.line : grad(color, color + '88') } })),
      label: { show: true, position: 'top', color: p.text, fontSize: 10.5, fontWeight: 600, formatter: (x: { value: number }) => (by === 'valor' ? `R$ ${(x.value / 1000).toFixed(1).replace('.', ',')}k` : fmtNum(x.value)) },
    }],
  }
}

/** Rosca (processo, situação…) */
export function donutOption(p: Pal, g: Group[], by: 'itens' | 'valor', selected: string[]): EChartsCoreOption {
  const colors = [p.brand, p.accent, '#8b5cf6', '#06b6d4', '#22c55e', '#f97316', '#ec4899', '#64748b', '#eab308']
  return {
    tooltip: { trigger: 'item', formatter: (x: { name: string; value: number; percent: number }) => `<b>${x.name}</b><br/>${(by === 'valor' ? fmtBRL : fmtNum)(x.value)} · ${x.percent}%` },
    legend: { orient: 'vertical', right: 4, top: 'middle', textStyle: { color: p.text, fontSize: 11 }, itemWidth: 10, itemHeight: 10, icon: 'circle' },
    series: [{
      type: 'pie', radius: ['46%', '68%'], center: ['38%', '50%'], padAngle: 2, itemStyle: { borderRadius: 8, borderColor: p.surface, borderWidth: 2 }, avoidLabelOverlap: true, minShowLabelAngle: 6,
      label: { show: true, color: p.text, fontSize: 11, fontWeight: 600, lineHeight: 15, formatter: (x: { value: number; percent: number }) => `${by === 'valor' ? fmtBRL(x.value) : fmtNum(x.value)}
{pct|${x.percent.toFixed(1).replace(".", ",")}%}`, rich: { pct: { color: p.muted, fontSize: 10, fontWeight: 500 } } },
      labelLine: { length: 10, length2: 8, lineStyle: { color: p.line } },
      emphasis: { scale: true, scaleSize: 6, label: { fontSize: 12, fontWeight: 700 } },
      data: g.map((x, i) => ({ name: x.key, value: x[by], itemStyle: { color: selected.length && !selected.includes(x.key) ? p.line : colors[i % colors.length] } })),
    }],
  }
}

/** Pareto: barras de valor + linha acumulada */
export function paretoOption(p: Pal, g: Group[], selected: string[]): EChartsCoreOption {
  const rows = g.slice(0, 15)
  const total = g.reduce((a, x) => a + x.valor, 0)
  let acc = 0
  const cum = rows.map((r) => Math.round(((acc += r.valor) / total) * 1000) / 10)
  return {
    grid: { left: 8, right: 8, top: 24, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'category', data: rows.map((r) => r.key), axisLabel: { show: false }, axisTick: { show: false }, axisLine: { lineStyle: { color: p.line } } },
    yAxis: [
      { type: 'value', splitLine: split(p), axisLabel: { ...axisText(p), formatter: (v: number) => `${v / 1000}k` } },
      { type: 'value', max: 100, axisLabel: { ...axisText(p), formatter: '{value}%' }, splitLine: { show: false } },
    ],
    series: [
      { name: 'Valor', type: 'bar', barMaxWidth: 26, label: { show: true, position: 'top', color: p.text, fontSize: 10, fontWeight: 600, formatter: (x: { value: number }) => (x.value >= 1000 ? `${(x.value / 1000).toFixed(1).replace('.', ',')}k` : String(x.value)) }, data: rows.map((r) => ({ name: r.key, value: r.valor, itemStyle: { borderRadius: [6, 6, 0, 0], color: selected.length && !selected.includes(r.key) ? p.line : grad(p.brand, p.brand2) } })), tooltip: { valueFormatter: (v: number) => fmtBRL(v) } },
      { name: '% acumulado', type: 'line', yAxisIndex: 1, smooth: true, symbolSize: 7, data: rows.map((r, i) => ({ name: r.key, value: cum[i] })), lineStyle: { color: p.accent, width: 3 }, itemStyle: { color: p.accent }, label: { show: true, position: 'top', distance: 8, color: p.accent, fontSize: 10, fontWeight: 700, formatter: (x: { value: number }) => `${String(x.value).replace('.', ',')}%` }, markLine: { silent: true, symbol: 'none', lineStyle: { color: p.muted, type: 'dashed' }, label: { color: p.muted, formatter: 'meta 80%', position: 'insideEndTop' }, data: [{ yAxis: 80 }] }, tooltip: { valueFormatter: (v: number) => `${v}%` } },
    ],
  }
}

/** Mapa de calor Base × Mês */
export function heatOption(p: Pal, bases: string[], months: string[], cells: [number, number, number][], by: 'valor' | 'itens'): EChartsCoreOption {
  const max = Math.max(1, ...cells.map((c) => c[2]))
  return {
    grid: { left: 8, right: 16, top: 8, bottom: 36, containLabel: true },
    tooltip: { formatter: (x: { value: number[] }) => `<b>${bases[x.value[1]]} · ${months[x.value[0]]}</b><br/>${(by === 'valor' ? fmtBRL : fmtNum)(x.value[2])}` },
    xAxis: { type: 'category', data: months, splitArea: { show: false }, axisLine: { show: false }, axisTick: { show: false }, axisLabel: axisText(p) },
    yAxis: { type: 'category', data: bases, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { ...axisText(p), color: p.text, fontWeight: 600 } },
    visualMap: { min: 0, max, show: false, inRange: { color: [p.line + '55', p.accent, p.brand, p.brand2] } },
    series: [{ type: 'heatmap', data: cells, itemStyle: { borderRadius: 6, borderColor: p.surface, borderWidth: 3 }, label: { show: true, color: '#fff', fontSize: 10, formatter: (x: { value: number[] }) => (x.value[2] ? (by === 'valor' ? `${Math.round(x.value[2] / 1000)}k` : x.value[2]) : '') }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,.4)' } } }],
  }
}
