import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
