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
  // última opción pedida: si el contenedor aún no tiene tamaño se aplica cuando lo tenga
  const pending = useRef<EChartsCoreOption | null>(null)

  useEffect(() => {
    const el = ref.current!
    const c = echarts.init(el, undefined, { renderer: 'svg' })
    chart.current = c
    const hasSize = () => el.clientWidth > 0 && el.clientHeight > 0
    // redibuja con el tamaño real (y con la opción pendiente si la había)
    const redraw = () => {
      if (!hasSize() || c.isDisposed()) return
      c.resize()
      if (pending.current) { c.setOption(pending.current, true); pending.current = null }
    }
    let last = `${el.clientWidth}x${el.clientHeight}`
    const ro = new ResizeObserver(() => {
      const now = `${el.clientWidth}x${el.clientHeight}`
      if (now === last) return
      last = now
      redraw()
    })
    ro.observe(el)
    // En iOS el tamaño definitivo llega tras el primer pintado y al cargar las fuentes
    const raf = requestAnimationFrame(() => requestAnimationFrame(redraw))
    document.fonts?.ready.then(redraw).catch(() => {})
    return () => { cancelAnimationFrame(raf); ro.disconnect(); c.dispose(); chart.current = null }
  }, [])

  useEffect(() => {
    const c = chart.current
    const el = ref.current
    if (!c || !el) return
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      c.setOption(option, true)
      c.resize()
    } else {
      pending.current = option
    }
  }, [option, theme])
  return <div ref={ref} style={{ width: '100%', height }} />
}
