// ── Renderer các slide tương tác guitar cho FlowPlayer ────────────────────────
// Mỗi renderer EMIT onPass/onWrong/onOpenTool cho engine (KHÔNG tự kết thúc bài).
// Khung "self-check trung thực": app phát tiếng mẫu → học viên bắt chước trên đàn THẬT → tự xác nhận.
// (App chưa nghe được tay đàn — phần chấm bằng mic để Giai đoạn 3.)
import { useState, useEffect, useRef } from 'react'
import { ACCENT, STRINGS, freqOfNum, colorOfNum, widthOfNum, stringByNum } from './guitarConst'
import { playTone, playSequence, playClick, playKick, playSnare, playHat, playBass, playPad } from './audio'
import { detectPitch, pitchClass } from './pitch'
import { playGuitarNote } from '../audioEngine'   // engine guitar (nốt ngân độc lập) — để rải hợp âm không bị cắt

export interface NeckCfg { target?: number; successMsg?: string }
export interface ChecklistCfg { items?: string[]; requireAll?: boolean }
export interface NoteChartCfg { highlight?: string[] }
export interface StrumCfg { sequence?: number[] }                 // dãy số dây cần gảy đúng thứ tự
export interface EarCfg { pool?: number[]; rounds?: number; passScore?: number }
// "Đánh theo mẫu": máy chạy chuỗi nốt theo nhịp, học viên bắt chước
export interface NoteItem { label: string; freq: number; string?: number; fret?: number; staff?: number; dur?: number; rest?: boolean; acc?: '#' | 'b' }  // dur = số phách (mặc định 1); rest = dấu lặng; acc = dấu hoá (#/b) vẽ trước nốt (cùng dòng với nốt tự nhiên)
// "Xem nốt": hình minh hoạ tĩnh (khuông nhạc và/hoặc cần đàn) + nút nghe thử
export interface NoteShowCfg {
  label?: string; freq?: number; string?: number; fret?: number; staff?: number
  showStaff?: boolean; showFretboard?: boolean; caption?: string; dur?: number   // dur ≥2 → nốt trắng/tròn đầu rỗng (dạy trường độ)
  acc?: '#' | 'b'                                                                // dấu hoá vẽ trước nốt (dạy dấu thăng/giáng)
}
export interface NotePracticeCfg {
  notes?: NoteItem[]                            // chuỗi nốt (vd 4× Mi). string/fret để vẽ cần đàn, staff = vị trí trên khuông (0 = dòng kẻ dưới cùng = Mi/E4)
  speeds?: { label: string; bpm: number }[]    // các tốc độ chọn
  showStaff?: boolean                           // hiện khuông nhạc (mặc định có nếu nốt có staff)
  hint?: string                                 // dòng nhắc nhỏ dưới khuông (vd: chưa cần để ý trường độ)
  showDur?: boolean                             // vẽ nốt đen/trắng/tròn theo dur (chỉ chương Trường độ); mặc định mọi nốt giống nhau
  beatsPerBar?: number                          // số phách mỗi ô nhịp (2/3/4) → vẽ vạch nhịp + số chỉ nhịp + count-in đếm đúng
  chords?: { bass: number; pad: number[] }[]    // nền đệm ban nhạc: mỗi ô 1 hợp âm (bass + strings pad); có = bật trống+bass+pad khi Nghe mẫu
  scored?: boolean                              // Tự đàn kiểu B: nốt CHẠY THEO NHỊP (không chờ), mic chấm điểm cuối bài. Mặc định = kiểu A (đàn đúng mới chạy)
}
// "Chia ô nhịp": đối chiếu SHEET (vẽ sạch từ nốt MusicXML) ↔ LỜI, bút kẻ vạch chia ô nhịp
export interface SNote { pos?: number; rest?: boolean; dur: 'e' | 'q' | 'h' | 'w' }  // pos = bậc trên khuông (E4=0, mỗi bậc = nửa dòng), dur = trường độ
export interface BarCell { notes?: SNote[]; words: string[]; lead?: boolean; hold?: boolean }  // 1 ô nhịp (lead=mở bằng dấu lặng; hold=1 chữ ngân cả ô)
export interface CauLine { bars: BarCell[] }                                                    // 1 câu = vài ô nhịp
export interface BarSplitCfg { lines?: CauLine[]; caption?: string }

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
            <div style={{ width: 22, flexShrink: 0, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 13.5, fontWeight: 800, color: reveal || isBlink ? c : '#C9C0AF' }}>
              {reveal || isBlink ? s.num : '?'}
            </div>
            <div style={{ flex: 1, height: w, borderRadius: 99, background: c }} />
            <div style={{ width: 50, flexShrink: 0, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: c }}>
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
      <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, fontSize: 14.5, fontWeight: 600, lineHeight: 1.5,
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
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>Ký hiệu tên nốt</div>
      <div style={{ fontSize: 12.5, color: '#8A8478', lineHeight: 1.45, marginBottom: 12 }}>Guitar dùng 7 chữ cái quốc tế — đây là bảng "phiên dịch" sang Đô-Rê-Mi:</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
        {N.map(([letter, vn]) => (
          <div key={letter} style={{ textAlign: 'center', padding: '8px 2px', borderRadius: 10, background: isOn(letter) ? ACCENT.s : '#F6F2EA', border: isOn(letter) ? `1.5px solid ${ACCENT.a}` : '1px solid #EAE4D8' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 17, fontWeight: 800, color: isOn(letter) ? ACCENT.a : '#1C1A17' }}>{letter}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B655A', marginTop: 2 }}>{vn}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#A8A294', lineHeight: 1.4 }}>Ô tô màu = 5 chữ cái xuất hiện trên 6 dây đàn (E, A, D, G, B).</div>
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
            <div style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 7, border: `2px solid ${on ? ACCENT.a : '#D8CFBE'}`, background: on ? ACCENT.a : 'transparent', color: '#fff', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</div>
            <div style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: '#3A352C', lineHeight: 1.4 }}>{it}</div>
          </button>
        )
      })}
      {satisfied && (
        <div style={{ marginTop: 4, padding: '11px 14px', borderRadius: 12, background: ACCENT.s, color: ACCENT.d, fontSize: 14, fontWeight: 600, textAlign: 'center' }}>Xong rồi! Bạn đã sẵn sàng cho bước tiếp theo.</div>
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
        <div style={{ fontSize: 14.5, color: '#6B655A', marginTop: 3, lineHeight: 1.5 }}>Giờ thử gảy lại dãy này trên cây đàn của bạn — tay phải đều, từng dây nghe rõ.</div>
        <div style={{ marginTop: 12 }}><ReplayStrings nums={seq} /></div>
        <button onClick={() => { setStep(0); setWrong(null) }} style={{ marginTop: 10, padding: '9px 18px', border: '1px solid #E2DBCD', borderRadius: 10, background: '#fff', color: '#5A5448', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Gảy lại trong app</button>
      </div>
    )
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 14, borderRadius: 14, background: '#1C1A17', marginBottom: 14 }}>
        <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 12, background: colorOfNum(target!), color: '#fff', fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tg?.note}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', color: '#9A9082' }}>HÃY GẢY</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#F4E9D8', marginTop: 2 }}>Dây {tg?.num} · {tg?.vn} ({tg?.note})</div>
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: '#9A9082' }}>{step}/{seq.length}</div>
      </div>
      <HStrings onTap={tap} reveal target={target ?? undefined} picked={wrong} />
      {wrong != null && (
        <div style={{ marginTop: 12, padding: '11px 14px', borderRadius: 12, background: '#FBEDE9', color: '#A03B1C', fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>
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
        <div style={{ fontSize: 15, color: '#6B655A', marginTop: 3 }}>Đúng <b style={{ color: ACCENT.a }}>{score}/{rounds}</b> — tai bạn đang quen dần với từng dây.</div>
        <button onClick={restart} style={{ marginTop: 12, padding: '10px 20px', border: '1px solid #E2DBCD', borderRadius: 10, background: '#fff', color: '#5A5448', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Luyện lại</button>
      </div>
    )
  }
  const answered = picked !== null, ok = picked === target
  const tgE = stringByNum(target)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#8A8478' }}>Câu {round}/{rounds}</div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13.5, fontWeight: 700, color: ACCENT.a }}>Đúng {score}</div>
      </div>
      <button onClick={play} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18, border: 'none', borderRadius: 15, background: '#1C1A17', color: '#F4E9D8', fontFamily: 'inherit', fontSize: 17, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>🔊 Nghe âm</button>
      <div style={{ fontSize: 14.5, fontWeight: 700, textAlign: 'center', marginBottom: 12, color: '#3A352C' }}>Âm vừa nghe là dây nào?</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {pool.map(num => {
          const s = stringByNum(num)!, c = colorOfNum(num)
          let bg = '#fff', bd = '#E6E0D4'
          if (answered && num === target) { bg = ACCENT.s; bd = ACCENT.a }
          else if (answered && num === picked) { bg = '#FBEDE9'; bd = '#D98A6E' }
          return (
            <button key={num} onClick={() => choose(num)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px', border: `1.5px solid ${bd}`, borderRadius: 12, background: bg, cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              <div style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 8, background: c, color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.note}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#3A352C' }}>Dây {s.num} · {s.vn}</div>
            </button>
          )
        })}
      </div>
      {answered && (
        <div style={{ marginTop: 12 }}>
          <div style={{ padding: '11px 14px', borderRadius: 12, fontSize: 14, fontWeight: 600, lineHeight: 1.5, background: ok ? ACCENT.s : '#FBEDE9', color: ok ? ACCENT.d : '#A03B1C' }}>
            {ok ? `Chính xác — dây ${tgE?.num} (${tgE?.vn}·${tgE?.note}).` : `Là dây ${tgE?.num} (${tgE?.vn}·${tgE?.note}). Bấm 🔊 nghe lại để nhớ.`}
          </div>
          <button onClick={next} style={{ marginTop: 10, width: '100%', padding: 13, border: 'none', borderRadius: 12, background: ACCENT.a, color: '#fff', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{round >= rounds ? 'Xem kết quả' : 'Câu tiếp →'}</button>
        </div>
      )}
    </div>
  )
}

// ── note_practice: máy chạy chuỗi nốt theo nhịp → học viên ĐÁNH THEO (bắt chước) ──
const DEFAULT_SPEEDS = [{ label: 'Chậm', bpm: 60 }, { label: 'Vừa', bpm: 80 }, { label: 'Nhanh', bpm: 100 }]

// Cần đàn mini gỗ tối — hiện 1 nốt theo (dây 1..6 từ trên xuống, phím 0=buông sát nut)
export function MiniFretboard({ string, fret, pulse, h = 128 }: { string?: number; fret?: number; pulse?: number; h?: number }) {
  const STRING_CNT = 6, FRET_COUNT = 4, H = h
  const rowY = (num: number) => ((num - 1 + 0.5) / STRING_CNT) * 100   // dây 1 → trên cùng
  const strW = (num: number) => 1.2 + (num - 1) * (2.4 / 5)
  const active = string != null && fret != null
  const xPct = fret === 0 ? 2 : ((fret! - 0.5) / FRET_COUNT) * 100
  return (
    <div>
      <div style={{ display: 'flex', height: H }}>
        <div style={{ width: 22, flexShrink: 0, position: 'relative' }}>
          {[1, 2, 3, 4, 5, 6].map(num => (
            <div key={num} style={{ position: 'absolute', right: 3, top: `${rowY(num)}%`, transform: 'translateY(-50%)', fontSize: 9, fontWeight: 700, color: colorOfNum(num) }}>{num}</div>
          ))}
        </div>
        <div style={{ flex: 1, position: 'relative', background: 'linear-gradient(180deg,#1e1008,#20140F 55%,#1a0d06)', border: '1.5px solid #3a2a1f', borderRadius: '0 8px 8px 0', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: 'linear-gradient(90deg,#b8ac90,#ede3cc,#b8ac90)', zIndex: 4 }} />
          {[1, 2, 3].map(i => <div key={i} style={{ position: 'absolute', left: `${i * 25}%`, top: 0, bottom: 0, width: 2, background: 'linear-gradient(90deg,#888,#bbb,#888)', zIndex: 3 }} />)}
          {[1, 2, 3, 4, 5, 6].map(num => { const t = strW(num); return (
            <div key={num} style={{ position: 'absolute', left: 6, right: 0, top: `${rowY(num)}%`, height: t, marginTop: -(t / 2), background: `linear-gradient(90deg,${colorOfNum(num)}99,${colorOfNum(num)})`, zIndex: 3 }} />
          )})}
          {active && (
            <div key={pulse} style={{ position: 'absolute', left: `${xPct}%`, top: `${rowY(string!)}%`, width: 26, height: 26, marginLeft: -13, marginTop: -13, borderRadius: '50%', background: ACCENT.a, border: '2px solid rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', zIndex: 10, boxShadow: `0 0 14px ${ACCENT.a}, 0 2px 6px rgba(0,0,0,.5)`, animation: '_ntPing .25s ease-out' }}>
              {fret === 0 ? '○' : fret}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', marginLeft: 22, marginTop: 4 }}>
        {[1, 2, 3, 4].map(f => <div key={f} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#9CA3AF' }}>{f}</div>)}
      </div>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes _ntPing{0%{transform:scale(.6)}60%{transform:scale(1.18)}100%{transform:scale(1)}}' }} />
    </div>
  )
}

// Dòng kẻ phụ (ledger line): nốt nằm sâu DƯỚI/TRÊN khuông. Dòng kẻ ở các bậc CHẴN;
// dưới khuông kẻ từ -2 trở xuống tới nốt, trên khuông từ 10 trở lên. Trả về danh sách bậc-staff cần kẻ.
function ledgersFor(staff: number): number[] {
  const out: number[] = []
  if (staff <= -2) { const deep = staff % 2 === 0 ? staff : staff + 1; for (let e = -2; e >= deep; e -= 2) out.push(e) }
  else if (staff >= 10) { const high = staff % 2 === 0 ? staff : staff - 1; for (let e = 10; e <= high; e += 2) out.push(e) }
  return out
}

// Khuông nhạc nhỏ — dạy thụ động vị trí nốt.
// staff = số bậc (nửa-dòng) tính từ DÒNG KẺ DƯỚI CÙNG (=0). LƯU Ý: guitar viết CAO HƠN THỰC TẾ 1 QUÃNG 8,
// nên Mi dây-1-buông (E4 thực) VIẾT là E5 = KHE 4 = staff 7 (gần đỉnh). Dây2(B4)=4, dây3(G4)=2.
export function NoteStaff({ active, label, staff = 0, pulse, dur, acc }: { active: boolean; label: string; staff?: number; pulse?: number; dur?: number; acc?: '#' | 'b' }) {
  const W = 240, top = 22, gap = 11
  const hollow = (dur ?? 1) >= 2, noStem = (dur ?? 1) >= 4    // nốt trắng/tròn = đầu rỗng; nốt tròn = không đuôi
  const flag = (dur ?? 1) > 0 && (dur ?? 1) <= 0.5           // nốt móc đơn = có dấu móc
  const H = 92 + (staff < -1 ? Math.round((-1 - staff) * (gap / 2)) + 20 : 0)   // giãn cao cho nốt trầm (dây 5–6) không tràn khung
  const lineY = (i: number) => top + i * gap            // i=0 dòng trên cùng … i=4 dòng dưới cùng
  const noteY = lineY(4) - staff * (gap / 2)            // mỗi bậc = nửa khoảng dòng
  const noteX = 158
  const col = active ? ACCENT.c1 : '#B0AA9C'
  const stemUp = staff < 4                              // nốt từ dòng giữa (B4) trở lên → đuôi quay xuống
  const stemX = noteX + (stemUp ? 8 : -8)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 270, display: 'block', margin: '0 auto' }}>
      {[0, 1, 2, 3, 4].map(i => <line key={i} x1={10} x2={W - 12} y1={lineY(i)} y2={lineY(i)} stroke="#D8CFBE" strokeWidth={1.4} />)}
      {/* Dòng kẻ phụ cho nốt trầm (dây 5–6) / cao ngoài khuông */}
      {ledgersFor(staff).map(e => { const y = lineY(4) - e * (gap / 2); return <line key={`lg${e}`} x1={noteX - 14} x2={noteX + 14} y1={y} y2={y} stroke="#CBBF9E" strokeWidth={1.5} /> })}
      {/* Khóa Sol — font nhạc chuẩn Bravura (SMuFL U+E050); 1 em = 4 khoảng dòng; baseline trên dòng Sol lineY(3) để xoắn ốc ôm đúng dòng */}
      <text x={9} y={lineY(3)} fontSize={4 * gap} fill="#2E2A24" fontFamily="Bravura">{String.fromCodePoint(0xE050)}</text>
      {acc && <text x={noteX - 17} y={noteY} textAnchor="middle" dominantBaseline="central" fontFamily="Bravura" fontSize={3.4 * gap} fill={col}>{String.fromCodePoint(acc === '#' ? 0xE262 : 0xE260)}</text>}
      <g key={pulse} style={{ animation: active ? '_ntPing .25s ease-out' : undefined, transformOrigin: `${noteX}px ${noteY}px` }}>
        {hollow
          ? <ellipse cx={noteX} cy={noteY} rx={9.4} ry={6.9} fill="none" stroke={col} strokeWidth={2.8} transform={`rotate(-18 ${noteX} ${noteY})`} />
          : <ellipse cx={noteX} cy={noteY} rx={9} ry={6.6} fill={col} transform={`rotate(-18 ${noteX} ${noteY})`} />}
        {!noStem && <line x1={stemX} x2={stemX} y1={noteY + (stemUp ? -2 : 2)} y2={noteY + (stemUp ? -38 : 38)} stroke={col} strokeWidth={2.2} />}
        {flag && <text x={stemX} y={noteY + (stemUp ? -38 : 38)} fontFamily="Bravura" fontSize={4 * gap} fill={col}>{String.fromCodePoint(stemUp ? 0xE240 : 0xE241)}</text>}
      </g>
      <text x={noteX} y={H - 3} textAnchor="middle" fontSize={13} fontWeight="700" fill={col}>{label}</text>
    </svg>
  )
}

// Khuông nhạc CẢ CÂU như bản nhạc — mọi nốt hiện sẵn, nốt đang chơi SÁNG lên, chạy lần lượt.
// Câu dài → cuộn ngang; tự cuộn để nốt đang chơi vào giữa.
export function NoteSheet({ notes, active, showDur = false, beatsPerBar = 0 }: { notes: NoteItem[]; active: number; showDur?: boolean; beatsPerBar?: number }) {
  const gap = 9, sp = 33, perRow = 8, headTop = 20   // gap: khoảng dòng kẻ (khuông cao thoáng, cân với cỡ nốt); 8 nốt/dòng
  const x0 = beatsPerBar > 0 ? 70 : 54               // có số chỉ nhịp → nốt đầu lùi phải cho thoáng; thường thì chừa khoảng sau khóa Sol
  const minStaff = notes.length ? Math.min(...notes.map(n => n.staff ?? 0)) : 0
  const rowH = 72 + (minStaff < -1 ? Math.round((-1 - minStaff) * (gap / 2)) + 20 : 0)   // giãn dòng cho nốt trầm (dây 5–6) + nhãn tụt xuống
  // ── Bố cục: mỗi nốt có (x, dòng). Bài ô nhịp gom thành Ô rồi XUỐNG DÒNG theo ranh giới ô (không cắt ngang ô) ──
  const NX: number[] = new Array(notes.length)
  const NR: number[] = new Array(notes.length)
  const bars: { x: number; row: number }[] = []
  let rows = 1
  if (beatsPerBar > 0) {
    const measures: number[][] = []
    let curM: number[] = [], cum = 0
    notes.forEach((n, i) => { curM.push(i); cum += (n.dur ?? 1); if (Math.abs(cum % beatsPerBar) < 0.001) { measures.push(curM); curM = [] } })
    if (curM.length) measures.push(curM)
    let row = 0, col = 0
    for (const m of measures) {
      if (col > 0 && col + m.length > perRow) { row++; col = 0 }   // ô không vừa dòng → xuống dòng nguyên ô
      for (const idx of m) { NX[idx] = x0 + col * sp; NR[idx] = row; col++ }
      bars.push({ x: x0 + (col - 0.5) * sp, row })                 // vạch nhịp ngay sau nốt cuối ô
    }
    rows = row + 1
  } else {
    notes.forEach((_, i) => { NX[i] = x0 + (i % perRow) * sp; NR[i] = Math.floor(i / perRow) })
    rows = Math.max(1, Math.ceil(notes.length / perRow))
  }
  const rowEndX = (r: number) => {
    if (beatsPerBar <= 0) return x0 + perRow * sp + 8
    let mx = x0
    notes.forEach((_, i) => { if (NR[i] === r) mx = Math.max(mx, NX[i] + sp * 0.6) })
    return mx + 6
  }
  const rowW = Math.max(...Array.from({ length: rows }, (_, r) => rowEndX(r)))
  const H = headTop + rows * rowH + 4
  const bY = (row: number) => headTop + row * rowH + 4 * gap            // dòng kẻ dưới cùng của hàng
  const noteY = (staff: number, row: number) => bY(row) - staff * (gap / 2)
  const outerRef = useRef<HTMLDivElement>(null)
  const scRef = useRef<HTMLDivElement>(null)
  const [availH, setAvailH] = useState(0)
  useEffect(() => {
    const el = outerRef.current; if (!el) return
    const measure = () => setAvailH(el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const activeRow = active >= 0 ? NR[active] : -1
  const visRows = availH > 0 ? Math.max(1, Math.floor((availH - 2) / rowH)) : rows   // số dòng hiện TRỌN VẸN
  const innerH = rows <= visRows ? H : visRows * rowH + 2   // vừa đủ → hiện TRỌN (không thanh cuộn thừa); dài hơn → cuộn theo dòng
  useEffect(() => {
    const el = scRef.current
    if (el && activeRow >= 0) el.scrollTo({ top: activeRow * rowH, behavior: 'smooth' })   // cuộn snap theo trọn dòng
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRow, innerH])
  const staffEls: React.ReactNode[] = []
  for (let row = 0; row < rows; row++) {
    for (const li of [0, 1, 2, 3, 4]) staffEls.push(<line key={`l${row}-${li}`} x1={10} x2={rowEndX(row)} y1={bY(row) - li * gap} y2={bY(row) - li * gap} stroke="#D8CFBE" strokeWidth={1.3} />)
    staffEls.push(<text key={`cl${row}`} x={8} y={bY(row) - gap} fontSize={4 * gap} fill="#2E2A24" fontFamily="Bravura">{String.fromCodePoint(0xE050)}</text>)
    if (beatsPerBar > 0 && row === 0) {   // số chỉ nhịp chỉ ở DÒNG ĐẦU (như bản nhạc chuẩn), giữa khóa Sol và nốt đầu
      staffEls.push(<text key={`tsn${row}`} x={47} y={bY(row) - 3 * gap} textAnchor="middle" dominantBaseline="central" fontSize={1.9 * gap} fontWeight={700} fontFamily="Georgia, 'Times New Roman', serif" fill="#2E2A24">{beatsPerBar}</text>)
      staffEls.push(<text key={`tsd${row}`} x={47} y={bY(row) - 1 * gap} textAnchor="middle" dominantBaseline="central" fontSize={1.9 * gap} fontWeight={700} fontFamily="Georgia, 'Times New Roman', serif" fill="#2E2A24">4</text>)
    }
  }
  // Vạch nhịp: kẻ dọc cuối mỗi ô (theo bố cục đã tính)
  const barEls: React.ReactNode[] = bars.map((b, k) => (
    <line key={`bar${k}`} x1={b.x} x2={b.x} y1={bY(b.row) - 4 * gap} y2={bY(b.row)} stroke="#B0A588" strokeWidth={1.5} />
  ))
  // Nhãn tên nốt: đặt DƯỚI nốt thấp nhất của từng dòng (nốt trầm nằm dưới khuông sẽ không bị nhãn đè)
  const rowMaxY: number[] = []
  notes.forEach((n, i) => { if (n.rest) return; const r = NR[i], yy = noteY(n.staff ?? 0, r); if (rowMaxY[r] == null || yy > rowMaxY[r]) rowMaxY[r] = yy })
  const labelYOf = (row: number) => Math.max(bY(row) + 16, (rowMaxY[row] ?? bY(row)) + 15)
  return (
    <div ref={outerRef} style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div ref={scRef} style={{ height: innerH, maxHeight: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
        <svg viewBox={`0 0 ${rowW} ${H}`} width={rowW} height={H} style={{ display: 'block' }}>
          {staffEls}
          {barEls}
        {notes.map((n, i) => {
          const row = NR[i], x = NX[i], on = i === active
          const c = on ? ACCENT.c1 : '#6B6456'
          const dur = n.dur ?? 1
          if (n.rest) {   // dấu lặng — glyph Bravura quanh dòng giữa, không đầu nốt/đuôi
            const glyph = dur >= 4 ? 0xE4E3 : dur >= 2 ? 0xE4E4 : dur >= 1 ? 0xE4E5 : 0xE4E6
            return (
              <g key={i}>
                {on && <rect x={x - 12} y={bY(row) - 4 * gap - 4} width={24} height={4 * gap + 12} rx={6} fill="rgba(194,98,46,0.13)" />}
                <text x={x} y={bY(row) - 2 * gap} textAnchor="middle" fontFamily="Bravura" fontSize={4 * gap} fill={c}>{String.fromCodePoint(glyph)}</text>
                <text x={x} y={labelYOf(row)} textAnchor="middle" fontSize={on ? 11 : 10} fontWeight={600} fill={c}>lặng</text>
              </g>
            )
          }
          const st = n.staff ?? 0, y = noteY(st, row)
          const stemUp = st < 4, stemX = x + (stemUp ? 6.5 : -6.5)
          const hollow = showDur && dur >= 2      // nốt trắng/tròn = đầu rỗng
          const noStem = showDur && dur >= 4      // nốt tròn = không đuôi
          const flag = showDur && dur > 0 && dur <= 0.5   // nốt móc đơn = có dấu móc
          const stemEnd = y + (stemUp ? -26 : 26)
          return (
            <g key={i}>
              {on && <rect x={x - 12} y={y - 30} width={24} height={46} rx={6} fill="rgba(194,98,46,0.13)" />}
              {ledgersFor(st).map(e => { const ly = bY(row) - e * (gap / 2); return <line key={`lg${e}`} x1={x - 10} x2={x + 10} y1={ly} y2={ly} stroke="#CBBF9E" strokeWidth={1.2} /> })}
              {n.acc && <text x={x - 13} y={y} textAnchor="middle" dominantBaseline="central" fontFamily="Bravura" fontSize={3.4 * gap} fill={c}>{String.fromCodePoint(n.acc === '#' ? 0xE262 : 0xE260)}</text>}
              <g key={'p' + active} style={{ animation: on ? '_ntPing .25s ease-out' : undefined, transformOrigin: `${x}px ${y}px` }}>
                {hollow
                  ? <ellipse cx={x} cy={y} rx={on ? 8.3 : 7.4} ry={on ? 6.1 : 5.4} fill="none" stroke={c} strokeWidth={2.3} transform={`rotate(-18 ${x} ${y})`} />
                  : <ellipse cx={x} cy={y} rx={on ? 8 : 7} ry={on ? 6 : 5.2} fill={c} transform={`rotate(-18 ${x} ${y})`} />}
                {!noStem && <line x1={stemX} x2={stemX} y1={y + (stemUp ? -2 : 2)} y2={stemEnd} stroke={c} strokeWidth={2} />}
                {flag && <text x={stemX} y={stemEnd} fontFamily="Bravura" fontSize={4 * gap} fill={c}>{String.fromCodePoint(stemUp ? 0xE240 : 0xE241)}</text>}
              </g>
              <text x={x} y={labelYOf(row)} textAnchor="middle" fontSize={on ? 11.5 : 10.5} fontWeight={on ? 800 : 600} fill={c}>{n.label}</text>
            </g>
          )
        })}
        <style dangerouslySetInnerHTML={{ __html: '@keyframes _ntPing{0%{transform:scale(.6)}60%{transform:scale(1.18)}100%{transform:scale(1)}}' }} />
        </svg>
      </div>
    </div>
  )
}

const VN_PC: Record<number, string> = { 0: 'Đô', 1: 'Đô#', 2: 'Rê', 3: 'Rê#', 4: 'Mi', 5: 'Fa', 6: 'Fa#', 7: 'Sol', 8: 'Sol#', 9: 'La', 10: 'La#', 11: 'Si' }
const MicIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
)

export function NotePractice({ cfg, onPass }: { cfg: NotePracticeCfg } & Pick<CB, 'onPass'>) {
  const notes: NoteItem[] = cfg.notes?.length ? cfg.notes : Array.from({ length: 4 }, () => ({ label: 'Mi', freq: 329.63, string: 1, fret: 0, staff: 7 }))
  const speeds = cfg.speeds?.length ? cfg.speeds : DEFAULT_SPEEDS
  const [speedIdx, setSpeedIdx] = useState(0)
  const [playing, setPlaying] = useState(false)    // chế độ "Nghe mẫu" (máy chạy)
  const [micOn, setMicOn] = useState(false)        // chế độ "Tự đàn" (mic chấm)
  const [cursor, setCursor] = useState(-1)
  const [done, setDone] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  const [countIn, setCountIn] = useState(0)        // đếm lấy đà 1-2-3-4 (bài trường độ)
  const [score, setScore] = useState<{ hit: number; total: number } | null>(null)   // điểm Tự đàn kiểu B
  const hitR = useRef(false)                       // nốt hiện tại đã đàn đúng chưa (chấm điểm)
  const resultsR = useRef<boolean[]>([])           // đúng/sai từng nốt
  const timer = useRef<number | null>(null)
  const beat = useRef(0)
  const passedR = useRef(false)
  // mic refs
  const micStreamR = useRef<MediaStream | null>(null)
  const audioCtxR = useRef<AudioContext | null>(null)
  const analyserR = useRef<AnalyserNode | null>(null)
  const bufR = useRef<Float32Array<ArrayBuffer> | null>(null)
  const micTimer = useRef<number | null>(null)
  const cursorR = useRef(0)
  const stableR = useRef(0)
  const releaseR = useRef(false)
  const metro = useRef<number | null>(null)   // metronome (chỉ bài trường độ)

  const stopMetro = () => { if (metro.current) { clearInterval(metro.current); metro.current = null } }
  const stop = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    stopMetro()
    setPlaying(false); setCursor(-1); setCountIn(0)
  }
  const stopMic = () => {
    if (micTimer.current) { clearInterval(micTimer.current); micTimer.current = null }
    if (timer.current) { clearTimeout(timer.current); timer.current = null }   // dừng con trỏ chạy-theo-nhịp (kiểu B)
    stopMetro()                                                                // dừng ban nhạc
    micStreamR.current?.getTracks().forEach(t => t.stop()); micStreamR.current = null
    try { audioCtxR.current?.close() } catch { /* */ } audioCtxR.current = null
    setMicOn(false); setHeard(null); setCountIn(0)
  }
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); if (micTimer.current) clearInterval(micTimer.current); if (metro.current) clearInterval(metro.current); micStreamR.current?.getTracks().forEach(t => t.stop()); try { audioCtxR.current?.close() } catch { /* */ } }, [])

  // ── Nghe mẫu: máy chạy CÓ TRƯỜNG ĐỘ (mỗi nốt giữ đúng số phách = dur) ──
  // spi = chỉ số tốc độ dùng NGAY (tránh đọc speedIdx cũ khi vừa đổi tốc độ lúc đang chạy)
  const start = (spi: number = speedIdx) => {
    stopMic(); stopMetro()
    if (timer.current) clearTimeout(timer.current)
    setPlaying(true); setDone(false); beat.current = 0; passedR.current = false; setCountIn(0); setScore(null)
    const beatMs = 60000 / speeds[spi].bpm
    const tick = () => {
      const i = beat.current
      setCursor(i); if (!notes[i].rest) playTone(notes[i].freq)   // dấu lặng = im lặng đúng số phách
      const d = (notes[i].dur ?? 1) * beatMs                 // giữ nốt đúng trường độ rồi mới sang nốt kế
      beat.current++
      if (beat.current >= notes.length) {                    // hết bài → cho nốt cuối ngân đủ rồi DỪNG (không lặp lại)
        if (!passedR.current) { passedR.current = true; setDone(true); onPass() }
        timer.current = window.setTimeout(stop, d)
        return
      }
      timer.current = window.setTimeout(tick, d)
    }
    const beginMelody = () => {                              // vào bài: nền đệm/metronome + nốt đầu
      setCountIn(0)
      const bpb = cfg.beatsPerBar && cfg.beatsPerBar > 0 ? cfg.beatsPerBar : 4
      const chords = cfg.chords
      if (chords && chords.length) {                          // NỀN BAN NHẠC: trống + bass + strings pad
        let bi = 0
        const band = () => {
          const beatInBar = bi % bpb, barIdx = Math.floor(bi / bpb)
          const ch = chords[barIdx % chords.length]
          playHat()
          if (beatInBar === 0 || (bpb >= 4 && beatInBar === 2)) playKick()
          if (bpb >= 4 ? (beatInBar === 1 || beatInBar === 3) : beatInBar === Math.floor(bpb / 2)) playSnare()
          if (beatInBar === 0) { playBass(ch.bass); playPad(ch.pad, beatMs * bpb) }
          else if (bpb >= 4 && beatInBar === 2) playBass(ch.bass)
          bi++
        }
        band()
        metro.current = window.setInterval(band, beatMs)
      } else if (cfg.showDur) {                               // metronome đơn
        playClick(true); metro.current = window.setInterval(() => playClick(), beatMs)
      }
      tick()
    }
    if (cfg.showDur || (cfg.chords && cfg.chords.length)) {  // ĐẾM LẤY ĐÀ đúng số phách 1 ô (mặc định 4) rồi vào bài
      const countN = cfg.beatsPerBar && cfg.beatsPerBar > 0 ? cfg.beatsPerBar : 4
      let cn = 1; setCountIn(1); playClick(true)
      const countTick = () => {
        cn++
        if (cn <= countN) { setCountIn(cn); playClick(false); timer.current = window.setTimeout(countTick, beatMs) }
        else beginMelody()
      }
      timer.current = window.setTimeout(countTick, beatMs)
    } else beginMelody()
  }

  // ── Tự đàn: mic nghe — đàn ĐÚNG TÊN NỐT mới sang nốt kế ──
  const detect = () => {
    const an = analyserR.current, buf = bufR.current, ctx = audioCtxR.current
    if (!an || !buf || !ctx) return
    while (cursorR.current < notes.length && notes[cursorR.current].rest) {   // dấu lặng: không đàn được → tự nhảy qua
      cursorR.current++; setCursor(cursorR.current)
    }
    if (cursorR.current >= notes.length) { setDone(true); onPass(); stopMic(); return }
    an.getFloatTimeDomainData(buf)
    const { freq } = detectPitch(buf, ctx.sampleRate)
    const i = cursorR.current
    const target = pitchClass(notes[i].freq)
    if (freq > 0) {
      const pc = pitchClass(freq)
      setHeard(VN_PC[pc] ?? null)
      if (releaseR.current) { if (pc !== target) releaseR.current = false }
      else if (pc === target) {
        stableR.current++
        if (stableR.current >= 2) {                 // ~150ms đúng → tính là đàn đúng
          playTone(notes[i].freq); stableR.current = 0; releaseR.current = true
          const next = i + 1
          if (next >= notes.length) { setDone(true); onPass(); stopMic(); return }
          cursorR.current = next; setCursor(next)
        }
      } else stableR.current = 0
    } else { setHeard(null); stableR.current = 0 }
  }
  const openMic = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } as MediaTrackConstraints })
      micStreamR.current = stream
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      audioCtxR.current = ctx
      if (ctx.state === 'suspended') { try { await ctx.resume() } catch { /* */ } }   // iOS cần resume trong cử chỉ
      const src = ctx.createMediaStreamSource(stream)
      const an = ctx.createAnalyser(); an.fftSize = 2048; src.connect(an)
      analyserR.current = an; bufR.current = new Float32Array(an.fftSize)
      return true
    } catch {
      alert('Không truy cập được micro. Hãy cho phép quyền micro cho ứng dụng/trình duyệt rồi thử lại.')
      setMicOn(false); return false
    }
  }
  // Kiểu A — tự dò: đàn ĐÚNG mới sang nốt kế
  const startMic = async () => {
    stop()
    if (!(await openMic())) return
    cursorR.current = 0; setCursor(0); stableR.current = 0; releaseR.current = false
    setMicOn(true); setDone(false); setScore(null)
    micTimer.current = window.setInterval(detect, 60)
  }
  // Kiểu B — chơi theo nhịp + chấm điểm: nốt CHẠY ĐỀU (không chờ), mic chấm từng nốt, cuối bài cho điểm. Giữ ban nhạc.
  const finishScored = () => {
    const hit = resultsR.current.filter(Boolean).length, total = resultsR.current.length
    stopMic()
    setCursor(-1); setScore({ hit, total })
    if (total > 0 && hit / total >= 0.6) { setDone(true); onPass() }
  }
  const startScored = async () => {
    stop()
    if (!(await openMic())) return
    setMicOn(true); setDone(false); setScore(null)
    resultsR.current = []; hitR.current = false; cursorR.current = -1
    const beatMs = 60000 / speeds[speedIdx].bpm
    const bpb = cfg.beatsPerBar && cfg.beatsPerBar > 0 ? cfg.beatsPerBar : 4
    const chords = cfg.chords
    micTimer.current = window.setInterval(() => {   // nghe liên tục, đánh dấu nốt hiện tại đàn đúng chưa
      const an = analyserR.current, buf = bufR.current, ctx = audioCtxR.current
      if (!an || !buf || !ctx) return
      const i = cursorR.current
      if (i < 0 || i >= notes.length || notes[i].rest) return
      an.getFloatTimeDomainData(buf)
      const { freq } = detectPitch(buf, ctx.sampleRate)
      if (freq > 0) { const pc = pitchClass(freq); setHeard(VN_PC[pc] ?? null); if (pc === pitchClass(notes[i].freq)) hitR.current = true }
    }, 45)
    const runMelody = () => {                       // nốt chạy đều theo nhịp (KHÔNG phát tiếng đàn — học sinh tự đàn)
      setCountIn(0)
      if (chords && chords.length) {
        let bi = 0
        const band = () => {
          const bInBar = bi % bpb, barIdx = Math.floor(bi / bpb), ch = chords[barIdx % chords.length]
          playHat()
          if (bInBar === 0 || (bpb >= 4 && bInBar === 2)) playKick()
          if (bpb >= 4 ? (bInBar === 1 || bInBar === 3) : bInBar === Math.floor(bpb / 2)) playSnare()
          if (bInBar === 0) { playBass(ch.bass); playPad(ch.pad, beatMs * bpb) }
          else if (bpb >= 4 && bInBar === 2) playBass(ch.bass)
          bi++
        }
        band(); metro.current = window.setInterval(band, beatMs)
      } else { playClick(true); metro.current = window.setInterval(() => playClick(), beatMs) }
      const step = (i: number) => {
        cursorR.current = i; setCursor(i); hitR.current = false
        const d = (notes[i].dur ?? 1) * beatMs
        timer.current = window.setTimeout(() => {
          if (!notes[i].rest) resultsR.current.push(hitR.current)   // hết trường độ nốt i → ghi điểm
          if (i + 1 >= notes.length) finishScored()
          else step(i + 1)
        }, d)
      }
      step(0)
    }
    let cn = 1; setCountIn(1); playClick(true)      // đếm lấy đà 1 ô rồi vào
    const countTick = () => { cn++; if (cn <= bpb) { setCountIn(cn); playClick(false); timer.current = window.setTimeout(countTick, beatMs) } else runMelody() }
    timer.current = window.setTimeout(countTick, beatMs)
  }

  const active = (playing || micOn) ? cursor : -1
  const cur = notes[cursor >= 0 ? cursor % notes.length : 0]
  const showStaff = cfg.showStaff ?? notes.some(n => n.staff != null)
  const sheetRows = Math.ceil(notes.length / 8)   // khớp perRow=8 trong NoteSheet; 1 dòng = bài ngắn
  const busy = playing || micOn

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '12px 16px 10px', boxSizing: 'border-box' }}>
      {/* Tốc độ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#8A8478', letterSpacing: '.04em' }}>TỐC ĐỘ</span>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: '#EFE9DD', borderRadius: 12 }}>
          {speeds.map((s, i) => (
            <button key={i} onClick={() => { setSpeedIdx(i); if (playing) start(i) }}
              style={{ padding: '6px 15px', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                background: speedIdx === i ? '#fff' : 'transparent', color: speedIdx === i ? ACCENT.d : '#8A8478',
                boxShadow: speedIdx === i ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* Khuông nhạc — TRỌNG TÂM, lấp đầy khoảng trống (luôn hiện trọn dòng) */}
      {showStaff && (
        <div style={{ position: 'relative', flex: 1, minHeight: 0, background: '#fff', border: '1px solid #EAE4D8', borderRadius: 14, padding: '4px 6px', marginBottom: 9, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            <NoteSheet notes={notes} active={active} showDur={cfg.showDur} beatsPerBar={cfg.beatsPerBar} />
          </div>
          {countIn > 0 && (   // count-in 1-2-3-4 — nằm TRÊN, né khuông nhạc, cỡ vừa
            <div style={{ position: 'absolute', top: 6, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, pointerEvents: 'none' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#8A8478', letterSpacing: '.08em' }}>COUNT IN</span>
              <span key={countIn} style={{ fontSize: 38, fontWeight: 900, color: ACCENT.d, lineHeight: 1, animation: '_ntPing .25s ease-out' }}>{countIn}</span>
            </div>
          )}
          {cfg.hint && sheetRows <= 1 && (   // bài ngắn còn chỗ → dùng khoảng trống để dặn dò
            <div style={{ flexShrink: 0, margin: '2px 8px 8px', padding: '9px 13px', background: '#FBF3E7', border: '1px solid #F0E2C9', borderRadius: 11, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 15, lineHeight: '19px' }}>💡</span>
              <span style={{ fontSize: 13.5, lineHeight: '19px', color: '#8A6D3B', fontWeight: 500 }}>{cfg.hint}</span>
            </div>
          )}
        </div>
      )}

      {/* Cần đàn — quan trọng ngang khuông (nốt đã hiện trên khuông + cần đàn nên bỏ dòng chữ) */}
      <div style={{ flexShrink: 0, background: '#F1ECE2', borderRadius: 12, padding: '10px 12px', marginBottom: 9 }}>
        <MiniFretboard string={cur.string} fret={cur.fret} pulse={cursor} h={118} />
      </div>

      {/* Nút điều khiển — sát đáy màn */}
      <div style={{ flexShrink: 0 }}>
        {busy ? (
          <button onClick={micOn ? stopMic : stop}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 13, border: 'none', borderRadius: 13, background: '#1C1A17', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15.5, fontWeight: 700 }}>
            <span style={{ fontSize: 16 }}>⏹</span> {micOn ? 'Dừng tự đàn' : 'Dừng nghe mẫu'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => start()}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '13px 8px', border: `1.5px solid ${ACCENT.a}`, borderRadius: 12, background: '#fff', color: ACCENT.d, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
              ▶ Nghe mẫu
            </button>
            <button onClick={cfg.scored ? startScored : startMic}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '13px 8px', border: 'none', borderRadius: 12, background: ACCENT.a, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 700 }}>
              <MicIcon size={16} /> {cfg.scored ? 'Chơi & chấm' : 'Tự đàn'}
            </button>
          </div>
        )}
        {score !== null ? (
          (() => { const pct = score.total ? score.hit / score.total : 0; const stars = pct >= 0.9 ? '⭐⭐⭐' : pct >= 0.75 ? '⭐⭐' : pct >= 0.6 ? '⭐' : ''
            return (
              <div style={{ marginTop: 8, padding: '9px 13px', borderRadius: 11, background: pct >= 0.6 ? ACCENT.s : '#FBECEC', color: pct >= 0.6 ? ACCENT.d : '#A23B3B', fontSize: 13.5, fontWeight: 700, textAlign: 'center' }}>
                Kết quả: <b>{score.hit}/{score.total}</b> nốt đúng nhịp {stars || (pct >= 0.4 ? '— cố thêm chút nữa!' : '— tập lại nhé!')}
              </div>
            ) })()
        ) : done && (
          <div style={{ marginTop: 8, padding: '8px 13px', borderRadius: 11, background: ACCENT.s, color: ACCENT.d, fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
            Tốt lắm! Bạn đàn đúng cả câu rồi — có thể sang bước sau.
          </div>
        )}
      </div>
    </div>
  )
}

