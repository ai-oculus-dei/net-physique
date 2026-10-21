import { describe, expect, it } from 'vitest'
import { computeBalance, computeWeightTrend, rulerPosition, type BalanceDay } from './balance'

const TODAY = '2026-10-21'
// días de la ventana: 14 → 20 de octubre
const d = (day: number, consumido: number, objetivo = 2000): BalanceDay =>
  ({ fecha: `2026-10-${String(day).padStart(2, '0')}`, objetivo, consumido })

describe('computeBalance', () => {
  it('0 días → sin datos', () => {
    const r = computeBalance([], TODAY)
    expect(r.status).toBe('nodata')
    expect(r.days).toBe(0)
    expect(r.deviation).toBeNull()
  })

  it('2 días → pocos datos, pero calcula la desviación', () => {
    const r = computeBalance([d(19, 2600), d(20, 2600)], TODAY)
    expect(r.status).toBe('nodata')
    expect(r.days).toBe(2)
    expect(r.deviation).toBe(30)
    expect(r.direction).toBeNull()
  })

  it('ignora hoy, días sin registro y días fuera de la ventana', () => {
    const r = computeBalance([
      d(21, 5000), // hoy
      d(13, 5000), // 8 días atrás: fuera
      d(14, 2000), d(15, 0), d(16, 2000), d(17, 2000),
    ], TODAY)
    expect(r.days).toBe(3)
    expect(r.deviation).toBe(0)
    expect(r.status).toBe('ok')
    expect(r.from).toBe('2026-10-14')
    expect(r.to).toBe('2026-10-20')
  })

  it('usa el objetivo de cada día, no uno fijo', () => {
    // 1800+2200+2000 = 6000 consumido; objetivos 2000+2000+2000 → 0 %
    const r = computeBalance([d(18, 1800), d(19, 2200, 2000), d(20, 2000)], TODAY)
    expect(r.deviation).toBe(0)
    // objetivos distintos: 3000 / (1500+1500) = 0 %
    const r2 = computeBalance([d(18, 1000, 1500), d(19, 1000, 1000), d(20, 1000, 500)], TODAY)
    expect(r2.deviation).toBe(0)
  })

  it('exactamente 10 % → naranja (por encima / por debajo)', () => {
    const above = computeBalance([d(18, 2200), d(19, 2200), d(20, 2200)], TODAY)
    expect(above.deviation).toBe(10)
    expect(above.status).toBe('warn')
    expect(above.direction).toBe('above')
    const below = computeBalance([d(18, 1800), d(19, 1800), d(20, 1800)], TODAY)
    expect(below.deviation).toBe(-10)
    expect(below.status).toBe('warn')
    expect(below.direction).toBe('below')
  })

  it('exactamente 15 % → naranja; 15.01 % → rojo', () => {
    expect(computeBalance([d(18, 2300), d(19, 2300), d(20, 2300)], TODAY).status).toBe('warn')
    expect(computeBalance([d(18, 1700), d(19, 1700), d(20, 1700)], TODAY).status).toBe('warn')
    const r = computeBalance([d(18, 2300.2), d(19, 2300.2), d(20, 2300.2)], TODAY)
    expect(r.deviation).toBe(15.01)
    expect(r.status).toBe('off')
  })

  it('9.99 % → azul', () => {
    const r = computeBalance([d(18, 2199.8), d(19, 2199.8), d(20, 2199.8)], TODAY)
    expect(r.status).toBe('ok')
  })

  it('cuenta los días muy desiguales (<70 % o >130 %) aunque la media cuadre', () => {
    const r = computeBalance([d(17, 1000), d(18, 3000), d(19, 2000), d(20, 2000), d(16, 1400), d(15, 2600)], TODAY)
    expect(r.deviation).toBe(0)
    expect(r.status).toBe('ok')
    // 1000 (<1400) y 3000 (>2600) son extremos; 1400 y 2600 justo en el límite no
    expect(r.extremeDays).toBe(2)
    expect(r.days).toBe(6)
  })

  it('medias diarias', () => {
    const r = computeBalance([d(18, 1500, 2000), d(19, 2500, 2200), d(20, 2000, 1800)], TODAY)
    expect(r.avgConsumed).toBe(2000)
    expect(r.avgTarget).toBe(2000)
  })
})

describe('computeWeightTrend', () => {
  const w = (day: number, kg: number) => ({ fecha: `2026-10-${String(day).padStart(2, '0')}`, kg })
  it('necesita 3 pesajes en cada ventana', () => {
    const t = computeWeightTrend([w(21, 80), w(20, 80), w(19, 80), w(14, 81), w(13, 81)], TODAY)
    expect(t.enough).toBe(false)
    expect(t.deltaKg).toBeNull()
  })
  it('media 7 días vs 7 anteriores', () => {
    const t = computeWeightTrend([w(21, 79.8), w(19, 80), w(15, 80.2), w(14, 80.6), w(10, 80.8), w(8, 81)], TODAY)
    expect(t.recentCount).toBe(3)
    expect(t.previousCount).toBe(3)
    expect(t.recent).toBeCloseTo(80, 5)
    expect(t.previous).toBeCloseTo(80.8, 5)
    expect(t.deltaKg).toBe(-0.8)
  })
})

describe('rulerPosition', () => {
  it('mapea −25..+25 a 0..100 y acota', () => {
    expect(rulerPosition(0)).toBe(50)
    expect(rulerPosition(-25)).toBe(0)
    expect(rulerPosition(25)).toBe(100)
    expect(rulerPosition(60)).toBe(100)
    expect(rulerPosition(-12.5)).toBe(25)
  })
})
