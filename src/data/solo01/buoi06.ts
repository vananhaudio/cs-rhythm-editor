// ── SOLO-01 · BUỔI 06 — BẢN THẢO (29/10/2026, Claude soạn, CHỜ THẦY DUYỆT) ──
// Chưa nằm trong repo. Khi Thầy duyệt: chép thành src/data/solo01/buoi06.ts rồi đăng ký 3 chỗ
// theo docs/GIAO-TRINH-CHUAN.md §5 (Solo01LessonPage LESSONS · solo01Program doc/unlockAt · programTemplates).
// Nguồn nội dung: solo01Program.ts (Chặng 1, buổi 6 "Melody + Bass cùng lúc": phối hợp p với i–m ·
// bắt đầu xử lý xếp ngón tay trái · kết hợp các kỹ thuật đã học) + khung SOLO01 Buổi 05.
// KHÔNG tự tạo bản nhạc mới: toàn bộ melody lấy NGUYÊN từ WORK_DIEM_XUA_BASS (Diễm Xưa ô 1–4);
// chỉ bè bass được viết lại thành 2 nốt/ô (gốc ↔ quãng 5) theo đúng quy tắc Buổi 05.
// Đáp án trắc nghiệm KHÔNG ở đây → solo01-buoi06.keys-private.json (đưa vào repo PRIVATE).
import type { LessonDoc } from '../../lesson/lessonTypes'
import { WORK_DIEM_XUA_BASS, WORK_DIEM_XUA_B5 } from './works'

// ── Bài tập 01 — Diễm Xưa ô 1–4: melody + bass LUÂN PHIÊN (gốc ↔ quãng 5) ──
// Melody = y nguyên 4 ô đầu của WORK_DIEM_XUA_BASS. Bass: Am (La–Mi) · A7 (La–Mi) · Dm (Rê–La).
// Bass vào ở phách 1 và 3; phách 3 trùng nốt melody → "bật cùng lúc".
const EX1 = `
\\tempo 60
\\ts 4 4
.
r.8 0.1.8 1.1.8 0.1.8 0.1.8 1.2.8 2.3.8 1.2.8 |
2.4.1 |
r.8 2.3.8 1.2.8 0.1.8 3.1.8 3.1.8 5.1.8 0.1.8 |
3.2.1
\\voice
0.5{ch "Am" rf 1}.2 0.6{rf 1}.2 |
0.5{rf 1}.2 0.6{rf 1}.2 |
0.5{rf 1}.2 0.6{ch "A7" rf 1}.2 |
0.4{ch "Dm" rf 1}.2 0.5{rf 1}.2
`.trim()

// ── Hai cấp của CÙNG hai ô nhịp (ô 3–4): bass 1 nốt/ô (Buổi 02–03) → bass 2 nốt/ô (hôm nay) ──
const LOP_B2 = `
\\ts 4 4
.
r.8 2.3.8 1.2.8 0.1.8 3.1.8 3.1.8 5.1.8 0.1.8 |
3.2.1
\\voice
0.5{ch "Am" rf 1}.2 0.5{ch "A7" rf 1}.2 |
0.4{ch "Dm" rf 1}.1
`.trim()
const LOP_B6 = `
\\ts 4 4
.
r.8 2.3.8 1.2.8 0.1.8 3.1.8 3.1.8 5.1.8 0.1.8 |
3.2.1
\\voice
0.5{ch "Am" rf 1}.2 0.6{ch "A7" rf 1}.2 |
0.4{ch "Dm" rf 1}.2 0.5{rf 1}.2
`.trim()

// ── Bài tập 02 — Ô 6: bass Si (dây 5 ngăn 2) cùng ngăn với melody Mi (dây 4 ngăn 2) ──
// Hai nốt cùng ngăn 2 trên hai dây liền kề. Chỉ ghi MỘT cách xếp (hai ngón riêng: Si ngón 2, Mi ngón 3 — cũng là thế E).
// ⚠️ CẦN KIỂM TAY THẬT: ngón xếp này theo thế E phổ thông; nếu thế E của Thầy dạy ở Khởi đầu đam mê khác thì đổi theo Thầy.
// ĐÃ BỎ 'Cách B' (Si ngón 3, Mi ngón 2): hai ngón bắt chéo nhau, khó và dễ dạy sai.
const EX2_A = `
\\tempo 60
\\ts 4 4
.
2.4{lf 4}.1 | 2.4{lf 4}.1
\\voice
0.6{ch "E" rf 1}.2 2.5{lf 3 rf 1}.2 | 0.6{rf 1}.2 2.5{lf 3 rf 1}.2
`.trim()

