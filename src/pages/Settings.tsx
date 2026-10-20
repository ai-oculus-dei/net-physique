import ProfileForm from '../components/ProfileForm'
import { Seg, toast } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useApp } from '../stores/app'

export default function Settings() {
  const { profile, saveProfile, theme, setTheme, session } = useApp()
  if (!profile) return null
  return (
    <div className="shell">
      <div className="topbar">
        <div>
          <h1>⚙️ Ajustes</h1>
          <div className="sub">{session?.user.email}</div>
        </div>
      </div>
      <div className="stack">
        <div className="card row between">
          <span>🎨 Tema</span>
          <Seg value={theme} onChange={(t) => { setTheme(t); saveProfile({ theme: t }) }}
            options={[{ id: 'dark', label: '🌙 Oscuro' }, { id: 'light', label: '☀️ Claro' }]} />
        </div>
        <ProfileForm
          key={profile.id}
          initial={profile}
          submitLabel="Guardar cambios"
          onSubmit={async (p) => { const e = await saveProfile(p); toast(e ? '⚠️ ' + e : '✅ Guardado') }}
        />
        <button className="btn-danger btn-block" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
        <p className="faint small" style={{ textAlign: 'center' }}>
          Ejercicios: free-exercise-db (dominio público) · Alimentos: Open Food Facts (ODbL)
        </p>
      </div>
    </div>
  )
}
