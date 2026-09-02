import React, { useEffect } from 'react'
import { Trash2, Play, Image, Plus, Video } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { listen } from '@tauri-apps/api/event'
import { useStore } from '../store/useStore.js'
import { BUILTIN_THEMES } from '../engines/index.js'
import WallpaperPlayer from '../components/WallpaperPlayer/index.jsx'

export default function LibraryPage() {
  const installed         = useStore(s => s.installed)
  const activeWallpaper   = useStore(s => s.activeWallpaper)
  const activeTheme       = useStore(s => s.activeTheme)
  const setActiveWallpaper = useStore(s => s.setActiveWallpaper)
  const setActiveTheme    = useStore(s => s.setActiveTheme)
  const uninstallItem     = useStore(s => s.uninstallItem)
  const installItem       = useStore(s => s.installItem)

  const handleImport = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Video Wallpapers',
          extensions: ['mp4', 'webm', 'mkv', 'avi']
        }]
      })
      
      if (selected) {
        const path = typeof selected === 'string' ? selected : selected[0]
        if (!path) return
        
        const filename = path.split('\\').pop().split('/').pop()
        
        installItem({
          id: 'local-' + Date.now(),
          type: 'wallpaper',
          name: filename,
          engine: 'video-player',
          config: { videoPath: path, speedMultiplier: 1 },
          installedAt: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error("Failed to open dialog", err)
    }
  }

  // ── Drag & Drop to Import ────────────────────────────────────────────────
  useEffect(() => {
    let unlistenFn;
    
    listen('tauri://drag-drop', event => {
      const payload = event.payload;
      const paths = payload.paths;
      if (!paths || paths.length === 0) return;
      
      const path = paths[0];
      const ext = path.split('.').pop().toLowerCase();
      if (['mp4', 'webm', 'ogg', 'mkv', 'avi'].includes(ext)) {
        const filename = path.split('\\').pop().split('/').pop();
        installItem({
          id: 'local-' + Date.now(),
          type: 'wallpaper',
          name: filename,
          engine: 'video-player',
          config: { videoPath: path, speedMultiplier: 1 },
          installedAt: new Date().toISOString(),
        });
      }
    }).then(unlisten => {
      unlistenFn = unlisten;
    }).catch(err => {
      console.error("Failed to listen for drag-drop", err);
    });

    return () => {
      if (unlistenFn) unlistenFn();
    }
  }, [installItem]);

  const installedWallpapers = installed.filter(i => i.type !== 'theme')
  const installedThemes     = installed.filter(i => i.type === 'theme')

  const allThemes = [
    ...BUILTIN_THEMES.map(t => ({ ...t, type: 'theme', builtin: true })),
    ...installedThemes,
  ]

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 className="font-display font-bold text-2xl" style={{ letterSpacing: '-0.5px' }}>My Library</h1>
        <p className="text-muted text-sm" style={{ marginTop: 4 }}>
          {installedWallpapers.length} wallpapers · {allThemes.length} themes
        </p>
      </div>

      {/* Wallpapers */}
      <div className="flex justify-between items-end" style={{ marginBottom: 12 }}>
        <h2 className="font-semibold text-sm text-muted" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          Wallpapers
        </h2>
        <button className="btn btn-ghost text-xs flex items-center gap-1" onClick={handleImport} style={{ padding: '4px 10px', height: 'auto', minHeight: 0 }}>
          <Plus size={14} /> Import Video
        </button>
      </div>
      {installedWallpapers.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-subtle)', marginBottom: 32, border: '1.5px dashed var(--border-main)', background: 'transparent' }}>
          <Image size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
          <div className="text-sm">No wallpapers installed from marketplace yet.</div>
          <div className="text-xs" style={{ marginTop: 6 }}>Browse the <a href="#/marketplace" style={{ color: 'var(--color-brand)' }}>Marketplace</a> to install more.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
          {installedWallpapers.map(item => {
            const isActive = activeWallpaper?.id === item.id
            return (
              <div key={item.id} className={`card ${isActive ? 'card-active' : ''}`} style={{ overflow: 'hidden' }}>
                <div style={{ height: 100, position: 'relative' }}>
                  <WallpaperPlayer engineId={item.engine} config={item.config ?? {}} preview />
                  {isActive && (
                    <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--color-brand)', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 600, color: '#fff' }}>ACTIVE</div>
                  )}
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <div className="font-medium text-sm">{item.name}</div>
                  <div className="flex gap-2" style={{ marginTop: 8 }}>
                    <button className="btn btn-primary" style={{ flex: 1, padding: '5px 0', fontSize: 12 }}
                      onClick={() => setActiveWallpaper(item)}>
                      <Play size={11} /> {isActive ? 'Active' : 'Set'}
                    </button>
                    <button className="btn-icon" onClick={() => uninstallItem(item.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Themes */}
      <h2 className="font-semibold text-sm text-muted" style={{ marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
        Themes
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {allThemes.map(theme => {
          const isActive = activeTheme === theme.id
          return (
            <div key={theme.id}
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
    </div>
  )
}
