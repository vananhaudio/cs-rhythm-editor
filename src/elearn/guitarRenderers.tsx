// ── Renderer các slide tương tác guitar cho FlowPlayer ────────────────────────
// Mỗi renderer EMIT onPass/onWrong/onOpenTool cho engine (KHÔNG tự kết thúc bài).
// Khung "self-check trung thực": app phát tiếng mẫu → học viên bắt chước trên đàn THẬT → tự xác nhận.
// (App chưa nghe được tay đàn — phần chấm bằng mic để Giai đoạn 3.)
import { useState, useEffect, useRef } from 'react'
import { ACCENT, STRINGS, freqOfNum, colorOfNum, widthOfNum, stringByNum } from './guitarConst'
import { playTone, playSequence } from './audio'

export interface NeckCfg { target?: number; successMsg?: string }
export interface ChecklistCfg { items?: string[]; requireAll?: boolean }
export interface NoteChartCfg { highlight?: string[] }
export interface StrumCfg { sequence?: number[] }                 // dãy số dây cần gảy đúng thứ tự
export interface EarCfg { pool?: number[]; rounds?: number; passScore?: number }
// "Đánh theo mẫu": máy chạy chuỗi nốt theo nhịp, học viên bắt chước
export interface NotePracticeCfg {
  notes?: { label: string; freq: number }[]   // chuỗi nốt (vd 4× Mi)
  speeds?: { label: string; bpm: number }[]    // các tốc độ chọn
}

interface CB { onPass: () => void; onWrong: () => void }

// ── Dãy 6 dây ngang (dùng lại nhiều renderer) ─────────────────────────────────
function HStrings({ onTap, reveal, target, picked, blink }: {
  onTap?: (num: number) => void
  reveal?: boolean
  target?: number
  picked?: number | null
  blink?: number | null   // dây cần nhấp nháy gợi ý
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {STRINGS.map(s => {
        const c = colorOfNum(s.num), w = widthOfNum(s.num)
        const isTarget = target === s.num
        const isPicked = picked === s.num
        const isBlink = blink === s.num
        let bg = '#fff', bd = '1px solid #EDE7DA'
        if (isPicked && isTarget) { bg = ACCENT.s; bd = `1.5px solid ${ACCENT.a}` }
        else if (isPicked && !isTarget) { bg = '#FBEDE9'; bd = '1.5px solid #D98A6E' }
        else if (isBlink) { bg = ACCENT.s; bd = `1.5px solid ${ACCENT.a}` }
        return (
          <button key={s.num} onClick={onTap ? () => onTap(s.num) : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 13px', border: bd, borderRadius: 11, background: bg, cursor: onTap ? 'pointer' : 'default', fontFamily: 'inherit', width: '100%', animation: isBlink ? '_strBlink 0.6s ease-in-out 2' : undefined }}>
            <div style={{ width: 22, flexShrink: 0, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, fontWeight: 800, color: reveal || isBlink ? c : '#C9C0AF' }}>
              {reveal || isBlink ? s.num : '?'}
            </div>
            <div style={{ flex: 1, height: w, borderRadius: 99, background: c }} />
            <div style={{ width: 50, flexShrink: 0, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: c }}>
              {reveal || isBlink ? `${s.vn}·${s.note}` : ''}
            </div>
          </button>
        )
      })}
      <style dangerouslySetInnerHTML={{ __html: '@keyframes _strBlink{0%,100%{transform:none}50%{transform:scale(1.015)}}' }} />
    </div>
  )
}

// ── guitar_neck: chạm đúng 1 dây ──────────────────────────────────────────────
export function NeckPick({ cfg, onPass, onWrong }: { cfg: NeckCfg } & CB) {
  const target = cfg.target ?? 1
  const [picked, setPicked] = useState<number | null>(null)
  const [wrong, setWrong] = useState(0)
  const ok = picked === target
  const ts = stringByNum(target)

  const tap = (num: number) => {
    if (ok) return
    playTone(freqOfNum(num))
    setPicked(num)
    if (num === target) { onPass() }
    else { setWrong(w => w + 1); onWrong() }
  }

  return (
    <div>
      <HStrings onTap={tap} reveal={ok} target={target} picked={picked}
        blink={!ok && wrong >= 2 ? target : null} />
      <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, fontSize: 13.5, fontWeight: 600, lineHeight: 1.5,
        background: ok ? ACCENT.s : picked != null ? '#FBEDE9' : '#F6F2EA',
        color: ok ? ACCENT.d : picked != null ? '#A03B1C' : '#8A8478' }}>
        {ok
          ? (cfg.successMsg ?? `Đúng rồi — đây là dây ${target} (${ts?.vn}·${ts?.note}). Giờ gảy thử dây này trên cây đàn của bạn nhé. 🎸`)
          : picked != null
            ? (wrong >= 2 ? `Dây cần tìm đang nhấp nháy — đó là dây ${target}, ${target === 1 ? 'mỏng nhất, trên cùng' : target === 6 ? 'dày nhất, dưới cùng' : 'ở giữa'}.` : 'Chưa đúng — thử lại nhé. Nghe lại tiếng để đoán.')
            : `Chạm dây bạn nghĩ là dây ${target}${target === 1 ? ' (mỏng nhất, trên cùng)' : ''}.`}
      </div>
    </div>
  )
}

