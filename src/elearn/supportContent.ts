// ── Hệ Gỡ rối & Đào sâu — nội dung coaching mẫu (GĐ1) ─────────────────────────
// Đây là MẪU CHUNG, dùng lại cho mọi bài (thầy chỉnh lời sau cũng được).
// Tầng 3 "Kho Tri Thức" (tìm video thầy giảng) để giai đoạn sau.

export interface StuckType { id: string; label: string; coach: string }
export interface DeepenPrompt { id: string; label: string }

// 5 trạng thái "đang gặp khó" → mỗi cái 1 câu coaching (reframe, giọng động viên của thầy)
export const STUCK_TYPES: StuckType[] = [
  { id: 'not_understand', label: 'Tôi chưa hiểu bài',
    coach: 'Chưa hiểu là chuyện rất bình thường — thường chỉ vì đang đi hơi nhanh thôi. Thử xem lại phần đầu bài một lượt nữa, thật chậm. Bạn thấy chỗ nào rối nhất?' },
  { id: 'hand_cant', label: 'Tôi hiểu nhưng tay chưa làm được',
    coach: 'Hiểu mà tay chưa theo kịp KHÔNG phải vì thiếu năng khiếu — ai cũng vậy lúc đầu. Thử THU NHỎ bài tập: làm chậm một nửa, hoặc tách riêng từng tay. Khi chậm lại, bạn có làm được không?' },
  { id: 'rhythm', label: 'Làm được chậm nhưng vào nhịp thì rối',
    coach: 'Vào nhịp bị rối thường vì tay chưa đủ "tự động". Bỏ nhịp ra, làm thật chậm cho đều đã, rồi mới bật nhịp ở tốc độ chậm. Tay phải đều quan trọng hơn sạch tuyệt đối.' },
  { id: 'not_nice', label: 'Làm được nhưng nghe chưa hay',
    coach: 'Nghe ra "chưa hay" nghĩa là tai bạn đã tinh lên rồi đó! Để ý: có dây nào bị tịt không? Đầu ngón đã chạm đủ chưa? Gảy nhẹ và đều lại, lắng nghe từng tiếng.' },
  { id: 'unsure', label: 'Tôi không biết mình đúng hay sai',
    coach: 'Không chắc đúng/sai là lúc nên dừng lại nghe kỹ. Thu âm 15 giây rồi nghe lại — tai bạn sẽ tự chỉ ra chỗ chưa ổn. Hoặc ghi câu hỏi, thầy nghe giúp bạn.' },
]

// 6 hướng "muốn đào sâu" → chọn xong dẫn tới ghi câu hỏi cho thầy (hoặc tầng 3 sau này)
export const DEEPEN_PROMPTS: DeepenPrompt[] = [
  { id: 'why',        label: 'Vì sao phải học bài này?' },
  { id: 'fix_what',   label: 'Bài này sửa lỗi gì cho tôi?' },
  { id: 'real_song',  label: 'Bài này liên quan gì đến bài hát thật?' },
  { id: 'skip',       label: 'Nếu bỏ qua bài này thì sao?' },
  { id: 'other_way',  label: 'Có cách tập khác không?' },
  { id: 'deeper',     label: 'Tôi muốn hiểu kỹ hơn' },
]

export const DEEPEN_INTRO =
  'Câu hỏi rất hay — đây chính là tinh thần học sâu. Ghi lại để thầy giảng kỹ hơn trong buổi Zoom, hoặc thầy sẽ trả lời riêng cho bạn.'

export const stuckById = (id: string) => STUCK_TYPES.find(s => s.id === id)
export const deepenById = (id: string) => DEEPEN_PROMPTS.find(d => d.id === id)
