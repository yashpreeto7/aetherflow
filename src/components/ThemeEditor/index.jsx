import React, { useState, useEffect } from 'react'
import { X, Check, Save } from 'lucide-react'
import { useStore } from '../../store/useStore'

const hexToRgbTuple = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

const DEFAULT_TOKENS = {
  '--rgb-base': '#09090b',
  '--rgb-sidebar': '#111114',
  '--rgb-card': '#1a1a20',
  '--border-main': '#27272a',
  '--border-accent': '#3b82f6',
  '--color-brand': '#3b82f6',
  '--color-brand-hover': '#2563eb',
  '--color-accent': '#60a5fa',
  '--text-main': '#fafafa',
  '--text-muted': '#a1a1aa',
}

export default function ThemeEditor({ onClose }) {
  const [name, setName] = useState('My Custom Theme')
  const [tokens, setTokens] = useState({ ...DEFAULT_TOKENS })
  const saveCustomTheme = useStore(s => s.saveCustomTheme)
  const setActiveTheme = useStore(s => s.setActiveTheme)

  // Apply preview styles instantly
  useEffect(() => {
    Object.entries(tokens).forEach(([key, hexValue]) => {
      let finalValue = hexValue
      if (key.startsWith('--rgb-')) {
        finalValue = hexToRgbTuple(hexValue)
      }
      document.documentElement.style.setProperty(key, finalValue)
    })
    
    // Cleanup if closed without saving
    return () => {
      // Re-apply the actual active theme
      const active = useStore.getState().activeTheme
      const customThemes = useStore.getState().themes
      
      if (customThemes && customThemes[active]) {
        Object.entries(customThemes[active]).forEach(([k, v]) => {
          document.documentElement.style.setProperty(k, v)
        })
      } else {
        document.documentElement.removeAttribute('style')
      }
    }
  }, [tokens])

  const handleSave = () => {
    const id = `custom-${Date.now()}`
    
    // Convert RGB ones
    const finalTokens = {}
    Object.entries(tokens).forEach(([key, hexValue]) => {
      finalTokens[key] = key.startsWith('--rgb-') ? hexToRgbTuple(hexValue) : hexValue
    })
    // Add meta properties so Home.jsx can render the card
    finalTokens._meta = {
      name: name || 'Untitled Theme',
      bg: tokens['--rgb-base'],
      accent: tokens['--color-brand']
    }

    saveCustomTheme(id, finalTokens)
    setActiveTheme(id)
    onClose()
  }

  const handleChange = (key, val) => {
    setTokens(s => ({ ...s, [key]: val }))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="card" style={{ width: 400, maxWidth: '90vw', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="font-semibold text-lg">Theme Editor</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div>
          <label className="text-xs text-muted block mb-1">Theme Name</label>
          <input 
            type="text" 
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ 
              width: '100%', padding: '8px 12px', borderRadius: 6,
              background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-main)',
              color: 'var(--text-main)', outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxHeight: '50vh', overflowY: 'auto', paddingRight: 8 }}>
          {Object.entries(tokens).map(([key, value]) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="text-xs text-muted truncate">{key.replace('--', '')}</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input 
                  type="color" 
                  value={value}
                  onChange={e => handleChange(key, e.target.value)}
                  style={{ width: 32, height: 32, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
                />
                <span className="text-xs font-mono">{value}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          <button onClick={onClose} className="text-sm font-medium" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px 16px' }}>
            Cancel
          </button>
          <button onClick={handleSave} className="text-sm font-medium" style={{ 
            background: 'var(--color-brand)', color: '#fff', border: 'none', 
            borderRadius: 6, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' 
          }}>
            <Save size={16} /> Save Theme
          </button>
        </div>

      </div>
    </div>
  )
}
