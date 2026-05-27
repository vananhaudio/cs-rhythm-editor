import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import alphaTabVite from '@coderline/alphatab/dist/alphaTab.vite.js'

export default defineConfig({
  plugins: [react(), alphaTabVite()],
})