// ── note_chart: bảng nốt C–B ↔ Đô–Si (NHẬN, không gate) ───────────────────────
export function NoteChart({ cfg }: { cfg?: NoteChartCfg }) {
  const N: [string, string][] = [['C', 'Đô'], ['D', 'Rê'], ['E', 'Mi'], ['F', 'Fa'], ['G', 'Sol'], ['A', 'La'], ['B', 'Si']]
  const used: Record<string, number> = { E: 1, A: 1, D: 1, G: 1, B: 1 }
  const hl = cfg?.highlight
  const isOn = (l: string) => (hl && hl.length ? hl.includes(l) : !!used[l])
  return (
    <div style={{ background: '#fff', border: '1px solid #EAE4D8', borderRadius: 16, padding: '14px 14px 12px' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 2 }}>Ký hiệu tên nốt</div>
      <div style={{ fontSize: 11.5, color: '#8A8478', lineHeight: 1.45, marginBottom: 12 }}>Guitar dùng 7 chữ cái quốc tế — đây là bảng "phiên dịch" sang Đô-Rê-Mi:</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
        {N.map(([letter, vn]) => (
          <div key={letter} style={{ textAlign: 'center', padding: '8px 2px', borderRadius: 10, background: isOn(letter) ? ACCENT.s : '#F6F2EA', border: isOn(letter) ? `1.5px solid ${ACCENT.a}` : '1px solid #EAE4D8' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 800, color: isOn(letter) ? ACCENT.a : '#1C1A17' }}>{letter}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6B655A', marginTop: 2 }}>{vn}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: '#A8A294', lineHeight: 1.4 }}>Ô tô màu = 5 chữ cái xuất hiện trên 6 dây đàn (E, A, D, G, B).</div>
    </div>
  )
}

// ── checklist: tự đánh giá (NGẪM, không có "sai") ─────────────────────────────
export function Checklist({ cfg, onPass }: { cfg: ChecklistCfg } & Pick<CB, 'onPass'>) {
  const items = cfg.items ?? []
  const requireAll = cfg.requireAll !== false
  const [checks, setChecks] = useState<Record<number, boolean>>({})
  const doneCount = items.filter((_, i) => checks[i]).length
  const satisfied = requireAll ? doneCount === items.length && items.length > 0 : doneCount > 0

  // Báo "vượt" ở effect (KHÔNG gọi onPass trong updater/render)
  useEffect(() => { if (satisfied) onPass() }, [satisfied]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (i: number) => setChecks(c => ({ ...c, [i]: !c[i] }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, i) => {
        const on = checks[i]
        return (
          <button key={i} onClick={() => toggle(i)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', border: `1.5px solid ${on ? ACCENT.a : '#E6E0D4'}`, borderRadius: 13, background: on ? ACCENT.s : '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%' }}>
            <div style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 7, border: `2px solid ${on ? ACCENT.a : '#D8CFBE'}`, background: on ? ACCENT.a : 'transparent', color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</div>
            <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: '#3A352C', lineHeight: 1.4 }}>{it}</div>
          </button>
        )
      })}
      {satisfied && (
        <div style={{ marginTop: 4, padding: '11px 14px', borderRadius: 12, background: ACCENT.s, color: ACCENT.d, fontSize: 13, fontWeight: 600, textAlign: 'center' }}>Xong rồi! Bạn đã sẵn sàng cho bước tiếp theo.</div>
      )}
    </div>
  )
}

// ── guitar_strum: gảy đủ dãy dây đúng thứ tự (LÀM) ────────────────────────────
export function Strum({ cfg, onPass, onWrong }: { cfg: StrumCfg } & CB) {
  const seq = cfg.sequence?.length ? cfg.sequence : [1, 2, 3, 4, 5, 6]
  const [step, setStep] = useState(0)
  const [wrong, setWrong] = useState<number | null>(null)
  const done = step >= seq.length
  const target = done ? null : seq[step]
  const tg = target != null ? stringByNum(target) : null

  const tap = (num: number) => {
    if (done) return
    playTone(freqOfNum(num))
    if (num === target) { setWrong(null); setStep(s => s + 1) }
    else { setWrong(num); onWrong() }
  }
  useEffect(() => { if (done) onPass() }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '10px 0' }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>Gảy đúng cả dãy!</div>
        <div style={{ fontSize: 13.5, color: '#6B655A', marginTop: 3, lineHeight: 1.5 }}>Giờ thử gảy lại dãy này trên cây đàn của bạn — tay phải đều, từng dây nghe rõ.</div>
        <div style={{ marginTop: 12 }}><ReplayStrings nums={seq} /></div>
        <button onClick={() => { setStep(0); setWrong(null) }} style={{ marginTop: 10, padding: '9px 18px', border: '1px solid #E2DBCD', borderRadius: 10, background: '#fff', color: '#5A5448', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Gảy lại trong app</button>
      </div>
    )
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 14, borderRadius: 14, background: '#1C1A17', marginBottom: 14 }}>
        <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 12, background: colorOfNum(target!), color: '#fff', fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tg?.note}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', color: '#9A9082' }}>HÃY GẢY</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#F4E9D8', marginTop: 2 }}>Dây {tg?.num} · {tg?.vn} ({tg?.note})</div>
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: '#9A9082' }}>{step}/{seq.length}</div>
      </div>
      <HStrings onTap={tap} reveal target={target ?? undefined} picked={wrong} />
      {wrong != null && (
        <div style={{ marginTop: 12, padding: '11px 14px', borderRadius: 12, background: '#FBEDE9', color: '#A03B1C', fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
          Bạn gảy dây {stringByNum(wrong)?.num}. Cần gảy dây {tg?.num} — {target === 1 ? 'mỏng nhất, trên cùng' : target === 6 ? 'dày nhất, dưới cùng' : 'ở giữa'}.
        </div>
      )}
    </div>
  )
}

