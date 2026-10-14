// STAGING nghiệm thu giao diện Rhythm Scroll. Dùng CHÍNH RhythmScrollPage + thư viện giả (mock), dữ liệu mẫu cố định.
// Không đăng nhập, không gọi Supabase, không có chức năng quản trị. Không nằm trong bundle production.
import { createRoot } from 'react-dom/client'
import '../../src/thuvien/RhythmScroll.css'
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

const library = createMockChordLibrary()
library.getChordSheet = async () => ({
  sheetId: 'demo', versionId: 'demo', title: 'Chuyến tàu hoàng hôn (bản thử)', composer: null, hasAnchors: true, updatedAt: '2026-10-14T00:00:00.000Z',
  status: 'current', draftVersionId: null, versionNumber: 1, text: LINES.join('\n'), meter: { beats: 4, beatType: 4 }, suggestedBpm: 72,
  hasSource: false, sources: [], anchors: { measures: MEASURES }, anchorsStatus: 'ready',
} as never)

createRoot(document.getElementById('root')!).render(
  <RhythmScrollPage library={library} versionId="demo" onBack={() => window.location.reload()} />)
