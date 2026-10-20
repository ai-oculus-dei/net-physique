import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/diet', ico: '🥗', label: 'Diet' },
  { to: '/training', ico: '🏋️', label: 'Training' },
  { to: '/physique', ico: '🧬', label: 'Physique' },
  { to: '/settings', ico: '⚙️', label: 'Ajustes' },
]

export default function BottomNav() {
  return (
    <nav className="bottomnav">
      {ITEMS.map((i) => (
        <NavLink key={i.to} to={i.to}>
          <span className="ico">{i.ico}</span>
          {i.label}
        </NavLink>
      ))}
    </nav>
  )
}