// ── note_show: hình minh hoạ nốt (khuông + cần đàn) + nghe thử (NHẬN, không gate) ──
export function NoteShow({ cfg }: { cfg: NoteShowCfg }) {
  const label = cfg.label ?? 'Mi'
  const freq = cfg.freq ?? 329.63
  const showStaff = cfg.showStaff ?? true
  const showFb = cfg.showFretboard ?? true
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {showStaff && (
        <div style={{ background: '#fff', border: '1px solid #EAE4D8', borderRadius: 14, padding: '8px 8px 2px' }}>
          <NoteStaff active label={label} staff={cfg.staff ?? 0} dur={cfg.dur} acc={cfg.acc} />
        </div>
      )}
      {showFb && (
        <div style={{ background: '#F1ECE2', borderRadius: 14, padding: '12px 12px 8px' }}>
          <MiniFretboard string={cfg.string ?? 1} fret={cfg.fret ?? 0} />
        </div>
      )}
      {cfg.caption && (
        <div style={{ fontSize: 15, color: '#3A352C', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: cfg.caption }} />
      )}
      <button onClick={() => playTone(freq)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 15, border: 'none', borderRadius: 14, background: '#1C1A17', color: '#F4E9D8', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
        🔊 Nghe thử nốt {label}
      </button>
    </div>
  )
}

