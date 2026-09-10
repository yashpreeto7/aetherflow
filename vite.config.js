import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

function aetherDevPlugin() {
  return {
    name: 'aether-dev-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/custom-wallpapers') {
          const possiblePaths = [
            path.join(process.env.APPDATA || '', 'com.aetherflow.app', 'custom_wallpapers.json'),
            path.join(process.env.APPDATA || '', 'aetherflow', 'custom_wallpapers.json'),
            path.join(process.env.LOCALAPPDATA || '', 'aetherflow', 'custom_wallpapers.json'),
            path.join(process.env.APPDATA || '', 'com.auraos.dev', 'custom_wallpapers.json'),
          ]
          for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
              res.setHeader('Content-Type', 'application/json')
              res.end(fs.readFileSync(p))
              return
            }
          }
          res.setHeader('Content-Type', 'application/json')
          res.end('[]')
          return
        }
        if (req.url?.startsWith('/api/local-file?path=')) {
          try {
            const filePath = decodeURIComponent(req.url.slice('/api/local-file?path='.length))
            if (fs.existsSync(filePath)) {
              const ext = path.extname(filePath).toLowerCase()
              const mime = ext === '.png' ? 'image/png' 
                : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' 
                : ext === '.webp' ? 'image/webp' 
                : ext === '.mp4' ? 'video/mp4' 
                : ext === '.webm' ? 'video/webm' 
                : 'application/octet-stream'
              res.setHeader('Content-Type', mime)
              fs.createReadStream(filePath).pipe(res)
              return
            }
          } catch {}
        }
        next()
      })
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), aetherDevPlugin()],
  // Tauri expects a fixed port in dev
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Watch for changes on Tauri side too
      ignored: ['**/src-tauri/**'],
    },
  },
  // Optimise build for Tauri WebView2
  build: {
    // Tauri uses Chromium on Linux/macOS, WebView2 on Windows
    target: ['es2021', 'chrome100'],
    minify: !process.env.TAURI_DEBUG ? 'oxc' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    // Keep bundle lean — rolldown requires function form
    rollupOptions: {
      input: {
        main: 'index.html',
        wallpaper: 'wallpaper.html'
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react'
          if (id.includes('node_modules/react-router-dom')) return 'router'
          if (id.includes('node_modules/@supabase')) return 'supabase'
        },
      },
    },
  },
  clearScreen: false,
})
