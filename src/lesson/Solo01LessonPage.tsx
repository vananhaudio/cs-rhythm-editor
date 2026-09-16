// ── Trang bài học SOLO-01 — route /solo01/buoi-NN ──
// Chỉ làm nhiệm vụ chọn dữ liệu buổi học; giao diện do LessonDocument dựng.
import LessonDocument from './LessonDocument'
import type { LessonDoc } from './lessonTypes'
import { SOLO01_BUOI01 } from '../data/solo01/buoi01'
import { SOLO01_BUOI02 } from '../data/solo01/buoi02'

// Đăng ký buổi học ở đây khi soạn thêm (Buổi 02 → 24 dùng CHUNG khuôn LessonDocument).
const LESSONS: Record<number, LessonDoc> = { 1: SOLO01_BUOI01, 2: SOLO01_BUOI02 }

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
  return <LessonDocument doc={doc} />
}
