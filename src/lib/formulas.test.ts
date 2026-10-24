import { describe, expect, it } from 'vitest'
import {
  activityFactor, adaptiveFactor, bmrDetail, bmrKatch, bmrMifflin, epley1rm, macroTargets,
  metKcal, navyBodyFat, siri, skinfoldBodyFat, stepsKcal,
} from './formulas'

describe('metabolismo basal', () => {
  it('Mifflin-St Jeor', () => {
    expect(bmrMifflin('male', 80, 180, 30)).toBeCloseTo(1780, 0)
    expect(bmrMifflin('female', 60, 165, 30)).toBeCloseTo(1320.25, 1)
  })
  it('Katch-McArdle', () => {
    expect(bmrKatch(80, 15)).toBeCloseTo(370 + 21.6 * 68, 3)
  })
  it('factor de actividad acotado', () => {
    expect(activityFactor(1)).toBe(1.2)
    expect(activityFactor(9)).toBe(1.9)
  })
})

describe('gasto', () => {
  it('MET', () => expect(metKcal(5, 80, 60)).toBe(400))
  it('pasos: 10k pasos, 80 kg, 180 cm ≈ 300 kcal', () => {
    expect(stepsKcal(10000, 80, 180)).toBeCloseTo(298.8, 1)
  })
  it('factor adaptativo', () => {
    expect(adaptiveFactor([1.5, 1.5, 1.5])).toBeNull()
    expect(adaptiveFactor(Array(10).fill(1.6))).toBe(1.6)
    expect(adaptiveFactor(Array(10).fill(3))).toBe(2.0)
  })
})

describe('macros', () => {
  it('carbohidratos con lo restante', () => {
    const t = macroTargets(2500, 500, 80, 2, 1)
    expect(t.kcal).toBe(2000)
    expect(t.protein).toBe(160)
    expect(t.fat).toBe(80)
    expect(t.carbs).toBeCloseTo((2000 - 640 - 720) / 4, 5)
  })
})

describe('composición corporal', () => {
  it('Siri', () => expect(siri(1.07)).toBeCloseTo(12.62, 1))
  it('JP3 hombre, suma 50 mm, 30 años ≈ 14.9 %', () => {
    expect(skinfoldBodyFat('jp3', 'male', [15, 20, 15], 30)).toBeCloseTo(14.9, 0)
  })
  it('Navy hombre 180 cm, cuello 38, cintura 85 ≈ 16 %', () => {
    expect(navyBodyFat('male', 180, 38, 85)).toBeGreaterThan(14)
    expect(navyBodyFat('male', 180, 38, 85)).toBeLessThan(18)
  })
  it('Navy mujer 165, cuello 32, cintura 70, cadera 95 ≈ 24 %', () => {
    const v = navyBodyFat('female', 165, 32, 70, 95)
    expect(v).toBeGreaterThan(21)
    expect(v).toBeLessThan(28)
  })
  it('Epley', () => expect(epley1rm(100, 5)).toBeCloseTo(116.67, 1))
})

describe('fórmula del basal elegible', () => {
  // tu caso: 179 cm, 29 años, 90.23 kg, 18.1 % de grasa
  const args = ['male', 90.23, 179, 29] as const
  it('auto: Katch-McArdle si hay % de grasa, si no Mifflin', () => {
    expect(bmrDetail('auto', ...args, 18.1)).toMatchObject({ used: 'katch', fallback: false })
    expect(bmrDetail('auto', ...args, 18.1).kcal).toBeCloseTo(370 + 21.6 * 90.23 * (1 - 0.181), 5)
    expect(bmrDetail('auto', ...args, null)).toMatchObject({ used: 'mifflin', fallback: false })
  })
  it('mifflin: siempre Mifflin aunque haya % de grasa', () => {
    expect(bmrDetail('mifflin', ...args, 18.1)).toMatchObject({ used: 'mifflin', fallback: false })
    expect(bmrDetail('mifflin', ...args, 18.1).kcal).toBeCloseTo(bmrMifflin(...args), 5)
  })
  it('katch sin % de grasa → Mifflin con aviso (fallback)', () => {
    expect(bmrDetail('katch', ...args, null)).toMatchObject({ used: 'mifflin', fallback: true })
    expect(bmrDetail('katch', ...args, 80)).toMatchObject({ used: 'mifflin', fallback: true }) // % no válido
  })
})