// ── guitar_chord: sơ đồ hợp âm + nghe "rải" + gảy thử (NHẬN, không gate) ────────
export interface ChordCfg {
  name?: string       // tên hợp âm, vd 'Em'
  frets?: number[]    // theo dây 6→1: -1 câm, 0 buông, n phím
  freqs?: number[]    // tần số từng dây (thấp→cao) để rải nghe
  caption?: string
}
const EM_FRETS = [0, 2, 2, 0, 0, 0]
const EM_FREQS = [82.41, 123.47, 164.81, 196.0, 246.94, 329.63]

export function ChordView({ cfg }: { cfg: ChordCfg }) {
  const name = cfg.name ?? 'Em'
  const frets = cfg.frets && cfg.frets.length === 6 ? cfg.frets : EM_FRETS
  const freqs = cfg.freqs && cfg.freqs.length ? cfg.freqs : EM_FREQS
  const xs = [16, 36, 56, 76, 96, 116]   // dây 6 (trái) → dây 1 (phải)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#F1ECE2', borderRadius: 14, padding: '14px 12px 10px', display: 'flex', justifyContent: 'center' }}>
        <svg viewBox="0 0 132 150" width="142" style={{ display: 'block' }}>
          <rect x={14} y={26} width={104} height={4} rx={2} fill="#2A2622" />
          {[58, 88, 118].map(y => <line key={y} x1={16} x2={116} y1={y} y2={y} stroke="#C9BBA4" strokeWidth={1.4} />)}
          {xs.map((x, i) => <line key={i} x1={x} x2={x} y1={28} y2={118} stroke="#B8AD9C" strokeWidth={i === 0 ? 2.6 : 1.6} />)}
          {frets.map((f, i) => f === 0
            ? <circle key={'o' + i} cx={xs[i]} cy={13} r={5} fill="none" stroke="#9A8F7E" strokeWidth={1.5} />
            : f < 0 ? <text key={'x' + i} x={xs[i]} y={17} textAnchor="middle" fontSize={12} fill="#9A8F7E">✕</text> : null)}
          {frets.map((f, i) => f > 0
            ? <circle key={'d' + i} cx={xs[i]} cy={28 + (f - 0.5) * 30} r={7.5} fill="#BF5A37" /> : null)}
          <text x={66} y={144} textAnchor="middle" fontSize={15} fontWeight="800" fill="#BF5A37">{name}</text>
        </svg>
      </div>
      {cfg.caption && <div style={{ fontSize: 15, color: '#3A352C', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: cfg.caption }} />}
      <button onClick={() => freqs.forEach((f, i) => setTimeout(() => playGuitarNote(f, i), i * 30))}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 15, border: 'none', borderRadius: 14, background: '#2A2622', color: '#F4ECDF', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
        🔊 Nghe hợp âm {name}
      </button>
    </div>
  )
}

