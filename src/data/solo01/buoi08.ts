// ── SOLO-01 · BUỔI 08 — BẢN THẢO (30/10/2026, Claude soạn, CHỜ THẦY DUYỆT) ──
// Chưa nằm trong repo. Khi Thầy duyệt: chép thành src/data/solo01/buoi08.ts rồi đăng ký 3 chỗ
// theo docs/GIAO-TRINH-CHUAN.md §5. Đáp án trắc nghiệm → solo01-buoi08.keys-private.json (repo PRIVATE).
// Đây là buổi KẾT CHẶNG 1 (Buổi 1–8): khung solo01Program.ts, Buổi 8 "Hoàn thiện đoạn Solo Guitar đầu tiên"
// — Melody · Bass · Hợp âm · Kỹ thuật · hoàn thiện một đoạn Solo Guitar. Phụ thuộc Buổi 07 (cùng tác phẩm Thành Phố Buồn, giọng Em).
//
// ── NGUỒN & MỨC XÁC MINH ──
// ĐÃ XÁC MINH:
//  · Giai điệu 8 ô: score.xml của Thầy (thư viện MuseScore), sinh bằng scripts/musicxml-to-alphatex.mjs
//    --transpose 0 --no-chords --no-lyrics --bars 2-9 --zones "0-30:1-3" (ô 2–9 theo cách đếm của script = 8 ô sau ô lấy đà).
//    Ô 4–7 TRÙNG NGUYÊN đoạn của Buổi 07. Đã bỏ dấu lặp (\ro/\rc) và bỏ 3 nốt lấy đà cuối ô 8 (dẫn vào lần lặp) — chỉ để đoạn kết gọn.
//  · Bass chỉ dây buông Mi · La · Rê (quy tắc "bass đầu = tên hợp âm" của Buổi 05).
//  · "Luyến khác trượt: luyến hai ngón khác nhau, trượt cùng một ngón" — từ ghi chú đầu buoi05.ts.
// CẦN THẦY DUYỆT:
// BỘ HỢP ÂM CHƯA CHÍNH THỨC — xem CHORD-SO-SANH-THANH-PHO-BUON.md (bảng theo ô: ảnh lead sheet A vs bản chì 1973 B; thước 1–3–5 của Thầy: A 15/15, B 14/15;
//   A chơi được bằng bass dây buông, B cần Si dây 5 ngăn 2). Bản thảo dùng A như BẢN THỬ; Thầy chốt trước khi dạy.
// KIỂM KHẢ NĂNG CHƠI (30/10, alphaTab + tính toán, CHƯA kiểm tay thật): bè bass 15/15 nốt là dây buông (không bao giờ phải bấm cùng lúc với melody);
//   melody chỉ là nốt đơn trên dây 1–3, ngăn cao nhất 12; chuyển giữa hai nốt BẤM tối đa Δ3 ngăn (nằm trong một thế tay ngón 1→4), riêng Sol dây 1 ngăn 3 → Si ngăn 7 ở ô 4
//   (Δ4) đã đổi Sol sang dây 2 ngăn 8. Lên ngăn 10–12 (ô 2–3) rồi về Mi buông (nốt có chấm — đủ thời gian đổi thế).
//  · HỢP ÂM: Em · Am · D từ ảnh lead sheet ~/Pictures/01_Anh_theo_nam/2026/THANH-PHO-BUON-lam-Phuong_Page_1-1.png (không rõ người chép;
//    khác score.xml vài nốt, gióng bằng cao độ). Ô 1–3 = Em; ô 4 = Am|Em; ô 5 = D|Em; ô 6 = Em|D; ô 7 = Em|D; ô 8 = Em.
//    Bản in gốc 1973 viết tay mờ, hợp âm KHÁC (thấy cả G) ⇒ không dùng. Ô 1–3 "chỉ Em" là chỗ nên Thầy kiểm lại trước nhất.
//  · Bass chỉ ROOT, không bass luân phiên: ô 1–3 melody lên tới ngăn 10–12 (dây 1) nên không thể giữ Si (dây 5 ngăn 2) cùng lúc.
//    Thầy có thể muốn bass khác — đây là điểm dạy, không phải điều Thầy đã duyệt.
//  · Điểm ngắt 3 nhịp, nội dung hai câu trắc nghiệm, và việc coi đây là "đoạn Solo đầu tiên": đề xuất.
// CHƯA CÓ: slide đề xuất tại ô nào (Thầy chọn); chưa nghe thử; chưa kiểm tay thật (nhất là chuyển ngăn 0 ↔ 7 ↔ 12 trên dây 1 ở ô 1–3).
import type { LessonDoc } from '../../lesson/lessonTypes'

