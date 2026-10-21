import { describe, expect, it } from 'vitest'
import { dietDayLevel } from './compliance'

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