// ── bar_split: đối chiếu SHEET (vẽ sạch từ nốt) ↔ LỜI, bút kẻ vạch chia ô nhịp ───
// Mục tiêu dạy: nhìn sheet để biết "từ đâu đến đâu là 1 ô nhịp" (ô nhịp ≠ số chữ).
const BS_INK = '#2A2622', BS_PEN = '#C2622E', BS_MUTE = '#9A8F7E'

// Vẽ MỘT hệ thống khuông (1 câu) tại baseY → trả node + bề rộng (notation, không lời).
function staffSystem(bars: BarCell[], baseY: number, x0: number, nw: number, sp: number, kb: number) {
  const yOf = (p: number) => baseY - p * sp
  const heads: React.ReactNode[] = [], stems: React.ReactNode[] = [], ledg: React.ReactNode[] = []
  const barX: number[] = [x0 - 12]
  let x = x0, k = kb
  for (const bar of bars) {
    const eighths: { x: number; y: number }[] = []
    for (const n of bar.notes ?? []) {
      if (n.rest) { heads.push(<text key={k++} x={x} y={yOf(4)} fontFamily="Bravura" fontSize={18} fill={BS_INK} textAnchor="middle">{''}</text>); x += nw; continue }
      const p = n.pos ?? 0, y = yOf(p), open = n.dur === 'h' || n.dur === 'w'
      heads.push(<ellipse key={k++} cx={x} cy={y} rx={open ? 5 : 4.3} ry={3.3} transform={`rotate(-20 ${x} ${y})`} fill={open ? '#fff' : BS_INK} stroke={BS_INK} strokeWidth={open ? 1.6 : 0} />)
      for (let g = 10; g <= p; g += 2) ledg.push(<line key={k++} x1={x - 8} y1={yOf(g)} x2={x + 8} y2={yOf(g)} stroke={BS_INK} strokeWidth={1.1} />)
      for (let g = -2; g >= p; g -= 2) ledg.push(<line key={k++} x1={x - 8} y1={yOf(g)} x2={x + 8} y2={yOf(g)} stroke={BS_INK} strokeWidth={1.1} />)
      if (n.dur === 'e') eighths.push({ x, y })
      else if (n.dur !== 'w') stems.push(<line key={k++} x1={x + 4} y1={y} x2={x + 4} y2={y - 23} stroke={BS_INK} strokeWidth={1.5} />)
      x += nw
    }
    if (eighths.length) {
      const by = Math.min(...eighths.map(e => e.y)) - 22
      for (const e of eighths) stems.push(<line key={k++} x1={e.x + 4} y1={e.y} x2={e.x + 4} y2={by} stroke={BS_INK} strokeWidth={1.5} />)
      heads.push(<rect key={k++} x={eighths[0].x + 4} y={by} width={eighths[eighths.length - 1].x - eighths[0].x} height={3.4} fill={BS_INK} />)
    }
    barX.push(x - nw * 0.42)
  }
  const width = x + 10
  const lines5 = [0, 2, 4, 6, 8].map(p => <line key={k++} x1={x0 - 12} y1={yOf(p)} x2={width - 6} y2={yOf(p)} stroke="#B8AE9B" strokeWidth={1} />)
  const clef = <text key={k++} x={5} y={baseY + 6} fontFamily="Bravura" fontSize={24} fill={BS_INK}>{''}</text>
  const bls = barX.map((bx, i) => <line key={k + 100 + i} x1={bx} y1={yOf(8)} x2={bx} y2={yOf(0)} stroke={BS_INK} strokeWidth={i === 0 || i === barX.length - 1 ? 2.4 : 1.6} />)
  return { nodes: [...lines5, clef, ...ledg, ...heads, ...stems, ...bls], width }
}

