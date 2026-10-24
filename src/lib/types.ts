import { Apple, Coffee, Moon, Nut, Sandwich, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import type { EnergyMode, Sex } from './formulas'

export type Meal = 'desayuno' | 'almuerzo' | 'picoteo' | 'comida' | 'merienda' | 'cena'
export const MEALS: { id: Meal; label: string; icon: LucideIcon }[] = [
  { id: 'desayuno', label: 'Desayuno', icon: Coffee },
  { id: 'almuerzo', label: 'Almuerzo', icon: Sandwich },
  { id: 'picoteo', label: 'Picoteo', icon: Nut },
  { id: 'comida', label: 'Comida', icon: UtensilsCrossed },
  { id: 'merienda', label: 'Merienda', icon: Apple },
  { id: 'cena', label: 'Cena', icon: Moon },
]

export interface Profile {
  id: string
  display_name: string | null
  sex: Sex | null
  birthdate: string | null
  height_cm: number | null
  weight_kg: number | null
  activity_level: number
  energy_mode: EnergyMode
  activity_factor: number
  protein_g_kg: number
  fat_g_kg: number
  deficit_kcal: number
  goal_weight_kg: number | null
  theme: 'dark' | 'light'
  kcal_tolerance_pct: number
  protein_min_pct: number
  steps_goal: number
  onboarded: boolean
  /** avisos (se desactivan en Ajustes) */
  remind_weight?: boolean
  remind_bodyfat?: boolean
  /** fórmula del basal: automática, Mifflin-St Jeor o Katch-McArdle */
  bmr_formula?: 'auto' | 'mifflin' | 'katch'
}

export interface Product {
  barcode: string
  name: string
  brand: string | null
  image_url: string | null
  kcal_100g: number | null
  protein_100g: number | null
  carbs_100g: number | null
  sugars_100g?: number | null
  fat_100g: number | null
  fiber_100g?: number | null
  salt_100g?: number | null
  serving_g: number | null
  source?: 'off' | 'manual' | 'dish' | string
  /** solo platos: peso final cocinado (null = suma de ingredientes) */
  dish_total_g?: number | null
  /** los valores son por 100 g ('g') o por 100 ml ('ml', líquidos) */
  unit?: 'g' | 'ml'
  /** quién lo añadió al catálogo (en platos: quién lo creó) */
  created_by?: string | null
}

export const isDish = (p: Pick<Product, 'source'>) => p.source === 'dish'

export interface FoodLog {
  id: number
  eaten_at: string
  day: string
  meal: Meal
  barcode: string | null
  name: string
  /** cantidad registrada, en la unidad de `unit` */
  grams: number
  unit?: 'g' | 'ml'
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface Exercise {
  id: string
  name: string
  force: string | null
  level: string | null
  mechanic: string | null
  equipment: string | null
  primary_muscles: string[]
  secondary_muscles: string[]
  instructions: string[]
  category: string | null
  images: string[]
  is_custom: boolean
}

export interface WorkoutSet {
  id?: number
  workout_id?: number
  exercise_id: string
  position: number
  sets: number
  reps: number
  weight_kg: number | null
  minutes: number | null
  done: boolean
  exercise: Exercise
  // solo cardio
  intensity?: 'light' | 'moderate' | 'vigorous' | null
  distance_km?: number | null
  avg_watts?: number | null
  avg_hr?: number | null
  machine_kcal?: number | null
  /** kcal netas calculadas (cardio) */
  kcal?: number | null
  kcal_method?: string | null
}

export interface Workout {
  id: number
  day: string
  title: string | null
  duration_min: number | null
  intensity: 'light' | 'moderate' | 'vigorous'
  kcal: number
  planned: boolean
  notes: string | null
  workout_sets: WorkoutSet[]
}
