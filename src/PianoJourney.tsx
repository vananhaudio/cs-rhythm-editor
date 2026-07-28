import { useState, useRef, useCallback } from 'react'
import { supabase, SUPABASE_URL } from './supabase'
import LearningFlow from './piano/LearningFlow'
import { useVoiceInput } from './piano/useVoiceInput'

// ── Types ────────────────────────────────────────────────────────────────────
interface PianoNote { pitch: string; startBeat: number; duration: number }
interface Exercise { title: string; bpm: number; notes: PianoNote[] }

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

  // ── Mic 3 tầng: Web Speech → thu âm + Whisper → gõ text ──
  const voice = useVoiceInput({ onFinal: generateMission })

  // ── Quay lại màn nói ──
  const backToVoice = useCallback(() => {
    voice.cancel()
    setExercise(null); setDraft(''); setPrompt(''); setGenError('')
    setStageSync('voice')
  }, [voice, setStageSync])

  if (stage === 'playing' && exercise) {
    return <LearningFlow exercise={exercise} onClose={onClose} onBack={backToVoice} />
  }

  // ── Trạng thái hiển thị ──
  // 'playing' mà thiếu bài (không nên xảy ra) → coi như màn nói. Dẫn xuất, KHÔNG
  // setState trong render hay trong effect để tự chữa.
  const listening    = voice.state === 'listening'
  const transcribing = voice.state === 'transcribing'
  const generating   = stage === 'generating'
  const busy         = listening || transcribing || generating
  const showRings    = listening || transcribing
  const noMic        = voice.tier === 'none'
  const error        = genError || voice.error

  const face = generating
    ? { icon: '⏳', label: 'Đang tạo bài tập...',            bg: INDIGO, shadow: '0 8px 40px rgba(99,102,241,.35)',                                  lc: C.dim  }
    : transcribing
    ? { icon: '💭', label: 'Đang nghe con nói...',           bg: INDIGO, shadow: '0 8px 40px rgba(99,102,241,.35)',                                  lc: C.dim  }
    : listening
    ? { icon: '🎙️', label: voice.transcript || 'Đang nghe...', bg: GOLD,   shadow: '0 8px 60px rgba(251,191,36,.5),0 0 120px rgba(251,191,36,.2)', lc: C.text }
    : { icon: '🎤', label: 'Chạm để nói',                    bg: GOLD,   shadow: '0 8px 40px rgba(245,158,11,.3)',                                  lc: C.dim  }

  // Nghe: nhích theo cường độ mic thật (10 lần/giây) thay vì animate bằng state 60fps
  const scale = listening ? 1.05 + voice.level * 0.06 : 1

  const handleTap = () => {
    if (listening) { voice.stop(); return }   // nói xong bấm lại để chốt sớm
    if (busy) return
    voice.start()                             // gọi ĐỒNG BỘ — giữ user gesture cho iOS
  }

  const submitDraft = () => {
    const t = draft.trim()
    if (t && !busy) generateMission(t)
  }

  return (
    <div style={{ height:'100dvh',background:`linear-gradient(180deg,${C.bg1} 0%,${C.bg2} 100%)`,display:'flex',flexDirection:'column',alignItems:'center',fontFamily:'Inter,system-ui,sans-serif',position:'relative',overflowX:'hidden',overflowY:'auto' }}>
      <style>{KEYFRAMES}</style>

      {onClose && <button onClick={onClose} style={{ position:'fixed',top:20,right:20,zIndex:100,background:'rgba(0,0,0,.06)',border:'1px solid rgba(0,0,0,.08)',borderRadius:50,width:44,height:44,fontSize:18,color:C.dim,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(12px)' }}>✕</button>}

      {/* Header */}
      <div style={{ width:'100%',textAlign:'center',paddingTop:36,paddingBottom:16 }}>
        <div style={{ fontSize:32,marginBottom:2 }}>🎹</div>
        <div style={{ fontSize:18,fontWeight:700,color:C.text,letterSpacing:'-.3px' }}>Piano Journey</div>
      </div>

      {/* Instruction */}
      <div style={{ fontSize:16,color:C.dim,textAlign:'center',padding:'0 40px',lineHeight:1.5,marginBottom:24,minHeight:24 }}>
        {!busy && (noMic ? 'Con muốn tập bài gì? Gõ vào ô bên dưới nhé' : 'Con muốn tập bài gì hôm nay?')}
        {listening && 'Nói xong bấm lại vào nút nhé'}
        {generating && (
          <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:6 }}>
            <span style={{ fontSize:24,animation:'pj-pulse 2s ease-in-out infinite' }}>✨</span>
            <span style={{ fontSize:15,color:C.text,fontWeight:600 }}>Đang sáng tác bản nhạc...</span>
            {prompt && <span style={{ fontSize:13,color:C.dim }}>"{prompt}"</span>}
          </div>
        )}
      </div>

      {/* Button area */}
      <div style={{ display:'flex',flexDirection:'column',alignItems:'center',paddingBottom:40 }}>
        {!noMic && (
          <>
            <div style={{ position:'relative',width:BUTTON*3,height:BUTTON*3,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:8 }}>
              {showRings && [0,1,2].map(i => (
                <div key={i} style={{ position:'absolute',width:BUTTON,height:BUTTON,borderRadius:'50%',border:`2px solid ${C.ring}`,animation:`pj-ring 2.4s ${i*0.8}s ease-out infinite`,pointerEvents:'none' }} />
              ))}
              <button onClick={handleTap} disabled={transcribing || generating}
                style={{ width:BUTTON,height:BUTTON,borderRadius:'50%',background:face.bg,border:'none',cursor:(transcribing||generating)?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:face.shadow,transform:`scale(${scale})`,transition:'transform .12s ease-out,box-shadow .5s ease,background .5s ease',position:'relative',zIndex:2,outline:'none',fontSize:36,WebkitTapHighlightColor:'transparent' }}>
                {generating || transcribing ? <Dots /> : face.icon}
              </button>
            </div>
            <div style={{ fontSize:15,fontWeight:600,color:face.lc,transition:'color .5s ease',textAlign:'center',maxWidth:320,lineHeight:1.4,minHeight:21 }}>
              {face.label}
            </div>
          </>
        )}

        {error && <div style={{ fontSize:13,color:'#C2410C',textAlign:'center',marginTop:8,maxWidth:300,lineHeight:1.5 }}>{error}</div>}

        {/* Ô gõ — luôn có, kể cả khi mic chạy tốt */}
        {!busy && (
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
