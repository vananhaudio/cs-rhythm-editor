// ── DỮ LIỆU các bài học hợp âm (config cho ChordLesson) ───────────────────────
// Thêm bài mới = thêm 1 object ở đây + 1 dòng trong nativeLessons.tsx. Không code lại.
import type { ChordLessonCfg } from './ChordLesson'

// Bài luyện chuyển hợp âm có DẤU NGHỈ — tất cả quạt xuống (bỏ móc đơn). C G7 Am E Dm.
const REST = { rest: true, beats: 4 } as const
export const BASIC_1: ChordLessonCfg = {
  crumb: 'ĐỆM HÁT · CHUYỂN HỢP ÂM',
  title: 'Luyện chuyển hợp âm cơ bản 1',
  practice: false,
  introTitle: 'Chuyển hợp âm — có ô nghỉ',
  intro: 'Bài này luyện chuyển qua lại giữa các hợp âm. Gảy hết một ô rồi tới ô NGHỈ (dấu lặng) — đừng gảy, hãy dùng lúc đó để đặt sẵn ngón sang hợp âm tiếp theo. Mỗi hợp âm gảy số dây khác nhau (xem dưới).',
  learn: ['C', 'G7', 'Am', 'E', 'Dm'],
  learnTips: [
    'Số dây gảy: C = 5 dây · G7 = 6 dây · Am = 5 dây.',
    'E = 6 dây · Dm = 4 dây (tránh 2 dây trầm nhất).',
    'Dấu lặng (nghỉ) = không gảy — tranh thủ đổi ngón cho mượt.',
  ],
  exercises: [
    { name: 'Bài tập 1 · C → G7', short: 'BT1', hint: 'Quạt 4 lần, nghỉ 1 ô, đổi sang G7.', strumPerBeat: true,
      cells: [{ chord: 'C', beats: 4 }, { ...REST }, { chord: 'G7', beats: 4 }, { ...REST }] },
    { name: 'Bài tập 2 · Am → E', short: 'BT2', hint: 'Quạt 4 lần, nghỉ 1 ô, đổi sang E.', strumPerBeat: true,
      cells: [{ chord: 'Am', beats: 4 }, { ...REST }, { chord: 'E', beats: 4 }, { ...REST }] },
    { name: 'Bài tập 3 · C → Am', short: 'BT3', hint: 'Quạt 4 lần, nghỉ 1 ô, đổi sang Am.', strumPerBeat: true,
      cells: [{ chord: 'C', beats: 4 }, { ...REST }, { chord: 'Am', beats: 4 }, { ...REST }] },
    { name: 'Bài tập 4 · Am → Dm', short: 'BT4', hint: 'Dm chỉ gảy 4 dây — cẩn thận dây trầm.', strumPerBeat: true,
      cells: [{ chord: 'Am', beats: 4 }, { ...REST }, { chord: 'Dm', beats: 4 }, { ...REST }] },
    { name: 'Bài tập 5 · Dm → G7', short: 'BT5', hint: 'Dm 4 dây ↔ G7 6 dây — chuyển hơi xa, đi chậm.', strumPerBeat: true,
      cells: [{ chord: 'Dm', beats: 4 }, { ...REST }, { chord: 'G7', beats: 4 }, { ...REST }] },
    { name: 'Bài tập 6 · C – Am – Dm – G7', short: 'BT6', hint: 'Mỗi ô gảy 1 lần (phách 1) rồi nghỉ, đổi hợp âm mỗi ô.', strumPerBeat: true,
      cells: [{ chord: 'C', beats: 4, oneHit: true }, { chord: 'Am', beats: 4, oneHit: true }, { chord: 'Dm', beats: 4, oneHit: true }, { chord: 'G7', beats: 4, oneHit: true }] },
  ],
  quiz: [
    { q: 'Dấu lặng (nghỉ) trong bài nghĩa là gì?', opts: ['Không gảy — để kịp đổi sang hợp âm sau', 'Quạt mạnh gấp đôi', 'Gảy nhẹ 1 cái'], correct: 0,
      explain: 'Ô nghỉ là lúc dừng gảy, tranh thủ đặt ngón sang hợp âm tiếp theo cho mượt.' },
    { q: 'Hợp âm Dm gảy mấy dây?', opts: ['4 dây (tránh 2 dây trầm)', '6 dây', 'Cả 6 dây'], correct: 0,
      explain: 'Dm là hợp âm 4 dây — chỉ gảy từ dây 4 trở xuống.' },
    { q: 'Bài tập 6 mỗi ô gảy thế nào?', opts: ['Gảy 1 lần ở phách 1 rồi nghỉ', 'Quạt đủ 4 lần', 'Không gảy'], correct: 0,
      explain: 'Mỗi ô chỉ gảy 1 cú ở phách 1, 3 phách sau nghỉ — rồi đổi hợp âm sang ô kế.' },
  ],
}

