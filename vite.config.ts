import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 4D.P4: Worker xem trước là ES module (import Verovio/WASM bên trong).
  worker: { format: 'es' },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['@coderline/alphatab'],
  },
})
