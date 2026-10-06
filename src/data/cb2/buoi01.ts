// ── GUITAR CĂN BẢN 2 (CB2.T3) · BUỔI 01 — Cấu trúc bài hát & Bolero ──
// BÊ phần Bolero Owner đã duyệt ở /dieudemhat/bolero?view=sach: ký âm, ký hiệu, trường độ, giải thích đọc THẲNG từ
// src/content/dieudemhat (không chép lại). Cách 3 (điệp khúc) = file XML Owner đưa 06/10/2026 (nguồn bolero chưa có trường độ).
// Tempo bài học ♩ = 65 (giáo trình Bolero); tempo trong XML không ghi đè.
// Mạch: HỌC → ĐIỂM DỪNG TẬP → HỌC → ĐIỂM DỪNG → … → GHÉP → TRẢ BÀI.
import type { LessonDoc, LessonSection, StrumBar } from '../../lesson/lessonTypes'
import { PATTERNS } from '../../content/dieudemhat/index.ts'

// Cách 3 — phách 1 Bùm (đen) · phách 2 Chát (móc đơn chấm) + ↑ (móc kép) · phách 3 ↓ ↑ (kép) ↓ (đơn) · phách 4 Chát (đen).
const CACH3: StrumBar = {
  beatsPerBar: 4,
  beats: [
    [{ frac: 1, label: 'Bùm', act: 'bum' }],
    [{ frac: 0.75, label: 'Chát', act: 'chat' }, { frac: 0.25, label: '↑', act: 'strum', dir: 'U' }],
    [{ frac: 0.25, label: '↓', act: 'strum', dir: 'D' }, { frac: 0.25, label: '↑', act: 'strum', dir: 'U' }, { frac: 0.5, label: '↓', act: 'strum', dir: 'D' }],
    [{ frac: 1, label: 'Chát', act: 'chat' }],
  ],
}

const fromPattern = (id: string, label: string): LessonSection => {
  const p = PATTERNS[id]
  return { kind: 'strum', label, name: p.name, tempo: '♩ = 65', strum: p.strum as StrumBar, guitar: p.guitar, durations: p.durations, legend: p.legend, howTo: p.howTo }
}

const stop = (n: number, text: string): LessonSection => ({ kind: 'note', title: `✋ Điểm dừng luyện tập ${n}`, text })

