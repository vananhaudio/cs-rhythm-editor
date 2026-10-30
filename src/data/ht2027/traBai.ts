// ── HÀNH TRÌNH 2027 — BÀI TRẢ ĐỀ XUẤT cho Buổi 01–08 (30/10/2026, Claude soạn, CHỜ THẦY DUYỆT) ──
// KHÔNG nối vào programTemplates / không đổi file giáo án đã duyệt (buoi01–08.ts nguyên vẹn): đây là lớp phủ tuỳ chọn, ghép lúc xuất bản.
// Nguồn lời nhắc: CHÍNH câu "NHIỆM VỤ CUỐI TUẦN / CUỐI CHẶNG" mà Thầy đã viết trong từng buổi (chép nguyên văn bằng script), KHÔNG tự sáng tác.
// Mỗi buổi 1 bài trả đặt NGAY SAU mục "Ngày 7" (nơi học viên đang được yêu cầu nộp bài). Nộp: link video và/hoặc chữ (V1 chưa nhận file).
// required: true = tính vào "hoàn thành buổi" (chỉ để ghi nhận/nhãn). Với lớp có unlock_policy = 'open' KHÔNG khoá buổi nào dù chưa nộp.
// ⚠️ Chỉ dùng cho lớp 'open' (xem docs/CLASS-UNLOCK-POLICY-V1.md). Dùng cho lớp 'sequential' sẽ khoá chuỗi buổi.
import type { CheckpointSection, LessonDoc, LessonSection } from '../../lesson/lessonTypes'

export const HT2027_TRA_BAI: Record<number, CheckpointSection> = {
  1: { kind: 'checkpoint', id: '1.1', title: "Hồ sơ giọng trưởng + video", required: true, accepts: ['video_link', 'text'],
    prompt: "Hoàn thành một hồ sơ ngắn cho một giọng trưởng do bạn tự chọn, sau đó quay video 60–90 giây chứng minh bạn hiểu và chơi được." },
  2: { kind: 'checkpoint', id: '2.1', title: "Chơi, nghe, nói và đặt câu hỏi", required: true, accepts: ['text', 'video_link'],
    prompt: "Chơi, nghe, nói và đặt câu hỏi. Chưa hiểu hết vẫn hoàn toàn bình thường; điều quan trọng là bạn mang tới lớp một vấn đề thật đã được thử trên đàn." },
  3: { kind: 'checkpoint', id: '3.1', title: "Bản phân tích 8–16 ô nhịp", required: true, accepts: ['video_link', 'text'],
    prompt: "Chọn 8–16 ô nhịp của một bài quen. Tạo một bản phân tích đủ rõ để người khác có thể đọc, chơi lại và phản biện." },
  4: { kind: 'checkpoint', id: '4.1', title: "Dịch giọng cho một bài quen", required: true, accepts: ['video_link', 'text'],
    prompt: "Chọn 8–16 ô nhịp của một bài quen. Dịch sang 2 giọng khác nhau và chọn ra giọng hợp nhất với người hát — có thể là chính bạn." },
  5: { kind: 'checkpoint', id: '5.1', title: "Hai phương án thay thế", required: true, accepts: ['video_link', 'text'],
    prompt: "Chọn 8–16 ô nhịp của một bài quen. Tìm 2 phương án thay thế khác nhau và chọn ra phương án bạn muốn dùng — kèm lý do." },
  6: { kind: 'checkpoint', id: '6.1', title: "Đường bass và hợp âm đảo", required: true, accepts: ['video_link', 'text'],
    prompt: "Chọn 8–16 ô nhịp của một bài quen. Thiết kế một đường bass đi mượt, thêm ít nhất 2 hợp âm đảo có lý do, rồi chơi và thu lại." },
  7: { kind: 'checkpoint', id: '7.1', title: "Bản phối hoàn chỉnh", required: true, accepts: ['video_link', 'text'],
    prompt: "Nộp một bản phối hoàn chỉnh cho 8–16 ô nhịp (đoạn hát + điệp khúc), kèm nhật ký quyết định và video ngắn." },
  8: { kind: 'checkpoint', id: '8.1', title: "Sản phẩm cuối Chặng 1", required: true, accepts: ['video_link', 'text'],
    prompt: "Nộp sản phẩm cuối Chặng 1: phiếu sản phẩm + video + câu hỏi cho Chặng 2. Đây là bước chốt lại bảy buổi." },
}

/** Ghép bài trả vào MỘT bản sao của giáo án (không sửa bản gốc). Đặt ngay sau mục có tag 'Ngày 7'; không có thì đặt trước hai mục cuối (tự kiểm tra + đáp án). */
export function withTraBai(doc: LessonDoc, sessionNo: number): LessonDoc {
  const cp = HT2027_TRA_BAI[sessionNo]
  if (!cp) return doc
  const sections: LessonSection[] = [...doc.sections]
  const i = sections.findIndex(s => s.kind === 'study' && (s as { tag?: string }).tag === 'Ngày 7')
  sections.splice(i >= 0 ? i + 1 : Math.max(0, sections.length - 2), 0, { ...cp })
  return { ...doc, sections }
}
