// ── GUITAR CĂN BẢN 1 (CB1.T3) · BUỔI 03 — 6 hợp âm cơ bản tông C/Am · Chuyển cặp & vòng hợp âm ──
// BẢN NHÁP ĐỂ OWNER DUYỆT (12/10/2026). Owner chốt 6 hợp âm: C, Dm, Em, F, G, Am (thuận cung C trưởng / Am thứ).
// CÁC LỰA CHỌN SƯ PHẠM DƯỚI ĐÂY LÀ GIẢ ĐỊNH CỦA CLAUDE — Owner cần xác nhận hoặc sửa:
//   1. Thế bấm (ngón tay trái; dây 1 = Mi cao, ngăn 0 = dây buông):
//        C  x32010  ngón 3 d5n3 · ngón 2 d4n2 · ngón 1 d2n1          gảy d5→d1
//        Am x02210  ngón 2 d4n2 · ngón 3 d3n2 · ngón 1 d2n1          gảy d5→d1
//        Dm xx0231  ngón 2 d3n2 · ngón 3 d2n3 · ngón 1 d1n1          gảy d4→d1
//        Em 022000  ngón 2 d5n2 · ngón 3 d4n2                        gảy d6→d1
//        G  320003  ngón 2 d6n3 · ngón 1 d5n2 · ngón 3 d1n3          gảy d6→d1
//        F  xx3211  ngón 3 d4n3 · ngón 2 d3n2 · ngón 1 d2n1+d1n1 (chặn 2 dây)   gảy d4→d1   ← F ĐƠN GIẢN, chưa phải F chặn 6 dây
//   2. Sáu cặp chuyển: C–Am · Am–F · F–G · G–C · Am–Dm · Dm–G (đủ để đi hết hai vòng dưới đây).
//   3. Hai vòng: C–Am–F–G  và  Am–Dm–G–C.  Mỗi hợp âm 4 phách, đánh xuống một lần mỗi phách (chưa dạy điệu — để Buổi 04).
// Chỉ bài trả văn bản/video (không trắc nghiệm → không cần đáp án server). Tối đa 1 video/buổi (3.2).
import type { FretDot, FretZone, LessonDoc } from '../../lesson/lessonTypes'

const Z: FretZone[] = [
  { no: 1, label: 'Ngón tay trái', tag: '', fromFret: 0, toFret: 3, strings: [1, 6], color: '#4338CA', hidden: true, hint: 'số trong chấm là ngón tay trái.' },
]
const f = (string: number, fret: number, finger: number, root = false): FretDot => ({ string, fret, name: String(finger), zone: 1, root })

const LEGEND_NGON = ['Số trong chấm = ngón tay trái: 1 trỏ · 2 giữa · 3 áp út', 'Dây không có chấm ở ngăn nào là dây buông (đàn không bấm).']