export const CB2_BUOI01: LessonDoc = {
  meta: {
    programCode: 'CB2',
    programName: 'GUITAR CĂN BẢN 2',
    sessionNo: 1,
    title: 'Cấu trúc bài hát & Bolero',
    stageLabel: 'Vòng 1 · Đệm hát',
    backHref: '/me',
  },
  sections: [
    {
      kind: 'objectives',
      items: [
        'Hiểu cấu trúc cơ bản của một bài hát.',
        'Áp dụng cấu trúc đó vào đệm hát thực tế.',
        'Chơi được điệu Bolero.',
        'Dùng 3 cách đánh khác nhau cho 3 phần của bài hát.',
        'Tiến gần tới việc đệm được một bài trọn vẹn — không đánh một kiểu từ đầu đến cuối.',
      ],
    },
    // ── PHẦN 1 — CẤU TRÚC BÀI HÁT ──
    {
      kind: 'study',
      tag: 'Phần 1',
      title: 'Bài hát có cấu trúc',
      blocks: [
        { b: 'callout', label: 'ĐIỀU CẦN NHỚ', text: 'Biết một điệu chưa có nghĩa là đệm được một bài hát.' },
        { b: 'p', text: 'Lỗi rất phổ biến: học được một cách đánh rồi dùng đúng cách đó từ đầu đến cuối bài.' },
        { b: 'p', text: 'Bài hát có cấu trúc, mỗi phần có vai trò khác nhau — nên phần đệm cũng phải phát triển theo cấu trúc đó. Hôm nay bạn sẽ học ba cách đánh Bolero, rồi ghép chúng vào một bài.' },
      ],
    },
    {
      kind: 'flow',
      title: 'Công thức cả bài',
      lead: 'Ba cách đánh sẽ học ở Phần 2, dùng theo thứ tự này:',
      steps: [
        { label: 'Lời 1', value: 'Bolero Móc Kiểu 1' },
        { label: 'Lời 2', value: 'Bolero Móc Kiểu 2' },
        { label: 'Điệp khúc', value: 'Cách 3 — Quạt điệp khúc' },
        { label: 'Lời 3', value: 'Bolero Móc Kiểu 2' },
      ],
    },
    // ── PHẦN 2 — HỌC TỪNG CÁCH ──
    { kind: 'study', tag: 'Phần 2', title: 'Học từng cách', blocks: [{ b: 'p', text: 'Học và tập từng cách một. Chưa cần nhanh — cần chậm và đều.' }] },
    fromPattern('bolero-moc-1', 'Cách 1'),
    stop(1, 'Tập riêng Cách 1 cùng máy đếm nhịp, chậm và đều, không cần nhanh. Khi chơi liên tục được cả ô nhịp mới đi tiếp.'),
    fromPattern('bolero-moc-2', 'Cách 2'),
    stop(2, 'Tập riêng Cách 2. Sau đó thử chuyển Cách 1 → Cách 2 mà không dừng nhịp.'),
    {
      kind: 'strum',
      label: 'Cách 3',
      name: 'Quạt điệp khúc',
      tempo: '♩ = 65',
      strum: CACH3,
      guitar: 'Bùm – Chát – ↑ – ↓ ↑ ↓ – Chát',
      durations: 'Đen – Đơn chấm – Kép – Kép – Kép – Đơn – Đen',
      legend: 'Bùm = như tiếng kick · Chát = như tiếng snare · ↑ lên · ↓ xuống',
      howTo: 'Phách 1 là Bùm. Phách 2 và phách 4 là Chát. Giữa hai tiếng Chát là các tiếng quạt: lên – xuống lên xuống.',
    },
    stop(3, 'Tập riêng Cách 3. Sau đó thử Cách 2 → Cách 3 → Cách 2 mà không dừng nhịp.'),
    // ── PHẦN 3 — GHÉP THÀNH BÀI ──
    {
      kind: 'flow',
      title: 'Ghép thành bài',
      lead: 'Đây mới là mục tiêu chính của Buổi 01.',
      steps: [
        { label: 'Lời 1', value: 'Cách 1 — nhẹ, thoáng' },
        { label: 'Lời 2', value: 'Cách 2 — tiết tấu rõ hơn' },
        { label: 'Điệp khúc', value: 'Cách 3 — tương phản, nâng cường độ' },
        { label: 'Lời 3', value: 'Cách 2 — trở lại như Lời 2' },
      ],
      note: 'Không phải thuộc ba cách đánh, mà là biết dùng chúng để phần đệm phát triển theo bài hát. Giữ nhịp qua mỗi điểm chuyển.',
    },
    {
      kind: 'study',
      tag: 'Điểm dừng 4',
      title: '✋ Ghép một bài của bạn',
      blocks: [
        {
          b: 'ol',
          items: [
            'Chọn một bài Bolero 4/4 bạn đã biết hợp âm.',
            'Đánh dấu Lời 1 / Lời 2 / Điệp khúc / Lời 3 trên lời bài hát.',
            'Ghép các cách đệm tương ứng cho từng phần.',
            'Thử chơi liên tục, không dừng khi chuyển cách.',
          ],
        },
        { b: 'write', label: 'Bài tôi chọn · các phần · cách đánh cho từng phần', lines: 6 },
      ],
    },
    // ── PHẦN 4 — BÀI TRẢ ──
    {
      kind: 'checkpoint',
      id: '1.1',
      title: 'Đệm một bài Bolero có phát triển',
      prompt: 'Gửi video bạn đệm một bài Bolero, thể hiện: nhận biết được cấu trúc bài · có thay đổi cách đệm giữa các phần · cố gắng giữ dòng chảy bài hát · không dùng một mẫu từ đầu đến cuối. Không cần kỹ thuật hoàn hảo. Kèm một dòng: "Tôi đang gặp khó nhất ở: ______".',
      required: true,
      accepts: ['text', 'video_link'],
    },
    // ── ĐUÔI BUỔI ──
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Tập riêng từng cách: Cách 1, Cách 2, Cách 3.' },
        { label: 'Bài 2.', text: 'Chọn một bài Bolero, xác định cấu trúc và đánh dấu các phần.' },
        { label: 'Bài 3.', text: 'Chọn cách đánh cho từng phần và tập chuyển cách mà không dừng nhịp.' },
        { label: 'Bài 4.', text: 'Đệm một đoạn dài hoặc cả bài, rồi gửi Bài trả 1.1.' },
      ],
      message: 'Không cần tập hoàn hảo. Hãy mang đúng những chỗ chưa làm được đến buổi học.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi nhận biết được các phần chính của bài.',
        'Tôi chơi được các cách đánh Bolero của buổi học.',
        'Tôi biết lựa chọn cách đánh khác nhau cho từng phần.',
        'Tôi thử đệm liên tục mà không dừng khi chuyển cách.',
        'Tôi đã gửi Bài trả 1.1.',
      ],
    },
    { kind: 'studentNotes', lines: 8 },
  ],
}
