import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../src/index.css'
import { ThuVienPageView } from '../../../src/thuvien/ThuVienPage.tsx'
import type { ClassSession } from '../../../src/class-social/useClassSession.ts'
import { createRpcChordLibrary } from '../../../src/thuvien/chordLibrary.ts'
import { createBridgeSourceStore } from './bridgeStore.ts'
import { createHttpMeasureAnalyzer } from '../../../src/thuvien/measureAnalysis.ts'
import { LOCAL_TEST_USER, installMusicXmlStandIn } from './musicxmlStandIn.ts'

// Trang thử — CHỈ chạy với dev server, bỏ qua cổng admin của AppRouter.
//   (mặc định)       → dữ liệu thử trong trình duyệt (mock), có băng cảnh báo.
//   ?db=local        → RPC THẬT trên Postgres TẠM qua scripts/chord-library-local-db.sh (cầu 127.0.0.1:54399);
//                      file nguồn đi qua mô phỏng Storage API (policy + trigger N1 thật), byte lưu ở /tmp/chord-library-localdb/files.
//   ?db=local&as=student → cùng DB, đóng vai học viên (để thấy quyền bị chặn).
//   Phân tích vạch nhịp (5B): gọi cầu analyzer CỤC BỘ 127.0.0.1:54398 (tests/thuvien-analyzer/bridge.ts); ?analyzer=off để tắt.
//   Bản production KHÔNG truyền analyzer → nút Phân tích luôn khoá.
const params = new URLSearchParams(location.search)
const as = params.get('as') ?? 'admin'
const local = params.get('db') === 'local'
  ? createRpcChordLibrary(async (fn, args) => {
      const reply = await fetch(`http://127.0.0.1:54399/rpc/${fn}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-chord-as': as }, body: JSON.stringify(args) })
      if (!reply.ok) return { data: null, error: { message: `Cầu DB tạm trả ${reply.status}` } }
      return reply.json()
    }, createBridgeSourceStore('http://127.0.0.1:54399', as))
  : undefined

// ?db=local: kho MusicXML thế thân trong trình duyệt (xem musicxmlStandIn.ts) — để thử luồng Xem / Nạp MusicXML mà không chạm production.
if (local) await installMusicXmlStandIn()

const analyzer = params.get('analyzer') === 'off' ? undefined : createHttpMeasureAnalyzer('http://127.0.0.1:54398')

// Phiên Class GIẢ cho trang thử (không gọi Supabase): người dùng thử cục bộ, vai thầy.
const session: ClassSession = {
  status: 'ready',
  me: { role: 'teacher', userId: LOCAL_TEST_USER.id, studentId: null, name: 'Thầy Văn Anh (thử)', email: LOCAL_TEST_USER.email, avatarUrl: null,
    level: null, enrolledAt: null, htMember: false, isTeacher: true, coverUrl: null },
}

createRoot(document.getElementById('root')!).render(<StrictMode>
  {local && <div style={{ position: 'fixed', right: 8, bottom: 8, zIndex: 9, padding: '4px 10px', borderRadius: 6, background: '#1f4a33', color: '#fff', font: '600 12px system-ui' }}>
    DB TẠM (local) · vai: {as} · kho MusicXML = bản thử trong trình duyệt · không phải production
  </div>}
  <ThuVienPageView chordLibrary={local} measureAnalyzer={analyzer} session={session} />
</StrictMode>)
