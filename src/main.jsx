import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import { useStore } from './store/useStore.js'

// Apply persisted theme to DOM before first paint
const state = useStore.getState()
const savedTheme = state.activeTheme
document.documentElement.setAttribute('data-theme', savedTheme)

if (state.themes && state.themes[savedTheme]) {
  Object.entries(state.themes[savedTheme]).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value)
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
