import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { playGuitarNote } from './audioEngine'

// ── Game nhận diện cao độ nốt trên khuông (treble). Native, thay app Bolt cũ (lab.vananhaudio.com). ──
// Mục tiêu: game hoá việc nhớ mặt nốt — nhiều biến thể lặp lại. Dùng đúng phong cách khuông/nốt LMS (Bravura).

type NoteName = 'Đô' | 'Rê' | 'Mi' | 'Fa' | 'Sol' | 'La' | 'Si'
const CHOICES: NoteName[] = ['Đô', 'Rê', 'Mi', 'Fa', 'Sol', 'La', 'Si']

interface Note { name: NoteName; staff: number; label: string; freq: number }
// staff: 0 = dòng kẻ dưới cùng (Mi/E4), mỗi bước = nửa khoảng dòng (khớp NoteSheet của LMS)
const ALL_NOTES: Note[] = [
  { name: 'Đô',  staff: -2, label: 'C4', freq: 261.63 },
  { name: 'Rê',  staff: -1, label: 'D4', freq: 293.66 },
  { name: 'Mi',  staff:  0, label: 'E4', freq: 329.63 },
  { name: 'Fa',  staff:  1, label: 'F4', freq: 349.23 },
  { name: 'Sol', staff:  2, label: 'G4', freq: 392.00 },
  { name: 'La',  staff:  3, label: 'A4', freq: 440.00 },
  { name: 'Si',  staff:  4, label: 'B4', freq: 493.88 },
  { name: 'Đô',  staff:  5, label: 'C5', freq: 523.25 },
  { name: 'Rê',  staff:  6, label: 'D5', freq: 587.33 },
  { name: 'Mi',  staff:  7, label: 'E5', freq: 659.25 },
  { name: 'Fa',  staff:  8, label: 'F5', freq: 698.46 },
  { name: 'Sol', staff:  9, label: 'G5', freq: 783.99 },
  { name: 'La',  staff: 10, label: 'A5', freq: 880.00 },
]

interface LevelDef { id: number; name: string; subtitle: string; labels: string[]; round: number; goal: number; secBase: number }
const LEVELS: LevelDef[] = [
  { id: 1, name: 'Ba nốt đầu',    subtitle: 'Đô · Rê · Mi',                labels: ['C4','D4','E4'],                               round: 10, goal: 70, secBase: 6 },
  { id: 2, name: 'Thêm Fa · Sol', subtitle: 'Đô → Sol',                    labels: ['C4','D4','E4','F4','G4'],                     round: 12, goal: 70, secBase: 5.5 },
  { id: 3, name: 'Nửa quãng tám', subtitle: 'Đô → Si (trọn quãng dưới)',   labels: ['C4','D4','E4','F4','G4','A4','B4'],           round: 15, goal: 70, secBase: 5 },
  { id: 4, name: 'Lên quãng cao', subtitle: 'Thêm Đô · Rê · Mi cao',       labels: ['C4','D4','E4','F4','G4','A4','B4','C5','D5','E5'], round: 18, goal: 75, secBase: 4.5 },
  { id: 5, name: 'Toàn khuông',   subtitle: 'Đủ mặt nốt',                  labels: ['C4','D4','E4','F4','G4','A4','B4','C5','D5','E5','F5','G5','A5'], round: 20, goal: 80, secBase: 4 },
]
const poolFor = (lv: LevelDef) => ALL_NOTES.filter(n => lv.labels.includes(n.label))

// ── Tiến độ lưu localStorage theo user ──
interface Prog { best: number; done: boolean }
type ProgMap = Record<number, Prog>
const rand = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]

// ── Vẽ 1 nốt lớn trên khuông (đồng bộ phong cách NoteSheet) ──
function BigStaff({ note, flash }: { note: Note; flash: 'ok' | 'no' | null }) {
  const gap = 17, W = 340, H = 240
  const bY = H / 2 + 2 * gap                     // dòng kẻ dưới cùng
  const nx = 232
  const y = bY - note.staff * (gap / 2)
  const col = flash === 'ok' ? '#16A34A' : flash === 'no' ? '#DC2626' : '#1E293B'
  const stemUp = note.staff < 4
  const stemX = nx + (stemUp ? 9 : -9)
  const stemEnd = y + (stemUp ? -46 : 46)
  // ledger lines cho nốt ngoài khuông (vị trí chẵn)
  const ledgers: number[] = []
  for (let s = -2; s >= note.staff; s -= 2) ledgers.push(s)
  for (let s = 10; s <= note.staff; s += 2) ledgers.push(s)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block', maxHeight: 300 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <line key={i} x1={16} x2={W - 16} y1={bY - i * gap} y2={bY - i * gap} stroke="#D8CFBE" strokeWidth={1.4} />
      ))}
      <text x={22} y={bY - gap} fontSize={4 * gap} fill="#2E2A24" fontFamily="Bravura">{String.fromCodePoint(0xE050)}</text>
      {ledgers.map(s => { const ly = bY - s * (gap / 2); return <line key={s} x1={nx - 16} x2={nx + 16} y1={ly} y2={ly} stroke="#CBBF9E" strokeWidth={1.4} /> })}
      <g key={note.label + (flash ?? '')} style={{ animation: '_ngPop .28s ease-out', transformOrigin: `${nx}px ${y}px` }}>
        <ellipse cx={nx} cy={y} rx={11} ry={8.2} fill={col} transform={`rotate(-18 ${nx} ${y})`} />
        <line x1={stemX} x2={stemX} y1={y + (stemUp ? -3 : 3)} y2={stemEnd} stroke={col} strokeWidth={2.6} />
      </g>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes _ngPop{0%{transform:scale(.5);opacity:.3}60%{transform:scale(1.15)}100%{transform:scale(1)}}' }} />
    </svg>
  )
}

