import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
import { useApp } from '../stores/app'

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, MarkLineComponent, DataZoomComponent, SVGRenderer])

export function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Opciones base de ejes/tooltip según el tema activo */
export function baseOption(): EChartsCoreOption {
  const muted = cssVar('--muted'), line = cssVar('--line')
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'JetBrains Mono, monospace', color: muted },
    grid: { left: 36, right: 12, top: 16, bottom: 26 },
    tooltip: {
      trigger: 'axis', backgroundColor: cssVar('--card-solid'), borderColor: cssVar('--line-strong'),
      textStyle: { color: cssVar('--text'), fontFamily: 'JetBrains Mono, monospace', fontSize: 12 },
    },
    xAxis: { type: 'category', axisLine: { lineStyle: { color: line } }, axisTick: { show: false }, axisLabel: { color: muted, fontSize: 10 } },
    yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { color: line, type: 'dashed' } }, axisLabel: { color: muted, fontSize: 10 } },
  }
}

export default function EChart({ option, height = 220 }: { option: EChartsCoreOption; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  const theme = useApp((s) => s.theme)
  useEffect(() => {
    chart.current = echarts.init(ref.current!, undefined, { renderer: 'svg' })
    const ro = new ResizeObserver(() => chart.current?.resize())
    ro.observe(ref.current!)
    return () => { ro.disconnect(); chart.current?.dispose() }
  }, [])
  useEffect(() => { chart.current?.setOption(option, true) }, [option, theme])
  return <div ref={ref} style={{ width: '100%', height }} />
}