export const SOLO01_BUOI06: LessonDoc = {
  meta: {
    programCode: 'SOLO-01',
    programName: 'SOLO GUITAR CĂN BẢN',
    sessionNo: 6,
    title: 'Melody + Bass cùng lúc',
    stageLabel: 'Chặng 1 · Từ giai điệu đến Solo Guitar',
    backHref: '/solo01',
  },
  sections: [
    {
      kind: 'recap',
      title: 'Từ Buổi 05 sang Buổi 06',
      steps: [
        { label: 'Buổi 05 đã có', items: ['Bạn tự chọn bass theo tên hợp âm.', 'Bạn biết ba cách nối: gảy lại · trượt · luyến.'] },
        { label: 'Buổi 06 thêm', items: ['Chơi bass bạn chọn CÙNG LÚC với melody.', 'Tay trái bận hơn — bạn xếp ngón có căn cứ.'] },
      ],
      message: 'Buổi 05 bạn viết bass lên giấy. Hôm nay bass ấy phải vang lên cùng câu hát — và đó là lúc hai tay cùng làm việc.',
    },
    {
      kind: 'objectives',
      title: 'Cuối buổi, bạn làm được',
      items: [
        'Ngón cái p gảy bass, i – m gảy melody, và hai việc ấy rơi cùng lúc ở phách trùng.',
        'Nghe rõ melody vẫn nổi hơn bass khi cả hai vang cùng nhau.',
        'Nhận ra chỗ tay trái bị bận (hai nốt cùng ngăn, hai dây liền kề) và xếp ngón có căn cứ cho chúng.',
        'Giữ được cách nối (gảy lại · trượt · luyến) bạn đã chọn ở Buổi 05 khi có thêm bass.',
        '⭐ QUAN TRỌNG NHẤT — Đàn được 4 ô đầu Diễm Xưa có melody + bass của chính bạn, chậm mà liền mạch.',
      ],
    },
    // ── NHỊP HỌC (đề xuất, theo khuôn Buổi 05 — Owner chốt lại điểm ngắt nếu cần):
    //    Nhịp 1 HAI TAY (6.1 trắc nghiệm) → Nhịp 2 TAY TRÁI (6.2 trắc nghiệm) → Nhịp 3 GHÉP VÀO BÀI (6.3 video + chữ, video DUY NHẤT).
    {
      kind: 'note',
      title: 'Nhịp 1 · Hai tay, hai việc',
      text: 'p lo bass, i – m lo melody; nhìn bass lớn lên từ 1 nốt thành 2 nốt mỗi ô, rồi luyện Bài tập kỹ thuật 01. Kết thúc nhịp: Bài trả 6.1 (trắc nghiệm).',
    },
    {
      kind: 'note',
      title: 'Phần 1 — Phách nào bật cùng lúc, phách nào đi riêng',
      text: 'Bass đứng ở phách 1 và phách 3. Melody đi đều hơn. Vì vậy có phách bass và melody cùng vang (bật cùng lúc: p và i/m cùng gảy), có phách chỉ melody đi một mình. Việc khó nhất không phải ngón nào đi đâu — mà là ngón cái p và ngón i – m không kéo nhau: p không làm i – m chậm lại, i – m không làm p gảy vội.',
    },
    {
      kind: 'layers',
      title: 'Cùng hai ô nhịp, bass lớn lên',
      lead: 'Diễm Xưa ô 3–4. Melody GIỮ NGUYÊN, chỉ phần bass thay đổi. Đàn cả hai rồi nghe.',
      layers: [
        { label: 'Buổi 02–03', what: 'Bass một nốt cho mỗi nửa ô — phần nền đứng yên.', tex: LOP_B2 },
        { label: 'Buổi 06', what: 'Bass gốc ↔ quãng 5 — phần nền đi bước một dưới giai điệu.', tex: LOP_B6, current: true },
      ],
      note: 'Nghe lại: melody vẫn là nhân vật chính. Nếu bass át tiếng hát, giảm lực ngón cái trước khi nghĩ đến chuyện gì khác.',
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 01',
      title: 'Diễm Xưa ô 1–4: melody + bass luân phiên',
      lead: 'Melody y nguyên bản Thầy đã dùng từ Buổi 02. Bass: Am (La–Mi) · A7 (La–Mi) · Dm (Rê–La), vào ở phách 1 và phách 3.',
      tempo: 'Tempo: ♩ = 60',
      tex: EX1,
      marks: [
        { at: 'Ô 1', text: 'bass La (dây 5 buông) vào trước, melody vào sau nửa phách; phách 3 bass Mi cùng melody Mi' },
        { at: 'Ô 3', text: 'phách 3 trùng nốt melody Sol (dây 1 ngăn 3) với bass Mi dây 6 buông — hai việc rơi một lúc' },
        { at: 'Ô 4', text: 'Dm: bass Rê (dây 4) rồi La (dây 5), cả hai đều là dây buông' },
      ],
      guidance: [
        'Chậm đến mức bật cùng lúc thật sự là cùng lúc — nghe hai tiếng làm một.',
        'Chưa đều thì đừng tăng tempo. Tập từng ô, rồi mới nối.',
        'Melody phải nghe rõ hơn bass ở mọi phách.',
      ],
    },
    {
      kind: 'checkpoint',
      id: '6.1',
      title: 'Bài trả 6.1 — Bass và melody vang cùng lúc',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Ở phách có cả nốt Bass lẫn nốt Melody, cách chơi nào đúng?',
        options: [
          { id: 'a', text: 'Gảy Bass trước, rồi mới gảy Melody sau một chút.' },
          { id: 'b', text: 'Ngón p gảy Bass và ngón i hoặc m gảy Melody cùng lúc, Melody nghe rõ hơn.' },
          { id: 'c', text: 'Bỏ Melody ở phách đó để Bass vang trọn vẹn.' },
          { id: 'd', text: 'Gảy Bass thật mạnh để tiếng nền chắc.' },
        ],
        hint: 'Hai tay cùng làm việc, nhưng nhân vật chính vẫn là câu hát.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 2 · Tay trái bận hơn',
      text: 'Khi có bass, một số chỗ tay trái phải giữ hai nốt cùng lúc. Nhận ra chỗ đó, xếp ngón có căn cứ, và nói được vì sao. Kết thúc nhịp: Bài trả 6.2 (trắc nghiệm).',
    },
    {
      kind: 'note',
      title: 'Phần 2 — Chỗ tay trái bị bận',
      text: 'Ở Buổi 05 bạn có thể chọn Si (dây 5 ngăn 2) làm bass quãng 5 của hợp âm E. Ô 6 của Diễm Xưa, melody lại là Mi ở dây 4 ngăn 2. Hai nốt cùng ngăn 2 trên hai dây liền kề, vang cùng lúc, tay trái phải giữ cả hai. Cách phổ thông là hai ngón riêng, mỗi ngón một nốt (Si ngón 2, Mi ngón 3); có thể còn cách khác. Như Buổi 04: Thầy không chấm bạn xếp giống Thầy; Thầy hỏi vì sao bạn xếp vậy.',
    },
    {
      kind: 'score',
      subtitle: 'Bài tập kỹ thuật 02',
      title: 'Ô 6 — Si và Mi cùng ngăn 2, hai ngón riêng',
      lead: 'Bass Mi dây buông rồi Si (ngón 2); melody Mi giữ trọn ô bằng ngón 3. Đây cũng là thế tay trái của hợp âm E.',
      tempo: 'Tempo: ♩ = 60',
      tex: EX2_A,
      guidance: [
        'Chỉ có hai ô, lặp lại để tay quen: bấm xong cả hai nốt rồi mới gảy.',
        'Hai ngón riêng cho hai nốt là cách xếp phổ thông (cũng là thế hợp âm E). Bạn nghĩ ra cách khác thì thử, nghe, rồi ghi lại vì sao.',
        'Nghĩ trước: ô 7 melody đi sang dây 3 ngăn 1 — ngón nào đang sẵn cho nốt đó?',
      ],
    },
    {
      kind: 'checkpoint',
      id: '6.2',
      title: 'Bài trả 6.2 — Hai nốt cùng ngăn',
      required: true,
      accepts: ['quiz'],
      quiz: {
        mode: 'single',
        question: 'Bass Si (dây 5 ngăn 2) và melody Mi (dây 4 ngăn 2) cần vang cùng lúc. Cách nghĩ nào đúng?',
        options: [
          { id: 'a', text: 'Chỉ có một cách xếp ngón đúng và phải giống Thầy.' },
          { id: 'b', text: 'Thử vài cách xếp ngón (ví dụ hai ngón riêng cho hai nốt), chọn cách thuận tay và giải thích được vì sao.' },
          { id: 'c', text: 'Bỏ nốt melody để bấm được bass.' },
          { id: 'd', text: 'Đổi hẳn bass sang dây 1.' },
        ],
        hint: 'Như Buổi 04: không có đáp án duy nhất, nhưng có căn cứ để chọn.',
      },
    },
    {
      kind: 'note',
      title: 'Nhịp 3 · Ghép vào bài',
      text: 'Đàn 4 ô đầu Diễm Xưa với melody + bass bạn tự chọn ở Buổi 05, giữ cách nối bạn đã chọn. Kết thúc nhịp: Bài trả 6.3 (video + giải thích).',
    },
    {
      kind: 'repertoire',
      title: 'Phần 3 — Áp dụng vào bài',
      candidates: ['Diễm Xưa — melody + bass bạn tự chọn'],
      status: 'ready',
      pieces: [
        {
          title: 'Diễm Xưa ô 1–8 — bản bass của bạn',
          composer: 'Trịnh Công Sơn · giọng Am',
          note: 'Dùng đúng bản Buổi 05: melody và tên hợp âm, bass bạn đã điền. Hôm nay đàn melody và bass CÙNG LÚC, bắt đầu từ ô 1–4. Chỗ luyến Thầy ghi sẵn ở ô 3 vẫn giữ.',
          barsPerRow: 2,
          tex: WORK_DIEM_XUA_B5,
        },
        {
          title: 'Diễm Xưa — bản Thầy dùng từ Buổi 02 (để đối chiếu bass)',
          composer: 'Trịnh Công Sơn · giọng Am',
          note: 'Bass một nốt cho mỗi nửa ô. Bass của bạn đi nhiều nốt hơn — nghe xem bản nào nền chắc hơn, bản nào giữ câu hát liền hơn.',
          barsPerRow: 3,
          tex: WORK_DIEM_XUA_BASS,
        },
      ],
      annotationTypes: ['Phách bật cùng lúc', 'Ngón tay trái', 'Chỗ tay trái bận', 'Lý do chọn', 'Ghi chú của giáo viên'],
    },
    {
      kind: 'assignment',
      items: [
        { label: 'Bài 1.', text: 'Bài tập kỹ thuật 01: từng ô rồi nối cả 4 ô, ♩ = 60, 5 phút mỗi ngày. Nghe hai tiếng bật cùng lúc có thành một không.' },
        { label: 'Bài 2.', text: 'Bài tập kỹ thuật 02: đàn chậm, lặp lại. Bạn có cách xếp ngón khác không? Thử và ghi "Tôi chọn cách này vì…".' },
        { label: 'Bài 3.', text: 'Đàn 4 ô đầu Diễm Xưa với bass bạn điền ở Buổi 05. Ô nào tay trái vướng thì khoanh lại.' },
        { label: 'Bài 4.', text: 'Ô nào bass làm đứt câu hát, đổi bass hoặc bỏ bass ô đó; ghi lý do.' },
      ],
      message: 'Mang các ô đã khoanh đến lớp — ta xem từng chỗ vướng và cùng nghe các phương án khác nhau.',
    },
    {
      kind: 'checkpoint',
      id: '6.3',
      title: 'Bài trả 6.3 — Melody + Bass của tôi',
      prompt: 'Chơi 4 ô đầu Diễm Xưa với melody và bass của bạn vang cùng lúc, chậm cũng được. Sau đó viết ngắn: "Chỗ tay trái khó nhất của tôi là… và tôi xếp ngón như thế này vì…".',
      required: true,
      accepts: ['video_link', 'text'],
    },
    {
      kind: 'checklist',
      items: [
        'Tôi gảy bass bằng p và melody bằng i – m ở phách trùng mà hai tiếng vang cùng lúc.',
        'Tôi nghe rõ melody hơn bass.',
        'Tôi nhận ra chỗ tay trái bị bận và xếp ngón có căn cứ.',
        'Tôi giữ được cách nối đã chọn ở Buổi 05 khi có thêm bass.',
        '⭐ Tôi đàn được 4 ô đầu Diễm Xưa có melody + bass của mình.',
      ],
    },
    { kind: 'studentNotes', title: 'Chỗ tay trái khó nhất của tôi là… vì…', lines: 8 },
  ],
}
