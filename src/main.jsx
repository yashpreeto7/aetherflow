import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import { useStore, syncCustomWallpapersFromDisk } from './store/useStore.js'
import { tauriInvoke } from './lib/wallpaperActions.js'

// Automatically sync and restore custom wallpapers from disk
syncCustomWallpapersFromDisk()

// Frontend lifecycle diagnostics
console.log('[FRONTEND DIAG] Initializing main.jsx, readyState:', document.readyState)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[FRONTEND DIAG] DOMContentLoaded fired at', performance.now())
  })
} else {
  console.log('[FRONTEND DIAG] DOM already ready at', performance.now())
}

window.addEventListener('error', (event) => {
  const errMsg = event.message || 'Unknown error'
  const errLocation = `${event.filename || 'unknown'}:${event.lineno || 0}:${event.colno || 0}`
  console.error('[FRONTEND ERROR]', errMsg, errLocation, event.error)
  tauriInvoke('report_frontend_error', {
    error: errMsg,
    info: errLocation,
    source: 'window.onerror',
  })
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason ? (event.reason.stack || String(event.reason)) : 'Unknown rejection'
  console.error('[FRONTEND UNHANDLED REJECTION]', reason)
  tauriInvoke('report_frontend_error', {
    error: reason,
    info: null,
    source: 'unhandledrejection',
  })
})

document.addEventListener('visibilitychange', () => {
  console.log('[FRONTEND DIAG] document.visibilityState changed to:', document.visibilityState)
})

// Apply persisted theme to DOM before first paint
const state = useStore.getState()
const savedTheme = state.activeTheme
document.documentElement.setAttribute('data-theme', savedTheme)

if (state.themes && state.themes[savedTheme]) {
  Object.entries(state.themes[savedTheme]).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value)
  })
}

// Restore saved taskbar styling
if (state.taskbarStyle && state.taskbarStyle !== 'default') {
  tauriInvoke('set_taskbar_style', { style: state.taskbarStyle }).catch(() => {})
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
console.log('[FRONTEND DIAG] React root rendered successfully at', performance.now())

// 2-second heartbeat loop verifying Tauri IPC responsiveness and renderer liveliness
setInterval(() => {
  tauriInvoke('frontend_heartbeat', {
    page: window.location.pathname || 'main',
    visibility: document.visibilityState || 'visible',
    timestamp: performance.now(),
    mounted: true,
  })
}, 2000)

