import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import type { Plugin } from 'vite'

function stampServiceWorker(): Plugin {
  return {
    name: 'stamp-sw-build-hash',
    writeBundle(options) {
      const outDir = options.dir || 'dist'
      const swPath = resolve(outDir, 'sw.js')
      try {
        const content = readFileSync(swPath, 'utf-8')
        const hash = `fore-skins-${Date.now().toString(36)}`
        writeFileSync(swPath, content.replace('__BUILD_HASH__', hash))
      } catch {}
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), stampServiceWorker()],
  base: '/golf-tracker/',
})
