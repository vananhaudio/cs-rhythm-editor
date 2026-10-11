// ── GUITAR CĂN BẢN 2 (CB2.T3) · BUỔI 03 — Đệm hoàn chỉnh một bài & Ballad ──
// BẢN NHÁP ĐỂ OWNER DUYỆT (12/10/2026). Buổi 03 = TỔNG HỢP Buổi 01 (cấu trúc bài) + Buổi 02 (chọn tông) vào một bài trọn vẹn,
// qua điệu Ballad. Ký âm Ballad đọc THẲNG từ src/content/dieudemhat. Điệp khúc có HAI phong cách (Owner 12/10/2026):
// cổ điển = Quạt Chùm 4; acoustic = Quạt Ballad Acoustic = Cách 3 của Bolero (Buổi 01) — cùng một nguồn.
// KHÔNG tự viết đặc điểm/cảm giác Ballad (Owner chưa đưa). Tempo: chỉ ghi khi nguồn có (acoustic ♩=65).
// Mạch: HỌC → ĐIỂM DỪNG → … → BÀI TRẢ 3.1 (trắc nghiệm) → GHÉP → BÀI TRẢ 3.2 (video).
// Đáp án trắc nghiệm 3.1 KHÔNG nằm ở đây (server — class_checkpoint_keys; nguồn soạn ở repo private).
import type { LessonDoc, LessonSection, StrumBar } from '../../lesson/lessonTypes'
import { PATTERNS } from '../../content/dieudemhat/index.ts'

const fromPattern = (id: string, label: string): LessonSection => {
  const p = PATTERNS[id]
  return { kind: 'strum', label, name: p.name, tempo: p.tempo, strum: p.strum as StrumBar, guitar: p.guitar, durations: p.durations, legend: p.legend, howTo: p.howTo }
}

const stop = (n: number, text: string): LessonSection => ({ kind: 'note', title: `✋ Điểm dừng luyện tập ${n}`, text })

