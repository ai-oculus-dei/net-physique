import { ChevronDown } from 'lucide-react'
import { MEALS, type Meal } from '../lib/types'

/** Desplegable de comida (desayuno, comida…) con el aspecto del chip seleccionado */
export default function MealSelect({ value, onChange }: { value: Meal; onChange: (m: Meal) => void }) {
  const current = MEALS.find((m) => m.id === value) ?? MEALS[0]
  const Icon = current.icon
  return (
    <label className="meal-select">
      <Icon size={15} className="meal-select-ico" />
      <select value={value} onChange={(e) => onChange(e.target.value as Meal)} aria-label="Comida">
        {MEALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
      <ChevronDown size={16} className="meal-select-chev" />
    </label>
  )
}
