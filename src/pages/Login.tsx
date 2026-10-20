import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Se puede entrar con "usuario" a secas: se traduce a usuario@netphysique.app
export const USER_DOMAIN = 'netphysique.app'
const toEmail = (u: string) => (u.includes('@') ? u.trim() : `${u.trim().toLowerCase()}@${USER_DOMAIN}`)

export default function Login() {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(user), password: pass })
    setBusy(false)
    if (error) setErr('Usuario o contraseña incorrectos')
  }

  return (
    <div className="auth-wrap">
      <form className="card glow auth-card stack" onSubmit={submit}>
        <div>
          <div className="logo">net<b>physique</b></div>
          <p className="muted small" style={{ textAlign: 'center', margin: 0 }}>🥗 dieta · 🏋️ entreno · 🧬 físico</p>
        </div>
        <label className="field"><span>Usuario</span>
          <input autoComplete="username" autoCapitalize="none" value={user} onChange={(e) => setUser(e.target.value)} required />
        </label>
        <label className="field"><span>Contraseña</span>
          <input type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} required />
        </label>
        {err && <div className="small bad">{err}</div>}
        <button className="btn-primary btn-block" disabled={busy}>{busy ? <span className="spin" /> : 'Entrar →'}</button>
        <p className="faint small" style={{ textAlign: 'center', margin: 0 }}>La sesión se recuerda en este dispositivo.</p>
      </form>
    </div>
  )
}
