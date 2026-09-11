import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, Download, Globe, Image, MonitorPlay, Upload, Users, Palette, LogIn, Play, Check, Heart, Clock, CheckCircle, XCircle, FileText, Award, Eye, X, FolderPlus } from 'lucide-react'
import { searchCatalog, fetchStats, submitWallpaper, trackInstall, toggleLike, getUserLikes, getUserSubmissions, fetchMarketplaceCounts } from '../lib/marketplace.js'
import { useStore } from '../store/useStore.js'
import { applyWallpaperToDesktop } from '../lib/wallpaperActions.js'
import { parseYouTubeId } from '../engines/web-stream.js'
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

const STATUS_BADGES = {
  pending:  { label: 'Pending Review', color: 'var(--color-amber)', icon: Clock },
  approved: { label: 'Approved',       color: 'var(--color-emerald)', icon: CheckCircle },
  rejected: { label: 'Rejected',       color: 'var(--color-rose)',    icon: XCircle },
}

export default function MarketplacePage() {
  const [tab, setTab] = useState('browse')
  const [query, setQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [typeFilter, setTypeFilter] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalWallpapers: 0, activeUsers: 0 })

  // Likes & Downloads state
  const [likedIds, setLikedIds] = useState(new Set())
  const [likeCounts, setLikeCounts] = useState({})  // wallpaperId -> count
  const [likingId, setLikingId] = useState(null)
  const [downloadCounts, setDownloadCounts] = useState({}) // wallpaperId -> count
  const [addingLibraryId, setAddingLibraryId] = useState(null)

  // Live Preview Modal state
  const [previewItem, setPreviewItem] = useState(null)

  // My Submissions state
  const [mySubmissions, setMySubmissions] = useState([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)

  // Auth & Library state
  const isAuthenticated = useStore(s => s.isAuthenticated)
  const authUser = useStore(s => s.authUser)
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

  // Fetch stats & live counts (downloads + likes)
  useEffect(() => {
    fetchStats().then(setStats).catch(() => {})
    fetchMarketplaceCounts().then(({ downloadCounts: dc, likeCounts: lc }) => {
      if (dc) setDownloadCounts(dc)
      if (lc) setLikeCounts(prev => ({ ...lc, ...prev }))
    }).catch(() => {})
  }, [])

  // Fetch user likes when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      getUserLikes().then(ids => setLikedIds(new Set(ids))).catch(() => {})
    } else {
      setLikedIds(new Set())
    }
  }, [isAuthenticated])

  // Fetch my submissions when tab switches
  useEffect(() => {
    if (tab === 'submissions' && isAuthenticated) {
      setLoadingSubmissions(true)
      getUserSubmissions()
        .then(setMySubmissions)
        .catch(() => {})
        .finally(() => setLoadingSubmissions(false))
    }
  }, [tab, isAuthenticated])

  const toggleTag = (tag) => setSelectedTags(prev =>
    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
  )

  const handleLike = async (wallpaperId) => {
    if (!isAuthenticated) {
      setShowAuthModal(true)
      return
    }
    const wasLiked = likedIds.has(wallpaperId)
    // Optimistic update
    setLikedIds(prev => {
      const next = new Set(prev)
      wasLiked ? next.delete(wallpaperId) : next.add(wallpaperId)
      return next
    })
    setLikeCounts(prev => {
      const base = prev[wallpaperId] ?? results.find(r => r.id === wallpaperId)?.likes ?? 0
      return {
        ...prev,
        [wallpaperId]: Math.max(0, base + (wasLiked ? -1 : 1)),
      }
    })
    setLikingId(wallpaperId)
    const result = await toggleLike(wallpaperId)
    if (result) {
      // Sync with server truth
      setLikedIds(prev => {
        const next = new Set(prev)
        result.liked ? next.add(wallpaperId) : next.delete(wallpaperId)
        return next
      })
      setLikeCounts(prev => ({ ...prev, [wallpaperId]: result.totalLikes }))
    }
    setLikingId(null)
  }

  const handleAddToLibrary = async (wallpaper) => {
    setAddingLibraryId(wallpaper.id)
    try {
      const isVideo = wallpaper.type === 'video' || /\.(mp4|webm|mkv|avi|mov)$/i.test(wallpaper.source || '')
      const isStream = !isVideo && (wallpaper.type === 'youtube' || wallpaper.type === 'stream' || Boolean(parseYouTubeId(wallpaper.source)))
      const resolvedEngine = isVideo ? 'video-player' : (isStream ? 'web-stream' : 'image-player')
      const item = {
        id: `community-${wallpaper.id}`,
        name: wallpaper.name,
        engine: resolvedEngine,
        type: 'wallpaper',
        isCustom: true,
        installedAt: Date.now(),
        preview: wallpaper.preview,
        tags: wallpaper.tags || ['community'],
        config: {
          ...(isVideo
            ? {
                videoPath: wallpaper.source,
                speedMultiplier: 1,
              }
            : isStream
            ? {
                streamUrl: wallpaper.source,
                url: wallpaper.source,
                streamType: wallpaper.type === 'youtube' ? 'youtube' : 'web',
                muted: false,
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

      // Optimistic download count +1
      setDownloadCounts(prev => {
        const base = prev[wallpaper.id] ?? wallpaper.downloads ?? 0
        return { ...prev, [wallpaper.id]: base + 1 }
      })

      // Track the install in Supabase
      const serverTotal = await trackInstall(wallpaper.id)
      if (serverTotal !== null && serverTotal !== undefined) {
        setDownloadCounts(prev => ({ ...prev, [wallpaper.id]: serverTotal }))
      }
    } catch (err) {
      console.error('Failed to add wallpaper to library:', err)
    } finally {
      setAddingLibraryId(null)
    }
  }

  const handleInstall = async (wallpaper) => {
    setApplyingId(wallpaper.id)
    try {
      // Convert community wallpaper to local library format
      const isVideo = wallpaper.type === 'video' || /\.(mp4|webm|mkv|avi|mov)$/i.test(wallpaper.source || '')
      const isStream = !isVideo && (wallpaper.type === 'youtube' || wallpaper.type === 'stream' || Boolean(parseYouTubeId(wallpaper.source)))
      const resolvedEngine = isVideo ? 'video-player' : (isStream ? 'web-stream' : 'image-player')
      const item = {
        id: `community-${wallpaper.id}`,
        name: wallpaper.name,
        engine: resolvedEngine,
        type: 'wallpaper',
        isCustom: true,
        installedAt: Date.now(),
        preview: wallpaper.preview,
        tags: wallpaper.tags || ['community'],
        config: {
          ...(isVideo
            ? {
                videoPath: wallpaper.source,
                speedMultiplier: 1,
              }
            : isStream
            ? {
                streamUrl: wallpaper.source,
                url: wallpaper.source,
                streamType: wallpaper.type === 'youtube' ? 'youtube' : 'web',
                muted: false,
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

      // Optimistic download count +1
      setDownloadCounts(prev => {
        const base = prev[wallpaper.id] ?? wallpaper.downloads ?? 0
        return { ...prev, [wallpaper.id]: base + 1 }
      })

      // Track the install in Supabase
      const serverTotal = await trackInstall(wallpaper.id)
      if (serverTotal !== null && serverTotal !== undefined) {
        setDownloadCounts(prev => ({ ...prev, [wallpaper.id]: serverTotal }))
      }
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
      await submitWallpaper(submitForm)
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
          ...(isAuthenticated ? [{ id: 'submissions', label: 'My Submissions', icon: FileText }] : []),
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {results.map(item => {
                const badge = TYPE_BADGES[item.type] || {}
                const isLiked = likedIds.has(item.id)
                const currentDownloads = Math.max(item.downloads || 0, downloadCounts[item.id] ?? 0)
                const currentLikes = likeCounts[item.id] ?? item.likes ?? 0

                const targetId = `community-${item.id}`
                const isInstalled = (installed || []).some(i => i?.id === targetId || i?.communityMeta?.originalId === item.id)
                const isCurrentlyApplied = isWallpaperRunning && (currentDesktopWallpaper?.id === targetId || activeWallpaper?.id === targetId)
                const isApplying = applyingId === item.id
                const isAddingLib = addingLibraryId === item.id

                return (
                  <div key={item.id} className="mp-card">
                    {/* ── 1. Thumbnail with smooth zoom & interactive overlay ── */}
                    <div
                      className="mp-thumb-container"
                      onClick={() => setPreviewItem(item)}
                      title={`Click to preview ${item.name}`}
                    >
                      {item.preview ? (
                        <img
                          src={item.preview}
                          alt={item.name}
                          className="mp-thumb-img"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full text-subtle text-xs">
                          No preview available
                        </div>
                      )}

                      {/* Top-Left: Staff Pick (only if featured) */}
                      {item.featured && (
                        <div className="mp-badge-top-left">
                          <div
                            className="mp-pill-badge"
                            style={{
                              background: 'linear-gradient(135deg, rgba(245,158,11,0.92), rgba(217,119,6,0.92))',
                              color: '#fff',
                              border: '1px solid rgba(255,255,255,0.2)',
                              fontSize: 10,
                              letterSpacing: '0.4px',
                            }}
                          >
                            <Award size={11} />
                            <span>STAFF PICK</span>
                          </div>
                        </div>
                      )}

                      {/* Top-Right: Media Type Pill */}
                      <div className="mp-badge-top-right">
                        <div
                          className="mp-pill-badge"
                          style={{
                            background: 'rgba(10, 10, 14, 0.75)',
                            color: badge.color || 'var(--text-main)',
                            border: '1px solid rgba(255,255,255,0.12)',
                          }}
                        >
                          {badge.label || item.type}
                        </div>
                      </div>

                      {/* Hover Overlay: Center Quick Preview Pill */}
                      <div className="mp-thumb-overlay">
                        <div className="mp-preview-pill">
                          <Eye size={13} />
                          <span>Quick Preview</span>
                        </div>
                      </div>
                    </div>

                    {/* ── 2. Card Content ── */}
                    <div style={{ padding: '16px 16px 14px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      {/* Title & Author */}
                      <div style={{ marginBottom: 8 }}>
                        <h3
                          className="font-semibold"
                          style={{
                            fontSize: 14,
                            lineHeight: '1.3',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: 'pointer',
                            transition: 'color 0.15s ease',
                          }}
                          onClick={() => setPreviewItem(item)}
                          title={item.name}
                        >
                          {item.name}
                        </h3>
                        <div className="text-xs text-muted" style={{ marginTop: 3 }}>
                          by <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{item.author || 'Anonymous'}</span>
                        </div>
                      </div>

                      {/* Description (2 lines clamped) */}
                      <p
                        className="text-xs text-subtle"
                        style={{
                          lineHeight: 1.45,
                          height: 34,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          marginBottom: 14,
                        }}
                        title={item.description}
                      >
                        {item.description || 'Stunning community wallpaper for AetherFlow.'}
                      </p>

                      {/* ── 3. Stats & Quick Preview Row (Separated from action bar) ── */}
                      <div
                        className="flex items-center justify-between"
                        style={{
                          paddingTop: 10,
                          paddingBottom: 12,
                          borderTop: '1px solid var(--border-main)',
                          marginBottom: 12,
                        }}
                      >
                        {/* Social / stats */}
                        <div className="flex items-center gap-3">
                          {/* Like Button */}
                          <button
                            className={`mp-like-btn ${isLiked ? 'liked' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleLike(item.id)
                            }}
                            disabled={likingId === item.id}
                            title={isLiked ? 'Unlike' : 'Like wallpaper'}
                            style={{
                              transform: likingId === item.id ? 'scale(1.15)' : 'scale(1)',
                            }}
                          >
                            <Heart size={13} fill={isLiked ? 'var(--color-rose)' : 'none'} />
                            <span>{currentLikes}</span>
                          </button>

                          {/* Downloads Counter */}
                          <div
                            className="flex items-center gap-1 text-xs text-muted"
                            title={`${currentDownloads.toLocaleString()} total downloads`}
                          >
                            <Download size={12} style={{ opacity: 0.7 }} />
                            <span>{currentDownloads.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Preview Button */}
                        <button
                          className="btn btn-ghost"
                          style={{
                            padding: '4px 8px',
                            fontSize: 11,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            color: 'var(--text-muted)',
                          }}
                          onClick={() => setPreviewItem(item)}
                          title="Open full interactive preview window"
                        >
                          <Eye size={12} />
                          <span>Preview</span>
                        </button>
                      </div>

                      {/* ── 4. Primary Action Bar (Full Width, 36px Height, Zero Cramping) ── */}
                      <div style={{ marginTop: 'auto' }}>
                        {isCurrentlyApplied ? (
                          <div
                            className="btn btn-success mp-btn-action w-full"
                            style={{
                              cursor: 'default',
                              background: 'color-mix(in srgb, var(--color-emerald) 15%, transparent)',
                              borderColor: 'var(--color-emerald)',
                              color: 'var(--color-emerald)',
                            }}
                          >
                            <Check size={14} /> Active on Desktop
                          </div>
                        ) : isInstalled ? (
                          <div className="flex gap-2 w-full">
                            <button
                              className="btn btn-ghost mp-btn-action"
                              style={{
                                flex: 1,
                                fontSize: 11.5,
                                color: 'var(--color-emerald)',
                                background: 'color-mix(in srgb, var(--color-emerald) 10%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--color-emerald) 25%, transparent)',
                                cursor: 'default',
                              }}
                              title="This wallpaper is installed in your Library"
                            >
                              <Check size={13} /> In Library
                            </button>
                            <button
                              className="btn btn-primary mp-btn-action"
                              style={{ flex: 1.25 }}
                              disabled={isApplying}
                              onClick={() => handleInstall(item)}
                              title="Apply to Windows desktop"
                            >
                              {isApplying ? (
                                'Applying…'
                              ) : (
                                <>
                                  <Play size={13} fill="currentColor" /> Apply
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 w-full">
                            <button
                              className="btn btn-secondary mp-btn-action"
                              style={{ flex: 1, fontSize: 11.5 }}
                              disabled={isAddingLib || isApplying}
                              onClick={() => handleAddToLibrary(item)}
                              title="Save to your Library without setting as wallpaper"
                            >
                              {isAddingLib ? (
                                'Adding…'
                              ) : (
                                <>
                                  <FolderPlus size={13} /> + Library
                                </>
                              )}
                            </button>
                            <button
                              className="btn btn-primary mp-btn-action"
                              style={{ flex: 1.25 }}
                              disabled={isApplying || isAddingLib}
                              onClick={() => handleInstall(item)}
                              title="Install & Apply to Windows desktop"
                            >
                              {isApplying ? (
                                'Applying…'
                              ) : (
                                <>
                                  <Play size={13} fill="currentColor" /> Apply
                                </>
                              )}
                            </button>
                          </div>
                        )}
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

      {/* ── MY SUBMISSIONS TAB ── */}
      {tab === 'submissions' && (
        <div style={{ maxWidth: 640 }}>
          <h2 className="font-semibold text-base" style={{ marginBottom: 16 }}>My Submissions</h2>

          {!isAuthenticated ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <LogIn size={36} style={{ margin: '0 auto 16px', opacity: 0.3, color: 'var(--text-muted)' }} />
              <div className="text-sm font-medium" style={{ marginBottom: 8 }}>Sign in to view your submissions</div>
              <button className="btn btn-primary" onClick={() => setShowAuthModal(true)}>
                <LogIn size={13} /> Sign In
              </button>
            </div>
          ) : loadingSubmissions ? (
            <div className="flex items-center justify-center" style={{ height: 200, color: 'var(--text-muted)' }}>
              <div className="animate-spin" style={{ width: 24, height: 24, border: '2px solid var(--border-main)', borderTopColor: 'var(--color-brand)', borderRadius: '50%' }} />
            </div>
          ) : mySubmissions.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <FileText size={36} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <div className="text-sm font-medium" style={{ marginBottom: 6 }}>No submissions yet</div>
              <div className="text-xs text-subtle" style={{ marginBottom: 16 }}>
                Submit your first wallpaper and share it with the community!
              </div>
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => setTab('submit')}>
                <Upload size={13} /> Submit a Wallpaper
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mySubmissions.map(sub => {
                const statusInfo = STATUS_BADGES[sub.status] || STATUS_BADGES.pending
                const StatusIcon = statusInfo.icon
                return (
                  <div key={sub.id} className="card" style={{ padding: '14px 18px' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                      <div className="font-semibold text-sm">{sub.title}</div>
                      <div className="flex items-center gap-1" style={{
                        padding: '3px 8px', borderRadius: 6,
                        background: `color-mix(in srgb, ${statusInfo.color} 12%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${statusInfo.color} 25%, transparent)`,
                        fontSize: 10, fontWeight: 600, color: statusInfo.color,
                      }}>
                        <StatusIcon size={11} />
                        {statusInfo.label}
                      </div>
                    </div>
                    {sub.description && (
                      <div className="text-xs text-muted" style={{ marginBottom: 8, lineHeight: 1.4 }}>
                        {sub.description}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-subtle">
                      <span>{TYPE_BADGES[sub.type]?.label || sub.type}</span>
                      <span>•</span>
                      <span>{new Date(sub.created_at).toLocaleDateString()}</span>
                      {sub.tags?.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{sub.tags.map(t => `#${t}`).join(' ')}</span>
                        </>
                      )}
                    </div>
                    {sub.review_note && (
                      <div style={{
                        marginTop: 10, padding: '8px 12px', borderRadius: 6,
                        background: 'color-mix(in srgb, var(--color-amber) 6%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--color-amber) 15%, transparent)',
                        fontSize: 11, color: 'var(--color-amber)', lineHeight: 1.4,
                      }}>
                        <strong>Review note:</strong> {sub.review_note}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── LIVE PREVIEW MODAL (Zero-Memory-Leak) ── */}
      {previewItem && (
        <MarketplacePreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onAddToLibrary={(item) => handleAddToLibrary(item)}
          onApply={(item) => handleInstall(item)}
          onLike={(id) => handleLike(id)}
          isLiked={likedIds.has(previewItem.id)}
          likeCount={likeCounts[previewItem.id] ?? previewItem.likes ?? 0}
          liking={likingId === previewItem.id}
          downloadCount={Math.max(previewItem.downloads || 0, downloadCounts[previewItem.id] ?? 0)}
          isInstalled={(installed || []).some(i => i?.id === `community-${previewItem.id}` || i?.communityMeta?.originalId === previewItem.id)}
          isCurrentlyApplied={isWallpaperRunning && (currentDesktopWallpaper?.id === `community-${previewItem.id}` || activeWallpaper?.id === `community-${previewItem.id}`)}
          isApplying={applyingId === previewItem.id}
          isAddingLib={addingLibraryId === previewItem.id}
        />
      )}
    </div>
  )
}

/**
 * Zero-Memory-Leak YouTube Preview Component.
 * Dynamically creates the iframe and on unmount navigates it to 'about:blank'
 * and removes it from DOM so Chromium completely disposes audio/video pipelines.
 */
function CleanYouTubePreview({ source, title }) {
  const containerRef = useRef(null)
  const videoId = parseYouTubeId(source) || source

  useEffect(() => {
    const container = containerRef.current
    if (!container || !videoId) return

    const iframe = document.createElement('iframe')
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=1&loop=1&playlist=${videoId}&playsinline=1&rel=0&modestbranding=1`
    iframe.title = title || 'Live Wallpaper Preview'
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
    iframe.allowFullscreen = true
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = 'none'
    iframe.style.display = 'block'

    container.appendChild(iframe)

    return () => {
      // 1. Force navigation to about:blank to destroy media pipeline and decoders immediately
      try {
        iframe.src = 'about:blank'
      } catch {}
      // 2. Remove from DOM
      if (container.contains(iframe)) {
        container.removeChild(iframe)
      }
    }
  }, [videoId, title])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        aspectRatio: '16/9',
        maxHeight: '52vh',
        background: '#050505',
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
      }}
    />
  )
}

/**
 * Zero-Memory-Leak HTML5 Stream/Video Preview Component.
 * Explicitly calls .pause(), clears .src, and calls .load() on unmount
 * so hardware GPU video decoders and buffers are freed immediately.
 */
function CleanVideoPreview({ source }) {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    return () => {
      if (video) {
        try {
          video.pause()
          video.removeAttribute('src')
          video.load()
        } catch {}
      }
    }
  }, [source])

  return (
    <div style={{
      width: '100%',
      aspectRatio: '16/9',
      maxHeight: '52vh',
      background: '#050505',
      borderRadius: 8,
      overflow: 'hidden',
      position: 'relative',
    }}>
      <video
        ref={videoRef}
        src={source}
        autoPlay
        loop
        muted
        playsInline
        controls
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  )
}

/**
 * Zero-Memory-Leak Image Preview Component.
 */
function CleanImagePreview({ source, title }) {

  return (
    <div style={{
      width: '100%',
      aspectRatio: '16/9',
      maxHeight: '52vh',
      background: '#050505',
      borderRadius: 8,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <img
        src={source}
        alt={title}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  )
}

/**
 * Full Live Preview Modal Window
 */
function MarketplacePreviewModal({
  item,
  onClose,
  onAddToLibrary,
  onApply,
  onLike,
  isLiked,
  likeCount,
  liking,
  downloadCount,
  isInstalled,
  isCurrentlyApplied,
  isApplying,
  isAddingLib,
}) {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!item) return null

  const badge = TYPE_BADGES[item.type] || {}

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        animation: 'fadeIn 0.18s ease-out',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 720,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-main)',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-main)',
            background: 'rgba(var(--rgb-card), 0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(0,0,0,0.6)',
                color: badge.color || 'var(--text-main)',
                border: '1px solid rgba(255,255,255,0.12)',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                letterSpacing: '0.2px',
              }}
            >
              {badge.label || item.type}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                className="font-semibold text-base"
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 460,
                  color: 'var(--text-main)',
                }}
                title={item.name}
              >
                {item.name}
              </div>
              <div className="text-xs text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                by <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{item.author || 'Anonymous'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-main)',
              borderRadius: 8,
              padding: 6,
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            title="Close preview (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Live Media Preview (Zero-Leak) */}
        <div style={{ padding: '16px 20px 10px', flex: 1, overflowY: 'auto' }}>
          {item.type === 'youtube' ? (
            <CleanYouTubePreview source={item.source} title={item.name} />
          ) : item.type === 'stream' && (item.source.endsWith('.mp4') || item.source.endsWith('.webm')) ? (
            <CleanVideoPreview source={item.source} />
          ) : (
            <CleanImagePreview source={item.preview || item.source} title={item.name} />
          )}

          {/* Description & Tags */}
          <div style={{ marginTop: 14 }}>
            {item.description && (
              <p className="text-xs text-muted" style={{ lineHeight: 1.5, marginBottom: 8 }}>
                {item.description}
              </p>
            )}
            {item.tags?.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {item.tags.map(t => (
                  <span
                    key={t}
                    style={{
                      padding: '2px 7px',
                      borderRadius: 4,
                      fontSize: 10,
                      background: 'rgba(255,255,255,0.05)',
                      color: 'var(--text-subtle)',
                    }}
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-main)',
            background: 'rgba(var(--rgb-card), 0.3)',
          }}
        >
          {/* Left Stats: Likes + Installs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onLike(item.id)}
              disabled={liking}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-main)',
                borderRadius: 6,
                padding: '5px 9px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: isLiked ? 'var(--color-rose)' : 'var(--text-muted)',
                fontSize: 11,
                fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              <Heart size={13} fill={isLiked ? 'var(--color-rose)' : 'none'} />
              <span>{likeCount}</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Download size={12} />
              <span>{downloadCount.toLocaleString()} downloads</span>
            </div>
          </div>

          {/* Right Buttons: Add to Library & Apply */}
          <div className="flex items-center gap-2">
            {isCurrentlyApplied ? (
              <span
                className="btn btn-success"
                style={{ padding: '6px 14px', fontSize: 12, cursor: 'default', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <Check size={13} /> Active on Desktop
              </span>
            ) : isInstalled ? (
              <>
                <span className="text-xs text-muted flex items-center gap-1" style={{ fontSize: 11, marginRight: 4 }}>
                  <Check size={12} style={{ color: 'var(--color-emerald)' }} /> In Library
                </span>
                <button
                  className="btn btn-primary"
                  style={{ padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                  disabled={isApplying}
                  onClick={() => onApply(item)}
                >
                  {isApplying ? 'Applying…' : <><Play size={12} /> Apply to Desktop</>}
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                  disabled={isAddingLib || isApplying}
                  onClick={() => onAddToLibrary(item)}
                >
                  <FolderPlus size={13} />
                  {isAddingLib ? 'Adding…' : '+ Add to Library'}
                </button>
                <button
                  className="btn btn-primary"
                  style={{ padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                  disabled={isApplying || isAddingLib}
                  onClick={() => onApply(item)}
                >
                  {isApplying ? 'Applying…' : <><Play size={12} /> Apply to Desktop</>}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
