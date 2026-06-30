// Port từ Groove Lab data/lessons.ts — types + analyzeBar + selectors cho 30 bài tiết tấu.
// Web thuần (không react-native). Logic chia ô nhịp & nhạc lý giữ nguyên.
import rawLessons from './rhythmLessons.json'

export type LessonMode = 'rhythm' | 'expression' | 'soul'

export interface RhythmTab { title: string; subtitle: string; teacherTip: string }
export interface ExpressionTab extends RhythmTab { accentPattern: number[] }
export interface SoulTab extends RhythmTab { theme: string }

export interface Lesson {
  id: string
  order: number
  level: number
  levelName: string
  title: string
  shortTitle: string
  isLocked: boolean
  isHidden: boolean
  defaultTempo: number
  timeSignature: string
  beats: string[]
  rhythmSymbols: string[]
  strumSymbols: string[]
  tabs: { rhythm: RhythmTab; expression: ExpressionTab; soul: SoulTab }
}

export const LESSONS: Lesson[] = rawLessons as Lesson[]

export const REST_SYMBOL = '𝄽'
const isDownbeat = (label: string) => /^[1-9]$/.test(label)
const isRestSym = (sym: string, strum: string) => sym === REST_SYMBOL || strum === '-'

export interface Cell {
  index: number
  beatLabel: string
  rhythmSymbol: string
  strumSymbol: string
  durationBeats: number  // ♩=1, ♪=0.5, triplet=1/3, ♬=0.25
  startBeat: number      // tích lũy từ đầu ô nhịp
  isRest: boolean
  isDownbeat: boolean
  downbeatNumber: number | null
}

export interface AnalyzedBar { cells: Cell[]; totalBeats: number }

// Chia ô nhịp thành nhóm theo phách (mỗi nhãn số = 1 phách mới), chia đều độ dài trong nhóm.
// 1 cell -> ♩ | 2 -> ♪ | 3 -> liên ba | 4 -> ♬
export function analyzeBar(lesson: Lesson): AnalyzedBar {
  const { beats, rhythmSymbols, strumSymbols } = lesson
  const n = beats.length

  const groups: number[][] = []
  let cur: number[] = []
  for (let i = 0; i < n; i++) {
    if (isDownbeat(beats[i]) && cur.length) { groups.push(cur); cur = [] }
    cur.push(i)
  }
  if (cur.length) groups.push(cur)

  const durations = new Array<number>(n).fill(1)
  for (const g of groups) {
    const d = 1 / g.length
    for (const idx of g) durations[idx] = d
  }

  const cells: Cell[] = []
  let acc = 0
  for (let i = 0; i < n; i++) {
    const down = isDownbeat(beats[i])
    cells.push({
      index: i,
      beatLabel: beats[i],
      rhythmSymbol: rhythmSymbols[i],
      strumSymbol: strumSymbols[i],
      durationBeats: durations[i],
      startBeat: acc,
      isRest: isRestSym(rhythmSymbols[i], strumSymbols[i]),
      isDownbeat: down,
      downbeatNumber: down ? parseInt(beats[i], 10) : null,
    })
    acc += durations[i]
  }
  return { cells, totalBeats: acc }
}

// ---- Selectors ----
export const VISIBLE_LESSONS = LESSONS.filter((l) => !l.isHidden)

export interface LevelGroup { level: number; levelName: string; lessons: Lesson[] }

export function getLevelGroups(includeHidden = false): LevelGroup[] {
  const src = includeHidden ? LESSONS : VISIBLE_LESSONS
  const map = new Map<number, LevelGroup>()
  for (const l of src) {
    if (!map.has(l.level)) map.set(l.level, { level: l.level, levelName: l.levelName, lessons: [] })
    map.get(l.level)!.lessons.push(l)
  }
  return Array.from(map.values())
    .sort((a, b) => a.level - b.level)
    .map((g) => ({ ...g, lessons: g.lessons.sort((a, b) => a.order - b.order) }))
}

export function getLessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id)
}

export const MODE_ORDER: LessonMode[] = ['rhythm', 'expression', 'soul']
export const MODE_COLORS: Record<LessonMode, string> = {
  rhythm: '#2E7D52', expression: '#E8760A', soul: '#7B4FA6',
}
export const MODE_LABELS: Record<LessonMode, string> = {
  rhythm: 'Nhịp Điệu', expression: 'Sắc Thái', soul: 'Câu Chuyện',
}
export const MODE_SUBTITLE: Record<LessonMode, string> = {
  rhythm: 'Cấp độ 1 - Nhịp điệu', expression: 'Cấp độ 2 - Sắc thái', soul: 'Cấp độ 3 - Câu chuyện',
}

export const APP_SLOGAN = 'Nhịp Điệu • Sắc Thái • Câu Chuyện'
