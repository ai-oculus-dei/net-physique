import { describe, expect, it } from 'vitest'
import { editDistance, fuzzyFilter, norm } from './search'
import { searchExercises } from './exerciseSearch'
import type { Exercise } from './types'

describe('búsqueda tolerante (texto)', () => {
  const items = ['Judías verdes redondas al natural', 'Leche semidesnatada sin lactosa', 'Gazpacho', 'Gazpacho con jamón y huevo', 'Tomate frito', 'Picos de pan']
  const f = (q: string) => fuzzyFilter(items, q, (x) => x)

  it('normaliza tildes y mayúsculas', () => {
    expect(norm('Judías VERDES, 100%')).toBe('judias verdes 100')
  })
  it('sin tildes y en cualquier orden', () => {
    expect(f('judias')).toEqual(['Judías verdes redondas al natural'])
    expect(f('verdes judias')).toEqual(['Judías verdes redondas al natural'])
    expect(f('lactosa leche')).toEqual(['Leche semidesnatada sin lactosa'])
  })
  it('prefijos y trozos', () => {
    expect(f('gazp')).toEqual(['Gazpacho', 'Gazpacho con jamón y huevo'])
    expect(f('desnat')).toEqual(['Leche semidesnatada sin lactosa'])
  })
  it('erratas', () => {
    expect(editDistance('gaspacho', 'gazpacho')).toBe(1)
    expect(f('gaspacho')).toEqual(['Gazpacho', 'Gazpacho con jamón y huevo'])
    expect(f('semidesnatda')).toEqual(['Leche semidesnatada sin lactosa'])
    expect(f('tomte frito')).toEqual(['Tomate frito'])
  })
  it('palabras cortas no admiten erratas (evita falsos positivos)', () => {
    expect(f('pon')).toEqual([])
  })
  it('todas las palabras deben coincidir; vacío → todo', () => {
    expect(f('gazpacho huevo')).toEqual(['Gazpacho con jamón y huevo'])
    expect(f('')).toEqual(items)
  })
})

describe('búsqueda de ejercicios en español', () => {
  const ex = (name: string, primary: string[], equipment: string | null = null): Exercise => ({
    id: name, name, force: null, level: null, mechanic: null, equipment, primary_muscles: primary, secondary_muscles: [],
    instructions: [], category: 'strength', images: [], is_custom: false,
  })
  const list = [
    ex('Barbell Full Squat', ['quadriceps'], 'barbell'),
    ex('Barbell Bench Press - Medium Grip', ['chest'], 'barbell'),
    ex('Dumbbell Bench Press', ['chest'], 'dumbbell'),
    ex('Barbell Deadlift', ['lower back'], 'barbell'),
    ex('Pullups', ['lats'], 'body only'),
    ex('Seated Cable Rows', ['middle back'], 'cable'),
    ex('Side Lateral Raise', ['shoulders'], 'dumbbell'),
    ex('Goblet Squat', ['quadriceps'], 'kettlebells'),
    ex('Sentadilla búlgara con mancuernas', ['quadriceps'], 'dumbbell'),
  ]
  const s = (q: string) => searchExercises(list, q).map((e) => e.name)

  it('español → nombres en inglés', () => {
    expect(s('sentadilla')).toContain('Barbell Full Squat')
    expect(s('sentadilla')).toContain('Goblet Squat')
    expect(s('press banca')).toEqual(['Dumbbell Bench Press', 'Barbell Bench Press - Medium Grip'])
    expect(s('press banca barra')[0]).toBe('Barbell Bench Press - Medium Grip')
    expect(s('peso muerto')).toEqual(['Barbell Deadlift'])
    expect(s('dominadas')).toEqual(['Pullups'])
    expect(s('remo polea')).toEqual(['Seated Cable Rows'])
    expect(s('elevaciones laterales')).toEqual(['Side Lateral Raise'])
  })
  it('por músculo o material en español', () => {
    expect(s('pecho mancuerna')).toEqual(['Dumbbell Bench Press'])
    expect(s('cuadriceps')).toHaveLength(3)
  })
  it('erratas y tildes', () => {
    expect(s('sentadila')).toContain('Barbell Full Squat')
    expect(s('bulgara')).toContain('Sentadilla búlgara con mancuernas')
    expect(s('benchpress')).toEqual([])
    expect(s('bench')).toHaveLength(2)
  })
})
