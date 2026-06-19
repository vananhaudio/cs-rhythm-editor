// ── Renderer các slide tương tác guitar cho FlowPlayer ────────────────────────
// Mỗi renderer EMIT onPass/onWrong/onOpenTool cho engine (KHÔNG tự kết thúc bài).
// Khung "self-check trung thực": app phát tiếng mẫu → học viên bắt chước trên đàn THẬT → tự xác nhận.
// (App chưa nghe được tay đàn — phần chấm bằng mic để Giai đoạn 3.)
import { useState, useEffect } from 'react'
import { ACCENT, STRINGS, freqOfNum, colorOfNum, widthOfNum, stringByNum } from './guitarConst'
import { playTone, playSequence } from './audio'

export interface NeckCfg { target?: number; successMsg?: string }
export interface ChecklistCfg { items?: string[]; requireAll?: boolean }
export interface NoteChartCfg { highlight?: string[] }

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
        <div style={{ marginTop: 4, padding: '11px 14px', borderRadius: 12, background: ACCENT.s, color: ACCENT.d, fontSize: 13, fontWeight: 600, textAlign: 'center' }}>Xong rồi! Bạn đã sẵn sàng cho bước tiếp theo. 👍</div>
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
