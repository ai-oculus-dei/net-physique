import { describe, expect, it } from 'vitest'
import { daysBetween, reminderState, type ReminderInput } from './reminders'

const base: ReminderInput = {
  now: new Date(2026, 9, 21, 7, 30), today: '2026-10-21',
  hasWeightToday: false, lastBodyFatDay: '2026-09-20',
  remindWeight: true, remindBodyFat: true, dismissed: { weight: false, bodyfat: false },
}
const st = (p: Partial<ReminderInput>) => reminderState({ ...base, ...p })

describe('avisos', () => {
  it('antes de las 6:00 no hay avisos; desde las 6:00 sí', () => {
    expect(st({ now: new Date(2026, 9, 21, 5, 59) })).toMatchObject({ weight: false, bodyfat: false })
    expect(st({ now: new Date(2026, 9, 21, 6, 0) })).toMatchObject({ weight: true, bodyfat: true })
  })
  it('peso: solo si hoy no hay pesaje (y ya se ha cargado)', () => {
    expect(st({ hasWeightToday: true }).weight).toBe(false)
    expect(st({ hasWeightToday: null }).weight).toBe(false)
  })
  it('grasa: cada 21 días (3 semanas) o si nunca se midió', () => {
    expect(daysBetween('2026-09-30', '2026-10-21')).toBe(21)
    expect(st({ lastBodyFatDay: '2026-10-07' })).toMatchObject({ bodyfat: false, bodyFatDaysAgo: 14 })
    expect(st({ lastBodyFatDay: '2026-10-01' })).toMatchObject({ bodyfat: false, bodyFatDaysAgo: 20 })
    expect(st({ lastBodyFatDay: '2026-09-30' })).toMatchObject({ bodyfat: true, bodyFatDaysAgo: 21 })
    expect(st({ lastBodyFatDay: null })).toMatchObject({ bodyfat: true, bodyFatDaysAgo: null })
    expect(st({ lastBodyFatDay: undefined }).bodyfat).toBe(false) // sin cargar
  })
  it('cerrar con la X y desactivar en Ajustes', () => {
    expect(st({ dismissed: { weight: true, bodyfat: false } })).toMatchObject({ weight: false, bodyfat: true })
    expect(st({ remindWeight: false, remindBodyFat: false })).toMatchObject({ weight: false, bodyfat: false })
  })
  it('cambio de mes en el cálculo de días', () => {
    expect(daysBetween('2026-09-30', '2026-10-14')).toBe(14)
  })
})