export const CB1_BUOI03: LessonDoc = {
  meta: {
    programCode: 'CB1',
    programName: 'GUITAR CĂN BẢN 1',
    sessionNo: 3,
    title: '6 hợp âm cơ bản tông C/Am — Chuyển cặp & vòng hợp âm',
    stageLabel: 'Vòng 1 · Học đàn bằng nốt nhạc',
    backHref: '/me',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Từ nốt nhạc sang hợp âm',
      steps: [
        { label: 'Buổi 01–02', items: ['Bạn đọc và chơi từng nốt trong 3 ngăn đầu, kể cả nốt ♯ / ♭.'] },
        { label: 'Buổi 03', items: ['Hợp âm là nhiều nốt vang cùng lúc. Bạn học 6 hợp âm quanh tông C / Am, chuyển giữa chúng, và nối thành vòng.'] },
      ],
      message: 'Cả 6 hợp âm đều nằm trong 3 ngăn đầu bạn đã quen.',
    },
    {
      kind: 'objectives',
      items: [
        'Bấm đúng 6 hợp âm: C, Am, Dm, Em, G, F.',
        'Chuyển được giữa các cặp hợp âm thường gặp, không dừng nhịp.',
        'Chơi được một vòng hợp âm: mỗi hợp âm 4 phách, đều nhịp.',
        'Hiểu vì sao 6 hợp âm này hay đi cùng nhau.',
      ],
    },
    // ── NHỊP 1 — 6 HỢP ÂM ──
    {
      kind: 'note',
      title: 'Nhịp 1 · Sáu hợp âm cơ bản',
      text: 'Bấm từng hợp âm, gảy từng dây một để nghe có dây nào bị rè hoặc tịt tiếng. Chưa cần chuyển nhanh. Kết thúc nhịp: Bài trả 3.1.',
    },
    {
      kind: 'study',
      tag: 'Phần 1',
      title: 'Vì sao là 6 hợp âm này',
      blocks: [
        { b: 'p', text: 'C, Dm, Em, F, G, Am là sáu hợp âm tạo từ chính các nốt tự nhiên bạn đã học ở Buổi 01. Vì vậy chúng đi cùng nhau rất tự nhiên: C trưởng và Am thứ dùng chung bộ nốt này.' },
        { b: 'callout', label: 'ĐIỀU CẦN NHỚ', text: 'Bấm gọn, ngón gần ngăn đàn, không chạm các dây bên cạnh. Gảy từng dây để kiểm tra trước khi đánh cả hợp âm.' },
      ],
    },
    {
      kind: 'fretboard',
      title: 'Hợp âm C',
      lead: 'Gảy từ dây 5 đến dây 1. Dây 6 không đàn.',
      frets: 3,
      zones: Z,
      dots: [f(5, 3, 3, true), f(4, 2, 2), f(2, 1, 1)],
      legend: LEGEND_NGON,
    },
    {
      kind: 'fretboard',
      title: 'Hợp âm Am',
      lead: 'Gảy từ dây 5 đến dây 1. Dây 6 không đàn.',
      frets: 3,
      zones: Z,
      dots: [f(4, 2, 2), f(3, 2, 3), f(2, 1, 1)],
      legend: LEGEND_NGON,
    },
    {
      kind: 'fretboard',
      title: 'Hợp âm Dm',
      lead: 'Gảy từ dây 4 đến dây 1. Dây 6 và dây 5 không đàn.',
      frets: 3,
      zones: Z,
      dots: [f(3, 2, 2), f(2, 3, 3), f(1, 1, 1)],
      legend: LEGEND_NGON,
    },
    {
      kind: 'fretboard',
      title: 'Hợp âm Em',
      lead: 'Gảy cả 6 dây.',
      frets: 3,
      zones: Z,
      dots: [f(5, 2, 2), f(4, 2, 3)],
      legend: LEGEND_NGON,
    },
    {
      kind: 'fretboard',
      title: 'Hợp âm G',
      lead: 'Gảy cả 6 dây.',
      frets: 3,
      zones: Z,
      dots: [f(6, 3, 2, true), f(5, 2, 1), f(1, 3, 3)],
      legend: LEGEND_NGON,
    },
    {
      kind: 'fretboard',
      title: 'Hợp âm F (bản đơn giản)',
      lead: 'Gảy từ dây 4 đến dây 1. Ngón 1 chặn cùng lúc dây 2 và dây 1 ở ngăn 1.',
      frets: 3,
      zones: Z,
      dots: [f(4, 3, 3, true), f(3, 2, 2), f(2, 1, 1), f(1, 1, 1)],
      legend: LEGEND_NGON,
    },
    {
      kind: 'checkpoint',
      id: '3.1',
      title: 'Bài trả 3.1 — Sáu hợp âm',
      prompt: 'Chọn 3 trong 6 hợp âm. Với mỗi hợp âm, viết: tên hợp âm, những dây bạn gảy, và ngón tay trái đặt ở đâu (ví dụ: C — gảy dây 5 đến dây 1; ngón 3 dây 5 ngăn 3…). Sau đó bấm từng hợp âm và gảy từng dây để chắc không dây nào rè. Kèm một dòng: hợp âm nào bạn thấy khó nhất? Không cần video.',
      required: true,
      accepts: ['text'],
    },
    // ── NHỊP 2 — CHUYỂN CẶP & VÒNG HỢP ÂM ──
    {
      kind: 'note',
      title: 'Nhịp 2 · Chuyển cặp và vòng hợp âm',
      text: 'Biết bấm từng hợp âm chưa đủ: bài hát luôn đổi hợp âm. Tập chuyển từng cặp thật chậm, rồi nối thành vòng. Kết thúc nhịp: Bài trả 3.2.',
    },
    {
      kind: 'study',
      tag: 'Phần 2',
      title: 'Chuyển cặp hợp âm',
      blocks: [
        { b: 'p', text: 'Tập mỗi cặp theo cả hai chiều. Nhìn trước vị trí ngón tay đầu tiên của hợp âm kế, rồi đổi cùng lúc cả bàn tay — không bấm từng ngón một.' },
        {
          b: 'table',
          rows: [
            ['Cặp', 'Gợi ý khi chuyển'],
            ['C ↔ Am', 'Ngón 1 đứng yên ở dây 2 ngăn 1; chỉ hai ngón còn lại di chuyển.'],
            ['Am ↔ F', 'Ngón 1 vẫn ở dây 2 ngăn 1; thêm ngón 1 chặn luôn dây 1.'],
            ['F ↔ G', 'Khác hẳn vị trí — tập chậm, nhìn trước ngăn của ngón đầu tiên.'],
            ['G ↔ C', 'Khác hẳn vị trí — tập chậm, nhìn trước ngăn của ngón đầu tiên.'],
            ['Am ↔ Dm', 'Cùng quanh ngăn 1–3; chuyển ngón 1 lên dây 1.'],
            ['Dm ↔ G', 'Tập chậm, nhìn trước ngăn của ngón đầu tiên.'],
          ],
        },
        { b: 'callout', label: 'ĐIỀU CẦN NHỚ', text: 'Chậm và đều tốt hơn nhanh mà vấp. Giữ nhịp: hợp âm mới phải vào đúng phách, kể cả khi bạn bấm chưa hoàn hảo.' },
      ],
    },
    {
      kind: 'study',
      tag: 'Phần 3',
      title: 'Vòng hợp âm',
      blocks: [
        { b: 'p', text: 'Vòng hợp âm là chuỗi hợp âm lặp đi lặp lại — nền của rất nhiều bài hát. Mỗi hợp âm 4 phách: đánh xuống một lần ở mỗi phách và đếm 1 – 2 – 3 – 4.' },
        { b: 'h', text: 'Vòng 1' },
        { b: 'p', text: 'C – Am – F – G (rồi quay lại C).' },
        { b: 'h', text: 'Vòng 2' },
        { b: 'p', text: 'Am – Dm – G – C (rồi quay lại Am).' },
        { b: 'p', text: 'Tập mỗi vòng với máy đếm nhịp chậm. Khi đi trọn vòng 4 lần liên tục không dừng, bạn đã sẵn sàng đệm hát.' },
      ],
    },
    {
      kind: 'checkpoint',
      id: '3.2',
      title: 'Bài trả 3.2 — Vòng hợp âm',
      prompt: 'Quay video bạn chơi Vòng 1 (C – Am – F – G) liên tục ít nhất 4 vòng, mỗi hợp âm 4 phách, đánh xuống mỗi phách. Thầy xem: đúng hợp âm · đúng nhịp · không dừng khi đổi hợp âm. Kèm một dòng: "Cặp tôi còn vấp nhất là ______".',
      required: true,
      accepts: ['text', 'video_link'],
    },
    // ── ĐUÔI BUỔI ──
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Mỗi ngày bấm lần lượt 6 hợp âm, gảy từng dây để kiểm tra.' },
        { label: 'Bài 2.', text: 'Tập từng cặp hợp âm theo hai chiều, chậm và đều, với máy đếm nhịp.' },
        { label: 'Bài 3.', text: 'Chơi Vòng 1 rồi Vòng 2 liên tục, không dừng khi đổi hợp âm.' },
      ],
      message: 'Không cần tập hoàn hảo. Hãy mang đúng những cặp chưa chuyển được đến buổi học.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi bấm được 6 hợp âm C, Am, Dm, Em, G, F.',
        'Tôi chuyển được giữa các cặp hợp âm mà không dừng nhịp.',
        'Tôi chơi được Vòng 1 và Vòng 2.',
        'Tôi đã gửi Bài trả 3.1 và 3.2.',
      ],
    },
    { kind: 'studentNotes', lines: 8 },
  ],
}
