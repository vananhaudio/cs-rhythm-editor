// ── SOLO-01 · BUỔI 03 — nội dung giáo trình ──
// Mạch của Chặng 1: CÙNG MỘT TÁC PHẨM, mỗi tuần chồng thêm một lớp.
//   Buổi 01: Melody → Buổi 02: Melody rõ hơn + Bass đầu tiên → Buổi 03: + Slide.
// KHÔNG đổi tác phẩm, KHÔNG mở chủ đề lý thuyết mới ở buổi này.
// ⚠️ NGÓN TAY TRONG alphaTex LỆCH 1: tay trái `lf 2`=ngón 1 … `lf 5`=ngón 4
//    (lf 1 = ngón cái, in ra chữ "T"); tay phải `rf 1`=p · `rf 2`=i · `rf 3`=m.
//    `{ss}` = trượt ngón, đặt ở nốt TRƯỚC khi trượt.
import type { LessonDoc } from '../../lesson/lessonTypes'
import { WORK_DIEM_XUA_B3, DX_LOP1_MELODY, DX_LOP2_BASS, DX_LOP3_SLIDE } from './works'

// ── Bài tập 01 — Bass + Melody luân phiên ──
// Bass và melody CHƯA chồng lên nhau: ngón cái p đi trước, i–m trả lời. Học viên
// quen việc phân vai hai tay phải trước khi phải làm hai việc cùng lúc.
const EX1 = `
\\tempo 60
\\ts 4 4
.
0.5{ch "Am" rf 1}.4 2.3{rf 2}.4 0.2{rf 3}.4 1.2{rf 2}.4 |
0.5{rf 1}.4 0.2{rf 3}.4 2.3{rf 2}.4 0.3{rf 3}.4 |
0.4{ch "Dm" rf 1}.4 3.2{rf 2}.4 1.2{rf 3}.4 0.2{rf 2}.4 |
0.4{rf 1}.4 1.2{rf 3}.4 3.2{rf 2}.4 1.1{rf 3}.4 |
0.6{ch "E" rf 1}.4 0.1{rf 2}.4 3.2{rf 3}.4 0.2{rf 2}.4 |
0.6{rf 1}.4 3.2{rf 3}.4 0.2{rf 2}.4 1.2{rf 3}.4 |
0.5{ch "Am" rf 1}.4 2.3{rf 2}.4 1.2{rf 3}.4 0.2{rf 2}.4 |
0.5{rf 1}.4 2.3{rf 2}.2{d}
`.trim()

// ── Bài tập 02 — Slide trong câu melody ──
// Không phải bài trượt ngón máy móc: đây là một CÂU NHẠC, slide chỉ nằm ở ba chỗ
// mà nó làm câu liền hơn.
const EX2 = `
\\tempo 60
\\ts 4 4
.
2.3{lf 3 rf 2}.4 0.2{rf 3}.4 1.2{lf 2 rf 2}.2 |
0.2{rf 3}.4 2.3{lf 3 ss rf 2}.4 4.3{lf 3}.2 |
5.3{lf 2 rf 3}.4 4.3{lf 5 rf 2}.4 2.3{lf 3 rf 3}.2 |
5.1{lf 2 ss rf 2}.4 7.1{lf 2}.4 0.1{rf 3}.2 |
3.2{lf 2 ss rf 2}.4 1.2{lf 2}.4 0.2{rf 3}.2 |
2.3{lf 3 rf 2}.1
`.trim()

// ── Etude 03 — Melody có Bass & Slide ──
// Bản thu nhỏ của cách Solo Guitar đang được dựng: bass ở bè dưới ngân trọn ô,
// melody bè trên, và hai cú trượt đặt đúng chỗ câu nhạc cần liền.
const ETUDE3 = `
\\tempo 66
\\ts 4 4
.
2.3{lf 3 rf 2}.4 0.2{rf 3}.4 1.2{lf 2 rf 2}.2 |
0.2{rf 3}.4 2.3{lf 3 rf 2}.4 0.3{rf 3}.2 |
2.3{lf 2 ss}.4 4.3{lf 2}.4 5.3{lf 3}.2 |
7.3{lf 5}.4 5.3{lf 3}.4 4.3{lf 2}.2 |
2.3{lf 3}.4 1.2{lf 2}.4 0.2.2 |
3.2{lf 2 ss}.4 1.2{lf 2}.4 0.2.2 |
0.1.4 1.1{lf 2}.4 0.1.2 |
2.3{lf 3}.1
\\voice
0.5{ch "Am" rf 1}.1 |
0.5{rf 1}.1 |
0.5{rf 1}.1 |
0.4{ch "Dm" rf 1}.1 |
0.5{ch "Am" rf 1}.1 |
0.4{ch "Dm" rf 1}.1 |
0.6{ch "E" rf 1}.1 |
0.5{ch "Am" rf 1}.1
`.trim()

