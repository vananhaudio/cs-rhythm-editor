import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Kho bài giảng (app Next.js riêng). Production: Netlify proxy qua public/_redirects.
// Dev server KHÔNG đọc _redirects → thiếu proxy thì /khobaigiang rơi vào PlayerView của SPA.
// Chỉ áp cho `npm run dev`; build production không dùng khối server này.
const KHO = 'https://khotrithuc.netlify.app'
const khoProxy = { target: KHO, changeOrigin: true, secure: true }

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/khobaigiang': khoProxy,
      '/api/hocsinh': khoProxy,
      '/login': khoProxy,
      '/_next': khoProxy,
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['@coderline/alphatab'],
  },
})
