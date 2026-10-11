// ── GUITAR CĂN BẢN 2 (CB2.T3) · BUỔI 02 — Tông giọng & Slow Rock ──
// BẢN NHÁP ĐỂ OWNER DUYỆT (11/10/2026). Mục tiêu buổi = 4 mục Owner đã chốt ở khung (tông giọng là gì · vì sao người đệm hát
// phải hiểu tông · ứng dụng khi tự hát / đệm cho người khác · Slow Rock). Ký âm Slow Rock đọc THẲNG từ src/content/dieudemhat
// (3 kiểu Owner chốt 26–28/09/2026) — không chép lại. Tempo Slow Rock: Owner chưa chốt → KHÔNG ghi tempo.
// Mạch: HỌC → ĐIỂM DỪNG → … → BÀI TRẢ 2.1 (trắc nghiệm, kiến thức tông giọng) → HỌC Slow Rock → GHÉP → BÀI TRẢ 2.2 (video).
// Đáp án trắc nghiệm 2.1 KHÔNG nằm ở đây (server — class_checkpoint_keys; nguồn soạn ở repo private).
import type { LessonDoc, LessonSection, StrumBar } from '../../lesson/lessonTypes'
import { PATTERNS } from '../../content/dieudemhat/index.ts'

const fromPattern = (id: string, label: string): LessonSection => {
  const p = PATTERNS[id]
  return { kind: 'strum', label, name: p.name, strum: p.strum as StrumBar, guitar: p.guitar, durations: p.durations, legend: p.legend, howTo: p.howTo }
}

const stop = (n: number, text: string): LessonSection => ({ kind: 'note', title: `✋ Điểm dừng luyện tập ${n}`, text })

