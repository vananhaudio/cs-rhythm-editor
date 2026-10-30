// ── SOLO-01 · BUỔI 07 — BẢN THẢO (30/10/2026, Claude soạn, CHỜ THẦY DUYỆT) ──
// Chưa nằm trong repo. Khi Thầy duyệt: chép thành src/data/solo01/buoi07.ts rồi đăng ký 3 chỗ
// theo docs/GIAO-TRINH-CHUAN.md §5 (Solo01LessonPage LESSONS · solo01Program doc/unlockAt · programTemplates).
// Đáp án trắc nghiệm KHÔNG ở đây → solo01-buoi07.keys-private.json (đưa vào repo PRIVATE).
//
// OWNER ĐÃ DUYỆT (30/10/2026): tác phẩm thực hành chính của Buổi 07 = "Thành Phố Buồn", định hướng G–Em.
// Khung: solo01Program.ts, Buổi 7 "Bản đồ G–Em" — mở rộng sang giọng mới · C–Am → G–Em · nhận diện F♯ · Melody + Bass + kỹ thuật.
//
// ── NGUỒN & MỨC XÁC MINH ──
// ĐÃ XÁC MINH (đối chiếu tệp):
//  · Giai điệu: score.xml của Thầy (thư viện MuseScore "thanh-pho-buon-lam-phuong"), 1 dấu thăng (fifths=1), nốt cuối = Mi
//    ⇒ bài ở MI THỨ (Em), cùng bộ dấu hoá với Sol trưởng. Repo ghi cùng điều này ở works.ts ("Gốc Sol trưởng/Em").
//    Sinh bằng scripts/musicxml-to-alphatex.mjs  --transpose 0 --no-chords --no-lyrics --bars 5-8 --zones "0-30:1-3"
//    (ô 5–8 theo cách đếm của script, tính cả ô lấy đà; = 4 ô liền sau "Đường quanh"). Toàn bộ nốt nằm ở dây 1–3, ngăn 0–7.
//    Bản Am (Buổi 01–05) lấy từ cùng script --transpose -7 = đúng WORK_THANH_PHO_BUON trong works.ts.
//  · Bản đồ G–Em Vùng 1: tính từ cao độ dây buông (không cần nguồn ngoài). F♯ là dấu thăng duy nhất của Sol trưởng.
//  · Bass chỉ dùng DÂY BUÔNG (Mi d6 · La d5 · Rê d4) ⇒ không tranh ngón với melody; quy tắc "nốt bass đầu = tên hợp âm" từ Buổi 05.
//  · Ngón tay trái trong 2 bài tập thang: ngăn n ⇒ ngón n, theo đúng Bài tập 01 Buổi 01.
// CẦN THẦY DUYỆT (chưa có nguồn chắc):
// BỘ HỢP ÂM CHƯA CHÍNH THỨC — xem CHORD-SO-SANH-THANH-PHO-BUON.md (bảng theo ô: ảnh lead sheet A vs bản chì 1973 B; thước 1–3–5 của Thầy: A 15/15, B 14/15;
//   A chơi được bằng bass dây buông, B cần Si dây 5 ngăn 2). Bản thảo dùng A như BẢN THỬ; Thầy chốt trước khi dạy.
// CHỈNH SỐ ĐIỂM TAY (30/10): nốt Sol đầu ô 1 của đoạn 4 ô đặt ở dây 2 ngăn 8 (không phải dây 1 ngăn 3) để khỏi nhảy 3→7 trên dây 1 giữa hai chùm ba; cao độ không đổi.
//  · HỢP ÂM Em · Am · D lấy từ ảnh lead sheet ~/Pictures/01_Anh_theo_nam/2026/THANH-PHO-BUON-lam-Phuong_Page_1-1.png
//    (không rõ tác giả bản chép; bản chép này KHÁC score.xml ở vài nốt, chỉ đối chiếu được bằng cao độ).
//    Gióng hợp âm vào score.xml bằng cao độ: ô 1 = Am|Em · ô 2 = D|Em · ô 3 = Em|D · ô 4 = Em|D.
//    Bản in gốc 1973 (~/Downloads/sheet-nhac-thanh-pho-buon-truong-vu.jpg) viết tay, mờ, có hợp âm KHÁC (thấy cả G, Dz/B7…) ⇒ KHÔNG dùng.
//  · Điểm ngắt 3 nhịp và nội dung 2 câu trắc nghiệm là đề xuất, theo khuôn Buổi 05–06.
// CHƯA LÀM: nghe thử · kiểm tay thật · xem trước giao diện Admin.
import type { LessonDoc, FretDot, FretZone } from '../../lesson/lessonTypes'
import { WORK_THANH_PHO_BUON } from './works'

