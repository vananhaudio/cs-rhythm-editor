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
