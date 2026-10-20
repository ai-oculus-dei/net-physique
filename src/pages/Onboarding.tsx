import ProfileForm from '../components/ProfileForm'
import { toast } from '../components/ui'
import { supabase } from '../lib/supabase'
import { ymd } from '../lib/dates'
import { useApp } from '../stores/app'

export default function Onboarding() {
  const { profile, saveProfile } = useApp()
  return (
    <div className="shell">
      <div className="topbar"><h1>👋 Configuración inicial</h1></div>
      <p className="muted small" style={{ marginTop: -6 }}>
        Estos datos se usan para el metabolismo basal, el gasto y los macros objetivo. Puedes cambiarlos luego en ⚙️ Ajustes.
      </p>
      <ProfileForm
        initial={profile ?? {}}
        submitLabel="Empezar 🚀"
        onSubmit={async (p) => {
          const err = await saveProfile({ ...p, onboarded: true })
          if (err) return toast('⚠️ ' + err)
          if (p.weight_kg) await supabase.from('weights').upsert({ day: ymd(), kg: p.weight_kg })
        }}
      />
    </div>
  )
}
