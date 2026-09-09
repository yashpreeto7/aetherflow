import React, { useState, useEffect } from 'react'
import { X, Check, Pencil, Video, Image as ImageIcon, Pin } from 'lucide-react'

/**
 * Modal to customize wallpaper name and options when adding a new local video or picture
 */
export function AddWallpaperModal({ isOpen, filePath, initialName, onClose, onConfirm }) {
  const [name, setName] = useState('')
  const [pinToHome, setPinToHome] = useState(true)

  const isImage = Boolean(filePath && /\.(png|jpe?g|webp|bmp|gif|avif)$/i.test(filePath))

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
            {isImage ? (
              <ImageIcon size={18} className="text-brand" />
            ) : (
              <Video size={18} className="text-brand" />
            )}
            <h3 className="font-semibold text-base">
              {isImage ? 'Add Picture Wallpaper' : 'Add Local Wallpaper'}
            </h3>
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

/**
 * Modal to add a live YouTube stream or Web URL wallpaper
 */
export function AddWebStreamModal({ isOpen, onClose, onConfirm }) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [muted, setMuted] = useState(true)
  const [pinToHome, setPinToHome] = useState(true)
  const [ytId, setYtId] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setUrl('')
      setName('')
      setMuted(true)
      setPinToHome(true)
      setYtId(null)
    }
  }, [isOpen])

  // Parse YouTube video ID whenever URL changes
  useEffect(() => {
    if (!url) {
      setYtId(null)
      return
    }
    const clean = url.trim()
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/
    ]
    let found = null
    for (const p of patterns) {
      const m = clean.match(p)
      if (m && m[1]) {
        found = m[1]
        break
      }
    }
    setYtId(found)
    if (found && !name) {
      setName('YouTube Ambient Stream')
    }
  }, [url])

  if (!isOpen) return null

  function handleSubmit(e) {
    e?.preventDefault()
    if (!url.trim()) return
    const finalName = name.trim() || (ytId ? 'YouTube Live Stream' : 'Web Stream Wallpaper')
    onConfirm({
      name: finalName,
      url: url.trim(),
      ytId,
      muted,
      pinToHome,
    })
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
        maxWidth: 460,
        padding: 24,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-main)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
      }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 18 }}>🌐</span>
            <h3 className="font-semibold text-base">Add YouTube / Web Stream</h3>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider" style={{ display: 'block', marginBottom: 6 }}>
              Stream or Web URL
            </label>
            <input
              type="url"
              autoFocus
              className="w-full"
              placeholder="e.g. https://www.youtube.com/watch?v=5qap5aO4i9A"
              value={url}
              onChange={e => setUrl(e.target.value)}
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
            <div className="text-xs text-muted" style={{ marginTop: 4 }}>
              Supports YouTube videos, live lofi streams, WebGL visualizers, and web cams
            </div>
          </div>

          {/* YouTube Thumbnail Preview Card */}
          {ytId && (
            <div style={{
              marginBottom: 14,
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid var(--border-main)',
              background: '#000',
              position: 'relative',
              height: 140,
            }}>
              <img
                src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                alt="Thumbnail"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                top: 8,
                left: 8,
                background: 'rgba(220, 38, 38, 0.9)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                letterSpacing: 0.5,
              }}>
                YOUTUBE STREAM
              </div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label className="text-xs font-semibold text-muted uppercase tracking-wider" style={{ display: 'block', marginBottom: 6 }}>
              Wallpaper Name
            </label>
            <input
              type="text"
              className="w-full"
              placeholder={ytId ? 'YouTube Ambient Stream' : 'Live Web Wallpaper'}
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

          <div className="flex items-center justify-between" style={{ padding: '8px 0', borderTop: '1px solid var(--border-main)' }}>
            <div>
              <div className="text-sm font-medium">Mute Audio</div>
              <div className="text-xs text-muted">Keep background quiet while running on desktop</div>
            </div>
            <label className="toggle" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={muted} onChange={e => setMuted(e.target.checked)} />
              <div className="toggle-track" />
              <div className="toggle-thumb" />
            </label>
          </div>

          <div className="flex items-center justify-between" style={{ marginBottom: 20, padding: '8px 0', borderTop: '1px solid var(--border-main)' }}>
            <div>
              <div className="text-sm font-medium flex items-center gap-1.5">
                <Pin size={13} className="text-brand" /> Pin to Home Screen
              </div>
              <div className="text-xs text-muted">Makes it immediately accessible on your dashboard</div>
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
            <button type="submit" className="btn btn-primary" disabled={!url.trim()}>
              <Check size={14} /> Add Stream
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