const Z1 = '#4338CA'

const ZONES: FretZone[] = [
  { no: 1, label: 'Vùng 1 — Đầu cần', fromFret: 0, toFret: 3, strings: [1, 6], color: Z1,
    hint: 'ngăn 0–3, cả 6 dây — giống Buổi 01, chỉ đổi một nốt: F → F♯.' },
]

const d = (string: number, fret: number, name: string, root = false): FretDot =>
  ({ string, fret, name, zone: 1, root })

// Bản đồ giản lược G–Em, Vùng 1 (ngăn 0–3). G và E là nốt trụ (root). F♯ thay F.
const DOTS: FretDot[] = [
  d(6, 0, 'E', true), d(6, 2, 'F♯'), d(6, 3, 'G', true),
  d(5, 0, 'A'), d(5, 2, 'B'), d(5, 3, 'C'),
  d(4, 0, 'D'), d(4, 2, 'E', true),
  d(3, 0, 'G', true), d(3, 2, 'A'),
  d(2, 0, 'B'), d(2, 1, 'C'), d(2, 3, 'D'),
  d(1, 0, 'E', true), d(1, 2, 'F♯'), d(1, 3, 'G', true),
]

// ── Bài tập 01 — thang Mi thứ (E F♯ G A B C D E) trên dây 6–5–4, đi lên rồi đi xuống ──
// Ngăn n ⇒ ngón n (như Buổi 01). F♯ là nốt đầu tiên ở ngăn 2 dây 6.
const EX1 = `
\\tempo 60
\\ts 4 4
.
0.6.4 2.6{lf 3}.4 3.6{lf 4}.4 0.5.4 |
2.5{lf 3}.4 3.5{lf 4}.4 0.4.4 2.4{lf 3}.4 |
0.4.4 3.5{lf 4}.4 2.5{lf 3}.4 0.5.4 |
3.6{lf 4}.4 2.6{lf 3}.4 0.6.2
`.trim()

// ── Bài tập 02 — cùng thang trên dây 2–1: Si Đô Rê Mi Fa♯ Sol, lên rồi xuống ──
// Đây là chỗ F♯ nằm ngay trong tầm tay của giai điệu: dây 1 ngăn 2.
const EX2 = `
\\tempo 60
\\ts 4 4
.
0.2.4 1.2{lf 2}.4 3.2{lf 4}.4 0.1.4 |
2.1{lf 3}.4 3.1{lf 4}.4 2.1{lf 3}.4 0.1.4 |
3.1{lf 4}.4 2.1{lf 3}.4 0.1.4 3.2{lf 4}.4 |
1.2{lf 2}.4 0.2.2 r.4
`.trim()

// ── Cùng một câu, hai tông: Am (Buổi 01–05) và Em (tông gốc, hôm nay) — 2 ô, chỉ giai điệu ──
const CAU_AM = `
\\ts 4 4
.
3.2.4 1.2.8{tu 3} 0.1.8{tu 3} 3.2.16{tu 3} 1.2.16{tu 3} 2.3.4 2.3{t}.8{tu 3} 0.3.8{tu 3} 0.2.8{tu 3} |
0.2.4 0.2.8{tu 3} 3.2.8{tu 3} 0.2.16{tu 3} 2.3.16{tu 3} 2.4.4 r.8{tu 3} 3.2.8{tu 3} 0.2.8{tu 3}
`.trim()
const CAU_EM = `
\\ts 4 4
.
5.1.4 8.2.8{tu 3} 7.1.8{tu 3} 5.1.16{tu 3} 3.1.16{tu 3} 0.1.4 0.1{t}.8{tu 3} 3.2.8{tu 3} 2.1.8{tu 3} |
2.1.4 2.1.8{tu 3} 5.1.8{tu 3} 2.1.16{tu 3} 0.1.16{tu 3} 0.2.4 r.8{tu 3} 5.1.8{tu 3} 2.1.8{tu 3}
`.trim()

