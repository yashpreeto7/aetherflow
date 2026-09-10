/**
 * AetherFlow Marketplace — Hybrid GitHub + Supabase Backend
 *
 * Catalog data (browse): fetched from yashpreeto7/aetherflow-community GitHub repo
 * User actions (submit, like, track): routed through Supabase RPC + tables
 * No external Worker needed — all serverless via Supabase RLS + RPC
 */

import { supabase, isOnline } from './supabase.js'

// ── GitHub Catalog CDN ────────────────────────────────────────────────────────

const PRIMARY_CATALOG_URL = 'https://raw.githubusercontent.com/yashpreeto7/aetherflow-community/main/index.json'
const FALLBACK_CATALOG_URL = 'https://cdn.jsdelivr.net/gh/yashpreeto7/aetherflow-community@main/index.json'

let catalogCache = null
let catalogETag = null
let lastFetchTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Fetches the community wallpaper catalog from GitHub.
 * Uses ETag-based caching to avoid redundant downloads.
 * Returns { version, updatedAt, totalWallpapers, wallpapers[] }
 */
export async function fetchCatalog(forceRefresh = false) {
  const now = Date.now()

  // Return cached data if fresh enough
  if (!forceRefresh && catalogCache && (now - lastFetchTime) < CACHE_TTL) {
    return catalogCache
  }

  try {
    const headers = {}
    if (catalogETag && !forceRefresh) {
      headers['If-None-Match'] = catalogETag
    }

    let response
    try {
      response = await fetch(PRIMARY_CATALOG_URL, { headers })
      if (!response.ok) throw new Error(`Primary CDN returned ${response.status}`)
    } catch {
      response = await fetch(FALLBACK_CATALOG_URL, { headers })
    }

    // 304 Not Modified — cache is still valid
    if (response.status === 304 && catalogCache) {
      lastFetchTime = now
      return catalogCache
    }

    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}`)
    }

    const etag = response.headers.get('ETag')
    if (etag) catalogETag = etag

    const data = await response.json()
    catalogCache = data
    lastFetchTime = now
    return data
  } catch (err) {
    console.warn('[Marketplace] Failed to fetch catalog:', err.message)
    // Return cached data if available, otherwise empty
    return catalogCache || { version: 1, updatedAt: '', totalWallpapers: 0, wallpapers: [] }
  }
}

/**
 * Search and filter wallpapers from the catalog.
 * All filtering happens client-side for instant results.
 */
export async function searchCatalog({ query = '', tags = [], type = '' } = {}) {
  const catalog = await fetchCatalog()
  let results = [...(catalog.wallpapers || [])]

  // Text search (title, description, author)
  if (query) {
    const q = query.toLowerCase()
    results = results.filter(w =>
      w.name?.toLowerCase().includes(q) ||
      w.description?.toLowerCase().includes(q) ||
      w.author?.toLowerCase().includes(q)
    )
  }

  // Tag filter
  if (tags.length > 0) {
    results = results.filter(w =>
      tags.some(tag => (w.tags || []).includes(tag))
    )
  }

  // Type filter
  if (type) {
    results = results.filter(w => w.type === type)
  }

  // Sort by downloads (most popular first)
  results.sort((a, b) => (b.downloads || 0) - (a.downloads || 0))

  return results
}

// ── Supabase-Backed User Actions ──────────────────────────────────────────────

/**
 * Track a wallpaper install. Calls Supabase RPC to upsert into installs table.
 * Returns the updated total install count as a number, or null on error.
 * Works for both authenticated and anonymous users.
 */
export async function trackInstall(wallpaperId) {
  if (!isOnline()) return null
  try {
    const { data, error } = await supabase.rpc('track_install', { p_wallpaper_id: wallpaperId })
    if (error) throw error
    return typeof data === 'number' ? data : Number(data)
  } catch (err) {
    console.warn('[Marketplace] Failed to track install:', err.message)
    return null
  }
}

/**
 * Fetch aggregate download and like counts for all wallpapers from Supabase.
 * Returns { downloadCounts: { [id]: number }, likeCounts: { [id]: number } }
 */
export async function fetchMarketplaceCounts() {
  if (!isOnline()) return { downloadCounts: {}, likeCounts: {} }
  try {
    const [installsRes, likesRes] = await Promise.all([
      supabase.from('installs').select('wallpaper_id'),
      supabase.from('likes').select('wallpaper_id'),
    ])

    const downloadCounts = {}
    for (const row of installsRes.data || []) {
      if (row.wallpaper_id) {
        downloadCounts[row.wallpaper_id] = (downloadCounts[row.wallpaper_id] || 0) + 1
      }
    }

    const likeCounts = {}
    for (const row of likesRes.data || []) {
      if (row.wallpaper_id) {
        likeCounts[row.wallpaper_id] = (likeCounts[row.wallpaper_id] || 0) + 1
      }
    }

    return { downloadCounts, likeCounts }
  } catch (err) {
    console.warn('[Marketplace] Failed to fetch aggregate counts:', err.message)
    return { downloadCounts: {}, likeCounts: {} }
  }
}

/**
 * Toggle a like on a wallpaper.
 * Returns { liked: boolean, totalLikes: number } or null on failure.
 * Requires authentication.
 */
export async function toggleLike(wallpaperId) {
  if (!isOnline()) return null
  try {
    const { data, error } = await supabase.rpc('toggle_like', { p_wallpaper_id: wallpaperId })
    if (error) throw error
    return data
  } catch (err) {
    console.warn('[Marketplace] Failed to toggle like:', err.message)
    return null
  }
}

/**
 * Get the current user's liked wallpaper IDs.
 * Returns string[] of wallpaper IDs.
 */
export async function getUserLikes() {
  if (!isOnline()) return []
  try {
    const { data, error } = await supabase.rpc('get_user_likes')
    if (error) throw error
    return data || []
  } catch (err) {
    console.warn('[Marketplace] Failed to fetch likes:', err.message)
    return []
  }
}

/**
 * Submit a wallpaper for community review.
 * Inserts directly into the `submissions` table with 'pending' status.
 * Requires authentication.
 */
export async function submitWallpaper({ title, description, tags, type, source }) {
  if (!isOnline()) {
    throw new Error('Cannot submit while offline. Please check your internet connection.')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('You must be signed in to submit wallpapers.')
  }

  const { data, error } = await supabase
    .from('submissions')
    .insert({
      author_id: user.id,
      title: title.trim(),
      description: (description || '').trim(),
      type,
      source: source.trim(),
      tags: tags || [],
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('[Marketplace] Submit error:', error)
    throw new Error(error.message || 'Failed to submit wallpaper')
  }

  return data
}

/**
 * Get the user's own submissions (all statuses).
 */
export async function getUserSubmissions() {
  if (!isOnline()) return []
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  } catch (err) {
    console.warn('[Marketplace] Failed to fetch submissions:', err.message)
    return []
  }
}

/**
 * Fetch community stats from Supabase RPC.
 * Falls back to catalog-only stats if Supabase is unavailable.
 */
export async function fetchStats() {
  const catalog = await fetchCatalog()
  const stats = {
    totalWallpapers: catalog.totalWallpapers || 0,
    activeUsers: 0,
    totalInstalls: 0,
  }

  if (isOnline()) {
    try {
      const { data, error } = await supabase.rpc('marketplace_stats')
      if (!error && data) {
        stats.activeUsers = data.activeUsers || 0
        stats.totalInstalls = data.totalInstalls || 0
        // Add approved submissions to community count
        if (data.approvedWallpapers > 0) {
          stats.totalWallpapers += data.approvedWallpapers
        }
      }
    } catch {
      // Supabase tables may not exist yet — that's fine
    }
  }

  return stats
}

/**
 * Get the user's profile from Supabase.
 */
export async function getUserProfile() {
  if (!isOnline()) return null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      // Profile might not exist yet — create it
      if (error.code === 'PGRST116') {
        const { data: newProfile } = await supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            display_name: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
            avatar_url: user.user_metadata?.avatar_url || '',
          })
          .select()
          .single()
        return newProfile
      }
      throw error
    }
    return data
  } catch (err) {
    console.warn('[Marketplace] Failed to fetch profile:', err.message)
    return null
  }
}

/**
 * Update the user's profile bio.
 */
export async function updateUserProfile({ bio }) {
  if (!isOnline()) return null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ bio, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (err) {
    console.warn('[Marketplace] Failed to update profile:', err.message)
    return null
  }
}
