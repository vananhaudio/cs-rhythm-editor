// ── Renderer các slide tương tác guitar cho FlowPlayer ────────────────────────
// Mỗi renderer EMIT onPass/onWrong/onOpenTool cho engine (KHÔNG tự kết thúc bài).
// Khung "self-check trung thực": app phát tiếng mẫu → học viên bắt chước trên đàn THẬT → tự xác nhận.
// (App chưa nghe được tay đàn — phần chấm bằng mic để Giai đoạn 3.)
import { useState, useEffect, useRef } from 'react'
import { ACCENT, STRINGS, freqOfNum, colorOfNum, widthOfNum, stringByNum } from './guitarConst'
import { playTone, playSequence } from './audio'
import { playGuitarNote } from '../audioEngine'   // engine guitar (nốt ngân độc lập) — để rải hợp âm không bị cắt

export interface NeckCfg { target?: number; successMsg?: string }
export interface ChecklistCfg { items?: string[]; requireAll?: boolean }
export interface NoteChartCfg { highlight?: string[] }
export interface StrumCfg { sequence?: number[] }                 // dãy số dây cần gảy đúng thứ tự
export interface EarCfg { pool?: number[]; rounds?: number; passScore?: number }
// "Đánh theo mẫu": máy chạy chuỗi nốt theo nhịp, học viên bắt chước
export interface NoteItem { label: string; freq: number; string?: number; fret?: number; staff?: number }
// "Xem nốt": hình minh hoạ tĩnh (khuông nhạc và/hoặc cần đàn) + nút nghe thử
export interface NoteShowCfg {
  label?: string; freq?: number; string?: number; fret?: number; staff?: number
  showStaff?: boolean; showFretboard?: boolean; caption?: string
}
export interface NotePracticeCfg {
  notes?: NoteItem[]                            // chuỗi nốt (vd 4× Mi). string/fret để vẽ cần đàn, staff = vị trí trên khuông (0 = dòng kẻ dưới cùng = Mi/E4)
  speeds?: { label: string; bpm: number }[]    // các tốc độ chọn
  showStaff?: boolean                           // hiện khuông nhạc (mặc định có nếu nốt có staff)
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
export function MiniFretboard({ string, fret, pulse }: { string?: number; fret?: number; pulse?: number }) {
  const STRING_CNT = 6, FRET_COUNT = 4, H = 128
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

// Khuông nhạc nhỏ — dạy thụ động vị trí nốt.
// staff = số bậc (nửa-dòng) tính từ DÒNG KẺ DƯỚI CÙNG (=0). LƯU Ý: guitar viết CAO HƠN THỰC TẾ 1 QUÃNG 8,
// nên Mi dây-1-buông (E4 thực) VIẾT là E5 = KHE 4 = staff 7 (gần đỉnh). Dây2(B4)=4, dây3(G4)=2.
export function NoteStaff({ active, label, staff = 0, pulse }: { active: boolean; label: string; staff?: number; pulse?: number }) {
  const W = 240, H = 92, top = 22, gap = 11
  const lineY = (i: number) => top + i * gap            // i=0 dòng trên cùng … i=4 dòng dưới cùng
  const noteY = lineY(4) - staff * (gap / 2)            // mỗi bậc = nửa khoảng dòng
  const noteX = 158
  const col = active ? ACCENT.c1 : '#B0AA9C'
  const stemUp = staff < 4                              // nốt từ dòng giữa (B4) trở lên → đuôi quay xuống
  const stemX = noteX + (stemUp ? 8 : -8)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 270, display: 'block', margin: '0 auto' }}>
      {[0, 1, 2, 3, 4].map(i => <line key={i} x1={10} x2={W - 12} y1={lineY(i)} y2={lineY(i)} stroke="#D8CFBE" strokeWidth={1.4} />)}
      {/* Khóa Sol — vạch khuông xuyên qua khóa (đúng chuẩn); baseline canh xoắn ốc ôm dòng Sol (lineY(3)) */}
      <text x={8} y={lineY(3) + 17} fontSize={84} fill="#2E2A24" fontFamily="'Times New Roman', Georgia, serif">𝄞</text>
      <g key={pulse} style={{ animation: active ? '_ntPing .25s ease-out' : undefined, transformOrigin: `${noteX}px ${noteY}px` }}>
        <ellipse cx={noteX} cy={noteY} rx={9} ry={6.6} fill={col} transform={`rotate(-18 ${noteX} ${noteY})`} />
        <line x1={stemX} x2={stemX} y1={noteY + (stemUp ? -2 : 2)} y2={noteY + (stemUp ? -38 : 38)} stroke={col} strokeWidth={2.2} />
      </g>
      <text x={noteX} y={H - 3} textAnchor="middle" fontSize={13} fontWeight="700" fill={col}>{label}</text>
    </svg>
  )
}