// ── Đoạn thực hành: 4 ô Thành Phố Buồn giọng Em, melody + bass (mỗi hợp âm một nốt gốc, dây buông) ──
// Hợp âm: Am|Em · D|Em · Em|D · Em|D (xem "CẦN THẦY DUYỆT" ở đầu tệp).
const TPB_EM = `
\\tempo 60
\\ts 4 4
.
5.1.4 8.2.8{tu 3} 7.1.8{tu 3} 5.1.16{tu 3} 3.1.16{tu 3} 0.1.4 0.1{t}.8{tu 3} 3.2.8{tu 3} 2.1.8{tu 3} |
2.1.4 2.1.8{tu 3} 5.1.8{tu 3} 2.1.16{tu 3} 0.1.16{tu 3} 0.2.4 r.8{tu 3} 5.1.8{tu 3} 2.1.8{tu 3} |
0.2.4 2.3.8{tu 3} 0.2.8{tu 3} 0.1.8{tu 3} 2.1.4 r.8{tu 3} 5.1.8{tu 3} 2.1.8{tu 3} |
0.2.4 r.8{tu 3} 2.1.8{tu 3} 0.1.8{tu 3} 3.2.4 2.1.8{tu 3} 5.1.8{tu 3} 3.2.8{tu 3}
\\voice
0.5{ch "Am" rf 1}.2 0.6{ch "Em" rf 1}.2 |
0.4{ch "D" rf 1}.2 0.6{ch "Em" rf 1}.2 |
0.6{ch "Em" rf 1}.2 0.4{ch "D" rf 1}.2 |
0.6{ch "Em" rf 1}.2 0.4{ch "D" rf 1}.2
`.trim()