export const CB2_BUOI03: LessonDoc = {
  meta: {
    programCode: 'CB2',
    programName: 'GUITAR CĂN BẢN 2',
    sessionNo: 3,
    title: 'Đệm hoàn chỉnh một bài & Ballad',
    stageLabel: 'Vòng 1 · Đệm hát',
    backHref: '/me',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Hai buổi trước gộp lại',
      steps: [
        { label: 'Buổi 01', items: ['Bài hát có cấu trúc; mỗi phần một cách đánh.'] },
        { label: 'Buổi 02', items: ['Chọn tông vừa giọng hát; ghép Slow Rock theo cấu trúc bài.'] },
        { label: 'Buổi 03', items: ['Ghép cả hai thành MỘT bài trọn vẹn: có cấu trúc, đúng tông, đúng điệu — với điệu Ballad.'] },
      ],
    },
    {
      kind: 'objectives',
      items: [
        'Nắm quy trình đệm hoàn chỉnh một bài hát: cấu trúc → tông → điệu → cách đánh từng phần.',
        'Phát triển phần đệm theo từng phần của bài.',
        'Chơi được điệu Ballad: Móc Chùm 2, Móc Chùm 4 và quạt điệp khúc (cổ điển hoặc acoustic).',
        'Đệm trọn một bài Ballad ở tông vừa giọng mình.',
      ],
    },
    // ── PHẦN 1 — QUY TRÌNH ĐỆM MỘT BÀI ──
    {
      kind: 'study',
      tag: 'Phần 1',
      title: 'Quy trình đệm một bài hoàn chỉnh',
      blocks: [
        { b: 'callout', label: 'ĐIỀU CẦN NHỚ', text: 'Đệm một bài không bắt đầu từ cách đánh. Bắt đầu từ bài hát: nó có những phần nào, người hát cần tông nào.' },
        {
          b: 'ol',
          items: [
            'Nghe/hát bài, xác định cấu trúc: Lời 1, Lời 2, Điệp khúc, Lời 3.',
            'Chọn tông vừa giọng người hát (capo nếu cần).',
            'Chọn điệu cho bài.',
            'Gán cách đánh cho từng phần — nhẹ ở đầu, rõ hơn ở giữa, tương phản ở điệp khúc.',
            'Chơi liên tục, giữ nhịp qua mọi điểm chuyển.',
          ],
        },
        { b: 'p', text: 'Đây là điều bạn đã làm từng phần ở hai buổi trước. Hôm nay làm trọn cả năm bước trong một bài.' },
      ],
    },
    // ── PHẦN 2 — BALLAD ──
    {
      kind: 'study',
      tag: 'Phần 2',
      title: 'Điệu Ballad',
      blocks: [
        { b: 'p', text: 'Ballad đi theo nhịp 4/4. Công thức cho cả bài: tiếng đàn dày dần lên — Chùm 2, rồi Chùm 4, tới điệp khúc thì chuyển sang quạt.' },
        { b: 'callout', label: 'CÔNG THỨC', text: 'Lời 1: Móc Chùm 2 · Lời 2: Móc Chùm 4 · Điệp khúc: quạt (cổ điển hoặc acoustic) · Lời 3: trở lại Móc Chùm 4.' },
        { b: 'p', text: 'Điệp khúc có hai phong cách để chọn: cổ điển — Quạt Chùm 4 (mỗi phách quạt 4 tiếng đều, cùng nhịp chia với Móc Chùm 4); hoặc acoustic ballad — chính là cách đánh Cách 3 của Bolero ở Buổi 01.' },
      ],
    },
    fromPattern('ballad-moc-chum-2', 'Cách 1'),
    stop(1, 'Tập riêng Móc Chùm 2 với máy đếm nhịp chậm. Mỗi phách móc hai lần đều nhau. Khi chơi liên tục được cả ô nhịp mới đi tiếp.'),
    fromPattern('ballad-moc-chum-4', 'Cách 2'),
    stop(2, 'Tập riêng Móc Chùm 4: mỗi phách móc bốn lần đều nhau. Sau đó thử Chùm 2 → Chùm 4 mà không dừng nhịp.'),
    fromPattern('quat-chum-4', 'Cách 3a (điệp khúc) — cổ điển'),
    fromPattern('quat-acoustic-ballad', 'Cách 3b (điệp khúc) — acoustic'),
    stop(3, 'Cách 3a: quạt 4 tiếng đều mỗi phách, giữ nhịp thật đều. Cách 3b: chính là Cách 3 của Bolero — bạn đã tập ở Buổi 01. Chọn MỘT phong cách cho điệp khúc rồi tập riêng. Sau đó thử Chùm 4 → Quạt → Chùm 4 mà không dừng nhịp.'),
    // ── BÀI TRẢ 3.1 — KIẾN THỨC (trắc nghiệm) ──
    {
      kind: 'checkpoint',
      id: '3.1',
      title: 'Bài trả 3.1 — Công thức đệm một bài Ballad',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Theo công thức Ballad của buổi học, Lời 3 nên đệm bằng cách nào?',
        options: [
          { id: 'a', text: 'Móc Chùm 2, giống Lời 1.' },
          { id: 'b', text: 'Móc Chùm 4, trở lại cách đệm của Lời 2.' },
          { id: 'c', text: 'Quạt Ballad, giống điệp khúc.' },
          { id: 'd', text: 'Một cách hoàn toàn mới, khác mọi phần trước.' },
        ],
        hint: 'Lời 3 trở lại như Lời 2 — đó là cách bài hát "hạ xuống" sau điệp khúc.',
      },
    },
    // ── PHẦN 3 — GHÉP THÀNH BÀI ──
    {
      kind: 'flow',
      title: 'Ghép thành bài',
      lead: 'Đây là mục tiêu chính của Buổi 03.',
      steps: [
        { label: 'Lời 1', value: 'Móc Chùm 2 — nhẹ, thoáng' },
        { label: 'Lời 2', value: 'Móc Chùm 4 — tăng mật độ nốt, tiết tấu rõ hơn' },
        { label: 'Điệp khúc', value: 'Quạt Chùm 4 (cổ điển) hoặc Quạt Ballad Acoustic — tương phản, nâng cường độ' },
        { label: 'Lời 3', value: 'Móc Chùm 4 — trở lại như Lời 2' },
      ],
      note: 'Điệp khúc lặp lại thì dùng lại mẫu quạt đã chọn. Giữ nhịp qua mỗi điểm chuyển.',
    },
    {
      kind: 'study',
      tag: 'Điểm dừng 4',
      title: '✋ Làm đủ năm bước với một bài Ballad',
      blocks: [
        {
          b: 'ol',
          items: [
            'Chọn một bài Ballad 4/4 bạn đã biết hợp âm.',
            'Xác định và đánh dấu các phần: Lời 1 / Lời 2 / Điệp khúc / Lời 3.',
            'Tìm tông (capo) vừa giọng bạn.',
            'Gán Móc Chùm 2 / Móc Chùm 4 / kiểu quạt điệp khúc đã chọn cho từng phần.',
            'Chơi liên tục, vừa đệm vừa hát, không dừng khi chuyển cách.',
          ],
        },
        { b: 'write', label: 'Bài tôi chọn · ngăn capo · cách đánh từng phần', lines: 6 },
      ],
    },
    // ── BÀI TRẢ 3.2 — THỰC HÀNH TỔNG HỢP (video, duy nhất trong buổi) ──
    {
      kind: 'checkpoint',
      id: '3.2',
      title: 'Bài trả 3.2 — Đệm trọn một bài Ballad',
      prompt: 'Gửi video bạn đệm và hát trọn một bài Ballad, thể hiện: nhận biết được cấu trúc bài · có chọn tông vừa giọng (ghi rõ capo ngăn mấy) · đổi cách đệm giữa các phần · giữ nhịp qua điểm chuyển. Không cần kỹ thuật hoàn hảo. Kèm một dòng: "Chỗ tôi muốn thầy góp ý nhất: ______".',
      required: true,
      accepts: ['text', 'video_link'],
    },
    // ── ĐUÔI BUỔI ──
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Tập riêng từng cách: Móc Chùm 2, Móc Chùm 4, và quạt điệp khúc (Quạt Chùm 4 hoặc Acoustic).' },
        { label: 'Bài 2.', text: 'Chọn một bài Ballad; xác định cấu trúc và tìm ngăn capo vừa giọng.' },
        { label: 'Bài 3.', text: 'Gán cách đánh cho từng phần và tập chuyển cách không dừng nhịp.' },
        { label: 'Bài 4.', text: 'Đệm và hát trọn cả bài, rồi gửi Bài trả 3.2.' },
      ],
      message: 'Không cần tập hoàn hảo. Hãy mang đúng những chỗ chưa làm được đến buổi học.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi kể được năm bước đệm một bài hoàn chỉnh.',
        'Tôi chơi được Móc Chùm 2, Móc Chùm 4 và một kiểu quạt điệp khúc.',
        'Tôi gán được cách đánh khác nhau cho từng phần của bài.',
        'Tôi đệm liên tục, không dừng khi chuyển cách.',
        'Tôi đã làm Bài trả 3.1 và gửi Bài trả 3.2.',
      ],
    },
    { kind: 'studentNotes', lines: 8 },
  ],
}
