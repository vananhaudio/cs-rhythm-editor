// ── GUITAR CĂN BẢN 2 (CB2.T3) · BUỔI 01 — Cấu trúc bài hát & Bolero ──
// TÁI SỬ DỤNG nguồn Bolero của Owner (src/content/dieudemhat): âm hình, cường độ từng phần, bài tập.
// KHÔNG tạo cách đánh mới. Chỉ Cách 3 (mẫu điệp khúc) thiếu trường độ trong nguồn — lấy từ file XML Owner đưa 06/10/2026
// (Bùm | Chát + lên | xuống lên xuống | Chát). Không dùng bất kỳ nội dung nào của trang Ballad.
import type { LessonDoc, StudyBlock } from '../../lesson/lessonTypes'
import { PATTERNS, SECTION_LABEL, type StrumNotation } from '../../content/dieudemhat/index.ts'
import { BOLERO } from '../../content/dieudemhat/bolero.ts'
import { DEFAULT_CUE, DEFAULT_TASK } from '../../dieudemhat/pacing'

// Cách 3 — mẫu điệp khúc: trường độ theo XML của Owner (♩ = 70).
// phách 1 Bùm (đen) · phách 2 Chát (móc đơn chấm) + lên (móc kép) · phách 3 xuống (kép) lên (kép) xuống (đơn) · phách 4 Chát (đen).
const CACH3_STRUM: StrumNotation = {
  beatsPerBar: 4,
  beats: [
    [{ frac: 1, label: 'Bùm', act: 'bum' }],
    [{ frac: 0.75, label: 'Chát', act: 'chat' }, { frac: 0.25, label: 'lên', act: 'strum', dir: 'U' }],
    [{ frac: 0.25, label: 'xuống', act: 'strum', dir: 'D' }, { frac: 0.25, label: 'lên', act: 'strum', dir: 'U' }, { frac: 0.5, label: 'xuống', act: 'strum', dir: 'D' }],
    [{ frac: 1, label: 'Chát', act: 'chat' }],
  ],
}

const FRAC: Record<string, string> = { '1': 'đen', '0.75': 'móc đơn chấm', '0.5': 'móc đơn', '0.25': 'móc kép' }

/** Bảng 4 phách từ chính dữ liệu ký âm: hàng "Đánh" + hàng "Trường độ". */
function strumTable(strum: StrumNotation): StudyBlock {
  const beats = strum.beats
  return {
    b: 'table',
    rows: [
      ['Phách', ...beats.map((_, i) => String(i + 1))],
      ['Đánh', ...beats.map(b => b.map(e => e.label ?? '').join(' · '))],
      ['Trường độ', ...beats.map(b => b.map(e => FRAC[String(e.frac)] ?? String(e.frac)).join(' · '))],
    ],
  }
}

const kieu1 = PATTERNS['bolero-moc-1']
const kieu2 = PATTERNS['bolero-moc-2']
const CACH: { no: number; name: string; strum: StrumNotation; note: string; how: string; task: string }[] = [
  { no: 1, name: kieu1.name, strum: kieu1.strum!, note: `${kieu1.legend}`, how: kieu1.howTo, task: DEFAULT_TASK(`Cách 1 (${kieu1.name})`) },
  { no: 2, name: kieu2.name, strum: kieu2.strum!, note: `${kieu2.legend}`, how: kieu2.howTo, task: DEFAULT_TASK(`Cách 2 (${kieu2.name})`) },
  {
    no: 3, name: 'Quạt điệp khúc', strum: CACH3_STRUM,
    note: 'Viết gọn: Bùm – Chát – lên – xuống lên xuống – Chát · ♩ = 70',
    how: 'Phách 1 là Bùm (như tiếng kick). Phách 2 và phách 4 là Chát (như tiếng snare). Giữa hai tiếng Chát là các tiếng quạt: lên – xuống lên xuống.',
    task: DEFAULT_TASK('Cách 3 (Quạt điệp khúc)'),
  },
]

// Cách nào đệm cho phần nào — lấy từ công thức Bolero của Owner (BOLERO.sections).
const cachOf = (id: string) => (id === kieu1.id ? 1 : id === kieu2.id ? 2 : 3)
const roleOf: Record<string, string> = {
  loi1: 'Phần nhẹ — mở đầu, đệm đơn giản',
  loi2: 'Phần phát triển — tiết tấu rõ hơn',
  diepkhuc: 'Phần cao trào — tương phản, đệm đầy hơn',
  loi3: 'Trở lại phần phát triển',
}
const ghepRows: string[][] = [
  ['Phần của bài', 'Vai trò', 'Cách đánh'],
  ...BOLERO.sections.map(s => [
    SECTION_LABEL[s.kind],
    roleOf[s.kind],
    s.reuseOf ? `Cách ${cachOf(s.patterns[0])} (như ${SECTION_LABEL[s.reuseOf]})` : `Cách ${cachOf(s.patterns[0])}`,
  ]),
]