// Khuông nhạc SẠCH nhiều dòng (mỗi câu = 1 hệ thống) — chỉ notation, không lời (lời đọc ở dải dưới).
function MultiStaff({ lines }: { lines: CauLine[] }) {
  const sp = 5, x0 = 40, nw = 18, sysH = 56, top = 36
  let maxW = 90
  const all: React.ReactNode[] = []
  lines.forEach((line, si) => { const r = staffSystem(line.bars, top + si * sysH, x0, nw, sp, si * 1000); all.push(...r.nodes); if (r.width > maxW) maxW = r.width })
  const H = top + lines.length * sysH - 16
  const pxH = Math.min(34 + lines.length * 26, 140)   // chiều cao cố định (px) — ép vừa màn
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg viewBox={`0 0 ${maxW} ${H}`} height={pxH} style={{ width: 'auto', maxWidth: '100%', display: 'block' }} preserveAspectRatio="xMidYMid meet">{all}</svg>
    </div>
  )
}

// Dải LỜI liền mạch TẤT CẢ câu + bút kẻ hết vạch; tô CAM vạch ở chỗ nối câu (dễ nhầm).
function PenFlow({ bars, boundary, runKey }: { bars: BarCell[]; boundary: Set<number>; runKey: number }) {
  const N = bars.length
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([])
  const penRefs = useRef<(HTMLSpanElement | null)[]>([])
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => {
    timers.current.forEach(clearTimeout); timers.current = []
    for (let i = 0; i <= N; i++) { const l = lineRefs.current[i]; if (l) l.style.height = '0'; const p = penRefs.current[i]; if (p) { p.style.opacity = '0'; p.style.top = '-20px' } }
    for (let i = 0; i <= N; i++) {
      timers.current.push(setTimeout(() => {
        const l = lineRefs.current[i], p = penRefs.current[i]
        if (p) { p.style.opacity = '1'; p.style.top = '30px' }
        if (l) l.style.height = (boundary.has(i) ? 34 : 27) + 'px'
        if (p) timers.current.push(setTimeout(() => { p.style.opacity = '0' }, 600))
      }, 300 + i * 620))
    }
    return () => { timers.current.forEach(clearTimeout); timers.current = [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, N])
  const Bar = (i: number) => {
    const b = boundary.has(i)
    return (
      <span key={'b' + i} style={{ position: 'relative', display: 'inline-flex', width: b ? 4 : 3, minHeight: 34, alignItems: 'flex-start', justifyContent: 'center', margin: b ? '0 9px' : '0 6px' }}>
        <span ref={el => { lineRefs.current[i] = el }} style={{ display: 'block', width: b ? 4 : 3, height: 0, background: b ? BS_PEN : BS_INK, borderRadius: 2, transition: 'height .45s ease-out' }} />
        <span ref={el => { penRefs.current[i] = el }} style={{ position: 'absolute', left: 4, top: -20, opacity: 0, transition: 'top .45s ease-out, opacity .25s', lineHeight: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BS_PEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l4-1L18 8l-3-3L5 16l-1 4z" /><path d="M14 6l3 3" /></svg>
        </span>
      </span>
    )
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', background: '#FBF6ED', border: '1px solid #E6D8C2', borderRadius: 10, padding: '7px 6px', rowGap: 2 }}>
      {bars.map((bar, i) => [
        Bar(i),
        <span key={'o' + i} style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          {bar.lead && <span style={{ fontSize: 10, fontStyle: 'italic', color: BS_MUTE, marginRight: 3 }}>(lặng)</span>}
          {bar.words.map((w, j) => <span key={j} style={{ fontSize: 14.5, padding: '0 2px', color: BS_INK, whiteSpace: 'nowrap' }}>{w}</span>)}
          {bar.hold && <span style={{ color: BS_MUTE, fontSize: 12, letterSpacing: 1, marginLeft: 1 }}>~~~</span>}
        </span>,
      ])}
      {Bar(N)}
    </div>
  )
}

export function BarSplit({ cfg }: { cfg: BarSplitCfg }) {
  const lines = cfg.lines ?? []
  const [runKey, setRunKey] = useState(1)
  const flat = lines.flatMap(l => l.bars)
  const boundary = (() => { const s = new Set<number>(); let acc = 0; lines.forEach((l, i) => { if (i > 0) s.add(acc); acc += l.bars.length }); return s })()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: BS_MUTE, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.05em' }}>Sheet nhạc — vạch nhịp ở đây</div>
        <div style={{ background: '#fff', border: '1px solid #E6D8C2', borderRadius: 10, padding: '4px 6px' }}><MultiStaff lines={lines} /></div>
      </div>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: BS_MUTE, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.05em' }}>Lời — bút kẻ vạch (<span style={{ color: BS_PEN }}>cam</span> = chỗ nối câu)</div>
        <PenFlow key={lines.length} bars={flat} boundary={boundary} runKey={runKey} />
      </div>
      {cfg.caption && <div style={{ fontSize: 13.5, color: '#3A352C', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: cfg.caption }} />}
      <button onClick={() => setRunKey(k => k + 1)}
        style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', borderRadius: 10, background: BS_PEN, color: '#fff', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l4-1L18 8l-3-3L5 16l-1 4z" /><path d="M14 6l3 3" /></svg>
        Kẻ lại vạch
      </button>
    </div>
  )
}

// ── Nút "nghe lại chuỗi dây vừa học" (bằng chứng tiến bộ, dùng cuối bài) ────────
export function ReplayStrings({ nums }: { nums: number[] }) {
  return (
    <button onClick={() => playSequence(nums.map(freqOfNum))}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', border: 'none', borderRadius: 12, background: '#1C1A17', color: '#F4E9D8', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>
      🔊 Nghe lại chuỗi dây
    </button>
  )
}