// ── Bài tập 01 — ô 1–3 (phần mới so với Buổi 07): melody dây 1 từ ngăn 0 lên ngăn 12, bass Mi dây buông ──
const EX1 = `
\\tempo 60
\\ts 4 4
.
0.1.4 0.1{t}.8{tu 3} 7.1.8{tu 3} 5.1.8{tu 3} 3.1.4 3.1{t}.8{tu 3} 3.2.8{tu 3} 0.1.8{tu 3} |
0.2.4 0.2.8{tu 3} 5.1.8{tu 3} 3.1.8{tu 3} 0.1.4 r.8{tu 3} 7.1.8{tu 3} 10.1.8{tu 3} |
7.1.4 7.1.8{tu 3} 10.1.8{tu 3} 12.1.8{tu 3} 0.1.8{d} 5.1.16 7.1.8{tu 3} 0.1.8{tu 3} 5.1.8{tu 3}
\\voice
0.6{ch "Em" rf 1}.2 0.6{rf 1}.2 |
0.6{rf 1}.2 0.6{rf 1}.2 |
0.6{rf 1}.2 0.6{rf 1}.2
`.trim()

// ── Đoạn Solo hoàn chỉnh: 8 ô giọng Em, melody + bass + hợp âm ──
const VERSE = `
\\tempo 60
\\ts 4 4
.
0.1.4 0.1{t}.8{tu 3} 7.1.8{tu 3} 5.1.8{tu 3} 3.1.4 3.1{t}.8{tu 3} 3.2.8{tu 3} 0.1.8{tu 3} |
0.2.4 0.2.8{tu 3} 5.1.8{tu 3} 3.1.8{tu 3} 0.1.4 r.8{tu 3} 7.1.8{tu 3} 10.1.8{tu 3} |
7.1.4 7.1.8{tu 3} 10.1.8{tu 3} 12.1.8{tu 3} 0.1.8{d} 5.1.16 7.1.8{tu 3} 0.1.8{tu 3} 5.1.8{tu 3} |
5.1.4 8.2.8{tu 3} 7.1.8{tu 3} 5.1.16{tu 3} 3.1.16{tu 3} 0.1.4 0.1{t}.8{tu 3} 3.2.8{tu 3} 2.1.8{tu 3} |
2.1.4 2.1.8{tu 3} 5.1.8{tu 3} 2.1.16{tu 3} 0.1.16{tu 3} 0.2.4 r.8{tu 3} 5.1.8{tu 3} 2.1.8{tu 3} |
0.2.4 2.3.8{tu 3} 0.2.8{tu 3} 0.1.8{tu 3} 2.1.4 r.8{tu 3} 5.1.8{tu 3} 2.1.8{tu 3} |
0.2.4 r.8{tu 3} 2.1.8{tu 3} 0.1.8{tu 3} 3.2.4 2.1.8{tu 3} 5.1.8{tu 3} 3.2.8{tu 3} |
0.1.2 r.2
\\voice
0.6{ch "Em" rf 1}.2 0.6{rf 1}.2 |
0.6{rf 1}.2 0.6{rf 1}.2 |
0.6{rf 1}.2 0.6{rf 1}.2 |
0.5{ch "Am" rf 1}.2 0.6{ch "Em" rf 1}.2 |
0.4{ch "D" rf 1}.2 0.6{ch "Em" rf 1}.2 |
0.6{ch "Em" rf 1}.2 0.4{ch "D" rf 1}.2 |
0.6{ch "Em" rf 1}.2 0.4{ch "D" rf 1}.2 |
0.6{ch "Em" rf 1}.1
`.trim()

