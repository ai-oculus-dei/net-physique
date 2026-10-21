import { describe, expect, it } from 'vitest'
import { dietDayLevel, dietDayStatus, type DietDayInput } from './compliance'

describe('dietDayStatus (exceso + quedarse corto + proteína)', () => {
  const base: DietDayInput = { consumed: 2000, target: 2000, protein: 160, proteinTarget: 160, underTolPct: 10, proteinMinPct: 90, complete: true }
  const st = (p: Partial<DietDayInput>) => dietDayStatus({ ...base, ...p })

  it('todo en orden → verde sin motivos', () => {
    expect(st({})).toEqual({ level: 'green', reasons: [] })
  })
  it('sin datos → null', () => {
    expect(st({ consumed: 0 })).toBeNull()
    expect(st({ target: null })).toBeNull()
  })
  it('quedarse corto más allá de la tolerancia → naranja', () => {
    expect(st({ consumed: 1800 })).toEqual({ level: 'green', reasons: [] }) // −10 % exacto: dentro
    expect(st({ consumed: 1799 })).toEqual({ level: 'orange', reasons: ['under'] })
  })
  it('proteína por debajo del mínimo → naranja', () => {
    expect(st({ protein: 144 })).toEqual({ level: 'green', reasons: [] }) // 90 % exacto: dentro
    expect(st({ protein: 143 })).toEqual({ level: 'orange', reasons: ['protein'] })
  })
  it('los motivos se acumulan; el exceso > 15 % sigue siendo rojo', () => {
    expect(st({ consumed: 1500, protein: 100 })).toEqual({ level: 'orange', reasons: ['under', 'protein'] })
    expect(st({ consumed: 2400, protein: 100 })).toEqual({ level: 'red', reasons: ['over', 'protein'] })
    expect(st({ consumed: 2200 })).toEqual({ level: 'orange', reasons: ['over'] })
  })
  it('día en curso: solo cuenta el exceso', () => {
    expect(st({ consumed: 900, protein: 20, complete: false })).toEqual({ level: 'green', reasons: [] })
    expect(st({ consumed: 2400, complete: false })).toEqual({ level: 'red', reasons: ['over'] })
  })
  it('sin objetivo de proteína no se juzga la proteína', () => {
    expect(st({ protein: 0, proteinTarget: null })).toEqual({ level: 'green', reasons: [] })
  })
})

describe('dietDayLevel (balance neto del día)', () => {
  it('sin registros u objetivo → null', () => {
    expect(dietDayLevel(0, 2000)).toBeNull()
    expect(dietDayLevel(1800, null)).toBeNull()
    expect(dietDayLevel(1800, 0)).toBeNull()
  })
  it('por debajo del objetivo → verde', () => {
    expect(dietDayLevel(1200, 2000)).toBe('green')
    expect(dietDayLevel(2000, 2000)).toBe('green')
  })
  it('exceso hasta el 5 % incluido → verde', () => {
    expect(dietDayLevel(2100, 2000)).toBe('green') // +5 % exacto
    expect(dietDayLevel(1050, 1000)).toBe('green')
  })
  it('exceso > 5 % y ≤ 15 % → naranja', () => {
    expect(dietDayLevel(2100.2, 2000)).toBe('orange') // +5.01 %
    expect(dietDayLevel(2300, 2000)).toBe('orange') // +15 % exacto
    expect(dietDayLevel(1150, 1000)).toBe('orange')
  })
  it('exceso > 15 % → rojo', () => {
    expect(dietDayLevel(2300.2, 2000)).toBe('red') // +15.01 %
    expect(dietDayLevel(3000, 2000)).toBe('red')
  })
})
