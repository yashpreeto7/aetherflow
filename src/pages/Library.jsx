import React, { useState, useEffect, useMemo } from 'react'
import {
  Trash2, Play, Image, Plus, Video, Monitor, Square, Check,
  Zap, Pin, PinOff, Pencil, Search, X
} from 'lucide-react'
import { listen } from '@tauri-apps/api/event'
import { useStore } from '../store/useStore.js'
import { BUILTIN_THEMES, WALLPAPER_LIST } from '../engines/index.js'
import WallpaperPlayer from '../components/WallpaperPlayer/index.jsx'
import WallpaperThumbnail from '../components/WallpaperThumbnail/index.jsx'
import { AddWallpaperModal, RenameWallpaperModal } from '../components/Modals/WallpaperModals.jsx'
import {
  applyWallpaperToDesktop,
  stopDesktopWallpaper,
  addCustomMediaWallpaper,
  addCustomVideoWallpaper,
  tauriInvoke,
} from '../lib/wallpaperActions.js'

export default function LibraryPage() {
  const installed            = useStore(s => s.installed)
  const activeWallpaper      = useStore(s => s.activeWallpaper)
  const isWallpaperRunning   = useStore(s => s.isWallpaperRunning)
  const activeTheme          = useStore(s => s.activeTheme)
  const setActiveTheme       = useStore(s => s.setActiveTheme)
  const uninstallItem        = useStore(s => s.uninstallItem)
  const screenArrangement    = useStore(s => s.screenArrangement)
  const monitorWallpapers    = useStore(s => s.monitorWallpapers)
  const homeWallpaperIds     = useStore(s => s.homeWallpaperIds) || []
  const togglePinToHome      = useStore(s => s.togglePinToHome)
  const customNames          = useStore(s => s.customNames) || {}
  const setWallpaperName     = useStore(s => s.setWallpaperName)

  const [monitors, setMonitors] = useState([])
  const [selectedMonitorLabel, setSelectedMonitorLabel] = useState(null)
  const [applyingId, setApplyingId] = useState(null)
  const [hoveredId, setHoveredId]   = useState(null)

  // Filters & Search
  const [filterCategory, setFilterCategory] = useState('all') // 'all' | 'builtin' | 'custom' | 'pinned'
  const [searchQuery, setSearchQuery]       = useState('')

  // Modals state
  const [addModal, setAddModal] = useState({ isOpen: false, path: '', initialName: '' })
  const [renameModal, setRenameModal] = useState({ isOpen: false, id: null, currentName: '' })

  // Fetch monitors on mount and when display configuration changes
  useEffect(() => {
    let unlistenMonitors
    function loadMonitors() {
      tauriInvoke('get_monitors').then(res => {
        if (res && res.length > 0) {
          res.sort((a, b) => {
            if (a.isPrimary && !b.isPrimary) return -1
            if (!a.isPrimary && b.isPrimary) return 1
            return a.x - b.x
          })
          setMonitors(res)
          setSelectedMonitorLabel(prev => {
            if (prev && res.some(m => m.label === prev)) return prev
            return res[0].label
          })
        }
      })
    }
    loadMonitors()

    listen('aura:monitors-changed', () => {
      loadMonitors()
    }).then(u => { unlistenMonitors = u }).catch(() => {})

    window.addEventListener('focus', loadMonitors)
    return () => {
      if (unlistenMonitors) unlistenMonitors()
      window.removeEventListener('focus', loadMonitors)
    }
  }, [])

  // ── Import file handler with naming modal ──────────────────────────────────
  const handleOpenImportDialog = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'All Supported Media',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv']
          },
          {
            name: 'Pictures (*.png, *.jpg, *.jpeg, *.webp, *.bmp)',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp']
          },
          {
            name: 'Videos (*.mp4, *.webm, *.mkv, *.avi, *.mov)',
            extensions: ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv']
          }
        ]
      })

      if (selected) {
        const path = typeof selected === 'string' ? selected : selected[0]
        if (!path) return
        const filename = path.split('\\').pop().split('/').pop()
        const cleanName = filename.replace(/\.[^/.]+$/, '')
        setAddModal({ isOpen: true, path, initialName: cleanName })
      }
    } catch (err) {
      console.error('Failed to open import dialog:', err)
    }
  }

  // ── Drag & Drop listener ───────────────────────────────────────────────────
  useEffect(() => {
    let unlistenFn
    listen('tauri://drag-drop', event => {
      const paths = event.payload?.paths
      if (!paths || paths.length === 0) return

      const path = paths[0]
      const ext = path.split('.').pop().toLowerCase()
      if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'mp4', 'webm', 'ogg', 'mkv', 'avi', 'mov', 'wmv', 'flv'].includes(ext)) {
        const filename = path.split('\\').pop().split('/').pop()
        const cleanName = filename.replace(/\.[^/.]+$/, '')
        setAddModal({ isOpen: true, path, initialName: cleanName })
      }
    }).then(u => { unlistenFn = u }).catch(err => console.error(err))

    return () => { if (unlistenFn) unlistenFn() }
  }, [])

  function handleConfirmAdd({ name, pinToHome }) {
    if (!addModal.path) return
    const newItem = addCustomMediaWallpaper(addModal.path, name, pinToHome)
    setAddModal({ isOpen: false, path: '', initialName: '' })
    if (newItem) {
      handleApply(newItem)
    }
  }

  function handleConfirmRename(newName) {
    if (!renameModal.id) return
    setWallpaperName(renameModal.id, newName)
    setRenameModal({ isOpen: false, id: null, currentName: '' })
  }

  // ── Apply to Desktop ───────────────────────────────────────────────────────
  async function handleApply(item, targetMon = null) {
    setApplyingId(item.id)
    try {
      const mon = targetMon ?? (screenArrangement === 'per-screen' ? selectedMonitorLabel : null)
      await applyWallpaperToDesktop(item, { targetMonitor: mon })
    } finally {
      setApplyingId(null)
    }
  }

  // ── Stop Desktop Wallpaper ─────────────────────────────────────────────────
  async function handleStop(targetMon = null) {
    const mon = targetMon ?? (screenArrangement === 'per-screen' ? selectedMonitorLabel : null)
    await stopDesktopWallpaper(mon)
  }

  // Check if wallpaper is currently active on desktop
  function getActiveStatus(item) {
    if (!isWallpaperRunning) return null
    if (screenArrangement === 'per-screen') {
      const activeScreens = Object.entries(monitorWallpapers || {})
        .filter(([_, wp]) => wp?.id === item.id)
        .map(([monLabel]) => monLabel)
      return activeScreens.length > 0 ? activeScreens : null
    }
    return activeWallpaper?.id === item.id ? ['all'] : null
  }

  // ── Combine All Wallpapers (Built-in + Custom) ───────────────────────────────
  const allWallpapers = useMemo(() => {
    const builtins = WALLPAPER_LIST.map(w => ({
      id: w.id,
      name: customNames[w.id] || w.name,
      engine: w.id,
      tags: w.tags || ['canvas'],
      config: w.defaultConfig || {},
      isCustom: false,
      builtin: true,
    }))

    const customs = installed
      .filter(i => i.type === 'wallpaper')
      .map(i => ({
        ...i,
        name: customNames[i.id] || i.name,
        engine: i.engine || 'video-player',
        isCustom: true,
      }))

    return [...customs, ...builtins]
  }, [installed, customNames])

  const filteredWallpapers = useMemo(() => {
    return allWallpapers.filter(w => {
      const isPinned = homeWallpaperIds.includes(w.id)
      if (filterCategory === 'builtin' && w.isCustom) return false
      if (filterCategory === 'custom' && !w.isCustom) return false
      if (filterCategory === 'pinned' && !isPinned) return false
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchName = w.name.toLowerCase().includes(query)
        const matchTag = w.tags?.some(t => t.toLowerCase().includes(query))
        return matchName || matchTag
      }
      return true
    })
  }, [allWallpapers, filterCategory, searchQuery, homeWallpaperIds])

  const installedThemes = installed.filter(i => i.type === 'theme')
  const allThemes = [
    ...BUILTIN_THEMES.map(t => ({ ...t, type: 'theme', builtin: true })),
    ...installedThemes,
  ]

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ letterSpacing: '-0.5px' }}>Wallpaper Library</h1>
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>
            Master collection of all wallpapers — select what you want to appear on your Home screen
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenImportDialog}>
          <Plus size={15} /> Add Local Wallpaper
        </button>
      </div>

      {/* Target Screen Bar (for multi-monitor) */}
      {screenArrangement === 'per-screen' && monitors.length > 1 && (
        <div className="card p-3" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div className="flex items-center gap-2">
            <Monitor size={16} className="text-brand" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Target Screen:</span>
          </div>
          <div className="flex gap-2">
            {monitors.map((m, i) => {
              const isSelected = selectedMonitorLabel === m.label
              const monWp = monitorWallpapers?.[m.label]
              return (
                <button
                  key={m.label}
                  className={`btn ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '4px 12px', fontSize: 12, height: 'auto' }}
                  onClick={() => setSelectedMonitorLabel(m.label)}
                >
                  Screen {i + 1} {monWp ? `(${monWp.name})` : ''}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div style={{ marginBottom: 16 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-base">All Wallpapers</h2>
            <span className="badge font-mono">{filteredWallpapers.length}</span>
          </div>

          <div style={{ position: 'relative', width: 220 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search library…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 26px 6px 30px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-main)',
                borderRadius: 8,
                color: 'var(--text-main)',
                fontSize: 12,
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                className="btn-icon"
                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', padding: 2 }}
                onClick={() => setSearchQuery('')}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All (${allWallpapers.length})` },
            { id: 'pinned', label: `Pinned to Home (${homeWallpaperIds.length})` },
            { id: 'builtin', label: `Built-in Canvas (${WALLPAPER_LIST.length})` },
            { id: 'custom', label: `Custom Media (${allWallpapers.filter(w => w.isCustom).length})` },
          ].map(cat => (
            <button
              key={cat.id}
              className={`badge ${filterCategory === cat.id ? 'badge-brand' : ''}`}
              style={{ cursor: 'pointer', padding: '5px 12px', fontSize: 11 }}
              onClick={() => setFilterCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Wallpapers Grid */}
      {filteredWallpapers.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-subtle)', marginBottom: 36 }}>
          <Search size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
          <div className="text-sm">No wallpapers found matching your filter</div>
          <button className="btn btn-ghost" style={{ marginTop: 12, fontSize: 12 }} onClick={() => { setSearchQuery(''); setFilterCategory('all'); }}>
            Reset Filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, marginBottom: 36 }}>
          {filteredWallpapers.map(item => {
            const activeStatus = getActiveStatus(item)
            const isLive = Boolean(activeStatus)
            const isApplying = applyingId === item.id
            const isPinnedToHome = homeWallpaperIds.includes(item.id)
            const engineIdToLoad = item.engine || item.id

            return (
              <div
                key={item.id}
                className={`card wp-card ${isLive ? 'card-active' : ''}`}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onDoubleClick={() => handleApply(item)}
              >
                {/* Thumbnail Preview */}
                <div style={{ height: 118, position: 'relative', background: '#000' }}>
                  <WallpaperThumbnail wallpaper={item} isHovered={hoveredId === item.id} />

                  {/* Active Indicator Badge */}
                  {isLive && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'rgba(16, 185, 129, 0.9)',
                      backdropFilter: 'blur(4px)',
                      borderRadius: 999,
                      padding: '2px 8px',
                      fontSize: 9,
                      fontWeight: 700,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      zIndex: 3,
                    }}>
                      <div className="status-dot-live" />
                      {activeStatus[0] === 'all' ? 'LIVE' : activeStatus.join(', ')}
                    </div>
                  )}

                  {/* Pin to Home status indicator on thumbnail */}
                  <button
                    className="btn-icon"
                    style={{
                      position: 'absolute', top: 6, left: 6, zIndex: 3,
                      background: isPinnedToHome ? 'rgba(59, 130, 246, 0.85)' : 'rgba(0,0,0,0.6)',
                      color: '#fff', padding: 4, borderRadius: 6,
                      backdropFilter: 'blur(4px)',
                    }}
                    title={isPinnedToHome ? 'Pinned to Home (Click to remove)' : 'Pin to Home'}
                    onClick={(e) => { e.stopPropagation(); togglePinToHome(item.id) }}
                  >
                    <Pin size={12} fill={isPinnedToHome ? '#fff' : 'none'} />
                  </button>

                  {/* Hover Overlay with Quick Actions */}
                  <div className="wp-hover-overlay">
                    <button
                      className="btn btn-primary"
                      style={{ padding: '6px 14px', fontSize: 12, boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }}
                      onClick={(e) => { e.stopPropagation(); handleApply(item) }}
                      disabled={isApplying}
                    >
                      <Play size={12} fill="#fff" />
                      {isApplying ? 'Applying…' : isLive ? 'Re-apply' : 'Apply to Desktop'}
                    </button>
                    {isLive && (
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(239,68,68,0.2)', color: '#fca5a5', borderColor: 'rgba(239,68,68,0.4)' }}
                        onClick={(e) => { e.stopPropagation(); handleStop() }}
                      >
                        <Square size={10} fill="#fca5a5" /> Stop
                      </button>
                    )}
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Double-click to apply</span>
                  </div>
                </div>

                {/* Card Info & Actions */}
                <div style={{ padding: '10px 12px' }}>
                  <div className="flex items-center justify-between gap-1">
                    <div className="font-medium text-sm truncate" title={item.name}>
                      {item.name}
                    </div>
                    <div className="flex items-center">
                      <button
                        className="btn-icon"
                        style={{ padding: 3 }}
                        title="Rename Wallpaper"
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenameModal({ isOpen: true, id: item.id, currentName: item.name })
                        }}
                      >
                        <Pencil size={11} />
                      </button>
                      {item.isCustom && (
                        <button
                          className="btn-icon"
                          style={{ padding: 3 }}
                          title="Delete Wallpaper"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isLive) handleStop()
                            uninstallItem(item.id)
                          }}
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2" style={{ marginTop: 8 }}>
                    <button
                      className={`btn ${isLive ? 'btn-ghost' : 'btn-primary'}`}
                      style={{ flex: 1, padding: '5px 8px', fontSize: 11, justifyContent: 'center' }}
                      onClick={() => handleApply(item)}
                      disabled={isApplying}
                    >
                      {isLive ? <Check size={11} className="text-brand" /> : <Play size={11} />}
                      {isApplying ? 'Applying…' : isLive ? 'Live' : 'Apply'}
                    </button>

                    <button
                      className={`btn ${isPinnedToHome ? 'btn-ghost' : 'btn-ghost'}`}
                      style={{
                        padding: '5px 8px', fontSize: 11,
                        color: isPinnedToHome ? 'var(--color-brand)' : 'var(--text-muted)',
                        borderColor: isPinnedToHome ? 'var(--color-brand)' : 'var(--border-main)',
                      }}
                      title={isPinnedToHome ? 'Remove from Home' : 'Show on Home'}
                      onClick={() => togglePinToHome(item.id)}
                    >
                      <Pin size={11} fill={isPinnedToHome ? 'currentColor' : 'none'} />
                      {isPinnedToHome ? 'On Home' : 'Pin'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Themes Section */}
      <h2 className="font-semibold text-sm text-muted" style={{ marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
        Themes ({allThemes.length})
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, paddingBottom: 24 }}>
        {allThemes.map(theme => {
          const isActive = activeTheme === theme.id
          return (
            <div
              key={theme.id}
              className={`card card-interactive ${isActive ? 'card-active' : ''}`}
              style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
              onClick={() => setActiveTheme(theme.id)}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: theme.bg,
                border: `2px solid ${theme.accent}`,
                boxShadow: isActive ? `0 0 10px ${theme.accent}66` : 'none',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-sm font-medium truncate">{theme.name}</div>
                <div className="text-xs text-muted">{theme.builtin ? 'Built-in' : 'Installed'} · {theme.category}</div>
              </div>
              {!theme.builtin && (
                <button className="btn-icon" onClick={e => { e.stopPropagation(); uninstallItem(theme.id) }}>
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Modals */}
      <AddWallpaperModal
        isOpen={addModal.isOpen}
        filePath={addModal.path}
        initialName={addModal.initialName}
        onClose={() => setAddModal({ isOpen: false, path: '', initialName: '' })}
        onConfirm={handleConfirmAdd}
      />

      <RenameWallpaperModal
        isOpen={renameModal.isOpen}
        currentName={renameModal.currentName}
        onClose={() => setRenameModal({ isOpen: false, id: null, currentName: '' })}
        onConfirm={handleConfirmRename}
      />
    </div>
  )
}
