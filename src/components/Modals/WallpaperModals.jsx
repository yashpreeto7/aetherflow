import React, { useState, useEffect } from 'react'
import { X, Check, Pencil, Video, Pin } from 'lucide-react'

/**
 * Modal to customize wallpaper name and options when adding a new local video
 */
export function AddWallpaperModal({ isOpen, filePath, initialName, onClose, onConfirm }) {
  const [name, setName] = useState('')
  const [pinToHome, setPinToHome] = useState(true)

  useEffect(() => {
    if (isOpen) {
      setName(initialName || '')
      setPinToHome(true)
    }
  }, [isOpen, initialName])

  if (!isOpen) return null

  function handleSubmit(e) {
    e?.preventDefault()
    if (!name.trim()) return
    onConfirm({ name: name.trim(), pinToHome })
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16,
    }}>
      <div className="card animate-fadeIn" style={{
        width: '100%',
        maxWidth: 440,
        padding: 24,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-main)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
      }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
          <div className="flex items-center gap-2">
            <Video size={18} className="text-brand" />
            <h3 className="font-semibold text-base">Add Local Wallpaper</h3>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider" style={{ display: 'block', marginBottom: 6 }}>
              Wallpaper Name
            </label>
            <input
              type="text"
              autoFocus
              className="w-full"
              placeholder="e.g. Neon City Sunset"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{
                padding: '9px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-main)',
                borderRadius: 8,
                color: 'var(--text-main)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider" style={{ display: 'block', marginBottom: 4 }}>
              File Source
            </label>
            <div className="text-xs font-mono text-muted truncate" style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
              {filePath}
            </div>
          </div>

          <div className="flex items-center justify-between" style={{ marginBottom: 24, padding: '10px 0', borderTop: '1px solid var(--border-main)' }}>
            <div>
              <div className="text-sm font-medium flex items-center gap-1.5">
                <Pin size={13} className="text-brand" /> Pin to Home Screen
              </div>
              <div className="text-xs text-muted">Makes it immediately accessible on your Home dashboard</div>
            </div>
            <label className="toggle" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={pinToHome} onChange={e => setPinToHome(e.target.checked)} />
              <div className="toggle-track" />
              <div className="toggle-thumb" />
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              <Check size={14} /> Add to Library
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * Modal to edit/rename an existing wallpaper
 */
export function RenameWallpaperModal({ isOpen, currentName, onClose, onConfirm }) {
  const [name, setName] = useState('')

  useEffect(() => {
    if (isOpen) {
      setName(currentName || '')
    }
  }, [isOpen, currentName])

  if (!isOpen) return null

  function handleSubmit(e) {
    e?.preventDefault()
    if (!name.trim()) return
    onConfirm(name.trim())
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16,
    }}>
      <div className="card animate-fadeIn" style={{
        width: '100%',
        maxWidth: 400,
        padding: 24,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-main)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
      }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
          <div className="flex items-center gap-2">
            <Pencil size={16} className="text-brand" />
            <h3 className="font-semibold text-base">Rename Wallpaper</h3>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider" style={{ display: 'block', marginBottom: 6 }}>
              New Name
            </label>
            <input
              type="text"
              autoFocus
              className="w-full"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{
                padding: '9px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border-main)',
                borderRadius: 8,
                color: 'var(--text-main)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              <Check size={14} /> Save Name
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
