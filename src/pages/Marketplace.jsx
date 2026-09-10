import React, { useState, useEffect, useCallback } from 'react'
import { Search, Download, Globe, Image, MonitorPlay, Upload, Users, Palette, LogIn, Play, Check } from 'lucide-react'
import { searchCatalog, fetchCatalog, fetchStats, submitWallpaper } from '../lib/marketplace.js'
import { useStore } from '../store/useStore.js'
import { applyWallpaperToDesktop } from '../lib/wallpaperActions.js'
import { supabase } from '../lib/supabase.js'
import UserAvatar from '../components/UserAvatar/index.jsx'

const TAGS = ['anime', 'nature', 'city', 'space', 'minimal', 'retro', 'lofi', 'abstract', '4K', 'dark', 'neon']

const TYPE_FILTERS = [
  { id: '',        label: 'All',        icon: null },
  { id: 'youtube', label: 'YouTube',    icon: MonitorPlay },
  { id: 'stream',  label: 'Web Stream', icon: Globe },
  { id: 'image',   label: 'Image',      icon: Image },
]

const TYPE_BADGES = {
  youtube: { label: 'YouTube', color: 'var(--color-rose)' },
  stream:  { label: 'Stream',  color: 'var(--color-cyan)' },
  image:   { label: 'Image',   color: 'var(--color-emerald)' },
}