const cachBlocks: StudyBlock[] = CACH.flatMap((c): StudyBlock[] => [
  { b: 'h', text: `Cách ${c.no} — ${c.name}` },
  strumTable(c.strum),
  { b: 'p', text: c.note },
  { b: 'p', text: c.how },
  { b: 'callout', label: `TẬP RIÊNG CÁCH ${c.no}`, text: `${c.task} ${DEFAULT_CUE}` },
])

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
    {
      kind: 'study',
      tag: 'Phần 1',
      title: 'Bài hát có cấu trúc',
      blocks: [
        { b: 'callout', label: 'ĐIỀU CẦN NHỚ', text: 'Biết một điệu chưa có nghĩa là đệm được một bài hát.' },
        { b: 'p', text: 'Lỗi rất phổ biến: học được một cách đánh rồi dùng đúng cách đó từ đầu đến cuối bài.' },
        { b: 'p', text: 'Hôm nay bắt đầu một cách nghĩ khác: bài hát có cấu trúc → mỗi phần có vai trò khác nhau → phần đệm cũng cần thay đổi theo.' },
      ],
    },
    {
      kind: 'study',
      tag: 'Phần 2',
      title: 'Ba cách đệm Bolero',
      blocks: [
        { b: 'p', text: 'Bolero 4/4. Phách 1 chia thành một móc đơn và hai móc kép; các phách còn lại mỗi phách hai móc đơn (Cách 1 và Cách 2).' },
        ...cachBlocks,
      ],
    },
    {
      kind: 'study',
      tag: 'Phần 3',
      title: 'Ghép ba cách vào cấu trúc bài hát',
      blocks: [
        { b: 'p', text: 'Ba cách đánh không phải ba bài tập rời. Dùng chúng để bài hát đi lên: nhẹ → phát triển → cao trào.' },
        { b: 'table', rows: ghepRows },
        { b: 'callout', label: 'KHI CHUYỂN CÁCH', text: 'Giữ nhịp qua điểm chuyển. Tập riêng chỗ chuyển giữa hai phần cùng máy đếm nhịp.' },
        { b: 'p', text: 'Bài của bạn có thể chia phần khác (ví dụ thêm đoạn dạo, đoạn chuyển). Nguyên tắc vẫn vậy: phần nhẹ đệm đơn giản, phần phát triển tăng mức độ, phần cao trào đệm đầy hơn.' },
      ],
    },
    {
      kind: 'study',
      tag: 'Phần 4',
      title: 'Thực hành',
      blocks: [
        { b: 'p', text: BOLERO.exercise ?? '' },
        {
          b: 'ol',
          items: [
            'Chọn một bài Bolero phù hợp với bạn.',
            'Xác định cấu trúc bài: đâu là phần nhẹ, đâu là phần phát triển, đâu là cao trào.',
            'Đánh dấu các phần trên lời bài hát hoặc bản hợp âm.',
            'Chọn Cách 1, 2 hoặc 3 cho từng phần.',
            'Tập chuyển giữa các cách mà không dừng nhịp.',
            'Thử đệm một đoạn dài, hoặc cả bài tuỳ trình độ của bạn.',
          ],
        },
        { b: 'write', label: 'Bài tôi chọn · các phần · cách đánh cho từng phần', lines: 6 },
      ],
    },
    {
      kind: 'checkpoint',
      id: '1.1',
      title: 'Đệm một bài Bolero có phát triển',
      prompt: 'Gửi video bạn đệm một bài Bolero, thể hiện việc dùng các cách đánh khác nhau cho các phần khác nhau của bài. Không cần kỹ thuật hoàn hảo — điều thầy muốn thấy: bạn hiểu cấu trúc bài, giữ được dòng chảy bài hát, biết thay đổi cách đệm, và không đánh một mẫu duy nhất từ đầu đến cuối. Kèm một dòng: "Tôi đang gặp khó nhất ở: ______".',
      required: true,
      accepts: ['text', 'video_link'],
    },
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
