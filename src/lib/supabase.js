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
      try {
        await invoke('open_url', { url: data.url })
      } catch (openErr) {
        console.warn('[AetherFlow] open_url failed, falling back to window.open:', openErr)
        window.open(data.url, '_blank')
      }
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
