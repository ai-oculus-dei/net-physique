import { describe, expect, it } from 'vitest'
import { detectUnit, unitOf } from './units'

describe('unidad del producto', () => {
  it('usa la unidad de cantidad de Open Food Facts', () => {
    expect(detectUnit({ product_quantity_unit: 'ml', quantity: '330 ml' })).toBe('ml') // Coca-Cola
    expect(detectUnit({ product_quantity_unit: 'g', quantity: '400 g' })).toBe('g')
    expect(detectUnit({ serving_quantity_unit: 'ml' })).toBe('ml')
  })
  it('si no hay unidad estructurada, la deduce del texto', () => {
    expect(detectUnit({ quantity: '1,5 l' })).toBe('ml')
    expect(detectUnit({ quantity: '75cl' })).toBe('ml')
    expect(detectUnit({ quantity: '1 L' })).toBe('ml')
    expect(detectUnit({ quantity: '500 g' })).toBe('g')
    expect(detectUnit({ quantity: '1 lb' })).toBe('g')
    expect(detectUnit({ serving_size: '1 vaso (250 ml)' })).toBe('ml')
    expect(detectUnit({})).toBe('g')
  })
  it('unitOf: g por defecto', () => {
    expect(unitOf({ unit: 'ml' })).toBe('ml')
    expect(unitOf({ unit: undefined })).toBe('g')
    expect(unitOf(null)).toBe('g')
  })
})