// Bài QUẠT CHÙM 2 (xuống–lên mỗi phách) — nối tiếp bài lý thuyết "Chùm 2 nốt móc đơn".
// Hợp âm đã học (C G7 Am E Dm); bài này tập TAY PHẢI: mỗi phách quạt XUỐNG rồi LÊN.
export const QUAT_CHUM2: ChordLessonCfg = {
  crumb: 'ĐỆM HÁT · QUẠT CHÙM 2',
  title: 'Tập quạt chùm 2 (xuống–lên)',
  practice: false,
  introTitle: '╱╲ = quạt XUỐNG rồi LÊN trong một phách',
  intro: 'Nhớ bài Chùm 2: một phách = hai nốt móc đơn. Tay phải làm đúng như vậy — mỗi phách quạt XUỐNG (╱) rồi LÊN (╲), đều như con lắc. App gõ thêm tiếng "và" giữa phách để bạn đặt cú quạt lên cho đúng chỗ. Hợp âm bạn đã học rồi, bài này chỉ tập tay quạt và giữ nhịp.',
  learn: ['C', 'G7', 'Am', 'E', 'Dm'],
  learnTips: [
    'Xuống – lên là một chuyển động liên tục của cổ tay, không khựng giữa chừng.',
    'Cú LÊN nhẹ hơn cú xuống, chỉ lướt qua vài dây cao là đủ.',
    'Theo tiếng metronome: “1” quạt xuống, “và” quạt lên — đều tay.',
  ],
  exercises: [
    { name: 'Bài tập 1 · chỉ tay phải (C)', short: 'BT1',
      hint: 'Giữ một hợp âm C, chỉ lo tay quạt: xuống–lên đều suốt 2 ô. Đi chậm trước.',
      strumPerBeat: true,
      cells: [{ chord: 'C', beats: 8, eighths: true }] },
    { name: 'Bài tập 2 · C ↔ G7 chùm 2', short: 'BT2',
      hint: 'Quạt xuống–lên mỗi phách, đổi hợp âm mỗi ô: C – G7 – C – G7.',
      strumPerBeat: true,
      cells: [{ chord: 'C', beats: 4, eighths: true }, { chord: 'G7', beats: 4, eighths: true }, { chord: 'C', beats: 4, eighths: true }, { chord: 'G7', beats: 4, eighths: true }] },
    { name: 'Bài tập 3 · Am ↔ E chùm 2', short: 'BT3',
      hint: 'Khối 3 ngón trượt giữa Am và E; tay phải vẫn xuống–lên đều.',
      strumPerBeat: true,
      cells: [{ chord: 'Am', beats: 4, eighths: true }, { chord: 'E', beats: 4, eighths: true }, { chord: 'Am', beats: 4, eighths: true }, { chord: 'E', beats: 4, eighths: true }] },
    { name: 'Bài tập 4 · Am ↔ Dm chùm 2', short: 'BT4',
      hint: 'Dm chỉ gảy 4 dây — cú quạt gọn lại, tránh 2 dây trầm.',
      strumPerBeat: true,
      cells: [{ chord: 'Am', beats: 4, eighths: true }, { chord: 'Dm', beats: 4, eighths: true }, { chord: 'Am', beats: 4, eighths: true }, { chord: 'Dm', beats: 4, eighths: true }] },
    { name: 'Bài tập 5 · vòng C–Am–Dm–G7', short: 'BT5',
      hint: 'Chùm 2 cả vòng, ô cuối giữ nốt tròn (◇) cho gọn kết.',
      strumPerBeat: true,
      cells: [{ chord: 'C', beats: 4, eighths: true }, { chord: 'Am', beats: 4, eighths: true }, { chord: 'Dm', beats: 4, eighths: true }, { chord: 'G7', beats: 4, eighths: true }, { chord: 'C', beats: 4, hold: true }] },
  ],
  quiz: [
    { q: 'Ký hiệu ╱╲ trong bài nghĩa là gì?', opts: ['Một phách quạt xuống rồi lên (chùm 2)', 'Quạt xuống hai lần', 'Nghỉ một phách'], correct: 0,
      explain: 'Mỗi phách có 2 cú: ╱ quạt xuống rồi ╲ quạt lên — đúng như chùm 2 nốt móc đơn.' },
    { q: 'Một phách quạt chùm 2 thì tay phải gảy mấy lần?', opts: ['2 lần (xuống + lên)', '1 lần', '4 lần'], correct: 0,
      explain: 'Chùm 2 = hai nốt móc đơn trong một phách → tay quạt xuống rồi lên, 2 lần.' },
    { q: 'Cú quạt LÊN nên thế nào?', opts: ['Nhẹ hơn, chỉ lướt vài dây cao', 'Mạnh hơn cú xuống', 'Gảy đủ cả 6 dây thật mạnh'], correct: 0,
      explain: 'Cú lên nhẹ và lướt qua vài dây cao là đủ — nhờ vậy tiếng đều và cổ tay không bị khựng.' },
  ],
}

