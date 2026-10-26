import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Kho bài giảng (app Next.js riêng). Production: Netlify proxy qua public/_redirects.
// Dev server KHÔNG đọc _redirects → thiếu proxy thì /khobaigiang rơi vào PlayerView của SPA.
// Chỉ áp cho `npm run dev`; build production không dùng khối server này.
const KHO = 'https://khotrithuc.netlify.app'
const khoProxy = { target: KHO, changeOrigin: true, secure: true }

// Bản đóng gói native (`vite build --mode native`): stylesheet Google Fonts KHÔNG được chặn render.
// Font host chậm/bị chặn → trang trắng cho tới khi tải xong (đo trên iPhone SE Simulator: >36s trắng với host chậm,
// 3,4s khi font không chặn). font-display=swap đã có sẵn trong URL nên chữ hiện bằng font hệ thống rồi đổi font.
// Bản web production (mode mặc định) giữ nguyên index.html.
const nativeFontsNonBlocking = (mode: string) => ({
  name: 'native-fonts-non-blocking',
  transformIndexHtml: (html: string) => (mode !== 'native' ? html : html.replace(
    /(<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet")/,
    `$1 media="print" onload="this.media='all'"`,
  )),
})

export default defineConfig(({ mode }) => ({
  plugins: [react(), nativeFontsNonBlocking(mode)],
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
}))