const C = { primary: '#4338CA', accent: '#EA580C', bg: '#F0F2F5', surface: '#FFFFFF', ink: '#1E293B', ink2: '#64748B', line: '#E2E8F0', green: '#16A34A', red: '#DC2626' }

export default function NoteGame() {
  const embedded = new URLSearchParams(window.location.search).get('embedded') === '1'
  const [uid, setUid] = useState<string>('anon')
  const [prog, setProg] = useState<ProgMap>({})
  const [screen, setScreen] = useState<'select' | 'play'>('select')
  const [level, setLevel] = useState<LevelDef>(LEVELS[0])
  const [speed, setSpeed] = useState(false)
  const [sound, setSound] = useState(true)

  // trạng thái ván
  const [note, setNote] = useState<Note>(ALL_NOTES[2])
  const [asked, setAsked] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(0)
  const [flash, setFlash] = useState<'ok' | 'no' | null>(null)
  const [locked, setLocked] = useState(false)     // khoá phím trong lúc hiện kết quả
  const [wrongName, setWrongName] = useState<NoteName | null>(null)
  const [result, setResult] = useState<null | { pct: number; passed: boolean }>(null)
  const [timeLeft, setTimeLeft] = useState(1)     // 0..1 cho thanh tốc độ
  const prevLabel = useRef<string>('')
  const timerRef = useRef<number | null>(null)
  const deadline = useRef<number>(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? 'anon'
      setUid(id)
      try { const raw = localStorage.getItem('noteGame:' + id); if (raw) setProg(JSON.parse(raw)) } catch { /**/ }
    })
  }, [])
  const saveProg = useCallback((p: ProgMap) => {
    setProg(p); try { localStorage.setItem('noteGame:' + uid, JSON.stringify(p)) } catch { /**/ }
  }, [uid])

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }

  const nextNote = useCallback((lv: LevelDef) => {
    const pool = poolFor(lv)
    let n = rand(pool), guard = 0
    while (n.label === prevLabel.current && pool.length > 1 && guard++ < 8) n = rand(pool)
    prevLabel.current = n.label
    setNote(n); setFlash(null); setWrongName(null); setLocked(false)
    if (speed) {
      const secs = Math.max(2, lv.secBase - Math.floor((prog[lv.id]?.best ?? 0) / 40))
      deadline.current = Date.now() + secs * 1000
      setTimeLeft(1); clearTimer()
      timerRef.current = window.setInterval(() => {
        const left = (deadline.current - Date.now()) / (secs * 1000)
        if (left <= 0) { setTimeLeft(0); onTimeout() } else setTimeLeft(left)
      }, 80)
    }
  }, [speed, prog])

  const startLevel = (lv: LevelDef, sp: boolean) => {
    setLevel(lv); setSpeed(sp); setScreen('play')
    setAsked(0); setCorrect(0); setStreak(0); setBest(0); setResult(null)
    prevLabel.current = ''
    // dùng lv/sp trực tiếp để né stale
    setTimeout(() => { setSpeedThenNext(lv, sp) }, 0)
  }
  // helper để nextNote chạy với speed mới (state chưa kịp cập nhật)
  const setSpeedThenNext = (lv: LevelDef, sp: boolean) => {
    const pool = poolFor(lv)
    let n = rand(pool); prevLabel.current = n.label
    setNote(n); setFlash(null); setWrongName(null); setLocked(false)
    if (sp) {
      const secs = Math.max(2, lv.secBase - Math.floor((prog[lv.id]?.best ?? 0) / 40))
      deadline.current = Date.now() + secs * 1000; setTimeLeft(1); clearTimer()
      timerRef.current = window.setInterval(() => {
        const left = (deadline.current - Date.now()) / (secs * 1000)
        if (left <= 0) { setTimeLeft(0); onTimeout() } else setTimeLeft(left)
      }, 80)
    }
  }

  const play = (n: Note) => { if (sound) try { playGuitarNote(n.freq, 2) } catch { /**/ } }

  const finish = (asked2: number, correct2: number) => {
    clearTimer()
    const pct = Math.round((correct2 / level.round) * 100)
    const passed = pct >= level.goal
    const cur = prog[level.id] ?? { best: 0, done: false }
    const np: ProgMap = { ...prog, [level.id]: { best: Math.max(cur.best, pct), done: cur.done || passed } }
    if (passed) { const nx = LEVELS.find(l => l.id === level.id + 1); if (nx && !np[nx.id]) np[nx.id] = { best: 0, done: false } }
    saveProg(np)
    setResult({ pct, passed })
  }

  const answer = (name: NoteName) => {
    if (locked || result) return
    clearTimer()
    const ok = name === note.name
    setLocked(true); setFlash(ok ? 'ok' : 'no')
    const a2 = asked + 1
    if (ok) { play(note); const c2 = correct + 1; const s2 = streak + 1; setCorrect(c2); setStreak(s2); setBest(b => Math.max(b, s2))
      setAsked(a2)
      window.setTimeout(() => { if (a2 >= level.round) finish(a2, c2); else nextNote(level) }, 480)
    } else { setStreak(0); setWrongName(note.name); setAsked(a2)
      window.setTimeout(() => { if (a2 >= level.round) finish(a2, correct); else nextNote(level) }, 1150)
    }
  }

  const onTimeout = () => {
    clearTimer()
    if (locked || result) return
    setLocked(true); setFlash('no'); setStreak(0); setWrongName(note.name)
    const a2 = asked + 1; setAsked(a2)
    window.setTimeout(() => { if (a2 >= level.round) finish(a2, correct); else nextNote(level) }, 1150)
  }

  useEffect(() => () => clearTimer(), [])

  const close = () => { if (embedded) { try { window.parent.postMessage({ closeTool: true }, '*') } catch { /**/ } } else { window.history.length > 1 ? window.history.back() : (window.location.href = '/start') } }

  // ── Màn chọn cấp độ ──
  if (screen === 'select') {
    const unlocked = (id: number) => id === 1 || (prog[id - 1]?.done ?? false)
    return (
      <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
        <Header title="Nhận diện nốt nhạc" onClose={close} embedded={embedded} sound={sound} setSound={setSound} />
        <div style={{ padding: '16px 16px 40px', maxWidth: 560, margin: '0 auto', width: '100%' }}>
          <div style={{ color: C.ink2, fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
            Nhìn nốt trên khuông, bấm đúng tên. Vượt mục tiêu để mở cấp tiếp theo. Chơi lại nhiều lần để nhớ mặt nốt.
          </div>
          {LEVELS.map(lv => {
            const p = prog[lv.id]; const open = unlocked(lv.id)
            return (
              <div key={lv.id} style={{ background: C.surface, borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,.06)', border: `1px solid ${C.line}`, opacity: open ? 1 : .55, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: open ? C.primary : '#CBD5E1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>{lv.id}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15.5, color: C.ink }}>{lv.name}</div>
                  <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 1 }}>{lv.subtitle}</div>
                  <div style={{ fontSize: 11.5, color: p?.done ? C.green : C.accent, marginTop: 4, fontWeight: 600 }}>
                    {p?.done ? `✓ Đạt · Tốt nhất ${p.best}%` : p ? `Tốt nhất ${p.best}% · cần ${lv.goal}%` : `Mục tiêu ${lv.goal}%`}
                  </div>
                </div>
                {open ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => startLevel(lv, false)} style={btn(C.primary)}>Thường</button>
                    <button onClick={() => startLevel(lv, true)} style={btn(C.accent)}>⚡ Tốc độ</button>
                  </div>
                ) : <span style={{ fontSize: 20, color: '#94A3B8', flexShrink: 0 }}>🔒</span>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Màn chơi ──
  const pct = asked > 0 ? Math.round((correct / asked) * 100) : 0
  return (
    <div style={{ height: '100dvh', background: C.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header title={level.name} subtitle={speed ? '⚡ Tốc độ' : 'Thường'} onClose={() => { clearTimer(); setScreen('select') }} embedded={embedded} sound={sound} setSound={setSound} back />
      {/* Thanh chỉ số */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: C.surface, borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
        <Stat n={correct} l="Đúng" c={C.green} />
        <Stat n={asked - correct} l="Sai" c={C.red} />
        <Stat n={`${pct}%`} l="Tỉ lệ" c={C.accent} />
        <Stat n={level.round - asked} l="Còn" c={C.primary} />
        <Stat n={`🔥${best}`} l="Chuỗi" c={C.ink} />
      </div>
      {/* thanh tốc độ */}
      {speed && (
        <div style={{ height: 5, background: '#E2E8F0', flexShrink: 0 }}>
          <div style={{ height: '100%', width: `${Math.max(0, timeLeft) * 100}%`, background: timeLeft < .3 ? C.red : C.accent, transition: 'width .08s linear' }} />
        </div>
      )}
      {/* khuông nốt */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0, padding: 12 }}>
        <div style={{ background: C.surface, borderRadius: 20, boxShadow: '0 2px 10px rgba(0,0,0,.06)', padding: '8px 6px', width: '100%', maxWidth: 460 }}>
          <BigStaff note={note} flash={flash} />
        </div>
        <div style={{ height: 30, marginTop: 10 }}>
          {flash === 'ok' && <span style={{ color: C.green, fontWeight: 800, fontSize: 18 }}>Chính xác! 🎉</span>}
          {flash === 'no' && wrongName && <span style={{ color: C.red, fontWeight: 700, fontSize: 16 }}>Đây là nốt <b>{wrongName}</b></span>}
          {!flash && <button onClick={() => play(note)} style={{ background: 'transparent', border: `1px solid ${C.line}`, borderRadius: 20, padding: '5px 14px', color: C.primary, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>🔊 Nghe nốt này</button>}
        </div>
      </div>
      {/* phím Đô..Si */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, padding: '10px 12px calc(12px + env(safe-area-inset-bottom))', background: C.surface, borderTop: `1px solid ${C.line}`, flexShrink: 0 }}>
        {CHOICES.map(nm => (
          <button key={nm} onClick={() => answer(nm)} disabled={locked}
            style={{ padding: '16px 4px', borderRadius: 14, border: `1.5px solid ${C.line}`, background: locked && nm === note.name ? '#DCFCE7' : '#F8FAFC', color: C.ink, fontSize: 17, fontWeight: 700, cursor: locked ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'transform .05s', opacity: locked && nm !== note.name && flash === 'no' ? .5 : 1 }}>
            {nm}
          </button>
        ))}
      </div>

      {/* Kết quả ván */}
      {result && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
          <div style={{ background: C.surface, borderRadius: 22, padding: '28px 24px', maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 46, marginBottom: 8 }}>{result.passed ? '🏆' : '💪'}</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: C.ink }}>{result.passed ? 'Hoàn thành cấp này!' : 'Gần đạt rồi!'}</div>
            <div style={{ fontSize: 15, color: C.ink2, margin: '10px 0 4px' }}>Đúng <b style={{ color: C.green }}>{correct}/{level.round}</b> · Tỉ lệ <b style={{ color: C.accent }}>{result.pct}%</b></div>
            <div style={{ fontSize: 13, color: C.ink2, marginBottom: 20 }}>{result.passed ? (LEVELS.find(l => l.id === level.id + 1) ? 'Đã mở cấp tiếp theo 🎉' : 'Bạn đã thuộc hết mặt nốt!') : `Cần ${level.goal}% để qua — thử lại nhé.`}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.passed && LEVELS.find(l => l.id === level.id + 1) && (
                <button onClick={() => startLevel(LEVELS.find(l => l.id === level.id + 1)!, speed)} style={{ ...bigBtn(C.primary) }}>Cấp tiếp theo →</button>
              )}
              <button onClick={() => startLevel(level, speed)} style={{ ...bigBtn(C.accent) }}>Chơi lại</button>
              <button onClick={() => { setResult(null); setScreen('select') }} style={{ ...bigBtn('#64748B') }}>Về danh sách cấp độ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const btn = (bg: string): React.CSSProperties => ({ background: bg, color: '#fff', border: 'none', borderRadius: 10, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })
const bigBtn = (bg: string): React.CSSProperties => ({ background: bg, color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%' })

function Stat({ n, l, c }: { n: React.ReactNode; l: string; c: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontWeight: 800, fontSize: 16, color: c, lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 1 }}>{l}</div>
    </div>
  )
}

function Header({ title, subtitle, onClose, embedded, sound, setSound, back }: { title: string; subtitle?: string; onClose: () => void; embedded: boolean; sound: boolean; setSound: (b: boolean) => void; back?: boolean }) {
  return (
    <div style={{ background: C.primary, color: '#fff', padding: 'calc(10px + env(safe-area-inset-top)) 14px 12px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
      {(!embedded || back) && (
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,.16)', border: 'none', color: '#fff', borderRadius: 10, padding: '7px 12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{back ? '‹ Cấp độ' : '× Đóng'}</button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, opacity: .85 }}>{subtitle}</div>}
      </div>
      <button onClick={() => setSound(!sound)} style={{ background: 'rgba(255,255,255,.16)', border: 'none', color: '#fff', borderRadius: 10, width: 38, height: 38, cursor: 'pointer', fontSize: 16 }}>{sound ? '🔊' : '🔇'}</button>
    </div>
  )
}
