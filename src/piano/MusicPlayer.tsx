import { useRef, useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'

// ── Types ────────────────────────────────────────────────────────────────────
interface PianoNote { pitch: string; startBeat: number; duration: number }
interface Exercise { title: string; bpm: number; notes: PianoNote[] }

const SUPABASE_URL = 'https://wojmdilyflffvdtpovmq.supabase.co'

// ── Demo fallback ─────────────────────────────────────────────────────────────
const DEMO: Exercise = {
  title: 'Twinkle Twinkle Little Star',
  bpm: 100,
  notes: [
    {pitch:'C4',startBeat:0,duration:1},{pitch:'C4',startBeat:1,duration:1},
    {pitch:'G4',startBeat:2,duration:1},{pitch:'G4',startBeat:3,duration:1},
    {pitch:'A4',startBeat:4,duration:1},{pitch:'A4',startBeat:5,duration:1},
    {pitch:'G4',startBeat:6,duration:2},
    {pitch:'F4',startBeat:8,duration:1},{pitch:'F4',startBeat:9,duration:1},
    {pitch:'E4',startBeat:10,duration:1},{pitch:'E4',startBeat:11,duration:1},
    {pitch:'D4',startBeat:12,duration:1},{pitch:'D4',startBeat:13,duration:1},
    {pitch:'C4',startBeat:14,duration:2},
  ],
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const PITCH_Y: Record<string, number> = {
  'C4':5,'D4':4,'E4':3,'F4':2,'G4':1,'A4':0,'B4':-1,'C5':-2,'D5':-3,'E5':-4,'F5':-5,
}
const COLORS: Record<string, string> = {
  'C':'#EF4444','D':'#F59E0B','E':'#10B981','F':'#3B82F6','G':'#8B5CF6','A':'#EC4899','B':'#06B6D4',
}
function pc(p: string) { return COLORS[p[0]] || '#F59E0B' }
function py(p: string) { return PITCH_Y[p] ?? 3 }

const STAFF_LH = 12; const NR = 18; const PH_RATIO = 0.28; const PX_BEAT = 90

interface Props { onClose?: () => void }

export default function MusicPlayer({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef(0)
  const stRef     = useRef(0)
  const [exercise, setExercise] = useState<Exercise>(DEMO)
  const [prompt, setPrompt]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [playing, setPlaying]   = useState(false)
  const [tempo, setTempo]       = useState(DEMO.bpm)
  const [beat, setBeat]         = useState(0)

  // Sync tempo when exercise changes
  useEffect(() => { setTempo(exercise.bpm); setBeat(0); setPlaying(false); stRef.current = 0 }, [exercise])

  // ── Generate ──
  const generate = async () => {
    if (!prompt.trim()) return
    setLoading(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Vui lòng đăng nhập'); setLoading(false); return }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/piano-generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Server ${res.status}`)

      setExercise(data as Exercise)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  // ── Draw ──
  const draw = useCallback(() => {
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d')!; const W = c.width; const H = c.height
    const st = H * 0.45; const sh = STAFF_LH * 8; const sb = st + sh; const sm = st + sh/2
    const sl = 60; const sr = W - 20; const sw = sr - sl
    const ph = sl + sw * PH_RATIO; const pps = PX_BEAT * (tempo / 60)

    let cb = 0
    if (playing && stRef.current > 0) cb = ((performance.now() - stRef.current) / 1000) * (tempo / 60)
    setBeat(cb)

    ctx.clearRect(0, 0, W, H)

    // BG
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#1a1206'); bg.addColorStop(1, '#0d0a04')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

    // Staff
    for (let i = 0; i < 5; i++) {
      const y = st + i * STAFF_LH * 2
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(sl, y); ctx.lineTo(sr, y); ctx.stroke()
    }
    const sg = ctx.createLinearGradient(0, st, 0, sb)
    sg.addColorStop(0, 'rgba(0,0,0,0.3)'); sg.addColorStop(0.5, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.3)')
    ctx.fillStyle = sg; ctx.fillRect(sl, st, sw, sh)

    // Playhead
    const pg = ctx.createLinearGradient(ph-20, 0, ph+20, 0)
    pg.addColorStop(0, 'rgba(251,191,36,0)'); pg.addColorStop(0.4, 'rgba(251,191,36,0.08)')
    pg.addColorStop(0.5, 'rgba(251,191,36,0.25)'); pg.addColorStop(0.6, 'rgba(251,191,36,0.08)')
    pg.addColorStop(1, 'rgba(251,191,36,0)')
    ctx.fillStyle = pg; ctx.fillRect(ph-30, st-20, 60, sh+40)
    ctx.strokeStyle = 'rgba(251,191,36,0.6)'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(ph, st-16); ctx.lineTo(ph, sb+16); ctx.stroke()

    // Clef
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = `${STAFF_LH*10}px serif`
    ctx.fillText('𝄞', sl+4, sm+STAFF_LH*3.5)

    // Notes
    for (const n of exercise.notes) {
      const nx = ph + (n.startBeat - cb) * PX_BEAT
      if (nx+NR < sl || nx-NR > sr) continue
      const y = st + py(n.pitch) * STAFF_LH + STAFF_LH
      const col = pc(n.pitch)
      const atPH = n.startBeat <= cb && n.startBeat + n.duration >= cb
      const done = n.startBeat + n.duration <= cb

      // Glow
      if (atPH) {
        const g = ctx.createRadialGradient(nx, y, 0, nx, y, NR*1.8)
        g.addColorStop(0, 'rgba(251,191,36,0.25)'); g.addColorStop(1, 'rgba(251,191,36,0)')
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(nx, y, NR*1.8, 0, Math.PI*2); ctx.fill()
      }

      // Ledger C4
      if (n.pitch === 'C4') {
        const ly = st + STAFF_LH * 10
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(nx-NR, ly); ctx.lineTo(nx+NR, ly); ctx.stroke()
      }

      const nc = done ? '#10B981' : atPH ? '#FEF3C7' : col
      const na = done ? 0.7 : 1

      // Stem
      const up = py(n.pitch) >= 2
      ctx.strokeStyle = nc; ctx.globalAlpha = na; ctx.lineWidth = 3
      ctx.beginPath()
      if (up) { ctx.moveTo(nx+NR-2, y); ctx.lineTo(nx+NR-2, y-STAFF_LH*5) }
      else    { ctx.moveTo(nx-NR+2, y); ctx.lineTo(nx-NR+2, y+STAFF_LH*5) }
      ctx.stroke()

      // Head
      ctx.fillStyle = nc; ctx.beginPath()
      ctx.ellipse(nx, y, NR, NR*0.75, -0.15, 0, Math.PI*2); ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Beat counter
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '13px Inter, system-ui, sans-serif'
    ctx.fillText(`🎵 ${Math.floor(cb)+1}`, sr-50, st-14)

    animRef.current = requestAnimationFrame(draw)
  }, [tempo, playing, exercise])

  useEffect(() => { animRef.current = requestAnimationFrame(draw); return () => cancelAnimationFrame(animRef.current) }, [draw])

  const toggle = () => {
    if (playing) { setPlaying(false); stRef.current = 0 }
    else { setPlaying(true); stRef.current = performance.now() - beat * (60/tempo) * 1000 }
  }
  const reset = () => { setPlaying(false); stRef.current = 0; setBeat(0) }

  return (
    <div style={{ width:'100%',height:'100dvh',background:'#0d0a04',display:'flex',flexDirection:'column',fontFamily:'Inter,system-ui,sans-serif',position:'relative',overflow:'hidden' }}>
      {onClose && <button onClick={onClose} style={{ position:'absolute',top:16,right:16,zIndex:10,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.08)',borderRadius:50,width:40,height:40,fontSize:16,color:'rgba(255,255,255,.5)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>}

      <canvas ref={canvasRef} style={{ flex:1,width:'100%',display:'block' }} width={typeof window!=='undefined'?window.innerWidth:400} height={typeof window!=='undefined'?window.innerHeight:700} />

      {/* AI Input */}
      {!playing && (
        <div style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:12,width:'80%',maxWidth:360 }}>
          <div style={{ fontSize:15,color:'rgba(255,255,255,.5)',textAlign:'center' }}>
            {exercise === DEMO ? 'Con muốn tập bài gì?' : exercise.title}
          </div>
          <input
            value={prompt} onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key==='Enter' && generate()}
            placeholder='VD: bài hát thiếu nhi vui nhộn...'
            autoFocus
            style={{ width:'100%',padding:'14px 18px',fontSize:16,borderRadius:14,border:'1px solid rgba(255,255,255,.1)',background:'rgba(255,255,255,.05)',color:'#fff',outline:'none',fontFamily:'inherit',textAlign:'center' }}
          />
          <button onClick={generate} disabled={loading || !prompt.trim()}
            style={{ padding:'14px 32px',fontSize:16,fontWeight:700,borderRadius:14,border:'none',background:loading?'rgba(255,255,255,.05)':'linear-gradient(135deg,#F59E0B,#D97706)',color:loading?'rgba(255,255,255,.3)':'#fff',cursor:loading?'default':'pointer',fontFamily:'inherit' }}>
            {loading ? '⏳ Đang tạo...' : '🎹 Tạo bài tập'}
          </button>
          {error && <div style={{ fontSize:13,color:'#FCA5A5',textAlign:'center' }}>{error}</div>}
          {exercise !== DEMO && <div onClick={() => { setExercise(DEMO); setPrompt('') }} style={{ fontSize:13,color:'rgba(255,255,255,.3)',cursor:'pointer' }}>← Quay lại bài mẫu</div>}
        </div>
      )}

      {/* Title */}
      <div style={{ position:'absolute',top:16,left:0,right:0,textAlign:'center',pointerEvents:'none' }}>
        <div style={{ fontSize:18,fontWeight:700,color:'rgba(255,255,255,.7)' }}>🎹 {exercise.title}</div>
      </div>

      {/* Controls */}
      <div style={{ position:'absolute',bottom:0,left:0,right:0,display:'flex',alignItems:'center',justifyContent:'center',gap:16,padding:'16px 20px 32px',background:'linear-gradient(to top,rgba(13,10,4,.95),transparent)' }}>
        <button onClick={reset} style={bs}>⟲</button>
        <button onClick={toggle} style={{ ...bs,width:64,height:64,fontSize:24 }}>{playing?'⏸':'▶'}</button>
        <div style={{ display:'flex',alignItems:'center',gap:6 }}>
          <button onClick={() => setTempo(t=>Math.max(40,t-10))} style={bss}>−</button>
          <span style={{ color:'rgba(255,255,255,.6)',fontSize:14,fontWeight:600,minWidth:44,textAlign:'center' }}>{tempo}<span style={{fontSize:10,opacity:.6}}>BPM</span></span>
          <button onClick={() => setTempo(t=>Math.min(200,t+10))} style={bss}>+</button>
        </div>
      </div>
    </div>
  )
}

const bs: React.CSSProperties = { width:48,height:48,borderRadius:'50%',background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.1)',color:'rgba(255,255,255,.8)',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }
const bss: React.CSSProperties = { width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.08)',color:'rgba(255,255,255,.6)',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }
