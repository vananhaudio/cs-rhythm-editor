// ── Khởi Đầu Đam Mê — Nhập Môn · DỮ LIỆU BÀI HỌC ───────────────────────────────
// Đây là nơi thầy chỉnh nội dung 11 bài: mục tiêu (goal), các bước (steps),
// câu nhắc thao tác (prompt), và loại widget tương tác (thao.type).
// Sửa text ở đây là bài học trên app đổi theo ngay.

export const ACCENT = { a: '#3F6B4E', s: '#E3EDE6', d: '#2E5239', c1: '#C2622E' }

export interface StringInfo { n: number; note: string; vn: string }
// 6 dây đàn — thứ tự mảng: dây 6 (trầm) → dây 1 (cao)
export const STR: StringInfo[] = [
  { n: 6, note: 'E', vn: 'Mi' }, { n: 5, note: 'A', vn: 'La' },
  { n: 4, note: 'D', vn: 'Rê' }, { n: 3, note: 'G', vn: 'Sol' },
  { n: 2, note: 'B', vn: 'Si' }, { n: 1, note: 'E', vn: 'Mí' },
]
export const PSEQ = [5, 4, 3, 2, 1, 0] // thứ tự hiển thị: dây 1 (trên cùng) → dây 6 (dưới cùng)
export const FREQ = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63] // Hz cho từng dây (theo index STR)
export const strColor = (i: number) => (i === 0 ? ACCENT.a : i === 5 ? ACCENT.c1 : '#C2BAA9')

export type ThaoType = 'check' | 'neck' | 'tool' | 'listen8'
export interface Thao { type: ThaoType; items?: string[] }
export interface LessonDef {
  crumb: string
  title: string
  result: string
  dur: string
  goal: string
  steps: string[]
  prompt: string
  thao: Thao
}

