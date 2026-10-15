import { defineConfig } from 'vite'
export default defineConfig({ root: 'spike/video', base: './', build: { outDir: '../../dist-spike-video', emptyOutDir: true, target: 'es2022' } })
