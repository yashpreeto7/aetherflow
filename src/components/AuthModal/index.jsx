import React from 'react'
import { X, Zap } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { signInWithProvider, isOnline } from '../../lib/supabase.js'

// SVG icons for OAuth providers (inline to avoid extra dependencies)
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  )
}

const PROVIDERS = [
  { id: 'google',  label: 'Continue with Google',  icon: GoogleIcon,  bg: '#ffffff', color: '#333333' },
  { id: 'github',  label: 'Continue with GitHub',  icon: GitHubIcon,  bg: '#24292f', color: '#ffffff' },
  { id: 'discord', label: 'Continue with Discord', icon: DiscordIcon, bg: '#5865F2', color: '#ffffff' },
]

export default function AuthModal() {
  const showAuthModal = useStore(s => s.showAuthModal)
  const setShowAuthModal = useStore(s => s.setShowAuthModal)
  const isAuthenticated = useStore(s => s.isAuthenticated)
  const [loading, setLoading] = React.useState(null) // provider id or null
  const [error, setError] = React.useState(null)

  // Automatically close modal when user becomes authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      setShowAuthModal(false)
      setLoading(null)
      setError(null)
    }
  }, [isAuthenticated, setShowAuthModal])

  // Reset loading and error when modal closes
  React.useEffect(() => {
    if (!showAuthModal) {
      setLoading(null)
      setError(null)
    }
  }, [showAuthModal])

  if (!showAuthModal) return null

  const online = isOnline()

  const handleClose = () => {
    setLoading(null)
    setError(null)
    setShowAuthModal(false)
  }

  const handleSignIn = async (provider) => {
    setLoading(provider)
    setError(null)
    try {
      await signInWithProvider(provider)
      // Reset loading after 2.5s so buttons are interactive again if user cancels/switches
      setTimeout(() => {
        setLoading(null)
      }, 2500)
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please try again.')
      setLoading(null)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-main)',
          borderRadius: 16,
          padding: '36px 32px 28px',
          width: 380,
          maxWidth: '90vw',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6)',
          position: 'relative',
          animation: 'fadeIn 0.25s ease',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="btn-icon"
          style={{
            position: 'absolute', top: 12, right: 12,
            width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8,
          }}
        >
          <X size={14} />
        </button>

        {/* Logo & header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 16px',
            background: 'var(--color-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px color-mix(in srgb, var(--color-brand) 40%, transparent)',
          }}>
            <Zap size={24} color="#fff" />
          </div>
          <h2 className="font-display font-bold text-lg" style={{ marginBottom: 6 }}>
            Sign in to AetherFlow
          </h2>
          <p className="text-sm text-muted" style={{ lineHeight: 1.5 }}>
            Sign in to install community wallpapers and submit your own creations.
          </p>
        </div>

        {/* Not configured message */}
        {!online && (
          <div style={{
            background: 'rgba(255,180,0,0.08)',
            border: '1px solid rgba(255,180,0,0.2)',
            borderRadius: 10, padding: '12px 14px', marginBottom: 16,
            textAlign: 'center',
          }}>
            <div className="text-xs" style={{ color: 'var(--color-amber)' }}>
              Marketplace not configured yet. Add Supabase credentials to <code>.env</code> to enable sign-in.
            </div>
          </div>
        )}

        {/* OAuth Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PROVIDERS.map(({ id, label, icon: Icon, bg, color }) => (
            <button
              key={id}
              disabled={!online || loading}
              onClick={() => handleSignIn(id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '11px 16px',
                background: bg, color: color,
                border: id === 'google' ? '1px solid #dadce0' : '1px solid transparent',
                borderRadius: 10,
                fontSize: 14, fontWeight: 500,
                cursor: online && !loading ? 'pointer' : 'not-allowed',
                opacity: loading && loading !== id ? 0.5 : 1,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { if (online && !loading) e.currentTarget.style.opacity = '0.9' }}
              onMouseLeave={e => { if (online && !loading) e.currentTarget.style.opacity = loading && loading !== id ? '0.5' : '1' }}
            >
              {loading === id ? (
                <div style={{
                  width: 18, height: 18,
                  border: `2px solid ${color === '#ffffff' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}`,
                  borderTopColor: color,
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                }} />
              ) : (
                <Icon />
              )}
              {label}
            </button>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            marginTop: 12, padding: '8px 12px',
            background: 'rgba(255,80,80,0.1)',
            border: '1px solid rgba(255,80,80,0.2)',
            borderRadius: 8, textAlign: 'center',
          }}>
            <span className="text-xs" style={{ color: 'var(--color-rose)' }}>{error}</span>
          </div>
        )}

        {/* Footer */}
        <div className="text-xs text-subtle" style={{ textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
          By signing in, you agree to AetherFlow's community guidelines.
          <br />Your profile is used for attribution only.
        </div>
      </div>
    </div>
  )
}
