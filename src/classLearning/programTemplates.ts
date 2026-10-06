// ── Mẫu chương trình để KHỞI TẠO dữ liệu lớp từ Admin (không phải nguồn sự thật) ──
// Sau khi khởi tạo, Chặng/Giáo trình sống trong DB và Admin là nơi sửa.
// (Các module dữ liệu này đã nằm trong bundle qua trang /solo01 và /hanhtrinh2027.)
import type { LessonDoc } from '../lesson/lessonTypes'
import type { StageTemplate } from './outline'
import { SOLO01_STAGES } from '../data/solo01Program'
import { HT2027_STAGES } from '../data/ht2027Program'
import { SOLO01_BUOI01 } from '../data/solo01/buoi01'
import { SOLO01_BUOI02 } from '../data/solo01/buoi02'
import { SOLO01_BUOI03 } from '../data/solo01/buoi03'
import { SOLO01_BUOI04 } from '../data/solo01/buoi04'
import { SOLO01_BUOI05 } from '../data/solo01/buoi05'
import { CB1_BUOI00 } from '../data/cb1/buoi00'
import { CB1_BUOI01 } from '../data/cb1/buoi01'
import { CB2_BUOI01 } from '../data/cb2/buoi01'
import { CB2_BUOI02 } from '../data/cb2/buoi02'
import { CB2_BUOI03 } from '../data/cb2/buoi03'
import { CB2_BUOI04 } from '../data/cb2/buoi04'
import { HT2027_BUOI01 } from '../data/ht2027/buoi01'
import { HT2027_BUOI02 } from '../data/ht2027/buoi02'
import { HT2027_BUOI03 } from '../data/ht2027/buoi03'
import { HT2027_BUOI04 } from '../data/ht2027/buoi04'

export interface ProgramTemplate {
  perStage: number
  stages: StageTemplate[]
  lessons: Record<number, LessonDoc>
}

export const PROGRAM_TEMPLATES: Record<string, ProgramTemplate> = {
  // CB1.T3: chặng đã có trong DB — chỉ dùng `lessons` cho nút "Nhập bài có sẵn". Buổi 00 = khoá 0 (xem ghi chú buoi00.ts).
  'CB1.T3': { perStage: 4, stages: [], lessons: { 0: CB1_BUOI00, 1: CB1_BUOI01 } },
  // Lớp đã có sẵn chặng trong DB (12 vòng × 4 buổi) — chỉ dùng `lessons` cho nút "Nhập bài có sẵn".
  'CB2.T3': {
    perStage: 4,
    stages: [],
    lessons: { 1: CB2_BUOI01, 2: CB2_BUOI02, 3: CB2_BUOI03, 4: CB2_BUOI04 },
  },
  'SOLO01.TH01': {
    perStage: 8,
    stages: SOLO01_STAGES.map(s => ({ no: s.no, title: s.title.trim(), summary: s.goal })),
    lessons: { 1: SOLO01_BUOI01, 2: SOLO01_BUOI02, 3: SOLO01_BUOI03, 4: SOLO01_BUOI04, 5: SOLO01_BUOI05 },
  },
  'HT2027.TH01': {
    perStage: 8,
    stages: HT2027_STAGES.map(s => ({ no: s.no, title: s.title.trim(), summary: s.goal })),
    lessons: { 1: HT2027_BUOI01, 2: HT2027_BUOI02, 3: HT2027_BUOI03, 4: HT2027_BUOI04 },
  },
}