export const CB2_BUOI02: LessonDoc = {
  meta: {
    programCode: 'CB2',
    programName: 'GUITAR CĂN BẢN 2',
    sessionNo: 2,
    title: 'Tông giọng & Slow Rock',
    stageLabel: 'Vòng 1 · Đệm hát',
    backHref: '/me',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Buổi 01 → Buổi 02',
      steps: [
        { label: 'Buổi 01', items: ['Bài hát có cấu trúc; đổi cách đánh theo từng phần (Bolero).'] },
        { label: 'Buổi 02', items: ['Chọn TÔNG vừa giọng hát và đổi tông bằng capo.', 'Một điệu mới: Slow Rock, ghép theo cấu trúc bài.'] },
      ],
    },
    {
      kind: 'objectives',
      items: [
        'Hiểu tông giọng là gì.',
        'Hiểu vì sao người đệm hát phải biết chọn tông.',
        'Đổi được tông của một bài (bằng capo) khi tự hát hoặc đệm cho người khác.',
        'Chơi được điệu Slow Rock với ba kiểu, và dùng chúng cho các phần của bài hát.',
      ],
    },
    // ── PHẦN 1 — TÔNG GIỌNG ──
    {
      kind: 'study',
      tag: 'Phần 1',
      title: 'Tông giọng là gì',
      blocks: [
        { b: 'callout', label: 'ĐIỀU CẦN NHỚ', text: 'Đệm đúng hợp âm chưa chắc đã hát được. Bài hát phải nằm vừa giọng người hát.' },
        { b: 'p', text: 'Mỗi bài hát có một tông — nốt "chủ" mà bài xoay quanh và quay về. Cùng một bài, bạn có thể hát ở nhiều tông khác nhau: giai điệu vẫn là giai điệu đó, chỉ cao hơn hoặc thấp hơn.' },
        { b: 'p', text: 'Tông giọng là tông mà người hát thấy thoải mái: nốt cao nhất không phải gồng, nốt thấp nhất không bị chìm.' },
        { b: 'h', text: 'Vì sao người đệm hát phải hiểu tông' },
        {
          b: 'ul',
          items: [
            'Bản gốc có thể quá cao hoặc quá thấp so với giọng của bạn — hoặc của người bạn đệm cho.',
            'Hát gồng thì mệt giọng, lệch nốt, mất cảm xúc; người nghe cũng thấy căng.',
            'Người đệm hát giỏi không bắt người hát chiều theo cây đàn — mà đổi tông cho vừa người hát.',
          ],
        },
      ],
    },
    {
      kind: 'study',
      tag: 'Phần 2',
      title: 'Đổi tông bằng capo',
      blocks: [
        { b: 'p', text: 'Capo kẹp ngang cần đàn ở ngăn nào thì mọi dây đều cao lên bấy nhiêu nửa cung. Bạn vẫn bấm đúng các thế hợp âm cũ — nhưng tiếng ra đã ở tông khác.' },
        {
          b: 'table',
          rows: [
            ['Vị trí capo', 'Thế bấm C', 'Thế bấm Am', 'Thế bấm F', 'Thế bấm G'],
            ['Không capo', 'C', 'Am', 'F', 'G'],
            ['Ngăn 2', 'D', 'Bm', 'G', 'A'],
            ['Ngăn 5', 'F', 'Dm', 'B♭', 'C'],
          ],
        },
        { b: 'p', text: 'Đọc bảng: bạn bấm thế C, kẹp capo ngăn 2 — tiếng ra là D. Cả bài dịch lên cùng một khoảng, nên vẫn nghe đúng là bài đó.' },
        {
          b: 'callout',
          label: 'CAPO KHÔNG CHỈ DÙNG ĐỂ NÂNG TÔNG',
          text: 'Ví dụ: Bạn đang hát bài ở tông Cm, sử dụng thế bấm Am với capo ngăn 3. Nếu thấy bài quá cao, bạn có thể chuyển capo lên ngăn 10. Khi đó bài chuyển sang tông Gm. Mặc dù âm thanh guitar cao lên, người hát có thể chọn hát Gm ở vùng giọng thấp hơn Cm ban đầu.',
        },
        { b: 'p', text: 'Hãy nhớ: Tăng ngăn capo không phải lúc nào cũng có nghĩa là người hát phải hát cao hơn. Điều quan trọng là tìm được tông và vùng giọng phù hợp với mình.' },
      ],
    },
    stop(1, 'Chọn một bài bạn đã biết hợp âm. Hát lần lượt với capo không, ngăn 2, ngăn 5 — và thử hát ở cả vùng giọng thấp hơn, không chỉ vùng giọng cũ. Ghi lại: ở tông và vùng giọng nào bạn thoải mái nhất, nốt cao nhất không cần gồng.'),
    {
      kind: 'study',
      tag: 'Điểm dừng 2',
      title: '✋ Chọn tông cho bài của bạn',
      blocks: [
        { b: 'ol', items: ['Hát bài ở tông gốc, chú ý chỗ cao nhất và thấp nhất.', 'Thử các ngăn capo, kể cả chuyển lên cao hơn, và chọn vùng giọng hát thoải mái nhất.', 'Chọn tông + vùng giọng vừa với bạn.'] },
        { b: 'write', label: 'Bài tôi chọn · hợp âm gốc · ngăn capo vừa giọng', lines: 4 },
      ],
    },
    // ── BÀI TRẢ 2.1 — KIẾN THỨC (trắc nghiệm) ──
    {
      kind: 'checkpoint',
      id: '2.1',
      title: 'Bài trả 2.1 — Chọn tông cho người hát',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Bạn đệm cho một người hát bài này mà họ không với tới nốt cao ở điệp khúc. Cách xử lý đúng nhất là gì?',
        options: [
          { id: 'a', text: 'Bảo họ cố gắng hát cao lên cho bằng bản gốc.' },
          { id: 'b', text: 'Chọn lại tông (có thể bằng cách đổi ngăn capo) và để họ hát ở vùng giọng vừa với họ.' },
          { id: 'c', text: 'Giữ nguyên tông, chỉ đánh đàn nhỏ lại để họ đỡ phải gồng.' },
          { id: 'd', text: 'Đổi sang điệu khác và giữ nguyên tông.' },
        ],
        hint: 'Đệm hát là phục vụ giọng hát: tìm tông và vùng giọng để nốt cao nhất nằm trong tầm của người hát. Tăng ngăn capo không phải lúc nào cũng buộc người hát phải hát cao hơn.',
      },
    },
    // ── PHẦN 3 — SLOW ROCK ──
    {
      kind: 'study',
      tag: 'Phần 3',
      title: 'Điệu Slow Rock',
      blocks: [
        { b: 'p', text: 'Slow Rock là điệu chậm, chắc, nhiều cảm xúc. Điều làm nên Slow Rock là cách chia nhịp: mỗi phách chia làm 3 phần đều nhau (liên ba).' },
        { b: 'p', text: '4 phách = 4 nhóm ba = 12 tiếng đều nhau trong một ô nhịp. Đếm: 1-trip-let | 2-trip-let | 3-trip-let | 4-trip-let.' },
        { b: 'callout', label: 'ĐIỀU CẦN NHỚ', text: 'Trên bản nhạc, mỗi nhóm có số 3 là một phách. Giữ ba tiếng đều nhau — đừng đánh dồn.' },
      ],
    },
    fromPattern('slowrock-1', 'Kiểu 1'),
    stop(3, 'Tập riêng Kiểu 1 với máy đếm nhịp chậm. Đếm thành tiếng 1-trip-let cho đến khi ba tiếng mỗi phách đều nhau.'),
    fromPattern('slowrock-2', 'Kiểu 2'),
    stop(4, 'Tập riêng Kiểu 2. Sau đó thử Kiểu 1 → Kiểu 2 mà không dừng nhịp.'),
    fromPattern('slowrock-3', 'Kiểu 3'),
    stop(5, 'Tập riêng Kiểu 3 — mang màu Blues, dùng cho điệp khúc. Sau đó thử Kiểu 2 → Kiểu 3 → Kiểu 2 mà không dừng nhịp.'),
    // ── PHẦN 4 — GHÉP THÀNH BÀI ──
    {
      kind: 'flow',
      title: 'Ghép thành bài',
      lead: 'Cùng cách nghĩ với Buổi 01: phần đệm phát triển theo bài hát.',
      steps: [
        { label: 'Lời 1', value: 'Kiểu 1 — nhẹ, phù hợp phần đầu' },
        { label: 'Lời 2', value: 'Kiểu 2 — tiết tấu rõ hơn' },
        { label: 'Điệp khúc', value: 'Kiểu 3 — tương phản, tăng năng lượng' },
        { label: 'Lời 3', value: 'Kiểu 2 — trở lại như Lời 2' },
      ],
      note: 'Giữ nhịp qua mỗi điểm chuyển. Điệp khúc lặp lại thì dùng lại Kiểu 3.',
    },
    {
      kind: 'study',
      tag: 'Điểm dừng 6',
      title: '✋ Ghép một bài Slow Rock — đúng tông của bạn',
      blocks: [
        {
          b: 'ol',
          items: [
            'Chọn một bài Slow Rock 4/4 bạn đã biết hợp âm.',
            'Chọn tông (capo) vừa giọng bạn, như Phần 2.',
            'Đánh dấu Lời 1 / Lời 2 / Điệp khúc / Lời 3 và gán Kiểu 1 / 2 / 3.',
            'Chơi liên tục, vừa đệm vừa hát, không dừng khi chuyển kiểu.',
          ],
        },
        { b: 'write', label: 'Bài tôi chọn · ngăn capo · kiểu cho từng phần', lines: 6 },
      ],
    },
    // ── BÀI TRẢ 2.2 — THỰC HÀNH TỔNG HỢP (video, duy nhất trong buổi) ──
    {
      kind: 'checkpoint',
      id: '2.2',
      title: 'Bài trả 2.2 — Tự đệm tự hát một bài Slow Rock',
      prompt: 'Gửi video bạn vừa đệm vừa hát một bài Slow Rock ở tông vừa giọng mình, thể hiện: có chọn tông (ghi rõ bạn kẹp capo ngăn mấy) · đổi kiểu đệm giữa các phần · giữ nhịp qua điểm chuyển. Không cần kỹ thuật hoàn hảo. Kèm một dòng: "Tôi chọn tông này vì ______".',
      required: true,
      accepts: ['text', 'video_link'],
    },
    // ── ĐUÔI BUỔI ──
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Với một bài bạn đã biết, tìm ngăn capo vừa giọng nhất và ghi lại.' },
        { label: 'Bài 2.', text: 'Tập riêng ba kiểu Slow Rock; đếm trip-let thành tiếng cho đến khi đều.' },
        { label: 'Bài 3.', text: 'Gán Kiểu 1 / 2 / 3 cho các phần của bài đã chọn và tập chuyển kiểu không dừng nhịp.' },
        { label: 'Bài 4.', text: 'Vừa đệm vừa hát cả bài, rồi gửi Bài trả 2.2.' },
      ],
      message: 'Không cần tập hoàn hảo. Hãy mang đúng những chỗ chưa làm được đến buổi học.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi giải thích được tông giọng là gì.',
        'Tôi biết chọn tông và vùng giọng vừa với người hát, kể cả khi tăng ngăn capo.',
        'Tôi đổi được tông bằng capo.',
        'Tôi chơi được ba kiểu Slow Rock và đếm trip-let đều.',
        'Tôi đã làm Bài trả 2.1 và gửi Bài trả 2.2.',
      ],
    },
    { kind: 'studentNotes', lines: 8 },
  ],
}
