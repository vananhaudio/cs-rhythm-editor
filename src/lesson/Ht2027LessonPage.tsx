// ── Trang giáo trình Hành trình 2027 — route /hanhtrinh2027/buoi-NN ──
// Cùng khuôn Solo01LessonPage: chỉ chọn dữ liệu buổi học; giao diện do LessonDocument dựng.
import LessonDocument from './LessonDocument'
import LessonLocked from './LessonLocked'
import { ht2027LessonUnlock, ht2027LessonOpen } from '../data/ht2027Program'
import type { LessonDoc } from './lessonTypes'
import { HT2027_BUOI01 } from '../data/ht2027/buoi01'
import { HT2027_BUOI02 } from '../data/ht2027/buoi02'
import { HT2027_BUOI03 } from '../data/ht2027/buoi03'

// Đăng ký buổi học ở đây khi soạn (file src/data/ht2027/buoiNN.ts, meta.backHref = '/hanhtrinh2027'),
// đồng thời điền `doc` (+ `unlockAt` nếu cần) cho buổi đó trong HT2027_STAGES để landing hiện nút.
const LESSONS: Record<number, LessonDoc> = { 1: HT2027_BUOI01, 2: HT2027_BUOI02, 3: HT2027_BUOI03 }

const BACK = '/hanhtrinh2027'

export default function Ht2027LessonPage({ sessionNo }: { sessionNo: number }) {
  const doc = LESSONS[sessionNo]
  if (!doc) {
    return (
      <div style={{ fontFamily: "'Be Vietnam Pro',system-ui,sans-serif", padding: 32, textAlign: 'center' }}>
        <p style={{ color: '#3E3952' }}>Buổi {sessionNo} chưa có giáo trình.</p>
        <a href={BACK} style={{ color: '#4338CA', fontWeight: 600 }}>← Về Hành trình 2027</a>
      </div>
    )
  }
  // ?xem = lối xem trước cho thầy (khoá chỉ là khoá mềm theo lịch, không phải quyền học).
  const preview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('xem')
  const unlockAt = ht2027LessonUnlock(sessionNo)
  if (unlockAt && !ht2027LessonOpen(sessionNo) && !preview) {
    const hasPrev = !!LESSONS[sessionNo - 1]
    return (
      <LessonLocked
        sessionNo={sessionNo}
        title={doc.meta.title}
        unlockAt={unlockAt}
        prevNo={hasPrev ? sessionNo - 1 : undefined}
        prevHref={hasPrev ? `${BACK}/buoi-${String(sessionNo - 1).padStart(2, '0')}` : undefined}
        backHref={doc.meta.backHref ?? BACK}
        backLabel="HÀNH TRÌNH 2027"
      />
    )
  }
  return <LessonDocument doc={doc} />
}
