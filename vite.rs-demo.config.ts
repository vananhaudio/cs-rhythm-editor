// Build riêng cho staging nghiệm thu Rhythm Scroll: `npx vite build -c vite.rs-demo.config.ts` → dist-rs-demo/
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  root: 'staging/rhythm-scroll-demo',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist-rs-demo', emptyOutDir: true },
})
