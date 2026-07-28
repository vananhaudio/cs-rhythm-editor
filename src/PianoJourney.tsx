// Piano Journey — MỘT màn duy nhất: bé nói chuyện với Cô Piano, cô tự soạn bài.
//
// Luồng: TalkWithTeacher (WebRTC Realtime) → cô gọi công cụ tao_bai_tap
//        → generateMission → LearningFlow.
//
// KHÔNG thêm màn "gõ yêu cầu" hay mic Web Speech riêng nữa: đã thử và bỏ vì
// `webkitSpeechRecognition` có mặt nhưng CHẾT trong WKWebView, chỉ làm bé tưởng
// app hỏng. Chỗ để nói là Cô Piano.

import { useState, useRef, useCallback } from 'react'
import { supabase, SUPABASE_URL } from './supabase'
import LearningFlow from './piano/LearningFlow'
import TalkWithTeacher from './piano/TalkWithTeacher'

// ── Types ────────────────────────────────────────────────────────────────────
interface PianoNote { pitch: string; startBeat: number; duration: number }
interface Exercise { title: string; bpm: number; notes: PianoNote[] }

type Stage = 'talk' | 'generating' | 'playing'

const AI_TIMEOUT_MS = 8000

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

interface Props { onClose?: () => void }

export default function PianoJourney({ onClose }: Props) {
  const [stage, setStage]       = useState<Stage>('talk')
  const [exercise, setExercise] = useState<Exercise | null>(null)

  const stageRef = useRef<Stage>('talk')
  const setStageSync = useCallback((s: Stage) => { stageRef.current = s; setStage(s) }, [])

  // ── Tạo bài tập (AI, có fallback) ──
  const generateMission = useCallback(async (text: string) => {
    if (stageRef.current === 'generating') return
    setStageSync('generating')

    // Mạng yếu KHÔNG được để bé kẹt ở "đang soạn bài" vô hạn: chặn cứng bằng
    // timeout rồi lùi về bài mẫu. getSession() cũng phải bọc — nó có thể treo
    // khi đang tự refresh token.
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS)
    let ex: Exercise | null = null
    try {
      ex = await withTimeout(askAI(text, ctrl.signal), AI_TIMEOUT_MS)
    } catch { /* lùi về bài mẫu bên dưới */ }
    clearTimeout(timer)

    // Fallback: tự tạo bài tập mẫu — luôn chạy, không cần đăng nhập
    if (!ex) ex = makeFallbackExercise(text)

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

// ── Fallback: tự tạo bài tập mẫu ──
function makeFallbackExercise(prompt: string): Exercise {
  const patterns: [string, number[]][] = [
    ['Đô Rê Mi', [0,1,2,3,2,1,0,-1]],
    ['bậc thang', [0,0,1,1,2,2,3,3,4,4,5,5]],
    ['lên xuống', [0,2,4,2,0,2,4,2,0,-1]],
    ['bước nhảy', [0,3,0,3,2,0,2,0,-1]],
  ]
  const p = patterns.find(([name]) => prompt.toLowerCase().includes(name.toLowerCase()))
  const steps = (p ? p[1] : [0,0,1,1,2,2,1,-1]).filter(s => s >= 0)
  const pitches = ['C4','D4','E4','F4','G4','A4','B4','C5']

  return {
    title: prompt.slice(0, 60) || 'Bài tập mới',
    bpm: 90,
    notes: steps.map((s, i) => ({
      pitch: pitches[Math.min(s, pitches.length - 1)],
      startBeat: i,
      duration: i === steps.length - 1 ? 2 : 1,
    })),
  }
}
