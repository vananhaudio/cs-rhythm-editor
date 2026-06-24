// ── DỮ LIỆU các bài học hợp âm (config cho ChordLesson) ───────────────────────
// Thêm bài mới = thêm 1 object ở đây + 1 dòng trong nativeLessons.tsx. Không code lại.
import type { ChordLessonCfg } from './ChordLesson'

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
      cells: [{ chord: 'C', beats: 4 }, { chord: 'Am', beats: 4 }, { chord: 'E', beats: 4 }, { chord: 'G7', beats: 4 }, { chord: 'C', beats: 4 }],
    },
    {
      name: 'Bài tập 3 · chuỗi dài', short: 'BT3',
      hint: 'Có ô 2 hợp âm — mỗi hợp âm 2 phách (C–Am, rồi E–Am). G7 và C trọn 4 phách.',
      strumPerBeat: true,
      cells: [{ chord: 'C', beats: 2 }, { chord: 'Am', beats: 2 }, { chord: 'G7', beats: 4 }, { chord: 'E', beats: 2 }, { chord: 'Am', beats: 2 }, { chord: 'C', beats: 4 }],
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
