import React, { useState } from 'react'

/**
 * Robust UserAvatar component.
 * - Handles Google user content images by specifying referrerPolicy="no-referrer" (fixes 403 blocked images)
 * - Automatically falls back to a sleek gradient circle with the user's initial (e.g. 'Y') on error or missing image
 */
export function UserAvatar({ user, size = 28, style = {} }) {
  const [imgError, setImgError] = useState(false)

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.user_metadata?.user_name || user?.email || 'User'
  const initial = (name.trim().charAt(0) || 'U').toUpperCase()

  // Deterministic vibrant gradients based on the initial
  const gradients = [
    'linear-gradient(135deg, #6366f1, #a855f7)',
    'linear-gradient(135deg, #06b6d4, #3b82f6)',
    'linear-gradient(135deg, #ec4899, #f43f5e)',
    'linear-gradient(135deg, #10b981, #059669)',
    'linear-gradient(135deg, #f59e0b, #ef4444)',
    'linear-gradient(135deg, #8b5cf6, #3b82f6)',
  ]
  const colorIndex = (initial.charCodeAt(0) || 0) % gradients.length
  const bgGradient = gradients[colorIndex]

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1.5px solid var(--border-main)',
          flexShrink: 0,
          display: 'block',
          ...style,
        }}
      />
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bgGradient,
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: Math.round(size * 0.44),
        lineHeight: 1,
        letterSpacing: '0.02em',
        flexShrink: 0,
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
        userSelect: 'none',
        ...style,
      }}
      title={name}
    >
      {initial}
    </div>
  )
}

export default UserAvatar