export const LESSONS: Record<number, LessonDef> = {
  1: { crumb: 'Phần 1 · Bài 1', title: 'Chọn cây đàn phù hợp', result: 'Biết nên mua loại đàn nào', dur: '5 phút',
    goal: 'Biết nên chuẩn bị guitar classic, acoustic hay điện theo nhu cầu của bạn.',
    steps: ['Classic (dây nilon): cần to, dây mềm — hợp người mới, ngón đỡ đau.', 'Acoustic (dây sắt): tiếng sáng, đệm hát hay — dây hơi cứng hơn.', 'Đàn điện: cần loa & nguồn — để sau cũng được.'],
    prompt: 'Tự đánh dấu khi đã rõ:', thao: { type: 'check', items: ['Mình hiểu khác biệt classic / acoustic / điện', 'Mình chọn được loại phù hợp với mình'] } },
  2: { crumb: 'Phần 1 · Bài 2', title: 'Kiểm tra đàn trước khi học', result: 'Biết đàn có học được không', dur: '5 phút',
    goal: 'Biết cây đàn hiện có còn dùng để học được không — tránh tập trên đàn quá khó bấm.',
    steps: ['Nhìn dọc cần đàn: cần thẳng, không cong võng.', 'Bấm thử: dây không quá cao so với phím (đỡ đau tay).', 'Gảy từng dây: không rè, không tịt tiếng.'],
    prompt: 'Kiểm tra cây đàn của bạn:', thao: { type: 'check', items: ['Cần đàn thẳng', 'Dây không quá cao', 'Không bị rè tiếng'] } },
  3: { crumb: 'Phần 1 · Bài 3', title: 'Các bộ phận của đàn', result: 'Gọi đúng tên các phần đàn', dur: '4 phút',
    goal: 'Nhận biết và gọi đúng tên các phần chính của cây đàn guitar.',
    steps: ['Đầu đàn & khoá đàn: nơi chỉnh dây.', 'Cần đàn & phím đàn: nơi tay trái bấm.', 'Thùng đàn & ngựa đàn: nơi khuếch đại và giữ dây.'],
    prompt: 'Tự kiểm tra:', thao: { type: 'check', items: ['Mình chỉ đúng đầu đàn, cần, phím', 'Mình chỉ đúng thùng, ngựa, khoá đàn'] } },
  4: { crumb: 'Phần 2 · Bài 4', title: 'Tên 6 dây đàn', result: 'Nhận diện đúng 6 dây', dur: '6 phút',
    goal: 'Nhớ tên 6 dây theo cả chữ cái và Đô-Rê-Mi: từ dây 6 đến dây 1 là Mi La Rê Sol Si Mí.',
    steps: ['Tên nốt viết bằng CHỮ CÁI: C D E F G A B = Đô Rê Mi Fa Sol La Si.', 'Dây 6 dày nhất = Mi trầm (E). Dây 1 mỏng nhất = Mí cao (E).', 'Mẹo nhớ thứ tự 6→1: "Em Ăn Dứa Giòn Bên Em" (E A D G B E).', 'Quy ước app: dây 1 ở trên cùng, dây 6 ở dưới cùng — và luôn khác màu.'],
    prompt: 'Bấm đúng dây Mi số 1 (mỏng nhất):', thao: { type: 'neck' } },
  5: { crumb: 'Phần 2 · Bài 5', title: 'Chỉnh dây bằng tuner', result: 'Tự chỉnh được 6 dây', dur: '6 phút',
    goal: 'Biết dùng tuner để chỉnh từng dây về đúng cao độ.',
    steps: ['Mở tuner, gảy một dây — tuner hiện tên nốt.', 'Vặn khoá đàn: kim lệch trái = non, vặn căng dần lên.', 'Kim về giữa, đèn xanh = chuẩn.'],
    prompt: 'Mở Tuner và lên dây Mi số 1:', thao: { type: 'tool' } },
  6: { crumb: 'Phần 2 · Bài 6', title: 'Tư thế ngồi & đặt đàn', result: 'Tư thế học ổn định', dur: '5 phút',
    goal: 'Ngồi sao cho đàn vững, tay không gồng, lưng không mỏi.',
    steps: ['Ghế cao vừa, hai chân chạm đất.', 'Eo đàn đặt lên đùi phải (cổ điển: đùi trái + kê chân).', 'Cần đàn hơi chếch lên, lưng thẳng tự nhiên.'],
    prompt: 'Tự kiểm tra tư thế:', thao: { type: 'check', items: ['Hai vai thả lỏng, không nhô', 'Cổ tay phải không gồng', 'Đàn không trượt khi buông tay phải'] } },
  7: { crumb: 'Phần 3 · Bài 7', title: 'Đặt tay trái lên cần đàn', result: 'Tay trái đúng tư thế', dur: '5 phút',
    goal: 'Biết vị trí ngón cái, cổ tay và đầu ngón khi bấm.',
    steps: ['Ngón cái tựa sau cần đàn, khoảng chính giữa.', 'Bấm bằng đầu ngón; móng tay trái cắt ngắn.', 'Cổ tay cong tự nhiên, không gập gắt.'],
    prompt: 'Tự kiểm tra tay trái:', thao: { type: 'check', items: ['Ngón cái nằm sau cần đàn', 'Bấm bằng đầu ngón', 'Móng tay trái đã cắt ngắn'] } },
  8: { crumb: 'Phần 3 · Bài 8', title: 'Gảy dây cho đàn kêu rõ', result: 'Gảy 6 dây nghe rõ', dur: '5 phút',
    goal: 'Gảy từng dây nghe rõ, không bị tịt tiếng.',
    steps: ['Tay phải thả lỏng, cổ tay mềm.', 'Gảy dứt khoát qua dây, không ấn quá sâu.', 'Nghe: tiếng tròn và vang, không bị cụt.'],
    prompt: 'Gảy đúng dây & luyện tai nghe:', thao: { type: 'listen8' } },
  9: { crumb: 'Phần 3 · Bài 9', title: 'Cầm pick / dùng ngón phải', result: 'Tay phải gảy gọn gàng', dur: '5 phút',
    goal: '', steps: [], prompt: 'Tự kiểm tra tay phải:', thao: { type: 'check', items: [] } },
  10: { crumb: 'Phần 4 · Bài 10', title: 'Góc học & thói quen tập', result: 'Có bộ chuẩn bị tối thiểu', dur: '4 phút',
    goal: 'Có bộ chuẩn bị tối thiểu và lịch tập ngắn mỗi ngày.',
    steps: ['Góc cố định: ghế, giá đàn, tuner, capo.', 'Để đàn ở nơi dễ thấy — cầm lên là tập.', 'Lịch ngắn 10–15 phút/ngày, đều hơn là nhiều.'],
    prompt: 'Chuẩn bị góc học của bạn:', thao: { type: 'check', items: ['Mình có góc tập cố định', 'Mình có tuner và giá đàn', 'Mình đặt lịch tập ngắn mỗi ngày'] } },
  11: { crumb: 'Phần 4 · Bài 11', title: 'Đặt tinh thần cho khoá học', result: 'Vào khoá với tâm thế đúng', dur: '4 phút',
    goal: 'Bước vào khoá chính với tâm thế đường dài, không nóng vội.',
    steps: ['Học đàn có "cao nguyên": có lúc tập mãi chưa thấy tiến — đó là bình thường.', 'Mục tiêu không phải "học xong", mà là sống cùng âm nhạc.', 'Vấp ở đâu, quay lại hỏi thầy ở đó.'],
    prompt: 'Sẵn sàng chưa?', thao: { type: 'check', items: ['Mình chấp nhận sẽ có đoạn khó', 'Mình tập vì thích, không vì điểm số', 'Mình biết tìm thầy khi vấp'] } },
}

