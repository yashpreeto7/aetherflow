# AuraOS Development Standards

## Canvas Engine Pattern
Every wallpaper engine MUST follow this exact interface:

```js
export function create<EngineName>(canvas, options = {}) {
  // Destructure options with defaults
  const { speedMultiplier = 1, ...rest } = options
  const ctx = canvas.getContext('2d')
  let animId = null

  function resize() {
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    // Re-initialize state after resize
  }

  function frame(timestamp) {
    // Draw frame
    animId = requestAnimationFrame(frame)
  }

  function start() {
    resize()
    window.addEventListener('resize', resize)
    animId = requestAnimationFrame(frame)
  }

  function stop() {
    if (animId) cancelAnimationFrame(animId)
    window.removeEventListener('resize', resize)
    // Clean up any other resources (streams, event listeners)
  }

  function updateOptions(newOpts) {
    Object.assign(options, newOpts)
  }

  return { start, stop, updateOptions }
}
```

## Engine Registry Pattern
Every engine in `src/engines/index.js` needs:
```js
'engine-id': {
  id: 'engine-id',
  name: 'Human Name',
  description: 'One sentence description',
  preview: '/previews/engine-id.webp',
  tags: ['tag1', 'tag2'],
  defaultConfig: { speedMultiplier: 1, color: '#00ff00' },
  properties: {
    color: { type: 'color', label: 'Label', default: '#00ff00' },
    speed: { type: 'range', label: 'Speed', min: 0.1, max: 3, step: 0.1, default: 1 },
  },
  load: () => import('./engine-name.js').then(m => m.createEngineName),
}
```

## Supabase Safety Pattern
ALWAYS check `isOnline()` before any Supabase operation:
```js
import { supabase, isOnline } from '../lib/supabase.js'

// Wrong ❌
const data = await supabase.from('wallpapers').select('*')

// Correct ✅
if (!isOnline()) return []
const { data } = await supabase.from('wallpapers').select('*')
```

## Zustand Store Pattern
When adding new persisted settings:
1. Add the field + setter to the store `(set, get) => ({...})`  
2. Add the field name to the `partialize` array at the bottom
3. Initialize from store in component with `useStore(s => s.fieldName)`

## Build Verification
After any significant change, always run:
```powershell
npm run build
```
A clean build = no regressions. Fix ALL errors before committing.