export const SOLO01_BUOI07: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 7,
    title: 'Bản đồ G–Em',
    stageLabel: 'Chặng 1 · Từ giai điệu đến Solo Guitar',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Từ Buổi 06 sang Buổi 07',
      steps: [
        { label: 'Buổi 01–06 đã có', items: ['Bản đồ C–Am: Vùng 1 – 2 – 3.', 'Melody + Bass cùng lúc, nối nốt, xếp ngón có căn cứ.'] },
        { label: 'Buổi 07 thêm', items: ['Một giọng mới: G–Em — chỉ khác C–Am đúng MỘT nốt, F♯.', 'Đàn Thành Phố Buồn ở tông gốc Em: melody + bass.'] },
      ],
      message: 'Từ Buổi 01 bạn đàn Thành Phố Buồn ở Am — một bản đã hạ tông cho vừa tay. Hôm nay bạn đàn nó ở nơi nó sinh ra, giọng Em.',
    },
    {
      kind: 'objectives',
      title: 'Cuối buổi, bạn làm được',
      items: [
        'Nói được G–Em khác C–Am ở đâu: nốt F biến thành F♯ — nâng lên nửa cung.',
        'Chỉ ra F♯ trên cần đàn (dây 6 ngăn 2, dây 1 ngăn 2) và đàn được thang Mi thứ ở Vùng 1.',
        'Nhận ra cùng một câu hát ở hai tông (Am và Em) là cùng giai điệu, khác vị trí trên cần đàn.',
        'Chọn bass theo hợp âm Em · Am · D bằng quy tắc Buổi 05: nốt bass đầu trùng tên hợp âm.',
        '⭐ QUAN TRỌNG NHẤT — Đàn được 4 ô Thành Phố Buồn giọng Em có melody + bass, chậm mà liền mạch.',
      ],
    },
    // ── NHỊP HỌC (đề xuất, theo khuôn Buổi 05–06 — Thầy chốt lại điểm ngắt nếu cần):
    //    Nhịp 1 BẢN ĐỒ G–Em (7.1 trắc nghiệm) → Nhịp 2 CÙNG CÂU, HAI TÔNG + BASS (7.2 trắc nghiệm) → Nhịp 3 GHÉP VÀO BÀI (7.3 video + chữ, video DUY NHẤT).
    {
      kind: 'note',
      title: 'Nhịp 1 · Bản đồ G–Em và nốt F♯',
      text: 'Xem bản đồ Vùng 1 ở giọng mới, tìm F♯, rồi luyện hai thang Mi thứ (Bài tập kỹ thuật 01 và 02). Kết thúc nhịp: Bài trả 7.1 (trắc nghiệm).',
    },
    {
      kind: 'note',
      title: 'Phần 1 — Chỉ đổi một nốt',
      text: 'Sol trưởng và Mi thứ dùng chung một bộ nốt, và bộ ấy chỉ có MỘT dấu thăng: F♯. So với C–Am, mọi nốt bạn đã biết vẫn ở nguyên chỗ; chỉ F (dây 6 ngăn 1, dây 1 ngăn 1, dây 4 ngăn 3) biến mất, thay bằng F♯ cao hơn nửa cung. Đây chính là quy tắc Buổi 04: nốt ♯ là nốt đã biết dịch nửa cung. Bài Thành Phố Buồn kết ở nốt Mi, nên đây là giọng Mi thứ — người ta nói “G–Em” vì hai giọng cùng chung bộ nốt.',
    },
    {
      kind: 'fretboard',
      title: 'Bản đồ G–Em — Vùng 1',
      lead: 'Cùng khung Vùng 1 của Buổi 01 (ngăn 0–3, cả 6 dây). Nốt trụ: Sol và Mi. Hai nốt F♯ là chỗ mới.',
      frets: 4,
      zones: ZONES,
      dots: DOTS,
      legend: [
        'F♯ — dây 6 ngăn 2 và dây 1 ngăn 2 (F cũ ở ngăn 1 không còn trong giọng này)',
        'Dây 4 ngăn 3 (Fa) cũng không còn; F♯ của dây 4 nằm ở ngăn 4, ngoài Vùng 1, hôm nay chưa dùng',
        'Các nốt còn lại giống hệt Buổi 01',
      ],
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 01',
      title: 'Thang Mi thứ trên dây 6 – 5 – 4',
      lead: 'Từ Mi trầm lên Mi dây 4 rồi xuống lại. F♯ là nốt thứ hai — ngăn 2, dây 6.',
      tempo: 'Tempo: ♩ = 60',
      tex: EX1,
      guidance: [
        'Ngăn n dùng ngón n, như Buổi 01. Đàn chậm, nghe mỗi bước một nửa cung hoặc một cung.',
        'Nghe F♯ — nốt đầu tiên bạn bấm khác Buổi 01. Đàn F (ngăn 1) rồi F♯ (ngăn 2) để thấy nửa cung.',
      ],
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 02',
      title: 'Thang Mi thứ trên dây 2 – 1',
      lead: 'Si Đô Rê Mi Fa♯ Sol — vùng giai điệu của Thành Phố Buồn. F♯ ở dây 1 ngăn 2.',
      tempo: 'Tempo: ♩ = 60',
      tex: EX2,
      guidance: [
        'Đây là nơi F♯ sẽ xuất hiện trong bài: dây 1 ngăn 2, giữa Mi buông và Sol ngăn 3.',
        'Lên rồi xuống, chậm. Thuộc đường đi của ngón tay trước khi tăng tốc.',
      ],
    },
    {
      kind: 'checkpoint',
      id: '7.1',
      title: 'Bài trả 7.1 — Từ C–Am sang G–Em',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Chuyển từ giọng C–Am sang G–Em, nốt nào ở Vùng 1 bị thay?',
        options: [
          { id: 'a', text: 'Nốt F biến thành F♯ (nâng nửa cung).' },
          { id: 'b', text: 'Nốt C biến thành C♯.' },
          { id: 'c', text: 'Nốt G biến thành G♯.' },
          { id: 'd', text: 'Không có nốt nào bị thay.' },
        ],
        hint: 'G–Em chỉ có một dấu thăng. Nhớ lại quy tắc Buổi 04: nốt ♯ là nốt đã biết dịch nửa cung.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 2 · Cùng một câu, hai tông — và bass',
      text: 'So sánh cùng một câu Thành Phố Buồn ở Am (đã học) và ở Em (tông gốc), rồi chọn bass cho các hợp âm Em · Am · D. Kết thúc nhịp: Bài trả 7.2 (trắc nghiệm).',
    },
    {
      kind: 'layers',
      title: 'Cùng một câu, hai tông',
      lead: 'Hai ô đầu của đoạn hôm nay. Giai điệu giống hệt, nhịp giống hệt; chỉ vị trí trên cần đàn khác. Đàn cả hai rồi nghe.',
      layers: [
        { label: 'Buổi 01–05 · tông Am', what: 'Bản bạn đã đàn — hạ tông cho vừa tay, nằm ở dây 1–4, ngăn 0–3.', tex: CAU_AM },
        { label: 'Buổi 07 · tông Em (gốc)', what: 'Cùng câu ở tông gốc — nằm trên dây 1–3, F♯ xuất hiện ở dây 1 ngăn 2.', tex: CAU_EM, current: true },
      ],
      note: 'Nghe lại: hai câu là một câu, chỉ khác tông. Nốt F♯ của bản Em chính là nốt Si của bản Am — cùng một bậc, hai tên khác nhau.',
    },
    {
      kind: 'recap',
      title: 'Phần 2 — Hợp âm nào thì bass nào',
      steps: [
        { label: 'Em', items: ['Gốc: Mi — dây 6 buông', 'Quãng 5: Si — dây 5 ngăn 2 (phải bấm)'] },
        { label: 'Am', items: ['Gốc: La — dây 5 buông', 'Quãng 5: Mi — dây 6 buông'] },
        { label: 'D', items: ['Gốc: Rê — dây 4 buông', 'Quãng 5: La — dây 5 buông'] },
      ],
      message: 'Quy tắc vẫn là của Buổi 05: nốt bass đầu tiên trùng TÊN hợp âm. Hôm nay đoạn đàn đổi hợp âm giữa ô, nên mỗi hợp âm chỉ một nốt gốc — toàn dây buông, tay trái dành hết cho melody.',
    },
    {
      kind: 'checkpoint',
      id: '7.2',
      title: 'Bài trả 7.2 — Bass cho hợp âm D',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Theo quy tắc Buổi 05, nốt bass ĐẦU TIÊN cho hợp âm D là nốt nào?',
        options: [
          { id: 'a', text: 'Rê — dây 4 buông.' },
          { id: 'b', text: 'Mi — dây 6 buông.' },
          { id: 'c', text: 'La — dây 5 buông.' },
          { id: 'd', text: 'Fa♯ — dây 4 ngăn 4.' },
        ],
        hint: 'Nốt bass đầu tiên trùng tên hợp âm.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 3 · Ghép vào bài',
      text: 'Đàn 4 ô Thành Phố Buồn giọng Em: melody ở dây 1–3 và bass gốc ở dây buông. Kết thúc nhịp: Bài trả 7.3 (video + giải thích).',
    },
    {
      kind: 'repertoire',
      title: 'Phần 3 — Áp dụng vào bài',
      candidates: ['Thành Phố Buồn — giọng Em (tông gốc)'],
      status: 'ready',
      pieces: [
        {
          title: 'Thành Phố Buồn — 4 ô giọng Em, melody + bass',
          composer: 'Lam Phương · giọng Em (tông gốc)',
          note: 'Đoạn đi từ “co quyện gốc thông già” tới “…trong sương chiều, anh thấy đẹp” (lời gióng theo cao độ của bản lead sheet, Thầy kiểm lại). Ngón tay trái chưa ghi sẵn — tự xếp có căn cứ như Buổi 04: nhìn cả câu, ngón hôm nay chuẩn bị cho nốt tiếp theo. Bass chỉ dây buông, mỗi hợp âm một nốt.',
          barsPerRow: 2,
          tex: TPB_EM,
        },
        {
          title: 'Thành Phố Buồn — bản giọng Am bạn đã đàn (để đối chiếu)',
          composer: 'Lam Phương · giọng Am (hạ tông 7 nửa cung cho vừa tay)',
          note: 'Bản Buổi 01. Dùng để so với bản Em: cùng giai điệu, khác tông.',
          barsPerRow: 3,
          tex: WORK_THANH_PHO_BUON,
        },
      ],
      annotationTypes: ['Nốt F♯', 'Ngón tay trái', 'Phách bass', 'Lý do chọn', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Bài tập kỹ thuật 01 và 02: mỗi bài 5 phút mỗi ngày, ♩ = 60. Chỉ ra F♯ mỗi lần đàn qua nó.' },
        { label: 'Bài 2.', text: 'Đàn riêng giai điệu 4 ô Thành Phố Buồn giọng Em, chưa bass. Tự xếp ngón tay trái và ghi lại.' },
        { label: 'Bài 3.', text: 'Thêm bass gốc theo hợp âm Am · Em · D. Ô nào bass làm đứt câu hát thì khoanh lại.' },
        { label: 'Bài 4.', text: 'So bản Em với bản Am bạn đã đàn: chỗ nào tay trái dễ hơn, chỗ nào khó hơn? Viết hai câu.' },
      ],
      message: 'Mang các chỗ đã khoanh đến lớp — ta xem cùng nhau và nghe các phương án khác.',
    },
    {
      kind: 'checkpoint',
      id: '7.3',
      title: 'Bài trả 7.3 — Thành Phố Buồn giọng Em của tôi',
      prompt: 'Chơi 4 ô Thành Phố Buồn giọng Em với melody và bass, chậm cũng được. Sau đó viết ngắn: "F♯ trong đoạn này nằm ở… và tôi xếp ngón tay trái như thế này vì…".',
      required: true,
      accepts: ['video_link', 'text'],
    },
    {
      kind: 'checklist',
      items: [
        'Tôi nói được G–Em khác C–Am ở nốt F → F♯.',
        'Tôi chỉ ra được F♯ ở dây 6 ngăn 2 và dây 1 ngăn 2.',
        'Tôi đàn được thang Mi thứ ở Vùng 1.',
        'Tôi chọn được bass gốc cho Em · Am · D.',
        '⭐ Tôi đàn được 4 ô Thành Phố Buồn giọng Em có melody + bass.',
      ],
    },
    { kind: 'studentNotes', title: 'F♯ trong bài nằm ở… và tôi xếp ngón như vậy vì…', lines: 8 },
  ],
}
