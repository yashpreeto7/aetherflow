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
 * Sign in with an OAuth provider (Google, GitHub, or Discord).
 * Opens the provider's login page in the user's default browser.
 * For Tauri desktop apps, uses the redirectTo parameter to come back to the app.
 */
export async function signInWithProvider(provider) {
  if (!supabase) throw new Error('Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')

  const isTauriApp = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__)

  // In Tauri: redirect to http://localhost:1420 so our on_navigation interceptor catches the tokens
  // In Browser: redirect to current origin
  const redirectUrl = isTauriApp ? 'http://localhost:1420' : window.location.origin

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider, // 'google' | 'github' | 'discord'
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: isTauriApp,
    },
  })

  if (error) throw error

  if (isTauriApp && data?.url) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      // Try dedicated popup window with clean Chrome user agent first
      try {
        await invoke('open_oauth_window', { url: data.url })
      } catch (popupErr) {
        console.warn('[AetherFlow] open_oauth_window failed, falling back to open_url:', popupErr)
        await invoke('open_url', { url: data.url })
      }
    } catch {
      window.open(data.url, '_blank')
    }
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
