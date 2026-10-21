// Exportación a CSV: una fila por alimento (Diet) y una por ejercicio (Training).
// Las columnas del día (objetivo, peso, pasos) se repiten en cada fila de ese día.
import { muscleEs } from './muscles'
import { MEALS } from './types'

export interface ExportOptions { diet: boolean; training: boolean; sep: ',' | ';' }

export interface ExportFood {
  day: string; time: string; meal: string; name: string; grams: number
  kcal: number; protein: number; fat: number; carbs: number
}
export interface ExportSet {
  day: string; session: string | null; exercise: string; sets: number; reps: number
  weightKg: number | null; minutes: number | null; primary: string[]; secondary: string[]
}
export interface ExportInput {
  foods: ExportFood[]
  sets: ExportSet[]
  targets: Record<string, number>
  weights: Record<string, number>
  steps: Record<string, number>
}

const DIET_COLS = ['hora', 'comida', 'alimento', 'gramos', 'kcal', 'proteinas_g', 'grasas_g', 'carbohidratos_g', 'kcal_objetivo_dia', 'peso_dia_kg']
const TRAINING_COLS = ['sesion', 'ejercicio', 'series', 'repeticiones', 'peso_levantado_kg', 'minutos', 'musculos', 'pasos_dia']

type Cell = string | number | null | undefined
const r1 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10) / 10)

export function exportHeaders(o: ExportOptions): string[] {
  return ['tipo', 'fecha', ...(o.diet ? DIET_COLS : []), ...(o.training ? TRAINING_COLS : [])]
}

export function buildExportRows(input: ExportInput, o: ExportOptions): Cell[][] {
  const headers = exportHeaders(o)
  const row = (vals: Record<string, Cell>): Cell[] => headers.map((h) => vals[h] ?? null)
  const dayCols = (day: string): Record<string, Cell> => ({
    fecha: day,
    kcal_objetivo_dia: o.diet ? input.targets[day] : null,
    peso_dia_kg: o.diet ? r1(input.weights[day]) : null,
    pasos_dia: o.training ? input.steps[day] : null,
  })
  const mealLabel = (m: string) => MEALS.find((x) => x.id === m)?.label ?? m
  const muscles = (s: ExportSet) => [
    ...s.primary.map(muscleEs),
    ...s.secondary.map((m) => `${muscleEs(m)} (sec.)`),
  ].join(' / ')

  const out: { day: string; order: number; row: Cell[] }[] = []
  if (o.diet) {
    for (const f of input.foods) {
      out.push({
        day: f.day, order: 0, row: row({
          tipo: 'Diet', ...dayCols(f.day), hora: f.time, comida: mealLabel(f.meal), alimento: f.name,
          gramos: r1(f.grams), kcal: r1(f.kcal), proteinas_g: r1(f.protein), grasas_g: r1(f.fat), carbohidratos_g: r1(f.carbs),
        }),
      })
    }
  }
  if (o.training) {
    const withSets = new Set(input.sets.map((s) => s.day))
    for (const s of input.sets) {
      const cardio = s.minutes != null
      out.push({
        day: s.day, order: 1, row: row({
          tipo: 'Training', ...dayCols(s.day), sesion: s.session, ejercicio: s.exercise,
          series: cardio ? null : s.sets, repeticiones: cardio ? null : s.reps,
          peso_levantado_kg: r1(s.weightKg), minutos: r1(s.minutes), musculos: muscles(s),
        }),
      })
    }
    // días con pasos pero sin ejercicios: una fila solo con los pasos
    for (const [day, n] of Object.entries(input.steps)) {
      if (!withSets.has(day) && n > 0) out.push({ day, order: 2, row: row({ tipo: 'Training', ...dayCols(day) }) })
    }
  }
  // orden: fecha, después Diet → Training (la ordenación estable conserva hora / posición)
  return out.sort((a, b) => (a.day === b.day ? a.order - b.order : a.day < b.day ? -1 : 1)).map((x) => x.row)
}

/** CSV con decimales con punto; se entrecomillan los campos con separador, comillas o saltos de línea */
export function toCsv(headers: string[], rows: Cell[][], sep: ',' | ';'): string {
  const esc = (v: Cell) => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(sep) || s.includes('"') || /[\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // BOM para que Excel lea bien tildes y eñes
  return '﻿' + [headers, ...rows].map((r) => r.map(esc).join(sep)).join('\r\n') + '\r\n'
}
