import { useCallback, useEffect, useState } from 'react'
import { computeDayEnergy, saveDayEnergy, type DayEnergy } from './energy'
import { ymd } from './dates'
import { useApp } from '../stores/app'

/** Objetivos y gasto del día; guarda el snapshot para el calendario de cumplimiento */
export function useDayEnergy(day: string) {
  const profile = useApp((s) => s.profile)
  const [energy, setEnergy] = useState<DayEnergy | null>(null)
  const refresh = useCallback(async () => {
    if (!profile) return
    const e = await computeDayEnergy(profile, day)
    setEnergy(e)
    if (day <= ymd()) saveDayEnergy(day, e)
  }, [profile, day])
  useEffect(() => { refresh() }, [refresh])
  return { energy, refresh }
}
