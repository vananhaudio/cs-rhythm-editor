// Piano Journey — MỘT màn duy nhất: bé nói chuyện với Cô Piano, cô tự soạn bài.
//
// Luồng: TalkWithTeacher (WebRTC Realtime) → cô gọi công cụ tao_bai_tap
//        → generateMission → LearningFlow.
//
// Bài tập đi qua 3 lớp: LUẬT (src/piano/rules.ts) → SINH (AI) → KIỂM (checkAndRepair).
// Lớp KIỂM mới là thứ đảm bảo bé không nhận bài vượt bậc — luật viết trong prompt
// chỉ là gợi ý, AI vẫn phạm như thường.
//
// KHÔNG thêm màn "gõ yêu cầu" hay mic Web Speech riêng: đã thử và bỏ vì
// `webkitSpeechRecognition` có mặt nhưng CHẾT trong WKWebView.

import { useState, useRef, useCallback } from 'react'
import { supabase, SUPABASE_URL } from './supabase'
import LearningFlow from './piano/LearningFlow'
import TalkWithTeacher from './piano/TalkWithTeacher'
import { getLevel, currentLevelId, buildPrompt, checkAndRepair } from './piano/rules'
import type { Exercise, PianoLevel } from './piano/rules'

type Stage = 'talk' | 'generating' | 'playing'

const AI_TIMEOUT_MS = 8000
/** AI phạm nhiều hơn ngần này lỗi luật thì bắt sáng tác lại một lần. */
const REDO_THRESHOLD = 3

/** Chặn cứng thời gian chờ — hết hạn thì trả null để lùi về bài mẫu. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>(resolve => window.setTimeout(() => resolve(null), ms)),
  ])
}

/** Gọi AI sáng tác bài. Trả null nếu chưa đăng nhập hoặc AI không dùng được. */
async function askAI(prompt: string, signal: AbortSignal): Promise<Exercise | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const res = await fetch(`${SUPABASE_URL}/functions/v1/piano-generate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
    signal,
  })
  if (!res.ok) return null
  const data = await res.json()
  return data?.notes ? (data as Exercise) : null
}

/** Một lượt: gọi AI (có chặn thời gian) rồi soi & sửa theo luật của bậc. */
async function attempt(chuDe: string, level: PianoLevel, extra = '') {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS)
  let raw: Exercise | null = null
  try {
    raw = await withTimeout(askAI(buildPrompt(chuDe, level) + extra, ctrl.signal), AI_TIMEOUT_MS)
  } catch { /* mạng lỗi → coi như AI không trả về */ }
  clearTimeout(timer)
  const checked = checkAndRepair(raw, level, chuDe)
  return { raw, exercise: checked.exercise, problems: checked.problems }
}

interface Props { onClose?: () => void }

export default function PianoJourney({ onClose }: Props) {
  const [stage, setStage]       = useState<Stage>('talk')
  const [exercise, setExercise] = useState<Exercise | null>(null)

  const stageRef = useRef<Stage>('talk')
  const setStageSync = useCallback((s: Stage) => { stageRef.current = s; setStage(s) }, [])

  // ── Tạo bài tập: LUẬT → AI → KIỂM ──
  const generateMission = useCallback(async (chuDe: string) => {
    if (stageRef.current === 'generating') return
    setStageSync('generating')

    const level = getLevel(currentLevelId())
    const first = await attempt(chuDe, level)
    let ex = first.exercise
    let problems = first.problems

    // AI phạm luật quá nhiều → bắt làm lại một lần, nói rõ nó sai ở đâu.
    // Bản đã sửa vẫn luôn ĐÚNG LUẬT; làm lại chỉ để câu nhạc tự nhiên hơn.
    if (first.raw && problems.length >= REDO_THRESHOLD) {
      const lai = await attempt(chuDe, level,
        `\n\nLần trước bạn làm sai: ${problems.slice(0, 5).join('; ')}. Hãy tuân thủ đúng ràng buộc.`)
      if (lai.raw && lai.problems.length < problems.length) { ex = lai.exercise; problems = lai.problems }
    }

    if (import.meta.env.DEV && problems.length) console.warn('[luật] AI phạm:', problems)

    setExercise(ex)
    setStageSync('playing')
  }, [setStageSync])

  const backToTalk = useCallback(() => {
    setExercise(null)
    setStageSync('talk')
  }, [setStageSync])

  if (stage === 'playing' && exercise) {
    return <LearningFlow exercise={exercise} onClose={onClose} onBack={backToTalk} />
  }

  // Giữ màn hội thoại mounted khi 'generating' để tiếng cô không bị cắt giữa câu.
  return (
    <TalkWithTeacher
      onClose={onClose}
      onCreateMission={generateMission}
      busy={stage === 'generating'}
    />
  )
}
