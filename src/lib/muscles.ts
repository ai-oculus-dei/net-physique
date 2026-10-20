// Músculos de free-exercise-db → nombre en español y grupo

export const MUSCLES = {
  abdominals: { es: 'Abdominales', group: 'Core' },
  abductors: { es: 'Abductores', group: 'Pierna' },
  adductors: { es: 'Aductores', group: 'Pierna' },
  biceps: { es: 'Bíceps', group: 'Brazo' },
  calves: { es: 'Gemelos', group: 'Pierna' },
  chest: { es: 'Pecho', group: 'Pecho' },
  forearms: { es: 'Antebrazos', group: 'Brazo' },
  glutes: { es: 'Glúteos', group: 'Pierna' },
  hamstrings: { es: 'Isquios', group: 'Pierna' },
  lats: { es: 'Dorsales', group: 'Espalda' },
  'lower back': { es: 'Lumbar', group: 'Espalda' },
  'middle back': { es: 'Espalda media', group: 'Espalda' },
  neck: { es: 'Cuello', group: 'Hombro' },
  quadriceps: { es: 'Cuádriceps', group: 'Pierna' },
  shoulders: { es: 'Hombros', group: 'Hombro' },
  traps: { es: 'Trapecio', group: 'Espalda' },
  triceps: { es: 'Tríceps', group: 'Brazo' },
} as const

export type Muscle = keyof typeof MUSCLES
export const MUSCLE_LIST = Object.keys(MUSCLES) as Muscle[]
export const GROUPS = ['Pecho', 'Espalda', 'Hombro', 'Brazo', 'Core', 'Pierna'] as const

export const muscleEs = (m: string) => (MUSCLES as Record<string, { es: string }>)[m]?.es ?? m

export const EQUIPMENT_ES: Record<string, string> = {
  'body only': 'Peso corporal', dumbbell: 'Mancuernas', barbell: 'Barra', cable: 'Polea',
  machine: 'Máquina', kettlebells: 'Kettlebell', bands: 'Bandas', 'medicine ball': 'Balón medicinal',
  'exercise ball': 'Fitball', 'foam roll': 'Foam roller', 'e-z curl bar': 'Barra Z', other: 'Otro',
}

export const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

export interface SetLike { sets: number; exercise: { primary_muscles: string[]; secondary_muscles: string[] } }

/** Carga por músculo: series directas = 1, secundarias = 0.5 */
export function muscleLoad(items: SetLike[]): Record<string, number> {
  const load: Record<string, number> = {}
  for (const it of items) {
    for (const m of it.exercise.primary_muscles) load[m] = (load[m] ?? 0) + it.sets
    for (const m of it.exercise.secondary_muscles) load[m] = (load[m] ?? 0) + it.sets * 0.5
  }
  return load
}
