import { describe, expect, it } from 'vitest'
import { cardioKcal, concept2KcalPerHour, cyclingKcal, keytelKcalPerMin, runningMet } from './cardio'

const me = { kg: 80, sex: 'male' as const, age: 30 }

describe('cardio', () => {
  it('running: MET por velocidad interpolado', () => {
    expect(runningMet(8.0)).toBe(8.3)
    expect(runningMet(10)).toBeCloseTo(9.8 + (0.3 / 1.1) * 0.7, 5)
    expect(runningMet(4)).toBe(6.0)
    expect(runningMet(30)).toBe(23.0)
  })

  it('running con km y tiempo: 10 km en 60 min (10 km/h)', () => {
    const r = cardioKcal({ exerciseId: 'cardio_running', minutes: 60, distanceKm: 10 }, me)
    expect(r.method).toBe('distance')
    expect(r.gross).toBeCloseTo(runningMet(10) * 80, 5)
    expect(r.net).toBeCloseTo((runningMet(10) - 1) * 80, 5)
  })

  it('running solo con km: ≈ 1 kcal/kg/km', () => {
    const r = cardioKcal({ exerciseId: 'cardio_running', minutes: 0, distanceKm: 5 }, me)
    expect(r.gross).toBe(400)
    expect(r.net).toBe(400) // sin tiempo no se puede restar el reposo
  })

  it('remo/SkiErg por vatios (Concept2)', () => {
    expect(concept2KcalPerHour(150)).toBeCloseTo(816.24, 2)
    const r = cardioKcal({ exerciseId: 'cardio_remo', minutes: 30, watts: 150 }, me)
    expect(r.method).toBe('watts')
    expect(r.gross).toBeCloseTo(408.12, 2)
    expect(r.net).toBeCloseTo(408.12 - 40, 2)
  })

  it('bici por vatios (eficiencia 21 %)', () => {
    expect(cyclingKcal(150, 60)).toBeCloseTo(614.6, 1)
    expect(cardioKcal({ exerciseId: 'cardio_bici', minutes: 60, watts: 150 }, me).method).toBe('watts')
  })

  it('prioridad: vatios > kcal máquina > FC > MET', () => {
    const base = { exerciseId: 'cardio_assault', minutes: 20 }
    expect(cardioKcal({ ...base, watts: 200, machineKcal: 300, avgHr: 160 }, me).method).toBe('watts')
    expect(cardioKcal({ ...base, machineKcal: 300, avgHr: 160 }, me).method).toBe('machine')
    expect(cardioKcal({ ...base, avgHr: 160 }, me).method).toBe('hr')
    expect(cardioKcal(base, me).method).toBe('met')
    // la elíptica no usa vatios aunque se manden
    expect(cardioKcal({ exerciseId: 'cardio_eliptica', minutes: 20, watts: 200 }, me).method).toBe('met')
  })

  it('FC media (Keytel)', () => {
    const k = keytelKcalPerMin('male', 150, 80, 30)
    expect(k).toBeCloseTo((-55.0969 + 0.6309 * 150 + 0.1988 * 80 + 0.2017 * 30) / 4.184, 5)
    const r = cardioKcal({ exerciseId: 'cardio_padel', minutes: 90, avgHr: 150 }, me)
    expect(r.gross).toBeCloseTo(k * 90, 5)
    expect(keytelKcalPerMin('female', 150, 60, 30)).toBeGreaterThan(0)
  })

  it('MET por intensidad y cardio genérico; neto = bruto − reposo', () => {
    const p = cardioKcal({ exerciseId: 'cardio_padel', minutes: 60, intensity: 'vigorous' }, me)
    expect(p.gross).toBe(7.5 * 80)
    expect(p.net).toBe(6.5 * 80)
    const g = cardioKcal({ exerciseId: 'Running_Treadmill', minutes: 30 }, me)
    expect(g.gross).toBe(7 * 80 * 0.5)
  })

  it('máquina con menos kcal que el reposo → neto 0', () => {
    expect(cardioKcal({ exerciseId: 'cardio_eliptica', minutes: 60, machineKcal: 50 }, me).net).toBe(0)
  })
})