export const SOLO01_BUOI03: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 3,
    title: 'Melody + Bass và kỹ thuật Slide',
    stageLabel: 'Chặng 1 · Từ giai điệu đến Solo Guitar',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Từ Buổi 02 sang Buổi 03',
      steps: [
        { label: 'Buổi 02 đã có', items: ['Melody rõ tiếng nhờ ép ngón.', 'Bass đơn giản bắt đầu xuất hiện.'] },
        { label: 'Buổi 03 thêm', items: ['Vẫn giữ melody là chính.', 'Bass hoạt động rõ hơn.', 'Thêm Slide cho câu nhạc mượt.'] },
      ],
      message: 'Không học bài mới từ đầu — tuần này ta nâng cấp chính bài đang chơi.',
    },
    {
      kind: 'objectives',
      items: [
        'Giữ được melody rõ khi bắt đầu thêm bass.',
        'Phân vai tay phải: p chơi bass, i – m chơi melody.',
        'Chơi được mẫu bass + melody đơn giản.',
        'Thực hiện Slide sạch, liền tiếng.',
        'Đưa Slide vào vài vị trí hợp trong chính tác phẩm đang học.',
        'Nâng đoạn Diễm Xưa từ melody đơn thành một đoạn Solo Guitar sơ khai.',
      ],
    },
    {
      kind: 'layers',
      title: 'Cùng một đoạn nhạc — ba cấp độ',
      lead: 'Đây là ô nhịp 3–4 của Diễm Xưa, đúng đoạn đang học, qua ba tuần.',
      layers: [
        { label: 'Buổi 01', what: 'Melody', tex: DX_LOP1_MELODY },
        { label: 'Buổi 02', what: 'Melody + tiếng rõ hơn + Bass đầu tiên', tex: DX_LOP2_BASS },
        { label: 'Buổi 03', what: 'Melody + Bass + Slide', tex: DX_LOP3_SLIDE, current: true },
      ],
      note: 'Cùng một bản nhạc, cùng một nguồn — chỉ chồng thêm lớp. Học viên phải NGHE ra bài của mình đang lớn lên.',
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 01',
      title: 'Bass + Melody luân phiên',
      lead: '8 ô nhịp. Ngón cái p chơi bass ở phách 1, rồi i – m trả lời bằng câu melody. Chưa chồng hai việc lên nhau.',
      tempo: 'Tempo: ♩ = 60',
      tex: EX1,
      marks: [
        { at: 'Am', text: 'Bass A — dây 5 buông' },
        { at: 'Dm', text: 'Bass D — dây 4 buông' },
        { at: 'E', text: 'Bass E — dây 6 buông' },
      ],
      guidance: [
        'Bass là phần nền. Melody vẫn phải được nghe rõ nhất.',
        'p đi xuống, i – m đi lên; hai ngón melody luân phiên, không dùng một ngón hai nốt liền.',
        'Nghe ra câu nhạc trong phần melody — đừng biến nó thành bài chạy ngón.',
      ],
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 02',
      title: 'Slide trong câu melody',
      lead: 'Một câu nhạc ngắn 6 ô nhịp, có ba chỗ trượt: lên trên dây 3, lên trên dây 1, và xuống trên dây 2.',
      tempo: 'Tempo: ♩ = 60',
      tex: EX2,
      marks: [
        { at: 'Ô 2', text: 'dây 3: ngón 2 trượt ngăn 2 → 4' },
        { at: 'Ô 4', text: 'dây 1: ngón 1 trượt ngăn 5 → 7' },
        { at: 'Ô 5', text: 'dây 2: ngón 1 trượt ngược ngăn 3 → 1' },
      ],
      guidance: [
        'Gảy nốt đầu — giữ lực tay trái — trượt sang nốt sau. Không nhấc tay giữa hai nốt.',
        'Trượt thì HAI NỐT CÙNG MỘT NGÓN. Trượt từ dây buông là vô nghĩa: không bấm gì thì không có ngón nào để trượt.',
        'Không trượt thì đổi ngón: một ngón không bấm liên tiếp hai nốt khác chỗ, nhất là khi sang dây khác.',
        'Nhịp KHÔNG được dừng lại vì slide.',
        'Slide ở đây để câu melody liền và có chất guitar hơn, không phải để khoe kỹ thuật.',
      ],
    },
    {
      kind: 'score',
      subtitle: 'Etude 03',
      title: 'Melody có Bass & Slide',
      lead: '8 ô nhịp gom lại tất cả những gì đã tích luỹ: bản đồ C–Am, ép ngón, bass đơn, melody và slide.',
      tempo: 'Tempo: ♩ = 66',
      tex: ETUDE3,
      marks: [
        { at: 'Ô 3', text: 'ngón 1 trượt trên dây 3 (ngăn 2 → 4), cả ô 3–4 ở thế IV' },
        { at: 'Ô 6', text: 'ngón 1 trượt xuống trên dây 2 (ngăn 3 → 1)' },
      ],
      guidance: [
        'Bass ở bè dưới ngân trọn ô nhịp, melody ở bè trên — đây là hình thu nhỏ của bản Solo đang dựng.',
        'Tập trước phần melody trơn, rồi mới thả bass vào, cuối cùng mới thêm slide.',
      ],
    },
    {
      kind: 'note',
      title: 'Ghi chú nhỏ về cao độ',
      text: 'Cùng một tên nốt có thể xuất hiện ở nhiều cao độ khác nhau trên cần đàn. Khi đọc bản nhạc, bám cả khuông nhạc lẫn TAB để chơi đúng vị trí — đừng chỉ nhớ tên nốt.',
    },
    {
      kind: 'repertoire',
      title: 'Tác phẩm thực hành',
      candidates: ['Diễm Xưa — Trịnh Công Sơn (tiếp tục từ Buổi 01–02)'],
      status: 'ready',
      pieces: [
        {
          title: 'Diễm Xưa — Melody + Bass + Slide',
          composer: 'Trịnh Công Sơn · giọng Am',
          note: 'Vẫn đúng bản nhạc của Buổi 01–02, không dựng lại từ đầu: giai điệu giữ nguyên, bè Bass giữ nguyên, tuần này chỉ chồng thêm hai cú trượt ở ô 3 và ô 7 — hai chỗ hiếm hoi mà hai nốt liền nhau cùng nằm trên một dây và đều là nốt bấm.',
          tempo: 'Chậm, giữ Bass ngân · melody vẫn phải nổi hơn Bass',
          barsPerRow: 3,
          tex: WORK_DIEM_XUA_B3,
          marks: [
            { at: 'Lớp 1', text: 'Bass ở phách mạnh — dây buông E · A · D' },
            { at: 'Lớp 2', text: 'Slide ô 3 (dây 1, ngăn 3 → 5) và ô 7 (dây 2, ngăn 3 → 1)' },
            { at: 'Lớp 3', text: 'Tay phải: p cho Bass, i – m cho melody' },
          ],
          guidance: [
            'Chơi lại y như tuần trước trước đã; chỉ khi trơn mới thêm hai cú trượt.',
            'Chỗ nào Bass làm melody yếu đi thì bỏ Bass ô đó — melody quan trọng hơn.',
          ],
        },
      ],
      annotationTypes: ['Vị trí Bass', 'Vị trí Slide', 'Ngón tay phải p – i – m', 'Câu melody',
        'Điểm lấy hơi / ngắt câu', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Tập Bass + Melody luân phiên (Bài tập 01).' },
        { label: 'Bài 2.', text: 'Tập câu Slide trong Bài tập 02.' },
        { label: 'Bài 3.', text: 'Chơi hoàn chỉnh Etude 03.' },
        { label: 'Bài 4.', text: 'Chơi lại đoạn tác phẩm đã học từ Buổi 01–02.' },
        { label: 'Bài 5.', text: 'Nâng cấp đoạn đó: thêm Bass, thêm Slide tại vị trí đã đánh dấu.' },
        { label: 'Bài 6.', text: 'Khoanh trên bản nhạc: chỗ Bass làm melody yếu, chỗ Slide đứt tiếng, chỗ tay phải bị rối.' },
        { label: 'Bài 7 — tự thiết kế.', text: 'Tự đặt thêm Slide vào Diễm Xưa theo cảm nhận của mình — KHÔNG có đúng sai. Đánh dấu thẳng lên bản nhạc chỗ muốn trượt và ghi ngắn lý do (câu nhạc liền hơn, gần giọng hát hơn, nghe buồn hơn…). Mang đến lớp tuần sau để trao đổi, biện luận và bảo vệ lựa chọn của mình.' },
        { label: 'Gợi ý cho Bài 7.', text: 'Trượt được khi hai nốt liền nhau cùng nằm trên MỘT dây, cả hai đều là nốt bấm, và dùng CÙNG một ngón. Chỗ nào chưa đủ điều kiện (nốt là dây buông, hoặc hai nốt nằm ở hai dây) thì thử ĐỔI DÂY: bấm nốt đó ở dây khác để hai nốt về chung một dây. Ví dụ Mi dây 1 buông cũng chính là Mi ở dây 2 ngăn 5.' },
      ],
      message: 'Mang đúng những vị trí đã khoanh đến buổi học — đó là phần thầy trò sẽ gỡ cùng nhau.',
    },
    {
      kind: 'checklist',
      items: [
        'Tôi giữ được melody khi thêm bass.',
        'Ngón cái p chơi được bass độc lập hơn.',
        'Tôi dùng i – m cho melody.',
        'Tôi thực hiện được Slide liền tiếng.',
        'Tôi chơi được Etude 03.',
        'Tôi nâng cấp được đoạn Diễm Xưa của tuần trước.',
        'Tôi đã đánh dấu chỗ chưa làm được.',
        'Tôi đã tự đặt Slide vào Diễm Xưa và chuẩn bị lý do để trình bày.',
      ],
    },
    { kind: 'studentNotes', title: 'Ghi chú / Slide tôi tự thiết kế', lines: 10 },
  ],
}