// Bài 9 có 2 biến thể theo cách gảy học viên chọn (ngón tay / pick)
export type PlayStyle = 'fingers' | 'pick'
export interface PlayVariant { result: string; goal: string; steps: string[]; items: string[] }
export const PLAY9: Record<PlayStyle, PlayVariant> = {
  fingers: { result: 'Gảy bằng ngón rõ tiếng',
    goal: 'Dùng các ngón tay phải để gảy — tiếng ấm, hợp đệm hát và fingerstyle.',
    steps: ['Ngón cái (p) lo 3 dây trầm: dây 6, 5, 4.', 'Ngón trỏ–giữa–áp út (i, m, a) lo dây 3, 2, 1.', 'Gảy bằng đầu ngón, thả lỏng cổ tay — tiếng tròn, không tịt.'],
    items: ['Ngón cái gảy được dây trầm', 'i-m-a gảy được dây cao', 'Tiếng tròn, không bị tịt'] },
  pick: { result: 'Cầm pick không rơi',
    goal: 'Cầm pick chắc tay, gảy xuống dứt khoát — tiếng sáng, hợp đệm mạnh.',
    steps: ['Pick kẹp giữa ngón cái và cạnh ngón trỏ, ló ra một chút.', 'Gảy bằng cổ tay (không cả cánh tay), thả lỏng.', 'Gảy xuống dứt khoát, giữ pick không xoay hay rơi.'],
    items: ['Pick không rơi khi gảy', 'Gảy xuống được từng dây rõ', 'Tiếng sáng và đều'] },
}

// Lấy bài học theo id; bài 9 ghép thêm biến thể theo playStyle
export function getLesson(id: number, playStyle: PlayStyle): LessonDef {
  const L = LESSONS[id]
  if (id === 9) {
    const v = PLAY9[playStyle] || PLAY9.fingers
    return { ...L, goal: v.goal, steps: v.steps, result: v.result, thao: { type: 'check', items: v.items } }
  }
  return L
}
