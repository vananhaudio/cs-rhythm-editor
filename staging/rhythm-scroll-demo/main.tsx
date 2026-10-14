// STAGING nghiệm thu giao diện Rhythm Scroll. Dùng CHÍNH RhythmScrollPage + thư viện giả (mock), dữ liệu mẫu cố định.
// Không đăng nhập, không gọi Supabase, không có chức năng quản trị. Không nằm trong bundle production.
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/thuvien/RhythmScroll.css'
import '../../src/class-social/classSocial.css'
import { ToolShareBodyView } from '../../src/class-social/toolshare/ToolShareCard.tsx'
import { ShareCardView } from '../../src/class-social/chat/ShareMessageCard.tsx'
import { describeToolShare } from '../../src/class-social/toolshare/registry.ts'
import { chordCardView } from '../../src/share/refCards.ts'
import RhythmScrollPage from '../../src/thuvien/RhythmScrollPage.tsx'
import { createMockChordLibrary } from '../../src/thuvien/chordLibrary.ts'

const LINES = [
  'Chiều [Am] nao, tiễn nhau [E7] đi khi bóng ngả xế [Am] tàn',
  'Hoàng [Dm] hôn đến đâu [G] đây màu tím dâng trong hồn [C] ta',
  'Một [Am] mình ta đứng trên [Dm] sân ga vắng [E7] người',
  'Nghe [F] tiếng còi tàu [C] xa dần khuất trong [E7] mây trời [Am] chiều',
  'ĐK: Người [C] ơi đừng [G] quên lời hẹn [Am] ước',
  'Ngày [F] mai ta [C] gặp lại nhau [E7] nơi này',
]
const MEASURES = [[0, 0], [0, 3], [0, 6], [1, 0], [1, 3], [1, 6], [2, 0], [2, 3], [3, 0], [3, 3], [4, 0], [4, 3], [5, 0], [5, 3]]
  .map(([line, token]) => ({ line, token }))

// STAGING: không cho request nào tới Supabase (không đăng nhập, không ghi) — hành động mạng của bảng Chia sẻ sẽ báo lỗi mạng.
const realFetch = window.fetch.bind(window)
window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => /supabase\.co/.test(String(input instanceof Request ? input.url : input))
  ? Promise.reject(new TypeError('staging: không kết nối Supabase')) : realFetch(input, init)) as typeof fetch

const library = createMockChordLibrary()
library.getChordSheet = async () => ({
  sheetId: 'demo', versionId: 'c1111111-0000-4000-8000-000000000009', title: 'Chuyến tàu hoàng hôn (bản thử)', composer: null, hasAnchors: true, updatedAt: '2026-10-14T00:00:00.000Z',
  status: 'current', draftVersionId: null, versionNumber: 1, text: LINES.join('\n'), meter: { beats: 4, beatType: 4 }, suggestedBpm: 72,
  hasSource: false, sources: [], anchors: { measures: MEASURES }, anchorsStatus: 'ready',
} as never)

const VERSION = 'c1111111-0000-4000-8000-000000000009'
const feedView = describeToolShare({ v: 1, tool: 'chord_sheet', kind: 'chord_sheet', version_id: VERSION, title: 'Chuyến tàu hoàng hôn', composer: 'Đức Huy', meter: { beats: 4, beatType: 4 }, bpm: 72 })
const dmView = chordCardView({ version_id: VERSION, title: 'Chuyến tàu hoàng hôn', composer: 'Đức Huy', meter: { beats: 4, beatType: 4 }, bpm: 72 })

function Cards() {
  return <div className="cs-root" style={{ maxWidth: 520, margin: '0 auto', padding: 16, fontFamily: '-apple-system,system-ui,sans-serif', minHeight: '100vh' }}>
    <p><a href="#">← Play Scroll</a></p>
    <h3>Thẻ trên tường /me (Feed)</h3>
    <div className="cs-card" style={{ padding: 14 }}>
      <ToolShareBodyView view={feedView} onShareToFriend={() => undefined} />
    </div>
    <h3>Thẻ trong trò chuyện (DM)</h3>
    <div style={{ background: '#fff', borderRadius: 14, padding: 14 }}><ShareCardView view={dmView} /></div>
    <h3>Bài không còn khả dụng (chưa duyệt / đã lưu trữ)</h3>
    <div style={{ background: '#fff', borderRadius: 14, padding: 14 }}><ShareCardView view={null} /></div>
    <p style={{ color: '#8E8E93', fontSize: 13 }}>Bản thử giao diện — nút "Mở Play Scroll" dẫn tới /hopam/&lt;id&gt; trên bản thật (cần đăng nhập). Dữ liệu mẫu.</p>
  </div>
}
function Root() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => { const f = () => setHash(window.location.hash); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, [])
  if (hash === '#the') return <Cards />
  return <>
    <RhythmScrollPage library={library} versionId={VERSION} onBack={() => window.location.reload()} />
  </>
}
createRoot(document.getElementById('root')!).render(<Root />)