export default function MarketplacePage() {
  const [tab, setTab] = useState('browse')
  const [query, setQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [typeFilter, setTypeFilter] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalWallpapers: 0, activeUsers: 0 })

  // Auth & Library state
  const isAuthenticated = useStore(s => s.isAuthenticated)
  const authUser = useStore(s => s.authUser)
  const authSession = useStore(s => s.authSession)
  const setShowAuthModal = useStore(s => s.setShowAuthModal)
  const installed = useStore(s => s.installed) || []
  const activeWallpaper = useStore(s => s.activeWallpaper)
  const currentDesktopWallpaper = useStore(s => s.currentDesktopWallpaper)
  const isWallpaperRunning = useStore(s => s.isWallpaperRunning)
  const setActiveWallpaper = useStore(s => s.setActiveWallpaper)
  const installItem = useStore(s => s.installItem)
  const pinToHome = useStore(s => s.pinToHome)
  const [applyingId, setApplyingId] = useState(null)

  // Submit form state
  const [submitForm, setSubmitForm] = useState({
    title: '', description: '', type: 'youtube', source: '', tags: [],
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState(null)

  // Fetch wallpapers
  const doSearch = useCallback(async () => {
    setLoading(true)
    const data = await searchCatalog({ query, tags: selectedTags, type: typeFilter })
    setResults(data)
    setLoading(false)
  }, [query, selectedTags, typeFilter])

  useEffect(() => {
    const timer = setTimeout(doSearch, 250)
    return () => clearTimeout(timer)
  }, [doSearch])

  // Fetch stats
  useEffect(() => {
    fetchStats().then(setStats).catch(() => {})
  }, [])

  const toggleTag = (tag) => setSelectedTags(prev =>
    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
  )

  const handleInstall = async (wallpaper) => {
    setApplyingId(wallpaper.id)
    try {
      // Convert community wallpaper to local library format
      const isStream = wallpaper.type === 'youtube' || wallpaper.type === 'stream'
      const item = {
        id: `community-${wallpaper.id}`,
        name: wallpaper.name,
        engine: isStream ? 'web-stream' : 'image-player',
        type: 'wallpaper',
        isCustom: true,
        installedAt: Date.now(),
        preview: wallpaper.preview,
        tags: wallpaper.tags || ['community'],
        config: {
          ...(isStream
            ? {
                streamUrl: wallpaper.source,
                url: wallpaper.source,
                streamType: wallpaper.type === 'youtube' ? 'youtube' : 'web',
                muted: true,
                speedMultiplier: 1,
              }
            : {
                imagePath: wallpaper.source,
                url: wallpaper.source,
                fit: 'cover',
              }
          ),
        },
        communityMeta: {
          author: wallpaper.author,
          originalId: wallpaper.id,
          source: wallpaper.source,
        },
      }

      installItem(item)
      pinToHome(item.id)
      setActiveWallpaper(item)
      await applyWallpaperToDesktop(item)
    } catch (err) {
      console.error('Failed to install/apply wallpaper:', err)
    } finally {
      setApplyingId(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isAuthenticated) {
      setShowAuthModal(true)
      return
    }

    setSubmitting(true)
    setSubmitResult(null)
    try {
      let token = authSession?.access_token
      if (!token && supabase) {
        const { data: sessionData } = await supabase.auth.getSession()
        token = sessionData?.session?.access_token
      }
      const result = await submitWallpaper(submitForm, token)
      setSubmitResult({ success: true, message: 'Submitted! Your wallpaper will appear after review.' })
      setSubmitForm({ title: '', description: '', type: 'youtube', source: '', tags: [] })
    } catch (err) {
      setSubmitResult({ success: false, message: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header with stats */}
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ letterSpacing: '-0.5px' }}>Marketplace</h1>
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>
            Discover wallpapers from the community
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats.activeUsers > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted">
              <Users size={12} />
              <span>{stats.activeUsers.toLocaleString()} users</span>
            </div>
          )}
          {stats.totalWallpapers > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted">
              <Palette size={12} />
              <span>{stats.totalWallpapers} wallpapers</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2" style={{ marginBottom: 20, borderBottom: '1px solid var(--border-main)', paddingBottom: 12 }}>
        {[
          { id: 'browse', label: 'Browse', icon: Search },
          { id: 'submit', label: 'Submit', icon: Upload },
        ].map(t => (
          <button key={t.id}
            className={`btn ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BROWSE TAB ── */}
      {tab === 'browse' && (
        <>
          {/* Search + Type Filter */}
          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name, description, or author…"
                  style={{
                    width: '100%', padding: '9px 12px 9px 36px',
                    background: 'var(--bg-card)', border: '1px solid var(--border-main)',
                    borderRadius: 8, color: 'var(--text-main)', fontSize: 13, outline: 'none',
                  }} />
              </div>
              <div className="flex gap-1">
                {TYPE_FILTERS.map(f => (
                  <button key={f.id}
                    className={`btn ${typeFilter === f.id ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ padding: '6px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setTypeFilter(f.id)}
                  >
                    {f.icon && <f.icon size={11} />}
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tag chips */}
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {TAGS.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className={`badge ${selectedTags.includes(tag) ? 'badge-brand' : ''}`}
                  style={{ cursor: 'pointer', border: '1px solid var(--border-main)', fontSize: 11 }}>
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex items-center justify-center" style={{ height: 200, color: 'var(--text-muted)' }}>
              <div className="animate-spin" style={{ width: 24, height: 24, border: '2px solid var(--border-main)', borderTopColor: 'var(--color-brand)', borderRadius: '50%' }} />
            </div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <Palette size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <div className="text-sm font-medium" style={{ marginBottom: 6 }}>
                {query || selectedTags.length ? 'No wallpapers match your search' : 'No community wallpapers yet'}
              </div>
              <div className="text-xs text-subtle">
                {query || selectedTags.length
                  ? 'Try different keywords or tags'
                  : 'Be the first to submit one!'}
              </div>
              {!query && !selectedTags.length && (
                <button className="btn btn-primary" style={{ marginTop: 16, fontSize: 12 }}
                  onClick={() => setTab('submit')}>
                  <Upload size={13} /> Submit a Wallpaper
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {results.map(item => {
                const badge = TYPE_BADGES[item.type] || {}
                return (
                  <div key={item.id} className="card card-interactive" style={{ overflow: 'hidden' }}>
                    {/* Preview */}
                    <div style={{
                      height: 130,
                      background: 'linear-gradient(135deg, var(--bg-card), rgba(var(--rgb-card),0.3))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative', overflow: 'hidden',
                    }}>
                      {item.preview ? (
                        <img src={item.preview} alt={item.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          loading="lazy" />
                      ) : (
                        <span className="text-subtle text-xs">No preview</span>
                      )}
                      {/* Type badge */}
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                        padding: '3px 8px', borderRadius: 6,
                        fontSize: 10, fontWeight: 600,
                        color: badge.color || 'var(--text-main)',
                      }}>
                        {badge.label || item.type}
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ padding: '12px 14px' }}>
                      <div className="font-semibold text-sm" style={{
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{item.name}</div>
                      <div className="text-xs text-muted" style={{ marginTop: 3 }}>
                        by {item.author || 'Anonymous'}
                      </div>
                      {item.description && (
                        <div className="text-xs text-subtle" style={{
                          marginTop: 6, lineHeight: 1.4,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {item.description}
                        </div>
                      )}
                      <div className="flex items-center justify-between" style={{ marginTop: 10 }}>
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <Download size={10} />
                          <span>{(item.downloads || 0).toLocaleString()}</span>
                        </div>
                        {(() => {
                          const targetId = `community-${item.id}`
                          const isInstalled = (installed || []).some(i => i?.id === targetId || i?.communityMeta?.originalId === item.id)
                          const isCurrentlyApplied = isWallpaperRunning && (currentDesktopWallpaper?.id === targetId || activeWallpaper?.id === targetId)
                          const isApplying = applyingId === item.id

                          if (isCurrentlyApplied) {
                            return (
                              <span
                                className="btn btn-success"
                                style={{ padding: '4px 10px', fontSize: 11, cursor: 'default', display: 'flex', alignItems: 'center', gap: 4 }}
                              >
                                <Check size={11} /> Applied
                              </span>
                            )
                          }

                          return (
                            <button
                              className={`btn ${isInstalled ? 'btn-secondary' : 'btn-primary'}`}
                              style={{ padding: '4px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                              disabled={isApplying}
                              onClick={() => handleInstall(item)}
                            >
                              {isApplying ? (
                                <>Applying…</>
                              ) : isInstalled ? (
                                <><Play size={11} /> Apply</>
                              ) : (
                                <><Download size={11} /> Install & Apply</>
                              )}
                            </button>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── SUBMIT TAB ── */}
      {tab === 'submit' && (
        <div className="card" style={{ maxWidth: 560, padding: 24 }}>
          <h2 className="font-semibold text-base" style={{ marginBottom: 6 }}>Submit a Wallpaper</h2>
          <p className="text-xs text-muted" style={{ marginBottom: 20, lineHeight: 1.5 }}>
            Share your favorite wallpaper with the community. All submissions are reviewed before publishing.
          </p>

          {!isAuthenticated ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <LogIn size={36} style={{ margin: '0 auto 16px', opacity: 0.3, color: 'var(--text-muted)' }} />
              <div className="text-sm font-medium" style={{ marginBottom: 8 }}>
                Sign in to submit wallpapers
              </div>
              <div className="text-xs text-muted" style={{ marginBottom: 16, lineHeight: 1.5 }}>
                Your name and profile picture will be shown as the wallpaper author.
              </div>
              <button className="btn btn-primary" onClick={() => setShowAuthModal(true)}>
                <LogIn size={13} /> Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Logged in as */}
              <div className="flex items-center gap-2" style={{
                padding: '8px 12px', borderRadius: 8,
                background: 'color-mix(in srgb, var(--color-brand) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-brand) 20%, transparent)',
              }}>
                <UserAvatar user={authUser} size={22} />
                <span className="text-xs">
                  Submitting as <strong>{authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || authUser?.user_metadata?.user_name || 'User'}</strong>
                </span>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-medium text-muted" style={{ display: 'block', marginBottom: 6 }}>Title *</label>
                <input
                  value={submitForm.title}
                  onChange={e => setSubmitForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Tokyo Night Drive"
                  required minLength={3} maxLength={50}
                  style={{
                    width: '100%', padding: '9px 12px',
                    background: 'var(--bg-card)', border: '1px solid var(--border-main)',
                    borderRadius: 8, color: 'var(--text-main)', fontSize: 13, outline: 'none',
                  }} />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-muted" style={{ display: 'block', marginBottom: 6 }}>Description *</label>
                <textarea
                  value={submitForm.description}
                  onChange={e => setSubmitForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="A short description of your wallpaper…"
                  required minLength={10} maxLength={500} rows={3}
                  style={{
                    width: '100%', padding: '9px 12px',
                    background: 'var(--bg-card)', border: '1px solid var(--border-main)',
                    borderRadius: 8, color: 'var(--text-main)', fontSize: 13, outline: 'none', resize: 'vertical',
                  }} />
              </div>

              {/* Type */}
              <div>
                <label className="text-xs font-medium text-muted" style={{ display: 'block', marginBottom: 6 }}>Type *</label>
                <div className="flex gap-2">
                  {[
                    { id: 'youtube', label: 'YouTube', icon: MonitorPlay },
                    { id: 'stream',  label: 'Web Stream', icon: Globe },
                    { id: 'image',   label: 'Image URL', icon: Image },
                  ].map(t => (
                    <button key={t.id} type="button"
                      className={`btn ${submitForm.type === t.id ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12 }}
                      onClick={() => setSubmitForm(f => ({ ...f, type: t.id }))}
                    >
                      <t.icon size={13} /> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Source URL */}
              <div>
                <label className="text-xs font-medium text-muted" style={{ display: 'block', marginBottom: 6 }}>
                  {submitForm.type === 'youtube' ? 'YouTube URL *' : submitForm.type === 'stream' ? 'Stream URL *' : 'Image URL *'}
                </label>
                <input
                  value={submitForm.source}
                  onChange={e => setSubmitForm(f => ({ ...f, source: e.target.value }))}
                  placeholder={
                    submitForm.type === 'youtube' ? 'https://www.youtube.com/watch?v=...'
                    : submitForm.type === 'stream' ? 'https://example.com/live-stream'
                    : 'https://example.com/wallpaper.jpg'
                  }
                  required type="url"
                  style={{
                    width: '100%', padding: '9px 12px',
                    background: 'var(--bg-card)', border: '1px solid var(--border-main)',
                    borderRadius: 8, color: 'var(--text-main)', fontSize: 13, outline: 'none',
                  }} />
              </div>

              {/* Tags */}
              <div>
                <label className="text-xs font-medium text-muted" style={{ display: 'block', marginBottom: 6 }}>Tags * (select 1-5)</label>
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                  {TAGS.map(tag => (
                    <button key={tag} type="button"
                      onClick={() => {
                        setSubmitForm(f => ({
                          ...f,
                          tags: f.tags.includes(tag)
                            ? f.tags.filter(t => t !== tag)
                            : f.tags.length < 5 ? [...f.tags, tag] : f.tags,
                        }))
                      }}
                      className={`badge ${submitForm.tags.includes(tag) ? 'badge-brand' : ''}`}
                      style={{ cursor: 'pointer', border: '1px solid var(--border-main)', fontSize: 11 }}>
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !submitForm.title || !submitForm.source || submitForm.tags.length === 0}
                style={{ width: '100%', padding: '10px', fontSize: 13, marginTop: 4 }}
              >
                {submitting ? (
                  <>
                    <div className="animate-spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} />
                    Submitting…
                  </>
                ) : (
                  <><Upload size={14} /> Submit for Review</>
                )}
              </button>

              {/* Result message */}
              {submitResult && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8,
                  background: submitResult.success
                    ? 'color-mix(in srgb, var(--color-emerald) 10%, transparent)'
                    : 'color-mix(in srgb, var(--color-rose) 10%, transparent)',
                  border: `1px solid ${submitResult.success ? 'var(--color-emerald)' : 'var(--color-rose)'}`,
                  textAlign: 'center',
                }}>
                  <span className="text-xs" style={{ color: submitResult.success ? 'var(--color-emerald)' : 'var(--color-rose)' }}>
                    {submitResult.success ? '✅ ' : '❌ '}{submitResult.message}
                  </span>
                </div>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  )
}