// Bài ĐẦU về quạt: giải thích Downstroke, KHÔNG dạy bấm hợp âm (đã học), bỏ bước làm quen.
export const C_G7: ChordLessonCfg = {
  crumb: 'ĐỆM HÁT · QUẠT HỢP ÂM',
  title: 'Quạt hợp âm: C và G7',
  practice: false,
  introTitle: 'Gạch chéo ╱ = Quạt xuống (Downstroke)',
  intro: 'Mỗi dấu ╱ là một lần QUẠT XUỐNG: tay phải lướt từ dây trầm xuống dây cao, đều và dứt khoát. Dấu ◇ là gảy 1 lần rồi để hợp âm ngân hết ô. Hợp âm C và G7 bạn đã học ở chương trước — bài này tập quạt và giữ nhịp.',
  learn: ['C', 'G7'],
  learnTips: [
    'Quạt bằng cổ tay thả lỏng, không gồng cả cánh tay.',
    'Mỗi gạch ╱ = một cú quạt xuống dứt khoát, đều tay.',
    '◇ (nốt tròn): quạt 1 lần, để ngân hết ô rồi mới đổi hợp âm.',
  ],
  exercises: [
    {
      name: 'Bài tập 1 · C – G7 (nốt tròn)', short: 'BT1',
      hint: 'Gảy 1 lần rồi giữ ngân đủ 4 phách, sang ô mới thì đổi.',
      strumPerBeat: false,
      cells: [{ chord: 'C', beats: 4 }, { chord: 'G7', beats: 4 }, { chord: 'C', beats: 4 }, { chord: 'G7', beats: 4 }, { chord: 'C', beats: 4 }],
    },
    {
      name: 'Bài tập 2 · giữ hợp âm 2 ô', short: 'BT2',
      hint: 'Quạt xuống mỗi phách. C giữ 2 ô, G7 giữ 2 ô, rồi về C.',
      strumPerBeat: true,
      cells: [{ chord: 'C', beats: 8 }, { chord: 'G7', beats: 8 }, { chord: 'C', beats: 4 }],
    },
    {
      name: 'Bài tập 3 · đổi mỗi ô', short: 'BT3',
      hint: 'Quạt xuống 4 lần mỗi ô, đổi hợp âm mỗi ô: C – G7 – C – G7 – C.',
      strumPerBeat: true,
      cells: [{ chord: 'C', beats: 4 }, { chord: 'G7', beats: 4 }, { chord: 'C', beats: 4 }, { chord: 'G7', beats: 4 }, { chord: 'C', beats: 4 }],
    },
  ],
  quiz: [
    {
      q: 'Dấu gạch chéo ╱ nghĩa là gì?',
      opts: ['Một lần quạt xuống (downstroke)', 'Một lần gảy lên', 'Nghỉ một phách'],
      correct: 0,
      explain: 'Mỗi ╱ là một cú quạt xuống — tay phải lướt từ dây trầm xuống dây cao.',
    },
    {
      q: 'Nốt tròn ◇ nghĩa là gì?',
      opts: ['Quạt 1 lần rồi giữ ngân cả ô (4 phách)', 'Quạt xuống 4 lần', 'Không chơi gì'],
      correct: 0,
      explain: 'Nốt tròn = gảy 1 lần và để hợp âm ngân đủ 4 phách rồi mới đổi.',
    },
    {
      q: 'Quạt xuống đúng cách nên thế nào?',
      opts: ['Cổ tay thả lỏng, quạt dứt khoát và đều', 'Gồng cứng cả cánh tay', 'Chỉ gảy đúng 1 dây'],
      correct: 0,
      explain: 'Quạt bằng cổ tay thả lỏng, đều tay — tiếng mới gọn và giữ được nhịp.',
    },
  ],
}

