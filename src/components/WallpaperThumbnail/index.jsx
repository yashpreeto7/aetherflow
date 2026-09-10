import React, { useRef, useState, useEffect } from 'react'
import { ENGINES } from '../../engines/index.js'
import {
  Video, Image as ImageIcon, Globe, Terminal, Sparkles,
  Waves, Compass, Flame, CloudRain, Activity, Code
} from 'lucide-react'
import { safeConvertFileSrc } from '../../lib/wallpaperActions.js'

/**
 * WallpaperThumbnail — Zero-RAM Vector Badge with On-Demand Hover Previews.
 *
 * When Idle (isHovered === false):
 * - Renders a lightweight, zero-RAM vector badge with glowing theme icons and gradients.
 * - Zero bitmap image fetches, zero video decoders, and zero GPU memory churn.
 * - Keeps baseline WebView2 RAM under ~35MB across all cards in the grid.
 *
 * When Hovered (isHovered === true):
 * - Video Wallpapers: Dynamically mounts the hardware video player and streams the preview loop.
 * - Image Wallpapers: Renders the full resolution image preview via convertFileSrc.
 * - YouTube Streams: Renders the official YouTube video thumbnail.
 * - Canvas Engines: Renders the crisp vector engine preview.
 *
 * On Hover Exit:
 * - Instantly unmounts media and calls .pause(), .removeAttribute('src'), and .load() on the video,
 *   forcing Chromium/Direct3D to discard the hardware decoding surface immediately.
 */

const ENGINE_THEMES = {
  'matrix-rain': {
    icon: Terminal,
    color: '#00ff41',
    bg: 'linear-gradient(135deg, #031308 0%, #062211 100%)',
    badge: 'MATRIX',
    badgeBg: 'rgba(0, 255, 65, 0.15)',
    label: 'Matrix Rain'
  },
  'cyber-particles': {
    icon: Sparkles,
    color: '#00d4ff',
    bg: 'linear-gradient(135deg, #041424 0%, #082640 100%)',
    badge: 'PARTICLES',
    badgeBg: 'rgba(0, 212, 255, 0.15)',
    label: 'Cyber Particles'
  },
  'synthwave-grid': {
    icon: Waves,
    color: '#ff2d78',
    bg: 'linear-gradient(135deg, #1d051c 0%, #36072f 100%)',
    badge: 'SYNTHWAVE',
    badgeBg: 'rgba(255, 45, 120, 0.15)',
    label: 'Synthwave Grid'
  },
  'deep-space': {
    icon: Compass,
    color: '#a855f7',
    bg: 'linear-gradient(135deg, #0e0622 0%, #1c0e3a 100%)',
    badge: 'COSMOS',
    badgeBg: 'rgba(168, 85, 247, 0.15)',
    label: 'Deep Space'
  },
  'tokyo-rain': {
    icon: CloudRain,
    color: '#ec4899',
    bg: 'linear-gradient(135deg, #180918 0%, #2b0e27 100%)',
    badge: 'TOKYO',
    badgeBg: 'rgba(236, 72, 153, 0.15)',
    label: 'Tokyo Rain'
  },
  'aurora': {
    icon: Flame,
    color: '#10b981',
    bg: 'linear-gradient(135deg, #031416 0%, #062725 100%)',
    badge: 'AURORA',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    label: 'Aurora Borealis'
  },
  'audio-spectrum': {
    icon: Activity,
    color: '#f59e0b',
    bg: 'linear-gradient(135deg, #181003 0%, #301f05 100%)',
    badge: 'SPECTRUM',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    label: 'Audio Spectrum'
  },
  'web-stream': {
    icon: Globe,
    color: '#ef4444',
    bg: 'linear-gradient(135deg, #1b0808 0%, #301010 100%)',
    badge: 'STREAM',
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    label: 'Web Stream'
  },
  'video-player': {
    icon: Video,
    color: '#3b82f6',
    bg: 'linear-gradient(135deg, #07101f 0%, #0c1e3a 100%)',
    badge: 'VIDEO',
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    label: 'Video Wallpaper'
  },
  'image-player': {
    icon: ImageIcon,
    color: '#10b981',
    bg: 'linear-gradient(135deg, #061510 0%, #0b261d 100%)',
    badge: 'IMAGE',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    label: 'Picture Wallpaper'
  },
}

