import { describe, expect, it } from 'vitest'
import { buildExportRows, exportHeaders, toCsv, type ExportInput } from './exportCsv'

const input: ExportInput = {
  foods: [
    { day: '2026-10-20', time: '14:05', meal: 'comida', name: 'Judías verdes, con jamón', grams: 350, kcal: 274.4, protein: 21.35, fat: 10.15, carbs: 14.7 },
    { day: '2026-10-19', time: '08:30', meal: 'desayuno', name: 'Yogur "griego"', grams: 125, kcal: 120, protein: 4, fat: 10, carbs: 4 },
  ],
  sets: [
    { day: '2026-10-20', session: 'Pierna', exercise: 'Barbell Squat', sets: 4, reps: 8, weightKg: 100, minutes: null, primary: ['quadriceps'], secondary: ['glutes'] },
    { day: '2026-10-20', session: 'Pierna', exercise: 'Running', sets: 1, reps: 1, weightKg: null, minutes: 20, primary: ['quadriceps'], secondary: [],
      cardio: true, distanceKm: 4.2, avgHr: 152, kcal: 251.4, kcalMethod: 'hr' },
  ],
  targets: { '2026-10-19': 2100, '2026-10-20': 2050 },
  weights: { '2026-10-20': 80.35 },
  steps: { '2026-10-20': 9500, '2026-10-18': 7000 },
}

describe('exportación CSV', () => {
  it('columnas según los tipos elegidos', () => {
    expect(exportHeaders({ diet: true, training: false, sep: ',' })).toEqual(
      ['tipo', 'fecha', 'hora', 'comida', 'alimento', 'gramos', 'kcal', 'proteinas_g', 'grasas_g', 'carbohidratos_g', 'kcal_objetivo_dia', 'peso_dia_kg'])
    expect(exportHeaders({ diet: false, training: true, sep: ',' })).toEqual(
      ['tipo', 'fecha', 'sesion', 'ejercicio', 'series', 'repeticiones', 'peso_levantado_kg', 'minutos', 'distancia_km', 'vatios_medios', 'fc_media', 'kcal_actividad', 'metodo_kcal', 'musculos', 'pasos_dia'])
  })

  it('solo Diet: filas por alimento, ordenadas por fecha, con objetivo y peso del día', () => {
    const rows = buildExportRows(input, { diet: true, training: false, sep: ',' })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual(['Diet', '2026-10-19', '08:30', 'Desayuno', 'Yogur "griego"', 125, 120, 4, 10, 4, 2100, null])
    expect(rows[1]).toEqual(['Diet', '2026-10-20', '14:05', 'Comida', 'Judías verdes, con jamón', 350, 274.4, 21.4, 10.2, 14.7, 2050, 80.4])
  })

  it('solo Training: ejercicios con músculos y pasos; día solo con pasos incluido', () => {
    const rows = buildExportRows(input, { diet: false, training: true, sep: ',' })
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual(['Training', '2026-10-18', null, null, null, null, null, null, null, null, null, null, null, null, 7000])
    expect(rows[1]).toEqual(['Training', '2026-10-20', 'Pierna', 'Barbell Squat', 4, 8, 100, null, null, null, null, null, null, 'Cuádriceps / Glúteos (sec.)', 9500])
    // cardio: sin series/reps ni músculos; con minutos, km, FC, kcal y método
    expect(rows[2]).toEqual(['Training', '2026-10-20', 'Pierna', 'Running', null, null, null, 20, 4.2, null, 152, 251.4, 'por pulsaciones', null, 9500])
  })

  it('ambos: Diet antes que Training dentro del mismo día', () => {
    const rows = buildExportRows(input, { diet: true, training: true, sep: ',' })
    expect(rows.map((r) => `${r[1]} ${r[0]}`)).toEqual([
      '2026-10-18 Training', '2026-10-19 Diet', '2026-10-20 Diet', '2026-10-20 Training', '2026-10-20 Training',
    ])
  })

  it('CSV: punto decimal, comillas y separador elegidos', () => {
    const o = { diet: true, training: false, sep: ',' as const }
    const csv = toCsv(exportHeaders(o), buildExportRows(input, o), ',')
    expect(csv.startsWith('﻿tipo,fecha,')).toBe(true)
    expect(csv).toContain('"Judías verdes, con jamón",350,274.4')
    expect(csv).toContain('"Yogur ""griego"""')
    const csv2 = toCsv(exportHeaders(o), buildExportRows(input, o), ';')
    expect(csv2).toContain('Judías verdes, con jamón;350;274.4')
  })
})