export const SOLO01_BUOI08: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 8,
    title: 'Hoàn thiện đoạn Solo Guitar đầu tiên',
    stageLabel: 'Chặng 1 · Từ giai điệu đến Solo Guitar',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Từ Buổi 07 sang Buổi 08',
      steps: [
        { label: 'Bảy buổi đã có', items: ['Bản đồ C–Am và G–Em, nốt F♯.', 'Melody + Bass cùng lúc, ba cách nối nốt, xếp ngón có căn cứ.', '4 ô Thành Phố Buồn giọng Em có melody + bass.'] },
        { label: 'Buổi 08 thêm', items: ['Nối thêm các ô còn lại thành MỘT đoạn 8 ô trọn vẹn.', 'Nhìn đoạn như ba lớp — Melody, Bass, Hợp âm — và hoàn thiện cả ba.'] },
      ],
      message: 'Hôm nay không có kiến thức mới. Hôm nay là buổi bạn gom mọi thứ đã học thành MỘT đoạn Solo Guitar đầu tiên — đàn liền mạch từ đầu đến cuối.',
    },
    {
      kind: 'objectives',
      title: 'Cuối buổi, bạn làm được',
      items: [
        'Nhìn một đoạn Solo như ba lớp: Melody (nốt hát), Bass (nền), Hợp âm (màu sắc) — và nói được mỗi lớp đang ở đâu.',
        'Chọn bass cho từng ô có căn cứ, kể cả khi melody đang ở ngăn cao.',
        'Nối các nốt và các ô bằng cách bạn đã chọn (gảy lại · trượt · luyến) mà câu hát vẫn liền.',
        'Giữ tempo đều và bass đều khi melody chạy lên xuống cần đàn.',
        '⭐ QUAN TRỌNG NHẤT — Đàn được cả 8 ô Thành Phố Buồn giọng Em có melody + bass, chậm mà liền mạch từ đầu đến cuối.',
      ],
    },
    // ── NHỊP HỌC (đề xuất): Nhịp 1 BA LỚP (8.1 trắc nghiệm) → Nhịp 2 NỐI ĐOẠN (8.2 trắc nghiệm) → Nhịp 3 TRÌNH BÀY (8.3 video + chữ, video DUY NHẤT).
    {
      kind: 'note',
      title: 'Nhịp 1 · Ba lớp của một đoạn Solo',
      text: 'Đọc đoạn 8 ô như ba lớp (Melody · Bass · Hợp âm), luyện phần mới ở ô 1–3, rồi chọn bass có căn cứ. Kết thúc nhịp: Bài trả 8.1 (trắc nghiệm).',
    },
    {
      kind: 'recap',
      title: 'Phần 1 — Ba lớp của đoạn 8 ô',
      steps: [
        { label: 'Ô 1 – 2 – 3', items: ['Hợp âm Em suốt ba ô', 'Melody: dây 1 từ ngăn 0 lên ngăn 12', 'Bass: Mi — dây 6 buông'] },
        { label: 'Ô 4 – 5', items: ['Am → Em, rồi D → Em (đổi giữa ô)', 'Đoạn này bạn đã đàn ở Buổi 07'] },
        { label: 'Ô 6 – 7 – 8', items: ['Em → D, Em → D, kết ở Em', 'Bass: Mi và Rê — toàn dây buông'] },
      ],
      message: 'Ba lớp luôn đi cùng nhau. Melody nổi lên, Bass đứng dưới, Hợp âm quyết định màu: đổi hợp âm là đổi bass ngay ở chỗ đó.',
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 01',
      title: 'Ô 1–3: melody lên cao, bass dây buông',
      lead: 'Phần mới so với Buổi 07. Melody lên tới ngăn 12 trên dây 1; bass chỉ là Mi dây 6 buông, hai nốt mỗi ô.',
      tempo: 'Tempo: ♩ = 60',
      tex: EX1,
      guidance: [
        'Melody đi dọc dây 1 giữa ngăn 0, 5, 7, 10, 12. Đổi thế tay dọc MỘT sợi dây, như Buổi 01 và Buổi 03; trượt hay gảy lại do bạn chọn và ghi lý do.',
        'Bass chỉ dây buông: tay trái hoàn toàn dành cho melody. Không có nốt bass nào phải với xa.',
        'Chưa đều thì đừng tăng tempo. Tập từng ô, rồi nối ba ô.',
      ],
    },
    {
      kind: 'checkpoint',
      id: '8.1',
      title: 'Bài trả 8.1 — Chọn bass có căn cứ',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Ở ô melody đang chơi ngăn cao (ngăn 10–12 trên dây 1), căn cứ nào hợp lý nhất để chọn bass?',
        options: [
          { id: 'a', text: 'Chọn bass dây buông để tay trái dành cho melody, không phải với xa.' },
          { id: 'b', text: 'Luôn chọn bass quãng 5 vì nghe hay hơn bass gốc.' },
          { id: 'c', text: 'Luôn bấm bass ở ngăn 2 cho giống Buổi 05.' },
          { id: 'd', text: 'Bỏ melody ở ô đó để bass đúng nhất.' },
        ],
        hint: 'Như Buổi 06: nhìn xem tay trái đang bận chỗ nào trước khi chọn.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 2 · Nối đoạn',
      text: 'Nối 3 ô mới với 4 ô của Buổi 07 thành đoạn liền, và chọn cách nối nốt cho các chỗ nối. Kết thúc nhịp: Bài trả 8.2 (trắc nghiệm).',
    },
    {
      kind: 'note',
      title: 'Phần 2 — Chỗ nối nhau',
      text: 'Hôm nay có hai chỗ nối: giữa ô 3 và ô 4 (melody kết ô 3 ở ngăn 0 – 5 và đi tiếp sang ô 4 ở ngăn 5) và giữa hai nửa của đoạn (ô 5 – 6, nơi hợp âm đổi giữa ô liên tục). Với mỗi chỗ nối nốt, bạn đã có ba cách: gảy lại, trượt, luyến. Trượt thì hai nốt cùng một ngón; luyến thì hai nốt khác ngón. Như Buổi 04–05: không có đáp án duy nhất; có căn cứ để chọn.',
    },
    {
      kind: 'checkpoint',
      id: '8.2',
      title: 'Bài trả 8.2 — Luyến và trượt',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Luyến (hammer-on / pull-off) khác trượt ở điểm nào?',
        options: [
          { id: 'a', text: 'Luyến dùng hai ngón khác nhau; trượt dùng cùng một ngón kéo từ nốt này sang nốt kia.' },
          { id: 'b', text: 'Luyến phải gảy cả hai nốt; trượt chỉ gảy một nốt.' },
          { id: 'c', text: 'Luyến và trượt hoàn toàn giống nhau.' },
          { id: 'd', text: 'Trượt chỉ dùng được ở dây buông.' },
        ],
        hint: 'Nhớ lại Buổi 05: hai nốt luyến khác ngón, hai nốt trượt cùng ngón.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 3 · Trình bày đoạn Solo đầu tiên',
      text: 'Đàn đủ 8 ô với melody, bass và hợp âm. Kết thúc nhịp: Bài trả 8.3 (video + giải thích).',
    },
    {
      kind: 'repertoire',
      title: 'Phần 3 — Đoạn Solo Guitar đầu tiên',
      candidates: ['Thành Phố Buồn — 8 ô giọng Em'],
      status: 'ready',
      pieces: [
        {
          title: 'Thành Phố Buồn — 8 ô giọng Em, melody + bass + hợp âm',
          composer: 'Lam Phương · giọng Em (tông gốc)',
          note: 'Ô 4–7 là đoạn bạn đã đàn ở Buổi 07. Ô 1–3 mới (melody lên cao). Ô 8 kết ở Mi. Ngón tay trái chưa ghi sẵn — bạn tự xếp có căn cứ, như Buổi 04. Chỗ nối nốt bạn chọn gảy lại, trượt hay luyến và ghi lý do.',
          barsPerRow: 2,
          tex: VERSE,
        },
      ],
      annotationTypes: ['Hợp âm đổi', 'Ngón tay trái', 'Cách nối nốt', 'Lý do chọn', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Bài tập kỹ thuật 01: ô 1–3 từng ô rồi nối ba ô, ♩ = 60, 5 phút mỗi ngày.' },
        { label: 'Bài 2.', text: 'Đàn 8 ô giai điệu trước, chưa bass. Khoanh chỗ tay trái vướng.' },
        { label: 'Bài 3.', text: 'Thêm bass dây buông theo hợp âm. Ô nào bass làm đứt câu hát thì khoanh và ghi lý do.' },
        { label: 'Bài 4.', text: 'Chọn cách nối nốt (gảy lại · trượt · luyến) cho ít nhất hai chỗ nối. Viết "Tôi chọn cách này vì…".' },
      ],
      message: 'Mang các chỗ đã khoanh đến lớp — ta cùng nghe nhiều cách xử lý khác nhau cho cùng một đoạn.',
    },
    {
      kind: 'checkpoint',
      id: '8.3',
      title: 'Bài trả 8.3 — Đoạn Solo đầu tiên của tôi',
      prompt: 'Chơi đủ 8 ô Thành Phố Buồn giọng Em có melody và bass, chậm cũng được. Sau đó viết ngắn: "Chỗ khó nhất của tôi là… và cách tôi nối nốt/chọn bass ở chỗ đó là… vì…".',
      required: true,
      accepts: ['video_link', 'text'],
    },
    {
      kind: 'checklist',
      items: [
        'Tôi nói được ba lớp của đoạn: Melody, Bass, Hợp âm.',
        'Tôi chọn bass có căn cứ, kể cả khi melody ở ngăn cao.',
        'Tôi nối nốt bằng cách tôi đã chọn mà câu hát vẫn liền.',
        'Tôi giữ tempo và bass đều khi melody chạy lên xuống.',
        '⭐ Tôi đàn được cả 8 ô Thành Phố Buồn giọng Em có melody + bass.',
      ],
    },
    { kind: 'studentNotes', title: 'Chỗ khó nhất của tôi là… và tôi xử lý như sau…', lines: 8 },
  ],
}
