import { Bell, Download, Moon, Palette, Settings as SettingsIcon, Sun } from 'lucide-react'
import { useState } from 'react'
import ExportSheet from '../components/ExportSheet'
import ProfileForm from '../components/ProfileForm'
import { Seg, Switch, toast } from '../components/ui'
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
          beforeSubmit={<>
            <div className="card stack" style={{ gap: 4 }}>
              <h2><Bell size={14} /> Avisos</h2>
              <Switch checked={profile.remind_weight !== false} label="Peso en ayunas"
                hint="Cada día desde las 6:00 hasta que lo registres"
                onChange={(v) => saveProfile({ remind_weight: v })} />
              <Switch checked={profile.remind_bodyfat !== false} label="% de grasa corporal"
                hint="Cada 2 semanas desde la última medición"
                onChange={(v) => saveProfile({ remind_bodyfat: v })} />
            </div>
            <button type="button" className="btn-block" onClick={() => setExporting(true)}><Download size={17} /> Exportar</button>
          </>}
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
