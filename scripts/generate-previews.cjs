const fs = require('fs');
const path = require('path');

const previews = [
  { id: 'matrix-rain',      bg: '#000000', accent: '#00ff41', label: 'Matrix Rain' },
  { id: 'cyber-particles',  bg: '#030a0f', accent: '#00d4ff', label: 'Cyber Particles' },
  { id: 'synthwave-grid',   bg: '#0d0019', accent: '#ff2d78', label: 'Synthwave Grid' },
  { id: 'deep-space',       bg: '#000005', accent: '#8800cc', label: 'Deep Space' },
  { id: 'tokyo-rain',       bg: '#0a001a', accent: '#b400ff', label: 'Tokyo Rain' },
  { id: 'aurora',           bg: '#000810', accent: '#00ff88', label: 'Aurora' },
  { id: 'audio-spectrum',   bg: '#050010', accent: '#ff2d78', label: 'Audio Spectrum' },
];

const outDir = path.join(__dirname, '..', 'public', 'previews');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

previews.forEach(p => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">
      <defs>
        <radialGradient id="grad_${p.id}" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stop-color="${p.accent}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${p.accent}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="${p.bg}"/>
      <rect width="100%" height="100%" fill="url(#grad_${p.id})"/>
      <text x="50%" y="55%" fill="${p.accent}" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle">${p.label}</text>
    </svg>`;
    
    fs.writeFileSync(path.join(outDir, `${p.id}.svg`), svg);
});
console.log('SVG previews generated successfully.');
