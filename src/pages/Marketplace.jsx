import React, { useState, useEffect } from 'react'
import { Search, Upload, Download, Heart, Star, Wifi, WifiOff } from 'lucide-react'
import { fetchFeatured, searchWallpapers, isOnline } from '../lib/supabase.js'
import { WALLPAPER_LIST } from '../engines/index.js'

const TAGS = ['dark', 'neon', 'space', 'nature', 'retro', 'minimal', 'audio', 'interactive']

export default function MarketplacePage() {
  const [tab, setTab] = useState('browse')        // 'browse' | 'publish'
  const [query, setQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const online = isOnline()

  // Fallback to builtin wallpapers when offline
  const displayItems = online ? results : WALLPAPER_LIST.map(e => ({
    id: e.id, name: e.name, description: e.description,
    tags: e.tags, downloads: '—', likes: '—', preview_url: null,
    builtin: true,
  }))

  useEffect(() => {
    if (!online) return
    setLoading(true)
    const timer = setTimeout(async () => {
      const data = query || selectedTags.length
        ? await searchWallpapers({ query, tags: selectedTags })
        : await fetchFeatured()
      setResults(data)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, selectedTags, online])

  const toggleTag = (tag) => setSelectedTags(prev =>
    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
  )

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ letterSpacing: '-0.5px' }}>Marketplace</h1>
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>Discover wallpapers & themes from the community</p>
        </div>
        <div className="flex gap-2">
          {!online && (
            <div className="flex items-center gap-2 badge" style={{ padding: '6px 12px' }}>
              <WifiOff size={12} />
              <span className="text-xs">Offline — showing built-ins</span>
            </div>
          )}
          <button className="btn btn-primary" onClick={() => setTab('publish')}>
            <Upload size={14} /> Publish
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2" style={{ marginBottom: 20, borderBottom: '1px solid var(--border-main)', paddingBottom: 12 }}>
        {['browse', 'publish'].map(t => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
            style={{ textTransform: 'capitalize' }} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'browse' && (
        <>
          {/* Search + filters */}
          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search wallpapers, themes…"
                style={{
                  width: '100%', padding: '9px 12px 9px 36px',
                  background: 'var(--bg-card)', border: '1px solid var(--border-main)',
                  borderRadius: 8, color: 'var(--text-main)', fontSize: 13, outline: 'none',
                }} />
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {TAGS.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className={`badge ${selectedTags.includes(tag) ? 'badge-brand' : ''}`}
                  style={{ cursor: 'pointer', border: '1px solid var(--border-main)' }}>
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Results grid */}
          {loading ? (
            <div className="flex items-center justify-center" style={{ height: 200, color: 'var(--text-muted)' }}>
              <div className="animate-spin" style={{ width: 24, height: 24, border: '2px solid var(--border-main)', borderTopColor: 'var(--color-brand)', borderRadius: '50%' }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {displayItems.map(item => (
                <div key={item.id} className="card card-interactive" style={{ overflow: 'hidden' }}>
                  <div style={{
                    height: 120, background: 'linear-gradient(135deg, var(--bg-card), rgba(var(--rgb-card),0.3))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-subtle)', fontSize: 11,
                  }}>
                    {item.preview_url
                      ? <img src={item.preview_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span>Preview unavailable</span>
                    }
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <div className="font-semibold text-sm">{item.name}</div>
                    <div className="text-xs text-muted" style={{ marginTop: 4, marginBottom: 10 }}>
                      {item.description?.slice(0, 60)}…
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-3 text-xs text-muted">
                        <span><Download size={10} style={{ display: 'inline', marginRight: 3 }} />{item.downloads}</span>
                        <span><Heart size={10} style={{ display: 'inline', marginRight: 3 }} />{item.likes}</span>
                      </div>
                      <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 11 }}>
                        {item.builtin ? 'Built-in' : 'Install'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'publish' && (
        <div className="card p-6" style={{ maxWidth: 560 }}>
          <h2 className="font-semibold text-base" style={{ marginBottom: 20 }}>Publish a Wallpaper</h2>
          {!online ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <WifiOff size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div className="text-sm">Connect Supabase to publish wallpapers.</div>
              <div className="text-xs" style={{ marginTop: 8 }}>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env</div>
            </div>
          ) : (
            <form style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Name', placeholder: 'My Awesome Wallpaper' },
                { label: 'Description', placeholder: 'A cool animated wallpaper that…', textarea: true },
                { label: 'Tags (comma separated)', placeholder: 'dark, neon, music' },
              ].map(({ label, placeholder, textarea }) => (
                <div key={label}>
                  <label className="text-xs font-medium text-muted" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
                  {textarea
                    ? <textarea placeholder={placeholder} rows={3} style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: 8, color: 'var(--text-main)', fontSize: 13, outline: 'none', resize: 'vertical' }} />
                    : <input placeholder={placeholder} style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: 8, color: 'var(--text-main)', fontSize: 13, outline: 'none' }} />
                  }
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-muted" style={{ display: 'block', marginBottom: 6 }}>Preview Image</label>
                <div style={{ border: '1.5px dashed var(--border-main)', borderRadius: 8, padding: 24, textAlign: 'center', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: 13 }}>
                  <Upload size={20} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                  Drop a .webp / .png preview here
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted" style={{ display: 'block', marginBottom: 6 }}>.aura Package</label>
                <div style={{ border: '1.5px dashed var(--border-main)', borderRadius: 8, padding: 24, textAlign: 'center', color: 'var(--text-subtle)', cursor: 'pointer', fontSize: 13 }}>
                  <Upload size={20} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                  Drop your .aura file here
                </div>
              </div>
              <button className="btn btn-primary w-full">Publish to Marketplace</button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
