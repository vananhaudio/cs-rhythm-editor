// ── Trang bài học SOLO-01 — route /solo01/buoi-NN ──
// Chỉ làm nhiệm vụ chọn dữ liệu buổi học; giao diện do LessonDocument dựng.
import LessonDocument from './LessonDocument'
import LessonLocked from './LessonLocked'
import { soloLessonUnlock, soloLessonOpen } from '../data/solo01Program'
import type { LessonDoc } from './lessonTypes'
import { SOLO01_BUOI01 } from '../data/solo01/buoi01'
import { SOLO01_BUOI02 } from '../data/solo01/buoi02'
import { SOLO01_BUOI03 } from '../data/solo01/buoi03'
import { SOLO01_BUOI04 } from '../data/solo01/buoi04'
import { SOLO01_BUOI05 } from '../data/solo01/buoi05'

// Đăng ký buổi học ở đây khi soạn thêm (Buổi 02 → 24 dùng CHUNG khuôn LessonDocument).
const LESSONS: Record<number, LessonDoc> = { 1: SOLO01_BUOI01, 2: SOLO01_BUOI02, 3: SOLO01_BUOI03, 4: SOLO01_BUOI04, 5: SOLO01_BUOI05 }

export default function Solo01LessonPage({ sessionNo }: { sessionNo: number }) {
  const doc = LESSONS[sessionNo]
  if (!doc) {
    return (
      <div style={{ fontFamily: "'Be Vietnam Pro',system-ui,sans-serif", padding: 32, textAlign: 'center' }}>
        <p style={{ color: '#3E3952' }}>Buổi {sessionNo} chưa có tài liệu học.</p>
        <a href="/solo01" style={{ color: '#4338CA', fontWeight: 600 }}>← Về chương trình SOLO-01</a>
      </div>
    )
  }
  // Buổi chưa tới giờ mở: vẫn vào được, nhưng thấy màn khoá thay vì tài liệu.
  // Thêm ?xem vào địa chỉ để BỎ QUA khoá — lối xem trước cho thầy soát nội dung.
  // (Khoá này vốn là khoá mềm theo lịch, không phải quyền học.)
  const preview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('xem')
  const unlockAt = soloLessonUnlock(sessionNo)
  if (unlockAt && !soloLessonOpen(sessionNo) && !preview) {
    return (
      <LessonLocked
        sessionNo={sessionNo}
        title={doc.meta.title}
        unlockAt={unlockAt}
        prevNo={LESSONS[sessionNo - 1] ? sessionNo - 1 : undefined}
        prevHref={LESSONS[sessionNo - 1] ? `/solo01/buoi-${String(sessionNo - 1).padStart(2, '0')}` : undefined}
        backHref={doc.meta.backHref ?? '/solo01'}
      />
    )
  }

  return <LessonDocument doc={doc} />
}
