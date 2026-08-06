// Piano Journey — Home → nói chuyện với Lyra → tập bài.
//
// Luồng: HomeScreen (theo HOME_SCREEN_SPEC.md) → TalkWithTeacher (WebRTC Realtime)
//        → Lyra gọi công cụ tao_bai_tap → generateMission → LearningFlow.
//
// Bài tập đi qua 3 lớp: LUẬT (src/piano/rules.ts) → SINH (AI) → KIỂM (checkAndRepair).
// Lớp KIỂM mới là thứ đảm bảo bé không nhận bài vượt bậc — luật viết trong prompt
// chỉ là gợi ý, AI vẫn phạm như thường.
//
// KHÔNG thêm màn "gõ yêu cầu" hay mic Web Speech riêng: đã thử và bỏ vì
// `webkitSpeechRecognition` có mặt nhưng CHẾT trong WKWebView.

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { supabase, SUPABASE_URL } from './supabase'
import LearningFlow from './piano/LearningFlow'
import TalkWithTeacher from './piano/TalkWithTeacher'
import HomeScreen from './piano/HomeScreen'
import SongLibrary from './piano/SongLibrary'
import { rememberSong, recordScore, advanceIfEarned, loadLibraryFromServer } from './piano/library'
import { getLevel, currentLevelId, buildPrompt, checkAndRepair, rememberExercise, loadPianoLevel } from './piano/rules'
import type { Exercise, PianoLevel } from './piano/rules'

type Stage = 'home' | 'talk' | 'generating' | 'playing' | 'library'

// ── Error Boundary ──────────────────────────────────────────────────────────
class PianoErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  constructor(props: any) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e: Error) { return { error: e.message || String(e) } }
  componentDidCatch(error: Error, info: any) {
    console.error('[Piano]', error.message, error.stack)
    try { (window as any).__pianoErr = error.message + ' | ' + (error.stack || '') } catch {}
  }
  render() {
    if (this.state.error) {
      const msg = this.state.error
      const short = msg.length > 150 ? msg.slice(0, 150) + '…' : msg
      return (
        <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "system-ui", textAlign: "center", background: "#FFF8F0" }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🎹</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#B45309", marginBottom: 6 }}>Có chút trục trặc</div>
          <div style={{ fontSize: 11, color: "#333", maxWidth: 320, lineHeight: 1.5, wordBreak: "break-all", background: "#FFF", padding: 10, borderRadius: 10, border: "1px solid #FDE68A", maxHeight: 220, overflow: "auto", whiteSpace: "pre-wrap", textAlign: "left" }}>{short}</div>
          <button onClick={() => { this.setState({ error: null }); window.location.reload() }} style={{ marginTop: 14, padding: "12px 28px", borderRadius: 14, border: "none", background: "#F59E0B", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Thử lại</button>
        </div>
      )
    }
    return this.props.children
  }
}



// ── DEBUG: AI helpers disabled ──
const AI_TIMEOUT_MS = 8000
const REDO_THRESHOLD = 3

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>(resolve => window.setTimeout(() => resolve(null), ms))])
}

async function askAI(_prompt: string, _signal: AbortSignal): Promise<any> { return null }

async function attempt(_chuDe: string, _level: any, _extra = "") {
  return { raw: null, exercise: null, problems: ["AI disabled for debug"] }
}

interface Props {
  onClose?: () => void
  /** Tên bé cho lời chào ở Home. Không có thì dùng mặc định của spec. */
  studentName?: string
}

export default function PianoJourney({ onClose, studentName }: Props) {
  const [stage, setStage]       = useState<Stage>('home')
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [ready, setReady]       = useState(false)
  const levelRef = useRef(currentLevelId())   // độ khó của bài đang mở, dùng khi ghi điểm

  // Kéo dữ liệu từ server khi mount — bậc + thư viện bài hát
  useEffect(() => {
    let cancelled = false
    void (async () => {
      // TẠM TẮT ĐỂ DEBUG: await Promise.all([loadPianoLevel(), loadLibraryFromServer()])
      if (cancelled) return
      levelRef.current = currentLevelId()   // cập nhật sau khi load từ server
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  const stageRef = useRef<Stage>('home')
  const setStageSync = useCallback((s: Stage) => { stageRef.current = s; setStage(s) }, [])

  // ── Tạo bài tập: LUẬT → AI → KIỂM ──
  const generateMission = useCallback(async (_chuDe: string) => {
    // DEBUG: stub — không gọi AI
    console.log('generateMission stub')
  }, [setStageSync])

  const backToTalk = useCallback(() => {
    setExercise(null)
    setStageSync('talk')
  }, [setStageSync])

  const backToHome = useCallback(() => {
    setExercise(null)
    setStageSync('home')
  }, [setStageSync])

  if (stage === 'playing' && exercise) {
    return (<PianoErrorBoundary>
      <LearningFlow
        exercise={exercise} onClose={onClose} onBack={backToTalk}
        onScore={(hit, total) => {
          recordScore(exercise, levelRef.current, hit, total, Date.now())
          advanceIfEarned(levelRef.current, hit, total)   // đạt 2 sao thì tự sang bậc kế
        }}
      />
    )
    </PianoErrorBoundary>)
  }

  if (stage === 'library') {
    return (<PianoErrorBoundary>
      <SongLibrary
        onBack={backToHome}
        onAskLyra={() => setStageSync('talk')}
        onPlay={song => {
          levelRef.current = song.levelId
          setExercise(song.exercise)
          setStageSync('playing')
        }}
      />
    )
    </PianoErrorBoundary>)
  }

  if (stage === 'home') {
    return (<PianoErrorBoundary>
      <HomeScreen
        studentName={studentName}
        // Chưa lưu tiến độ giữa các phiên, nên thẻ "Tiếp tục" hiện nội dung mặc
        // định của spec; bấm vào thì Lyra soạn bài mới.
        current={exercise ? { title: exercise.title, step: 1, totalSteps: 4 } : null}
        onTalkToLyra={() => setStageSync('talk')}
        onContinue={() => {
          if (exercise) { setStageSync('playing'); return }
          setStageSync('talk')
        }}
        // Spec không định nghĩa đích đến cho hamburger; đây là lối duy nhất ra
        // khỏi tool nên tạm nối vào đó.
        onOpenSongs={() => setStageSync('library')}
        onOpenMenu={onClose}
      />
    )
    </PianoErrorBoundary>)
  }

  // Giữ màn hội thoại mounted khi 'generating' để tiếng Lyra không bị cắt giữa câu.
  return (<PianoErrorBoundary>
    <TalkWithTeacher
      onClose={backToHome}
      onCreateMission={generateMission}
      busy={stage === 'generating'}
    />
  )
  </PianoErrorBoundary>)
}
