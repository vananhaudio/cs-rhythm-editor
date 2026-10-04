import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../src/index.css'
import ThuVienPage from '../../../src/thuvien/ThuVienPage.tsx'
import { createRpcChordLibrary } from '../../../src/thuvien/chordLibrary.ts'

// Trang thử — CHỈ chạy với dev server, bỏ qua cổng admin của AppRouter.
//   (mặc định)       → dữ liệu thử trong trình duyệt (mock), có băng cảnh báo.
//   ?db=local        → RPC THẬT trên Postgres TẠM qua scripts/chord-library-local-db.sh (cầu 127.0.0.1:54399).
//   ?db=local&as=student → cùng DB, đóng vai học viên (để thấy quyền bị chặn).
const params = new URLSearchParams(location.search)
const as = params.get('as') ?? 'admin'
const local = params.get('db') === 'local'
  ? createRpcChordLibrary(async (fn, args) => {
      const reply = await fetch(`http://127.0.0.1:54399/rpc/${fn}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-chord-as': as }, body: JSON.stringify(args) })
      if (!reply.ok) return { data: null, error: { message: `Cầu DB tạm trả ${reply.status}` } }
      return reply.json()
    })
  : undefined

createRoot(document.getElementById('root')!).render(<StrictMode>
  {local && <div style={{ position: 'fixed', right: 8, bottom: 8, zIndex: 9, padding: '4px 10px', borderRadius: 6, background: '#1f4a33', color: '#fff', font: '600 12px system-ui' }}>
    DB TẠM (local) · vai: {as} · không phải production
  </div>}
  <ThuVienPage chordLibrary={local} />
</StrictMode>)
