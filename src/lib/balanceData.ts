// Carga de datos para el balance de 7 días (consumo, objetivos y pesos)
import { supabase } from './supabase'
import { addDays } from './dates'
import { computeDayEnergy } from './energy'
import { BALANCE_WINDOW_DAYS, type BalanceDay, type WeightPoint } from './balance'
import type { Profile } from './types'

export async function loadBalanceInput(profile: Profile, today: string): Promise<{ days: BalanceDay[]; weights: WeightPoint[] }> {
  const from = addDays(today, -BALANCE_WINDOW_DAYS)
  const to = addDays(today, -1)
  const [{ data: food }, { data: targets }, { data: weights }] = await Promise.all([
    supabase.from('food_logs').select('day,kcal').gte('day', from).lte('day', to),
    supabase.from('daily_energy').select('day,target_kcal').gte('day', from).lte('day', to),
    supabase.from('weights').select('day,kg').gte('day', addDays(today, -13)).lte('day', today),
  ])

  const consumed = new Map<string, number>()
  for (const r of food ?? []) consumed.set(r.day, (consumed.get(r.day) ?? 0) + Number(r.kcal))
  const target = new Map<string, number>((targets ?? []).map((r) => [r.day, Number(r.target_kcal)]))

  // Objetivo del día guardado al abrir ese día; si no existe, se calcula igual que en Diet
  const days: BalanceDay[] = await Promise.all([...consumed.entries()].map(async ([fecha, consumido]) => ({
    fecha,
    consumido,
    objetivo: target.get(fecha) ?? Math.round((await computeDayEnergy(profile, fecha)).kcal),
  })))

  return { days, weights: (weights ?? []).map((w) => ({ fecha: w.day, kg: Number(w.kg) })) }
}