// ── guitar_ear: nghe âm → đoán dây (LÀM, luyện tai) ───────────────────────────
export function Ear({ cfg, onPass }: { cfg: EarCfg } & Pick<CB, 'onPass'>) {
  const pool = cfg.pool?.length ? cfg.pool : [1, 2, 3, 4, 5, 6]
  const rounds = cfg.rounds ?? 5
  const pick = () => pool[Math.floor(Math.random() * pool.length)]
  const [target, setTarget] = useState(pick)
  const [picked, setPicked] = useState<number | null>(null)
  const [round, setRound] = useState(1)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => { if (done) onPass() }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  const play = () => playTone(freqOfNum(target))
  const choose = (num: number) => {
    if (picked !== null) return
    setPicked(num)
    if (num === target) setScore(s => s + 1)
  }
  const next = () => {
    if (round >= rounds) { setDone(true); return }
    setRound(r => r + 1); setTarget(pick()); setPicked(null)
  }
  const restart = () => { setDone(false); setRound(1); setScore(0); setTarget(pick()); setPicked(null) }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '10px 0' }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>Xong {rounds} câu!</div>
        <div style={{ fontSize: 14, color: '#6B655A', marginTop: 3 }}>Đúng <b style={{ color: ACCENT.a }}>{score}/{rounds}</b> — tai bạn đang quen dần với từng dây.</div>
        <button onClick={restart} style={{ marginTop: 12, padding: '10px 20px', border: '1px solid #E2DBCD', borderRadius: 10, background: '#fff', color: '#5A5448', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Luyện lại</button>
      </div>
    )
  }
  const answered = picked !== null, ok = picked === target
  const tgE = stringByNum(target)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#8A8478' }}>Câu {round}/{rounds}</div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, fontWeight: 700, color: ACCENT.a }}>Đúng {score}</div>
      </div>
      <button onClick={play} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18, border: 'none', borderRadius: 15, background: '#1C1A17', color: '#F4E9D8', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>🔊 Nghe âm</button>
      <div style={{ fontSize: 13.5, fontWeight: 700, textAlign: 'center', marginBottom: 12, color: '#3A352C' }}>Âm vừa nghe là dây nào?</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {pool.map(num => {
          const s = stringByNum(num)!, c = colorOfNum(num)
          let bg = '#fff', bd = '#E6E0D4'
          if (answered && num === target) { bg = ACCENT.s; bd = ACCENT.a }
          else if (answered && num === picked) { bg = '#FBEDE9'; bd = '#D98A6E' }
          return (
            <button key={num} onClick={() => choose(num)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px', border: `1.5px solid ${bd}`, borderRadius: 12, background: bg, cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              <div style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 8, background: c, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.note}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#3A352C' }}>Dây {s.num} · {s.vn}</div>
            </button>
          )
        })}
      </div>
      {answered && (
        <div style={{ marginTop: 12 }}>
          <div style={{ padding: '11px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600, lineHeight: 1.5, background: ok ? ACCENT.s : '#FBEDE9', color: ok ? ACCENT.d : '#A03B1C' }}>
            {ok ? `Chính xác — dây ${tgE?.num} (${tgE?.vn}·${tgE?.note}).` : `Là dây ${tgE?.num} (${tgE?.vn}·${tgE?.note}). Bấm 🔊 nghe lại để nhớ.`}
          </div>
          <button onClick={next} style={{ marginTop: 10, width: '100%', padding: 13, border: 'none', borderRadius: 12, background: ACCENT.a, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{round >= rounds ? 'Xem kết quả' : 'Câu tiếp →'}</button>
        </div>
      )}
    </div>
  )
}

// ── note_practice: máy chạy chuỗi nốt theo nhịp → học viên ĐÁNH THEO (bắt chước) ──
const DEFAULT_SPEEDS = [{ label: 'Chậm', bpm: 60 }, { label: 'Vừa', bpm: 80 }, { label: 'Nhanh', bpm: 100 }]
export function NotePractice({ cfg, onPass }: { cfg: NotePracticeCfg } & Pick<CB, 'onPass'>) {
  const notes = cfg.notes?.length ? cfg.notes : Array.from({ length: 4 }, () => ({ label: 'Mi', freq: 329.63 }))
  const speeds = cfg.speeds?.length ? cfg.speeds : DEFAULT_SPEEDS
  const [speedIdx, setSpeedIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const [done, setDone] = useState(false)
  const timer = useRef<number | null>(null)
  const beat = useRef(0)

  const stop = () => {
    if (timer.current) { clearInterval(timer.current); timer.current = null }
    setPlaying(false); setCursor(-1)
  }
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  const start = () => {
    if (timer.current) clearInterval(timer.current)
    setPlaying(true); beat.current = 0
    const ms = 60000 / speeds[speedIdx].bpm
    const tick = () => {
      const i = beat.current % notes.length
      setCursor(i)
      playTone(notes[i].freq)
      beat.current++
      // sau 2 vòng (đủ vài nhịp) → mở hoàn thành
      if (beat.current >= notes.length * 2 && !done) { setDone(true); onPass() }
    }
    tick()
    timer.current = window.setInterval(tick, ms)
  }

  return (
    <div>
      {/* Chọn tốc độ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#8A8478', letterSpacing: '.04em' }}>TỐC ĐỘ</span>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: '#EFE9DD', borderRadius: 12 }}>
          {speeds.map((s, i) => (
            <button key={i} onClick={() => { setSpeedIdx(i); if (playing) start() }}
              style={{ padding: '7px 16px', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                background: speedIdx === i ? '#fff' : 'transparent', color: speedIdx === i ? ACCENT.d : '#8A8478',
                boxShadow: speedIdx === i ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* Dãy nốt chạy */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: '18px 0' }}>
        {notes.map((n, i) => {
          const on = cursor === i
          return (
            <div key={i} style={{ width: 58, height: 58, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, transition: 'all .08s',
              background: on ? ACCENT.a : '#fff', color: on ? '#fff' : '#C9C0AF',
              border: `2px solid ${on ? ACCENT.a : '#E6E0D4'}`, transform: on ? 'scale(1.12)' : 'none',
              boxShadow: on ? `0 6px 16px -6px ${ACCENT.a}` : 'none' }}>
              {n.label}
            </div>
          )
        })}
      </div>

      {/* Nút điều khiển */}
      <button onClick={playing ? stop : start}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16, border: 'none', borderRadius: 15, background: playing ? '#1C1A17' : ACCENT.a, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
        <span style={{ fontSize: 18 }}>{playing ? '⏹' : '▶'}</span>
        <span>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{playing ? 'Dừng lại' : 'Bắt đầu chơi theo'}</span>
          {!playing && <span style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 1 }}>Máy chạy nốt đều — bạn đánh theo trên đàn</span>}
        </span>
      </button>

      <div style={{ marginTop: 12, fontSize: 12, color: '#A8A294', textAlign: 'center', lineHeight: 1.5 }}>
        Nghe máy chạy rồi gảy theo. Không cần nhanh — đều và rõ là được.
      </div>
      {done && (
        <div style={{ marginTop: 12, padding: '11px 14px', borderRadius: 12, background: ACCENT.s, color: ACCENT.d, fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
          Tốt lắm! Bạn đã chơi theo được — có thể bấm Dừng và sang bước sau.
        </div>
      )}
    </div>
  )
}

// ── Nút "nghe lại chuỗi dây vừa học" (bằng chứng tiến bộ, dùng cuối bài) ────────
export function ReplayStrings({ nums }: { nums: number[] }) {
  return (
    <button onClick={() => playSequence(nums.map(freqOfNum))}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', border: 'none', borderRadius: 12, background: '#1C1A17', color: '#F4E9D8', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
      🔊 Nghe lại chuỗi dây
    </button>
  )
}
