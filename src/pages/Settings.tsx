import { Download, Moon, Palette, Settings as SettingsIcon, Sun } from 'lucide-react'
import { useState } from 'react'
import ExportSheet from '../components/ExportSheet'
import ProfileForm from '../components/ProfileForm'
import { Seg, toast } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useApp } from '../stores/app'

export default function Settings() {
  const { profile, saveProfile, theme, setTheme, session } = useApp()
  const [exporting, setExporting] = useState(false)
  if (!profile) return null
  return (
    <div className="shell">
      <div className="topbar">
        <div>
          <h1><SettingsIcon size={22} /> Ajustes</h1>
          <div className="sub">{session?.user.email}</div>
        </div>
      </div>
      <div className="stack">
        <div className="card row between">
          <span className="ic"><Palette size={17} color="var(--cyan)" /> Tema</span>
          <Seg value={theme} onChange={(t) => { setTheme(t); saveProfile({ theme: t }) }}
            options={[{ id: 'dark', label: <span className="ic"><Moon size={14} /> Oscuro</span> }, { id: 'light', label: <span className="ic"><Sun size={14} /> Claro</span> }]} />
        </div>
        <ProfileForm
          key={profile.id}
          initial={profile}
          submitLabel="Guardar cambios"
          requireChanges
          beforeSubmit={<button type="button" className="btn-block" onClick={() => setExporting(true)}><Download size={17} /> Exportar</button>}
          onSubmit={async (p) => {
            const e = await saveProfile(p)
            if (e) { toast.err(e); return false }
            toast('Guardado')
          }}
        />
        <ExportSheet open={exporting} onClose={() => setExporting(false)} />
        <button className="btn-danger btn-block" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
        <p className="faint small" style={{ textAlign: 'center' }}>
          Ejercicios: free-exercise-db (dominio público) · Alimentos: Open Food Facts (ODbL)
        </p>
      </div>
    </div>
  )
}
