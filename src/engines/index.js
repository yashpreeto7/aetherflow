/**
 * Engine Registry — maps engine IDs to their factory functions.
 * Lazy-loads engines to keep initial bundle size minimal.
 */

export const ENGINES = {
  'matrix-rain': {
    id: 'matrix-rain',
    name: 'Matrix Rain',
    description: 'Digital rain of katakana characters cascading down',
    preview: '/previews/matrix-rain.svg',
    tags: ['dark', 'hacker', 'green', 'cyberpunk'],
    defaultConfig: { color: '#00ff41', bgAlpha: 0.05, fontSize: 14, speedMultiplier: 1 },
    properties: {
      color: { type: 'color', label: 'Rain Color', default: '#00ff41' },
      bgAlpha: { type: 'range', label: 'Trail Length', min: 0.01, max: 0.2, step: 0.01, default: 0.05 },
      fontSize: { type: 'range', label: 'Character Size', min: 8, max: 24, step: 1, default: 14 },
    },
    load: () => import('./matrix-rain.js').then(m => m.createMatrixRain),
  },

  'cyber-particles': {
    id: 'cyber-particles',
    name: 'Cyber Particles',
    description: 'Connected particle network with interactive mouse repulsion',
    preview: '/previews/cyber-particles.svg',
    tags: ['dark', 'blue', 'network', 'interactive'],
    defaultConfig: { color: '#00d4ff', particleCount: 80, connectionDistance: 120, speedMultiplier: 1 },
    properties: {
      color: { type: 'color', label: 'Particle Color', default: '#00d4ff' },
      particleCount: { type: 'range', label: 'Particle Count', min: 20, max: 200, step: 10, default: 80 },
      connectionDistance: { type: 'range', label: 'Connection Range', min: 60, max: 250, step: 10, default: 120 },
    },
    load: () => import('./cyber-particles.js').then(m => m.createCyberParticles),
  },

  'synthwave-grid': {
    id: 'synthwave-grid',
    name: 'Synthwave Grid',
    description: 'Retro 80s perspective grid with neon sun and scanlines',
    preview: '/previews/synthwave-grid.svg',
    tags: ['retro', 'purple', 'neon', 'synthwave'],
    defaultConfig: { horizonColor: '#ff2d78', gridColor: '#b400ff', speedMultiplier: 1 },
    properties: {
      horizonColor: { type: 'color', label: 'Horizon Color', default: '#ff2d78' },
      gridColor: { type: 'color', label: 'Grid Color', default: '#b400ff' },
    },
    load: () => import('./synthwave-grid.js').then(m => m.createSynthwaveGrid),
  },

  'deep-space': {
    id: 'deep-space',
    name: 'Deep Space',
    description: 'Parallax starfield with nebula clouds and shooting stars',
    preview: '/previews/deep-space.svg',
    tags: ['dark', 'space', 'stars', 'minimal'],
    defaultConfig: { starCount: 300, speedMultiplier: 1, shootingStars: true },
    properties: {
      starCount: { type: 'range', label: 'Star Count', min: 100, max: 600, step: 50, default: 300 },
      shootingStars: { type: 'toggle', label: 'Shooting Stars', default: true },
    },
    load: () => import('./deep-space.js').then(m => m.createDeepSpace),
  },

  'tokyo-rain': {
    id: 'tokyo-rain',
    name: 'Tokyo City Rain',
    description: 'Anime-style neon city skyline with falling rain',
    preview: '/previews/tokyo-rain.svg',
    tags: ['neon', 'rain', 'city', 'purple', 'anime'],
    defaultConfig: { rainCount: 200, speedMultiplier: 1 },
    properties: {
      rainCount: { type: 'range', label: 'Rain Intensity', min: 50, max: 500, step: 25, default: 200 },
      rainColor: { type: 'color', label: 'Rain Color', default: '#96d2ff' },
    },
    load: () => import('./tokyo-rain.js').then(m => m.createTokyoRain),
  },

  'aurora': {
    id: 'aurora',
    name: 'Aurora Borealis',
    description: 'Smooth aurora curtains dancing over a starlit sky',
    preview: '/previews/aurora.svg',
    tags: ['green', 'nature', 'peaceful', 'blue'],
    defaultConfig: { speedMultiplier: 1, starCount: 150, intensity: 0.7 },
    properties: {
      intensity: { type: 'range', label: 'Intensity', min: 0.2, max: 1.2, step: 0.05, default: 0.7 },
      starCount: { type: 'range', label: 'Star Count', min: 50, max: 300, step: 25, default: 150 },
    },
    load: () => import('./aurora.js').then(m => m.createAurora),
  },

  'audio-spectrum': {
    id: 'audio-spectrum',
    name: 'Audio Spectrum',
    description: 'CAVA-style frequency bars with beat simulation and optional mic reactivity',
    preview: '/previews/audio-spectrum.svg',
    tags: ['audio', 'music', 'reactive', 'bars'],
    defaultConfig: { barCount: 80, mirror: true, speedMultiplier: 1, useMic: false },
    properties: {
      color: { type: 'color', label: 'Primary Color', default: '#00d4ff' },
      accentColor: { type: 'color', label: 'Accent Color', default: '#ff2d78' },
      barCount: { type: 'range', label: 'Bar Count', min: 20, max: 128, step: 4, default: 80 },
      mirror: { type: 'toggle', label: 'Mirror Mode', default: true },
      useMic: { type: 'toggle', label: 'Microphone Input (Real-time sound)', default: false },
    },
    load: () => import('./audio-spectrum.js').then(m => m.createAudioSpectrum),
  },
  'fps-meter': {
    id: 'fps-meter',
    name: 'FPS Benchmark HUD',
    description: 'Cyberpunk telemetry HUD showing real-time FPS counter, target limit, and frame-time graph',
    preview: '/previews/fps-meter.svg',
    tags: ['benchmark', 'fps', 'telemetry', 'cyberpunk', 'hud'],
    defaultConfig: { color: '#00ffcc', accentColor: '#ff0055', speedMultiplier: 1 },
    properties: {
      color: { type: 'color', label: 'Primary Neon', default: '#00ffcc' },
      accentColor: { type: 'color', label: 'Accent Neon', default: '#ff0055' },
    },
    load: () => import('./fps-meter.js').then(m => m.createFpsMeter),
  },
  'video-player': {
    id: 'video-player',
    name: 'Video Wallpaper',
    description: 'Plays a local MP4/WebM video file as your wallpaper',
    preview: '/previews/matrix-rain.svg', // using a fallback preview since we can't generate video previews easily right now
    tags: ['video', 'custom', 'local'],
    defaultConfig: { videoPath: '', speedMultiplier: 1 },
    properties: {
      videoPath: { type: 'text', label: 'Local Video Path (.mp4, .webm)', default: '' },
    },
    load: () => import('./video-player.js').then(m => m.default),
  },
  'image-player': {
    id: 'image-player',
    name: 'Picture Wallpaper',
    description: 'Displays a high-resolution local picture (PNG, JPG, WebP) as wallpaper',
    preview: '/previews/matrix-rain.svg',
    tags: ['image', 'picture', 'custom', 'local'],
    defaultConfig: { imagePath: '', fit: 'cover' },
    properties: {
      imagePath: { type: 'text', label: 'Local Image Path (.png, .jpg, .webp)', default: '' },
      fit: { type: 'select', label: 'Fit Mode', options: ['cover', 'contain', 'stretch'], default: 'cover' },
    },
    load: () => import('./image-player.js').then(m => m.createImagePlayer || m.default),
  },
  'web-stream': {
    id: 'web-stream',
    name: 'YouTube & Web Stream',
    description: 'Streams live video, YouTube ambient loops, or interactive web pages as wallpaper',
    preview: '/previews/deep-space.svg',
    tags: ['stream', 'youtube', 'live', 'web'],
    defaultConfig: { streamUrl: '', muted: true },
    properties: {
      streamUrl: { type: 'text', label: 'YouTube or Web Stream URL', default: '' },
      muted: { type: 'toggle', label: 'Mute Audio', default: true },
    },
    load: () => import('./web-stream.js').then(m => m.createWebStream || m.default),
  },
}

export const WALLPAPER_LIST = Object.values(ENGINES).filter(
  e => e.id !== 'video-player' && e.id !== 'image-player' && e.id !== 'web-stream'
)

/** Prebuilt themes shipped with the app */
export const BUILTIN_THEMES = [
  { id: 'sovereign-onyx',       name: 'Sovereign Onyx',       accent: '#3b82f6', bg: '#09090b', category: 'dark' },
  { id: 'sovereign-slate',      name: 'Sovereign Slate',       accent: '#6366f1', bg: '#0c0f17', category: 'dark' },
  { id: 'sovereign-studio',     name: 'Sovereign Studio',      accent: '#10b981', bg: '#0a0e0f', category: 'dark' },
  { id: 'sovereign-obsidian',   name: 'Sovereign Obsidian',    accent: '#f59e0b', bg: '#0e0b08', category: 'dark' },
  { id: 'sovereign-manifesto',  name: 'Sovereign Manifesto',   accent: '#d42b2b', bg: '#f5f0e8', category: 'light' },
  { id: 'sovereign-light',      name: 'Sovereign Light',       accent: '#2563eb', bg: '#f8fafc', category: 'light' },
]