export const AM_E: ChordLessonCfg = {
  crumb: 'BÀI TẬP HỢP ÂM · Am & E',
  title: 'Hợp âm Am và E',
  introTitle: 'Hai hợp âm: Am và E',
  intro: 'Am (La thứ) và E (Mi trưởng) dùng chung một "khối 3 ngón" — đổi qua lại chỉ là trượt khối ngón sang dây bên cạnh. Quen tay thì đổi rất nhanh.',
  learn: ['Am', 'E'],
  learnTips: [
    'Am: ngón 1 ở dây 2 (ngăn 1), ngón 2–3 ở dây 4–3 (ngăn 2).',
    'E: trượt cả 3 ngón sang 1 dây trầm hơn — ngón 1 ở dây 3, ngón 2–3 ở dây 5–4.',
    'Mẹo: giữ nguyên hình "khối 3 ngón", chỉ trượt sang dây bên cạnh.',
  ],
  exercises: [
    {
      name: 'Bài tập 1 · Am ↔ E (nốt tròn)', short: 'BT1',
      hint: 'Gảy 1 lần rồi giữ ngân đủ 4 phách, sang ô mới thì đổi. Đổi đều Am – E.',
      strumPerBeat: false,
      cells: [{ chord: 'Am', beats: 4 }, { chord: 'E', beats: 4 }, { chord: 'Am', beats: 4 }, { chord: 'E', beats: 4 }, { chord: 'Am', beats: 4 }],
    },
    {
      name: 'Bài tập 2 · C – Am – E – G7', short: 'BT2',
      hint: 'Quạt xuống 4 lần mỗi ô (/ / / /), đổi hợp âm mỗi ô.',
      strumPerBeat: true,
      cells: [{ chord: 'C', beats: 4 }, { chord: 'Am', beats: 4 }, { chord: 'E', beats: 4 }, { chord: 'G7', beats: 4 }, { chord: 'C', beats: 4, hold: true }],
    },
    {
      name: 'Bài tập 3 · chuỗi dài', short: 'BT3',
      hint: 'Có ô 2 hợp âm — mỗi hợp âm 2 phách (C–Am, rồi E–Am). G7 và C trọn 4 phách.',
      strumPerBeat: true,
      cells: [{ chord: 'C', beats: 2 }, { chord: 'Am', beats: 2 }, { chord: 'G7', beats: 4 }, { chord: 'E', beats: 2 }, { chord: 'Am', beats: 2 }, { chord: 'C', beats: 4, hold: true }],
    },
  ],
  quiz: [
    {
      q: 'Mẹo đổi nhanh giữa Am và E là gì?',
      opts: ['Trượt cả 3 ngón sang 1 dây, giữ nguyên ngăn phím', 'Nhấc cả bàn tay ra rồi đặt lại từ đầu', 'Chỉ cần đổi ngón 1, hai ngón kia giữ nguyên'],
      correct: 0,
      explain: 'Am và E cùng hình "khối 3 ngón" — chỉ trượt sang dây bên cạnh, giữ nguyên ngăn, nên đổi rất mượt.',
    },
    {
      q: 'Nốt tròn ◇ ở Bài tập 1 nghĩa là gì?',
      opts: ['Gảy 1 lần rồi giữ ngân đủ ô (4 phách)', 'Quạt xuống 4 lần mỗi ô', 'Không gảy, chỉ bấm im'],
      correct: 0,
      explain: 'Nốt tròn = gảy 1 lần và ngân đủ 4 phách rồi mới đổi hợp âm.',
    },
    {
      q: 'Dấu / / / / trên một ô nghĩa là?',
      opts: ['Quạt xuống 4 lần (4 phách) trong ô đó', 'Gảy đúng 1 lần', 'Ô nghỉ, không chơi'],
      correct: 0,
      explain: 'Mỗi gạch chéo = 1 lần quạt xuống; 4 gạch = quạt đủ 4 phách của ô.',
    },
  ],
}