export function NotePractice({ cfg, onPass }: { cfg: NotePracticeCfg } & Pick<CB, 'onPass'>) {
  const notes: NoteItem[] = cfg.notes?.length ? cfg.notes : Array.from({ length: 4 }, () => ({ label: 'Mi', freq: 329.63, string: 1, fret: 0, staff: 7 }))
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

  const cur = notes[cursor >= 0 ? cursor % notes.length : 0]
  const showStaff = cfg.showStaff ?? notes.some(n => n.staff != null)

  return (
    <div>
      {/* Chọn tốc độ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#8A8478', letterSpacing: '.04em' }}>TỐC ĐỘ</span>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: '#EFE9DD', borderRadius: 12 }}>
          {speeds.map((s, i) => (
            <button key={i} onClick={() => { setSpeedIdx(i); if (playing) start() }}
              style={{ padding: '7px 16px', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
                background: speedIdx === i ? '#fff' : 'transparent', color: speedIdx === i ? ACCENT.d : '#8A8478',
                boxShadow: speedIdx === i ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* Khuông nhạc — dạy thụ động vị trí nốt */}
      {showStaff && (
        <div style={{ background: '#fff', border: '1px solid #EAE4D8', borderRadius: 14, padding: '8px 8px 2px', marginBottom: 12 }}>
          <NoteStaff active={playing && cursor >= 0} label={cur.label} staff={cur.staff ?? 0} pulse={cursor} />
        </div>
      )}

      {/* Cần đàn — nốt chạy theo nhịp */}
      <div style={{ background: '#F1ECE2', borderRadius: 14, padding: '12px 12px 8px', marginBottom: 14 }}>
        <MiniFretboard string={cur.string} fret={cur.fret} pulse={cursor} />
        <div style={{ textAlign: 'center', marginTop: 6, fontSize: 13, color: '#8A8478' }}>
          {playing ? <>Đang chạy: <b style={{ color: ACCENT.d }}>{cur.label}</b></> : 'Bấm bắt đầu để máy chạy nốt'}
        </div>
      </div>

      {/* Nút điều khiển */}
      <button onClick={playing ? stop : start}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16, border: 'none', borderRadius: 15, background: playing ? '#1C1A17' : ACCENT.a, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
        <span style={{ fontSize: 18 }}>{playing ? '⏹' : '▶'}</span>
        <span>
          <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>{playing ? 'Dừng lại' : 'Bắt đầu chơi theo'}</span>
          {!playing && <span style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,.8)', marginTop: 1 }}>Máy chạy nốt đều — bạn đánh theo trên đàn</span>}
        </span>
      </button>

      <div style={{ marginTop: 12, fontSize: 13, color: '#A8A294', textAlign: 'center', lineHeight: 1.5 }}>
        Nghe máy chạy rồi gảy theo. Không cần nhanh — đều và rõ là được.
      </div>
      {done && (
        <div style={{ marginTop: 12, padding: '11px 14px', borderRadius: 12, background: ACCENT.s, color: ACCENT.d, fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
          Tốt lắm! Bạn đã chơi theo được — có thể bấm Dừng và sang bước sau.
        </div>
      )}
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
          <NoteStaff active label={label} staff={cfg.staff ?? 0} />
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
  const clef = <text key={k++} x={8} y={baseY + 11} fontFamily="Bravura" fontSize={48} fill={BS_INK}>{''}</text>
  const bls = barX.map((bx, i) => <line key={k + 100 + i} x1={bx} y1={yOf(8)} x2={bx} y2={yOf(0)} stroke={BS_INK} strokeWidth={i === 0 || i === barX.length - 1 ? 2.4 : 1.6} />)
  return { nodes: [...lines5, clef, ...ledg, ...heads, ...stems, ...bls], width }
}

// Khuông nhạc SẠCH nhiều dòng (mỗi câu = 1 hệ thống) — chỉ notation, không lời (lời đọc ở dải dưới).
function MultiStaff({ lines }: { lines: CauLine[] }) {
  const sp = 5, x0 = 42, nw = 19, sysH = 74, top = 46
  let maxW = 90
  const all: React.ReactNode[] = []
  lines.forEach((line, si) => { const r = staffSystem(line.bars, top + si * sysH, x0, nw, sp, si * 1000); all.push(...r.nodes); if (r.width > maxW) maxW = r.width })
  const H = top + lines.length * sysH - 20
  return (
    <svg viewBox={`0 0 ${maxW} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '30vh' }} preserveAspectRatio="xMidYMid meet">{all}</svg>
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
        if (l) l.style.height = (boundary.has(i) ? 50 : 42) + 'px'
        if (p) timers.current.push(setTimeout(() => { p.style.opacity = '0' }, 600))
      }, 300 + i * 620))
    }
    return () => { timers.current.forEach(clearTimeout); timers.current = [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey, N])
  const Bar = (i: number) => {
    const b = boundary.has(i)
    return (
      <span key={'b' + i} style={{ position: 'relative', display: 'inline-flex', width: b ? 4 : 3, minHeight: 50, alignItems: 'flex-start', justifyContent: 'center', margin: b ? '0 12px' : '0 9px' }}>
        <span ref={el => { lineRefs.current[i] = el }} style={{ display: 'block', width: b ? 4 : 3, height: 0, background: b ? BS_PEN : BS_INK, borderRadius: 2, transition: 'height .45s ease-out' }} />
        <span ref={el => { penRefs.current[i] = el }} style={{ position: 'absolute', left: 4, top: -20, opacity: 0, transition: 'top .45s ease-out, opacity .25s', lineHeight: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BS_PEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l4-1L18 8l-3-3L5 16l-1 4z" /><path d="M14 6l3 3" /></svg>
        </span>
      </span>
    )
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', background: '#FBF6ED', border: '1px solid #E6D8C2', borderRadius: 10, padding: '14px 10px', rowGap: 6 }}>
      {bars.map((bar, i) => [
        Bar(i),
        <span key={'o' + i} style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          {bar.lead && <span style={{ fontSize: 11, fontStyle: 'italic', color: BS_MUTE, marginRight: 4 }}>(lặng)</span>}
          {bar.words.map((w, j) => <span key={j} style={{ fontSize: 17.5, padding: '1px 3px', color: BS_INK, whiteSpace: 'nowrap' }}>{w}</span>)}
          {bar.hold && <span style={{ color: BS_MUTE, fontSize: 14, letterSpacing: 1, marginLeft: 1 }}>~~~</span>}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: BS_MUTE, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Sheet nhạc — vạch nhịp ở đây</div>
        <div style={{ background: '#fff', border: '1px solid #E6D8C2', borderRadius: 10, padding: '6px 8px' }}><MultiStaff lines={lines} /></div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: BS_MUTE, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Lời — kẻ vạch theo sheet (vạch cam = chỗ nối câu)</div>
        <PenFlow key={lines.length} bars={flat} boundary={boundary} runKey={runKey} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setRunKey(k => k + 1)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 15px', border: 'none', borderRadius: 11, background: BS_PEN, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l4-1L18 8l-3-3L5 16l-1 4z" /><path d="M14 6l3 3" /></svg>
          Kẻ lại vạch
        </button>
        <span style={{ fontSize: 12.5, color: BS_MUTE }}>bút kẻ hết các vạch — vạch cam là chỗ hết câu này sang câu sau</span>
      </div>
      {cfg.caption && <div style={{ fontSize: 14.5, color: '#3A352C', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: cfg.caption }} />}
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
