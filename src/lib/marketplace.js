/**
 * AetherFlow Marketplace — GitHub-backed wallpaper catalog
 *
 * All wallpaper data lives in the yashpreeto7/aetherflow-community GitHub repo.
 * This module fetches, caches, and searches the catalog from the GitHub CDN.
 */

const PRIMARY_CATALOG_URL = 'https://cdn.jsdelivr.net/gh/yashpreeto7/aetherflow-community@main/index.json'
const FALLBACK_CATALOG_URL = 'https://raw.githubusercontent.com/yashpreeto7/aetherflow-community/main/index.json'
const WORKER_URL = import.meta.env.VITE_WORKER_URL || ''

// ── In-Memory Cache ───────────────────────────────────────────────────────────

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

/**
 * Track a wallpaper install (increments download counter via Worker).
 * Requires a valid Supabase JWT.
 */
export async function trackInstall(wallpaperId, accessToken) {
  if (!WORKER_URL) return
  try {
    await fetch(`${WORKER_URL}/install`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ wallpaperId }),
    })
  } catch (err) {
    console.warn('[Marketplace] Failed to track install:', err.message)
  }
}

/**
 * Submit a wallpaper for review (creates a GitHub Issue via Worker).
 * Requires a valid Supabase JWT.
 */
export async function submitWallpaper({ title, description, tags, type, source, previewBase64 }, accessToken) {
  if (!WORKER_URL) {
    throw new Error('Submission service not configured. The marketplace worker is not available yet.')
  }

  const response = await fetch(`${WORKER_URL}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ title, description, tags, type, source, previewBase64 }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Submission failed' }))
    throw new Error(err.error || `Server returned ${response.status}`)
  }

  return response.json()
}

/**
 * Fetch community stats (user count, wallpaper count).
 */
export async function fetchStats() {
  // Primary: get wallpaper count from cached catalog
  const catalog = await fetchCatalog()
  const stats = {
    totalWallpapers: catalog.totalWallpapers || 0,
    activeUsers: 0,
  }

  // Secondary: get user count from Worker if available
  if (WORKER_URL) {
    try {
      const res = await fetch(`${WORKER_URL}/stats`)
      if (res.ok) {
        const data = await res.json()
        stats.activeUsers = data.activeUsers || 0
      }
    } catch {
      // Worker not available yet, that's fine
    }
  }

  return stats
}
