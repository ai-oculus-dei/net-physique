import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase, supabaseConfigured } from './lib/supabase'
import { useApp } from './stores/app'
import BottomNav from './components/BottomNav'
import DailyWeightPrompt from './components/DailyWeightPrompt'
import { Toaster } from './components/ui'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Diet from './pages/Diet'
const Training = lazy(() => import('./pages/Training'))
const Physique = lazy(() => import('./pages/Physique'))
const Settings = lazy(() => import('./pages/Settings'))

export default function App() {
  const { session, ready, profile, setSession, loadProfile } = useApp()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [setSession])

  useEffect(() => { if (session) loadProfile() }, [session?.user.id, loadProfile])

  if (!supabaseConfigured) {
    return (
      <div className="auth-wrap"><div className="card auth-card">
        <div className="logo">net<b>physique</b></div>
        <p className="muted small">
          Falta configurar <span className="mono">VITE_SUPABASE_URL</span> y{' '}
          <span className="mono">VITE_SUPABASE_ANON_KEY</span> (ver <span className="mono">.env.example</span>).
        </p>
      </div></div>
    )
  }
  if (!ready) return <div className="auth-wrap"><span className="spin" /></div>
  if (!session) return <><Login /><Toaster /></>
  if (!profile) return <div className="auth-wrap"><span className="spin" /></div>
  if (!profile.onboarded) return <><Onboarding /><Toaster /></>

  return (
    <>
      <Suspense fallback={<div className="auth-wrap"><span className="spin" /></div>}>
        <Routes>
          <Route path="/diet" element={<Diet />} />
          <Route path="/training" element={<Training />} />
          <Route path="/physique" element={<Physique />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/diet" replace />} />
        </Routes>
      </Suspense>
      <DailyWeightPrompt />
      <BottomNav />
      <Toaster />
    </>
  )
}
