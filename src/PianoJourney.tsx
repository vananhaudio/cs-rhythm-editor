// Màn đầu tiên = TRÒ CHUYỆN với Cô Piano (WebRTC Realtime) — đây mới là thứ đã
// chạy mượt hôm 27/07 và bị commit 0406b72 thay mất bằng SpeechRecognition.
// Màn tạo bài tập (LearningFlow) giữ nguyên, vào từ nút "🎼 Tập bài tập".

import { useState, useRef, useCallback } from 'react'
import { supabase, SUPABASE_URL } from './supabase'
import LearningFlow from './piano/LearningFlow'
import TalkWithTeacher from './piano/TalkWithTeacher'

// ── Types ────────────────────────────────────────────────────────────────────
interface PianoNote { pitch: string; startBeat: number; duration: number }
interface Exercise { title: string; bpm: number; notes: PianoNote[] }

type View  = 'talk' | 'mission'
type Stage = 'voice' | 'generating' | 'playing'

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  bg1: '#F9F7F1', bg2: '#F0ECE3',
  ring: 'rgba(245,158,11,0.4)',
  text: '#2E2A24', dim: '#8A8478',
  accent: '#F59E0B',
}

const GOLD   = 'linear-gradient(135deg,#F59E0B,#D97706)'
const INDIGO = 'linear-gradient(135deg,#6366F1,#4F46E5)'
const BUTTON = 120

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
  const [view, setView]         = useState<View>('talk')
  const [stage, setStage]       = useState<Stage>('voice')
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [draft, setDraft]       = useState('')       // ô gõ — TÁCH RIÊNG khỏi lời nói
  const [prompt, setPrompt]     = useState('')       // yêu cầu đang được xử lý
  const [genError, setGenError] = useState('')

  const stageRef = useRef<Stage>('voice')
  const setStageSync = useCallback((s: Stage) => { stageRef.current = s; setStage(s) }, [])

  // ── Tạo bài tập (AI, có fallback) ──
  const generateMission = useCallback(async (text: string) => {
    if (stageRef.current === 'generating') return
    setPrompt(text); setGenError(''); setStageSync('generating')

    // Mạng yếu KHÔNG được để trẻ kẹt ở "Đang sáng tác" vô hạn: chặn cứng bằng
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

  // ── Quay lại ──
  const backToTalk = useCallback(() => {
    setExercise(null); setDraft(''); setPrompt(''); setGenError('')
    setStageSync('voice'); setView('talk')
  }, [setStageSync])

  if (stage === 'playing' && exercise) {
    return <LearningFlow exercise={exercise} onClose={onClose} onBack={backToTalk} />
  }

  // Màn đầu tiên: trò chuyện với Cô Piano.
  // Bé nói → cô gọi công cụ tao_bai_tap → generateMission chạy NGAY trong lúc cô
  // còn đang nói. Giữ màn này mounted khi 'generating' để tiếng cô không bị cắt;
  // xong bài thì stage='playing' và nhánh trên đưa sang LearningFlow.
  if (view === 'talk') {
    return (
      <TalkWithTeacher
        onClose={onClose}
        onOpenMission={() => setView('mission')}
        onCreateMission={generateMission}
        busy={stage === 'generating'}
      />
    )
  }

  // ── Màn 2: CHỈ GÕ, không mic ──
  // Muốn nói thì nói ở màn 1 với Cô Piano (WebRTC Realtime — chạy thật trong app).
  // Trước đây màn này có mic riêng dùng Web Speech API; nó chết trong WKWebView nên
  // chỉ làm bé tưởng app hỏng. Đây là đường gõ cho bé không muốn/không thể nói.
  const generating = stage === 'generating'
  const error      = genError

  const submitDraft = () => {
    const t = draft.trim()
    if (t && !generating) generateMission(t)
  }

  return (
    <div style={{ height:'100dvh',background:`linear-gradient(180deg,${C.bg1} 0%,${C.bg2} 100%)`,display:'flex',flexDirection:'column',alignItems:'center',fontFamily:'Inter,system-ui,sans-serif',position:'relative',overflowX:'hidden',overflowY:'auto' }}>
      <style>{KEYFRAMES}</style>

      <button onClick={() => setView('talk')}
        style={{ position:'fixed',top:20,left:20,zIndex:100,background:'rgba(0,0,0,.06)',border:'1px solid rgba(0,0,0,.08)',borderRadius:999,height:44,padding:'0 16px',fontSize:14,fontWeight:600,color:C.dim,cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontFamily:'inherit',backdropFilter:'blur(12px)' }}>
        ‹ Cô Piano
      </button>
      {onClose && <button onClick={onClose} style={{ position:'fixed',top:20,right:20,zIndex:100,background:'rgba(0,0,0,.06)',border:'1px solid rgba(0,0,0,.08)',borderRadius:50,width:44,height:44,fontSize:18,color:C.dim,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(12px)' }}>✕</button>}

      {/* Header */}
      <div style={{ width:'100%',textAlign:'center',paddingTop:36,paddingBottom:16 }}>
        <div style={{ fontSize:32,marginBottom:2 }}>🎼</div>
        <div style={{ fontSize:18,fontWeight:700,color:C.text,letterSpacing:'-.3px' }}>Tập bài tập</div>
      </div>

      {/* Instruction */}
      <div style={{ fontSize:16,color:C.dim,textAlign:'center',padding:'0 40px',lineHeight:1.5,marginBottom:24,minHeight:24 }}>
        {!generating && 'Gõ điều con muốn tập, hoặc quay lại nói với Cô Piano'}
        {generating && (
          <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:6 }}>
            <span style={{ fontSize:24,animation:'pj-pulse 2s ease-in-out infinite' }}>✨</span>
            <span style={{ fontSize:15,color:C.text,fontWeight:600 }}>Đang sáng tác bản nhạc...</span>
            {prompt && <span style={{ fontSize:13,color:C.dim }}>"{prompt}"</span>}
          </div>
        )}
      </div>

      <div style={{ display:'flex',flexDirection:'column',alignItems:'center',paddingBottom:40 }}>
        {generating && (
          <div style={{ width:BUTTON,height:BUTTON,borderRadius:'50%',background:INDIGO,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 40px rgba(99,102,241,.35)',marginBottom:8 }}>
            <Dots />
          </div>
        )}

        {error && <div style={{ fontSize:13,color:'#C2410C',textAlign:'center',marginTop:8,maxWidth:300,lineHeight:1.5 }}>{error}</div>}

        {/* Ô gõ */}
        {!generating && (
          <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:10,marginTop:24,width:'85%',maxWidth:340 }}>
            <textarea
              value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && draft.trim()) { e.preventDefault(); submitDraft() } }}
              placeholder={'Ví dụ:\nCon muốn bài về khủng long\nCon muốn bài thiếu nhi\nCon muốn bài về mèo'}
              rows={3}
              style={{ width:'100%',padding:'12px 16px',fontSize:14,borderRadius:14,border:'1px solid #EAE4D8',background:'#fff',color:'#2E2A24',outline:'none',fontFamily:'inherit',textAlign:'center',resize:'none',lineHeight:1.6 }}
            />
            {draft.trim() && (
              <button onClick={submitDraft}
                style={{ padding:'11px 24px',fontSize:15,fontWeight:700,borderRadius:14,border:'none',background:GOLD,color:'#fff',cursor:'pointer',fontFamily:'inherit',boxShadow:'0 4px 20px rgba(245,158,11,.25)' }}>
                🎹 Tạo bài tập
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ position:'absolute',top:'12%',left:-20,fontSize:64,opacity:.04,pointerEvents:'none' }}>🎵</div>
      <div style={{ position:'absolute',top:'30%',right:-16,fontSize:56,opacity:.04,pointerEvents:'none' }}>🎶</div>
    </div>
  )
}

// Vòng sóng + hiệu ứng chờ — chạy bằng CSS, không re-render React mỗi frame
const KEYFRAMES = `
@keyframes pj-ring{0%{transform:scale(1);opacity:.5}100%{transform:scale(2.2);opacity:0}}
@keyframes pj-bounce{0%,80%,100%{transform:scale(.5);opacity:.4}40%{transform:scale(1);opacity:1}}
@keyframes pj-pulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}
`

function Dots() {
  return <div style={{ display:'flex',gap:6 }}>
    {[0,1,2].map(i => <div key={i} style={{ width:8,height:8,borderRadius:'50%',background:'#fff',animation:`pj-bounce 1.2s ${i*.15}s infinite ease-in-out` }} />)}
  </div>
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
