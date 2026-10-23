import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { applyTheme, useApp } from './stores/app'
import './styles.css'

applyTheme(useApp.getState().theme)

// Sin zoom en toda la app: iOS ignora user-scalable=no, así que se bloquea el gesto
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false })
}
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault() }, { passive: false })

// Altura del teclado en pantalla (iOS no encoge la ventana al abrirlo): --kb sube las hojas inferiores por encima
const vv = window.visualViewport
if (vv) {
  const updateKb = () => {
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
    document.documentElement.style.setProperty('--kb', `${kb > 80 ? Math.round(kb) : 0}px`)
    document.documentElement.classList.toggle('kb-open', kb > 80)
  }
  vv.addEventListener('resize', updateKb)
  vv.addEventListener('scroll', updateKb)
  updateKb()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
