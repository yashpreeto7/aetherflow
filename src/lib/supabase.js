import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  || ''
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Returns a real client if env vars are set, null otherwise (offline mode)
export const supabase = supabaseUrl && supabaseKey
  && !supabaseUrl.includes('YOUR_PROJECT_ID')
  ? createClient(supabaseUrl, supabaseKey)
  : null

export const isOnline = () => Boolean(supabase)

// ── OAuth Authentication ──────────────────────────────────────────────────────

/**
 * Sign in with an OAuth provider (Google or GitHub).
 * In desktop mode (Tauri), starts a local loopback server and opens the provider's
 * login page in the user's default system browser.
 * In browser mode, redirects the current tab to the OAuth provider.
 */
export async function signInWithProvider(provider) {
  if (!supabase) throw new Error('Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')

  const isTauriApp = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)

  if (isTauriApp) {
    const { invoke } = await import('@tauri-apps/api/core')

    // Start local loopback server to receive the OAuth redirect
    let port = 1420
    try {
      port = await invoke('start_oauth_listener')
    } catch (listenerErr) {
      console.warn('[AetherFlow] Failed to start oauth listener, falling back to 1420:', listenerErr)
    }

    const redirectUrl = `http://localhost:${port}/callback`

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider, // 'google' | 'github'
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    })

    if (error) throw error

    if (data?.url) {
      console.log('[AetherFlow] Launching OAuth URL via open_url:', data.url)
      try {
        await invoke('open_url', { url: data.url })
      } catch (openErr) {
        console.warn('[AetherFlow] open_url failed, falling back to window.open:', openErr)
        window.open(data.url, '_blank')
      }
    } else {
      console.error('[AetherFlow] No URL returned by Supabase signInWithOAuth:', data)
      throw new Error('Supabase did not return an authorization URL.')
    }

    return data
  }

  // Standard web browser fallback
  const redirectUrl = window.location.origin
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl,
    },
  })

  if (error) throw error
  if (data?.url && typeof window !== 'undefined') {
    window.location.href = data.url
  }
  return data
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Get the current session (null if not logged in).
 */
export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

/**
 * Get the current user object (null if not logged in).
 */
export async function getUser() {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user
}

/**
 * Listen for auth state changes (login, logout, token refresh).
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(callback) {
  if (!supabase) return () => {}
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => callback(event, session)
  )
  return () => subscription.unsubscribe()
}

/**
 * Processes an OAuth callback URL, hash fragment, authorization code, or raw token.
 * Sets the Supabase session and returns { success, user, session, error }.
 */
export async function processOAuthCallback(rawInput) {
  if (!supabase) return { success: false, error: 'Supabase is not configured in .env' }
  if (!rawInput || typeof rawInput !== 'string') return { success: false, error: 'No input provided' }

  const trimmed = rawInput.trim()
  console.log('[AetherFlow] Processing OAuth input:', trimmed.length > 80 ? trimmed.substring(0, 80) + '...' : trimmed)

  try {
    let accessToken = null
    let refreshToken = null
    let code = null
    let errorMsg = null

    // Case 1: Raw JWT access token directly
    if (trimmed.startsWith('ey') && trimmed.split('.').length === 3) {
      accessToken = trimmed
    } else {
      // Case 2: URL or URL fragment containing hash or search params
      const hashIdx = trimmed.indexOf('#')
      const queryIdx = trimmed.indexOf('?')

      const searchStr = queryIdx !== -1
        ? (hashIdx > queryIdx ? trimmed.substring(queryIdx + 1, hashIdx) : trimmed.substring(queryIdx + 1))
        : (trimmed.includes('=') && !trimmed.startsWith('#') ? trimmed : '')
      const hashStr = hashIdx !== -1
        ? trimmed.substring(hashIdx + 1)
        : (trimmed.startsWith('#') ? trimmed.substring(1) : '')

      const searchParams = new URLSearchParams(searchStr)
      const hashParams = new URLSearchParams(hashStr)

      accessToken = hashParams.get('access_token') || searchParams.get('access_token')
      refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token')
      code = searchParams.get('code') || hashParams.get('code')
      errorMsg = searchParams.get('error_description') || hashParams.get('error_description') || searchParams.get('error')
    }

    if (errorMsg) {
      console.warn('[AetherFlow] OAuth callback error in URL:', errorMsg)
      return { success: false, error: errorMsg }
    }

    if (accessToken) {
      // 1. If refresh_token is present, attempt setSession
      if (refreshToken) {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!error && data?.session?.user) {
            console.log('[AetherFlow] OAuth session established with refresh_token')
            return { success: true, user: data.session.user, session: data.session }
          }
        } catch (setErr) {
          console.warn('[AetherFlow] setSession failed, attempting getUser fallback:', setErr)
        }
      }

      // 2. Validate token directly with getUser
      try {
        const { data, error } = await supabase.auth.getUser(accessToken)
        if (!error && data?.user) {
          console.log('[AetherFlow] OAuth user validated via getUser')
          const sessionObj = {
            access_token: accessToken,
            refresh_token: refreshToken || '',
            user: data.user,
          }
          return { success: true, user: data.user, session: sessionObj }
        }
        if (error) {
          console.warn('[AetherFlow] getUser returned error:', error)
        }
      } catch (getErr) {
        console.warn('[AetherFlow] getUser threw error:', getErr)
      }
    } else if (code) {
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error && data?.session?.user) {
          console.log('[AetherFlow] OAuth session established via exchangeCodeForSession')
          return { success: true, user: data.session.user, session: data.session }
        }
        if (error) {
          return { success: false, error: error.message }
        }
      } catch (codeErr) {
        return { success: false, error: codeErr.message }
      }
    }

    return { success: false, error: 'Could not extract a valid sign-in token or code from input' }
  } catch (err) {
    console.error('[AetherFlow] processOAuthCallback error:', err)
    return { success: false, error: err.message || 'Authentication processing failed' }
  }
}
