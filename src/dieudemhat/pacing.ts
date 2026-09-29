// ── ĐIỆU ĐỆM HÁT — nhịp độ học (learning pacing, TEMPLATE V2) ──
// Content (src/content/dieudemhat) lưu TOÀN BỘ kiến thức một điệu. File này quyết định học sinh
// thấy gì TRƯỚC/SAU: chia điệu thành các BƯỚC, mỗi bước MỘT mục tiêu, xen ĐIỂM DỪNG thực hành.
//   Tổng quan → [Âm hình → Thực hành (nhiệm vụ + tiêu chí đi tiếp)] × mỗi âm hình mới → Ghép cả bài → Bài tập
// Cùng một danh sách bước → App (từng màn, tiến tuần tự) và Sách (trang nối tiếp, ô thực hành).
// Owner chỉ cung cấp kiến thức; bố cục bước do hàm này sinh, không soạn tay từng điệu.
import { PATTERNS, SECTION_LABEL, type Pattern, type RhythmStyle, type Section } from '../content/dieudemhat'

export type LearningStep =
  | { kind: 'overview'; title: string }
  | { kind: 'pattern'; title: string; section: Section; pattern: Pattern; option?: string; intensity: string }
  | { kind: 'practice'; title: string; pattern: Pattern; task: string; cue: string }
  | { kind: 'assemble'; title: string }
  | { kind: 'exercise'; title: string; text: string }

// Điểm thực hành mặc định — TRUNG TÍNH, không đặt yêu cầu kỹ thuật chuyên môn (số lần, tempo…).
// Âm hình có practiceTask / completionCue do Owner đưa thì dùng câu đó.
export const DEFAULT_TASK = (name: string) => `Đàn lại ${name} cùng máy đếm nhịp, chậm và đều.`
export const DEFAULT_CUE = 'Đi tiếp khi bạn đàn được cả ô nhịp mà không phải dừng giữa chừng.'

export const patternNames = (s: Section) => s.patterns.map((id) => PATTERNS[id]?.name ?? id).join(' / ')

export function buildSteps(st: RhythmStyle): LearningStep[] {
  const steps: LearningStep[] = [{ kind: 'overview', title: `Điệu ${st.name}` }]
  const seen = new Set<string>()
  for (const s of st.sections) {
    if (s.reuseOf) continue                         // Lời 3 dùng lại Lời 2 → nói ở bước Ghép cả bài
    const multi = s.patterns.length > 1
    s.patterns.forEach((id, i) => {
      const pattern = PATTERNS[id]
      if (!pattern || seen.has(id)) return            // âm hình đã học ở phần trước → không dạy lại
      seen.add(id)
      const option = multi ? `Lựa chọn ${i + 1}` : undefined
      steps.push({
        kind: 'pattern', section: s, pattern, option, intensity: s.intensity,
        title: `${SECTION_LABEL[s.kind]}${option ? ` · ${option}` : ''}: ${pattern.name}`,
      })
      steps.push({ kind: 'practice', title: 'Thực hành', pattern, task: pattern.practiceTask ?? DEFAULT_TASK(pattern.name), cue: pattern.completionCue ?? DEFAULT_CUE })
    })
  }
  steps.push({ kind: 'assemble', title: 'Ghép cả bài' })
  if (st.exercise) steps.push({ kind: 'exercise', title: 'Bài tập thực hành', text: st.exercise })
  return steps
}
