import { NavLink } from 'react-router-dom'
import { Dna, Dumbbell, Salad, Settings } from 'lucide-react'

const ITEMS = [
  { to: '/diet', ico: Salad, label: 'Diet' },
  { to: '/training', ico: Dumbbell, label: 'Training' },
  { to: '/physique', ico: Dna, label: 'Physique' },
  { to: '/settings', ico: Settings, label: 'Ajustes' },
]

export default function BottomNav() {
  return (
    <nav className="bottomnav">
      {ITEMS.map((i) => (
        <NavLink key={i.to} to={i.to}>
          <span className="ico"><i.ico size={21} /></span>
          {i.label}
        </NavLink>
      ))}
    </nav>
  )
}
