import { useMemo } from 'react'
import EChart, { baseOption, cssVar } from './EChart'
import { ewma } from '../lib/formulas'
import { weekStart } from '../lib/dates'
import { useApp } from '../stores/app'

export interface WeightRow { day: string; kg: number }

export function weeklyAverages(rows: WeightRow[]) {
  const by = new Map<string, number[]>()
  for (const r of rows) {
    const w = weekStart(r.day)
    by.set(w, [...(by.get(w) ?? []), Number(r.kg)])
  }
  return [...by.entries()].sort().map(([week, v]) => ({ week, avg: v.reduce((a, b) => a + b, 0) / v.length, n: v.length }))
}

export default function WeightChart({ rows, goal }: { rows: WeightRow[]; goal: number | null }) {
  const theme = useApp((s) => s.theme)
  const option = useMemo(() => {
    const base = baseOption() as any
    const days = rows.map((r) => r.day.slice(5))
    const kg = rows.map((r) => Number(r.kg))
    const trend = ewma(kg).map((v) => Math.round(v * 100) / 100)
    const wk = weeklyAverages(rows)
    const weekly = rows.map((r) => {
      const w = wk.find((x) => x.week === weekStart(r.day))
      return w ? Math.round(w.avg * 100) / 100 : null
    })
    const cyan = cssVar('--cyan'), violet = cssVar('--violet'), muted = cssVar('--faint'), lime = cssVar('--lime')
    return {
      ...base,
      xAxis: { ...base.xAxis, data: days, boundaryGap: false },
      series: [
        { name: 'Diario', type: 'line', data: kg, showSymbol: true, symbolSize: 5, lineStyle: { width: 0 }, itemStyle: { color: muted } },
        {
          name: 'Tendencia', type: 'line', data: trend, smooth: true, showSymbol: false,
          lineStyle: { width: 2.5, color: cyan, shadowColor: cyan, shadowBlur: 10 },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: cyan + '33' }, { offset: 1, color: cyan + '00' }] } },
          markLine: goal ? { symbol: 'none', silent: true, lineStyle: { color: lime, type: 'dashed' }, label: { formatter: `objetivo ${goal}`, color: lime, fontSize: 10 }, data: [{ yAxis: goal }] } : undefined,
        },
        { name: 'Media semanal', type: 'line', step: 'middle', data: weekly, showSymbol: false, lineStyle: { width: 1.5, color: violet, type: 'dashed' } },
      ],
      dataZoom: rows.length > 40 ? [{ type: 'inside', start: 100 - (40 / rows.length) * 100, end: 100 }] : [],
    }
  }, [rows, goal, theme])
  return <EChart option={option} height={230} />
}
