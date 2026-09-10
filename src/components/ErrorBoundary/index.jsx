import React from 'react'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'
import { tauriInvoke } from '../../lib/wallpaperActions.js'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]', error, errorInfo)
    this.setState({ errorInfo })
    tauriInvoke('report_frontend_error', {
      error: error?.toString() || 'Unknown React error',
      info: errorInfo?.componentStack || null,
      source: 'ReactErrorBoundary',
    }).catch(() => {})
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    try {
      localStorage.removeItem('aetherflow-state')
    } catch {}
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          width: '100vw',
          background: 'var(--bg-base, #09090b)',
          color: 'var(--text-main, #ffffff)',
          padding: '24px',
          boxSizing: 'border-box',
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center',
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: 'var(--bg-card, rgba(26, 26, 32, 0.95))',
            border: '1px solid var(--border-main, rgba(255, 255, 255, 0.12))',
            borderRadius: '16px',
            padding: '32px 24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(16px)',
          }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#ef4444',
            }}>
              <AlertTriangle size={26} />
            </div>

            <h2 style={{
              fontSize: '20px',
              fontWeight: 700,
              margin: '0 0 8px',
              color: 'var(--text-main, #fff)',
            }}>
              Something went wrong
            </h2>

            <p style={{
              fontSize: '13px',
              color: 'var(--text-muted, #a1a1aa)',
              margin: '0 0 20px',
              lineHeight: 1.5,
            }}>
              AetherFlow encountered an unexpected error while loading the interface.
            </p>

            <div style={{
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '11px',
              color: '#f87171',
              fontFamily: 'monospace',
              textAlign: 'left',
              maxHeight: '120px',
              overflowY: 'auto',
              marginBottom: '24px',
              wordBreak: 'break-all',
            }}>
              {this.state.error?.message || String(this.state.error)}
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  background: 'var(--color-brand, #3b82f6)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <RefreshCw size={15} />
                Reload App
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-main, #ffffff)',
                  border: '1px solid var(--border-main, rgba(255, 255, 255, 0.15))',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
              >
                <RotateCcw size={15} />
                Reset Cache & Reload
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
