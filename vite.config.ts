import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        statistics: resolve(__dirname, 'statistics.html') // use root-level statistics.html for output to dist/
      }
    }
  },
  optimizeDeps: {
    exclude: ['buffer']
  },
  define: {
    global: 'globalThis'
  }
}) 