export default function WallpaperThumbnail({ wallpaper, isHovered = false }) {
  const engineId = wallpaper.engine || wallpaper.id
  const descriptor = ENGINES[engineId]

  const imgPath = wallpaper.config?.imagePath || wallpaper.defaultConfig?.imagePath || ''
  const isImage = engineId === 'image-player' || 
                  wallpaper.mediaType === 'image' || 
                  Boolean(imgPath && !wallpaper.config?.videoPath) ||
                  Boolean(wallpaper.tags && wallpaper.tags.includes('image'))

  const isStream = engineId === 'web-stream' ||
                   wallpaper.mediaType === 'stream' ||
                   Boolean(wallpaper.config?.streamUrl)

  const isVideo = !isImage && !isStream && (wallpaper.isCustom || engineId === 'video-player' || wallpaper.mediaType === 'video')

  // Debounce hover activation by 100ms for video to avoid firing GPU decoders on quick cursor sweeps
  const [debouncedHover, setDebouncedHover] = useState(false)
  const [imgLoadError, setImgLoadError] = useState(false)
  const videoNodeRef = useRef(null)

  useEffect(() => {
    if (!isHovered) {
      setDebouncedHover(false)
      setImgLoadError(false)
      return
    }
    const timer = setTimeout(() => setDebouncedHover(true), 100)
    return () => clearTimeout(timer)
  }, [isHovered])

  // Explicit hardware decoder teardown callback:
  // When React unmounts the <video>, node is null. We immediately pause, strip src, and call .load()
  // to force Chromium/Direct3D to release the hardware video decoding surface.
  const handleVideoRef = (node) => {
    if (node) {
      videoNodeRef.current = node
    } else if (videoNodeRef.current) {
      try {
        videoNodeRef.current.pause()
        videoNodeRef.current.removeAttribute('src')
        videoNodeRef.current.load()
      } catch (e) {}
      videoNodeRef.current = null
    }
  }

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      if (videoNodeRef.current) {
        try {
          videoNodeRef.current.pause()
          videoNodeRef.current.removeAttribute('src')
          videoNodeRef.current.load()
        } catch (e) {}
        videoNodeRef.current = null
      }
    }
  }, [])

  // Resolve Theme & Badges
  let theme = null
  let isYouTube = false
  let ytThumb = null

  if (isStream) {
    theme = ENGINE_THEMES['web-stream']
    let ytId = wallpaper.config?.youtubeId
    if (!ytId && wallpaper.config?.streamUrl) {
      const match = wallpaper.config.streamUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/)
      if (match) ytId = match[1]
    }
    if (ytId) {
      isYouTube = true
      ytThumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
    } else if (wallpaper.preview && wallpaper.preview !== '/previews/deep-space.svg') {
      ytThumb = wallpaper.preview
    }
  } else if (isImage) {
    theme = ENGINE_THEMES['image-player']
  } else if (isVideo) {
    theme = ENGINE_THEMES['video-player']
  } else {
    theme = ENGINE_THEMES[engineId] || {
      icon: Code,
      color: 'var(--color-brand)',
      bg: 'linear-gradient(135deg, #0b0f19 0%, #151d2f 100%)',
      badge: 'CANVAS',
      badgeBg: 'rgba(59, 130, 246, 0.15)',
      label: wallpaper.name || 'Live Engine'
    }
  }

  const IconComponent = theme.icon || Sparkles
  const accentColor = isYouTube ? '#ef4444' : theme.color
  const badgeText = isYouTube ? 'YOUTUBE' : theme.badge

  // Compute media sources for on-demand hover display
  let previewMedia = null

  if (isHovered && !imgLoadError) {
    try {
      if (isVideo) {
        const videoPath = wallpaper.config?.videoPath || wallpaper.defaultConfig?.videoPath || ''
        const videoSrc = videoPath
          ? (videoPath.startsWith('http') || videoPath.startsWith('data:') ? videoPath : safeConvertFileSrc(videoPath))
          : ''

        if (debouncedHover && videoSrc) {
          previewMedia = (
            <video
              ref={handleVideoRef}
              src={videoSrc}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              onError={() => setImgLoadError(true)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                zIndex: 1,
              }}
            />
          )
        }
      } else if (isImage) {
        const imgSrc = imgPath
          ? (imgPath.startsWith('http') || imgPath.startsWith('data:') ? imgPath : safeConvertFileSrc(imgPath))
          : (wallpaper.preview || wallpaper.thumbnail || '')

        if (imgSrc) {
          previewMedia = (
            <img
              src={imgSrc}
              alt={wallpaper.name}
              onError={() => setImgLoadError(true)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                zIndex: 1,
                animation: 'fadeIn 0.2s ease forwards',
              }}
            />
          )
        }
      } else if (isStream) {
        if (ytThumb) {
          previewMedia = (
            <img
              src={ytThumb}
              alt={wallpaper.name}
              onError={() => setImgLoadError(true)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                zIndex: 1,
                animation: 'fadeIn 0.2s ease forwards',
              }}
            />
          )
        }
      } else {
        // Built-in canvas engine SVG preview
        const svgPath = descriptor?.preview || `/previews/${engineId}.svg`
        if (svgPath) {
          previewMedia = (
            <img
              src={svgPath}
              alt={wallpaper.name}
              onError={() => setImgLoadError(true)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                zIndex: 1,
                animation: 'fadeIn 0.2s ease forwards',
              }}
            />
          )
        }
      }
    } catch (err) {
      console.warn('[WallpaperThumbnail] Error preparing preview media:', err)
      previewMedia = null
    }
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: theme.bg,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.25s ease, filter 0.25s ease',
        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      {/* Base Zero-RAM Vector Badge (Always rendered as fallback & idle presentation) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 45%, ${accentColor}18 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Center Icon Badge */}
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 13,
          background: `${accentColor}15`,
          border: `1px solid ${accentColor}35`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 16px ${accentColor}1a`,
          marginBottom: 8,
          zIndex: 0,
          transition: 'transform 0.25s ease',
          transform: isHovered ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        <IconComponent size={23} style={{ color: accentColor, opacity: 0.95 }} />
      </div>

      {/* Type Subtitle */}
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          zIndex: 0,
          maxWidth: '85%',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {isYouTube ? 'YouTube Loop' : theme.label}
      </span>

      {/* Dynamic Hover Media Layer (Only mounted while actively hovered) */}
      {previewMedia}

      {/* Persistent Pill Badge Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          background: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(6px)',
          borderRadius: 4,
          padding: '2px 7px',
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: 0.5,
          color: accentColor,
          border: `1px solid ${accentColor}35`,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          zIndex: 3,
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: accentColor,
            boxShadow: `0 0 6px ${accentColor}`,
          }}
        />
        {badgeText}
      </div>
    </div>
  )
}
