import { describe, expect, it } from 'vitest'
import { decimalText, num } from './ui'

describe('entrada de números (coma o punto)', () => {
  it('num acepta coma y punto', () => {
    expect(num('80,5')).toBe(80.5)
    expect(num('80.5')).toBe(80.5)
    expect(num(' 72 ')).toBe(72)
    expect(num('')).toBeNull()
    expect(num(',')).toBeNull()
    expect(num('abc')).toBeNull()
  })
  it('decimalText convierte la coma en punto y deja un solo separador', () => {
    expect(decimalText('80,')).toBe('80.')
    expect(decimalText('80,5')).toBe('80.5')
    expect(decimalText('1,2,3')).toBe('1.23')
    expect(decimalText('7a5kg')).toBe('75')
  })
  it('enteros y negativos', () => {
    expect(decimalText('8.000', { decimal: false })).toBe('8000')
    expect(decimalText('-300', { decimal: false, negative: true })).toBe('-300')
    expect(decimalText('3-00', { decimal: false, negative: true })).toBe('300')
    expect(decimalText('-300', { decimal: false })).toBe('300')
  })
})
