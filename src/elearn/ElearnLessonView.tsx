// ── Khởi Đầu Đam Mê — Trình chiếu 1 bài học (native, không iframe) ─────────────
// App cung cấp mục lục (danh sách bài); component này render ĐÚNG 1 bài theo `num`.
// Hoàn thành → gọi onComplete (app ghi tiến độ + quay lại danh sách).
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { ACCENT, STR, PSEQ, FREQ, strColor, getLesson, type PlayStyle, type ThaoType } from './data'
import { playTone } from './audio'

// 1 hàng cấu hình bài (nội dung + media) soạn trong admin (bảng elearn_lessons)
interface ElearnCfg {
  goal?: string | null
  steps?: string[] | null
  prompt?: string | null
  thao_type?: string | null
  items?: string[] | null
  youtube_id?: string | null
  video_url?: string | null
}

interface Props {
  num: number                              // 1..11
  title?: string                           // tiêu đề bài (lấy từ course editor)
  courseSlug?: string                      // mặc định 'khoi-dau-dam-me'
  studentName?: string | null
  isDone?: boolean                         // bài đã hoàn thành (đổi nhãn nút)
  onComplete: () => void                   // app: markComplete + quay lại
  onBack: () => void                       // app: quay lại danh sách
  onOpenTool: (tool: 'tuner' | 'tempo') => void
}

const rnd6 = () => Math.floor(Math.random() * 6)

export default function ElearnLessonView({ num, title, courseSlug = 'khoi-dau-dam-me', studentName, isDone, onComplete, onBack, onOpenTool }: Props) {
  const [playStyle, setPlayStyleState] = useState<PlayStyle>('fingers')
  const [checks, setChecks] = useState<Record<number, boolean>>({})
  const [pick, setPick] = useState<number | null>(null)
  // Bài 8 — gảy đúng dây
  const [l8mode, setL8mode] = useState<'play' | 'ear'>('play')
  const [playStep, setPlayStep] = useState(0)
  const [playWrong, setPlayWrong] = useState<number | null>(null)
  const [playDone, setPlayDone] = useState(false)
  // Bài 8 — tai nghe
  const [exTarget, setExTarget] = useState(rnd6)
  const [exPicked, setExPicked] = useState<number | null>(null)
  const [exRound, setExRound] = useState(1)
  const [exScore, setExScore] = useState(0)
  const [exDone, setExDone] = useState(false)
  // Cấu hình bài (nội dung + media) từ admin
  const [cfg, setCfg] = useState<ElearnCfg | null>(null)

  // Đọc cách gảy đã chọn
  useEffect(() => {
    try { setPlayStyleState(((localStorage.getItem('guitarPlayStyle') as PlayStyle) || 'fingers')) } catch { /* */ }
  }, [])

  // Đổi bài → reset toàn bộ trạng thái widget
  useEffect(() => {
    setChecks({}); setPick(null)
    setL8mode('play'); setPlayStep(0); setPlayWrong(null); setPlayDone(false)
    setExTarget(rnd6()); setExPicked(null); setExRound(1); setExScore(0); setExDone(false)
  }, [num])

  // Lấy cấu hình bài (nội dung + media) đã soạn trong admin
  useEffect(() => {
    let alive = true
    supabase.from('elearn_lessons')
      .select('goal,steps,prompt,thao_type,items,youtube_id,video_url')
      .eq('course_slug', courseSlug).eq('lesson_num', num)
      .maybeSingle()
      .then(({ data }) => { if (alive) setCfg((data as ElearnCfg) ?? null) })
    return () => { alive = false }
  }, [num, courseSlug])

  const setPlayStyle = (v: PlayStyle) => {
    try { localStorage.setItem('guitarPlayStyle', v) } catch { /* */ }
    setPlayStyleState(v)
  }

  // Bài học hiệu lực = mặc định trong code, đè bằng nội dung soạn ở admin (nếu có)
  const base = getLesson(num, playStyle)
  const arr = (v: string[] | null | undefined) => (Array.isArray(v) && v.length ? v : null)
  const L = {
    ...base,
    title: title ?? base.title,
    goal: cfg?.goal ?? base.goal,
    steps: arr(cfg?.steps) ?? base.steps,
    prompt: cfg?.prompt ?? base.prompt,
    thao: {
      type: (cfg?.thao_type as ThaoType) ?? base.thao.type,
      items: arr(cfg?.items) ?? base.thao.items,
    },
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  const toggleCheck = (i: number) => setChecks(c => ({ ...c, [i]: !c[i] }))

  const l8strum = (i: number) => {
    playTone(FREQ[i])
    if (l8mode !== 'play' || playDone) return
    const target = PSEQ[playStep]
    if (i === target) {
      const ns = playStep + 1
      setPlayStep(ns); setPlayWrong(null); setPlayDone(ns >= 6)
    } else {
      setPlayWrong(i)
    }
  }
  const l8replay = () => { setPlayStep(0); setPlayWrong(null); setPlayDone(false) }

  const exPlay = () => playTone(FREQ[exTarget])
  const exPick = (i: number) => {
    if (exPicked !== null) return
    setExPicked(i); if (i === exTarget) setExScore(s => s + 1)
  }
  const exNext = () => {
    if (exRound >= 5) { setExDone(true); return }
    setExRound(r => r + 1); setExTarget(rnd6()); setExPicked(null)
  }
  const exRestart = () => {
    setExDone(false); setExRound(1); setExScore(0); setExTarget(rnd6()); setExPicked(null)
  }

  // ── Widget: dãy 6 dây ngang (dùng lại cho bài 4 & bài 8) ─────────────────────
  const HStrings = ({ onTap, disabled, reveal, target, doneSet, wrong }: {
    onTap?: (i: number) => void; disabled?: boolean; reveal?: boolean
    target?: number; doneSet?: Record<number, boolean>; wrong?: number | null
  }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {PSEQ.map(i => {
        const s = STR[i], c = strColor(i), w = 3 + (5 - i) * 1.7
        const isTarget = target === i, done = doneSet?.[i], isWrong = wrong === i
        let bg = '#fff', bd = '1px solid #EDE7DA'
        if (done) { bg = ACCENT.s; bd = `1.5px solid ${ACCENT.a}` }
        else if (isTarget) { bg = ACCENT.s; bd = `1.5px solid ${ACCENT.a}` }
        if (isWrong) { bg = '#FBEDE9'; bd = '1.5px solid #D98A6E' }
        return (
          <button key={i} onClick={disabled || !onTap ? undefined : () => onTap(i)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 13px', border: bd, borderRadius: 11, background: bg, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit', width: '100%' }}>
            <div style={{ width: 22, flexShrink: 0, textAlign: 'center', fontFamily: 'JetBrains Mono', fontSize: 13.5, fontWeight: 800, color: reveal ? c : '#C9C0AF' }}>{reveal ? s.n : '?'}</div>
            <div style={{ flex: 1, height: w, borderRadius: 99, background: c }} />
            <div style={{ width: 48, flexShrink: 0, textAlign: 'right', fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: c }}>{reveal ? `${s.vn}·${s.note}` : (done ? '✓' : '')}</div>
          </button>
        )
      })}
    </div>
  )

  // ── Widget bài 4: chọn dây 1 ─────────────────────────────────────────────────
  const NeckPick = () => {
    const answered = pick !== null
    const ok = pick === 5
    return (
      <div>
        <HStrings onTap={(i) => setPick(i)} disabled={answered} reveal={answered} target={answered ? 5 : undefined} wrong={answered && !ok ? pick : undefined} />
        {answered ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ padding: '12px 14px', borderRadius: 12, fontSize: 14.5, fontWeight: 600, lineHeight: 1.5, background: ok ? ACCENT.s : '#FBEDE9', color: ok ? ACCENT.d : '#A03B1C' }}>
              {ok ? 'Chính xác! Dây 1 là dây mỏng nhất, luôn nằm trên cùng.' : 'Chưa đúng — dây 1 là dây mỏng nhất, nằm trên cùng. Thử lại nhé.'}
            </div>
            <button onClick={() => setPick(null)} style={{ marginTop: 10, padding: '9px 16px', border: 'none', borderRadius: 10, background: '#1C1A17', color: '#fff', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Thử lại</button>
          </div>
        ) : (
          <div style={{ marginTop: 12, fontSize: 13.5, color: '#8A8478', textAlign: 'center' }}>Chạm dây bạn nghĩ là dây số 1 (mỏng nhất, trên cùng)</div>
        )}
      </div>
    )
  }

  // ── Widget bài 5: mở Tuner ───────────────────────────────────────────────────
  const ToolLaunch = () => (
    <button onClick={() => onOpenTool('tuner')}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: 16, border: 'none', borderRadius: 15, background: '#1C1A17', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
      <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 13, background: ACCENT.a, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎚️</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#F4E9D8' }}>Mở Tuner</div>
        <div style={{ fontSize: 13, color: '#9A9082', marginTop: 2, lineHeight: 1.35 }}>Đồ nghề bạn giữ mãi — lên dây mỗi lần chơi</div>
      </div>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#F4E9D8" strokeWidth={2.4}><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  )

  // ── Widget bài 8: gảy đúng dây + tai nghe ────────────────────────────────────
  const Listen8 = () => {
    const seg = (id: 'play' | 'ear', label: string) => (
      <button key={id} onClick={() => { setL8mode(id); setPlayWrong(null) }}
        style={{ flex: 1, padding: 9, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, background: l8mode === id ? '#fff' : 'transparent', color: l8mode === id ? '#1C1A17' : '#8A8478', boxShadow: l8mode === id ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>{label}</button>
    )
    const tabs = (
      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#EFE9DD', borderRadius: 12, marginBottom: 16 }}>
        {seg('play', '🎸 Gảy đúng dây')}{seg('ear', '👂 Nhận diện')}
      </div>
    )

    if (l8mode === 'play') {
      if (playDone) {
        return (
          <div>{tabs}
            <div style={{ textAlign: 'center', padding: '14px 0' }}>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>Gảy đúng cả 6 dây!</div>
              <div style={{ fontSize: 15, color: '#6B655A', marginTop: 3, lineHeight: 1.5 }}>Tay phải của bạn đã gảy rõ và đúng từng dây buông.</div>
              <button onClick={l8replay} style={{ marginTop: 16, padding: '11px 22px', border: 'none', borderRadius: 12, background: ACCENT.a, color: '#fff', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Gảy lại</button>
            </div>
          </div>
        )
      }
      const target = PSEQ[playStep]
      const tg = STR[target], tc = strColor(target)
      const doneSet: Record<number, boolean> = {}
      for (let k = 0; k < playStep; k++) doneSet[PSEQ[k]] = true
      const where = target === 0 ? 'dày nhất, dưới cùng' : target === 5 ? 'mỏng nhất, trên cùng' : 'ở giữa'
      return (
        <div>{tabs}
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 15, borderRadius: 14, background: '#1C1A17', marginBottom: 16 }}>
            <div style={{ width: 50, height: 50, flexShrink: 0, borderRadius: 13, background: tc, color: '#fff', fontSize: 21, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tg.note}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', color: '#9A9082' }}>{`HÃY GẢY (bằng ${playStyle === 'pick' ? 'pick' : 'ngón tay'})`}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#F4E9D8', marginTop: 2 }}>{`Dây buông số ${tg.n} · ${tg.vn} (${tg.note})`}</div>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 700, color: '#9A9082' }}>{`${playStep}/6`}</div>
          </div>
          <HStrings onTap={(i) => l8strum(i)} reveal target={target} doneSet={doneSet} wrong={playWrong} />
          {playWrong != null && (
            <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: '#FBEDE9', color: '#A03B1C', fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>
              {`Bạn gảy dây ${STR[playWrong].n} (${STR[playWrong].note}). Hãy gảy dây ${tg.n} — ${where}.`}
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 12.5, color: '#A8A294', textAlign: 'center' }}>Chạm dây để thực hành — mic sẽ tự chấm khi nhúng.</div>
        </div>
      )
    }

    // Tai nghe
    if (exDone) {
      return (
        <div>{tabs}
          <div style={{ textAlign: 'center', padding: '14px 0' }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>Xong 5 câu!</div>
            <div style={{ fontSize: 15, color: '#6B655A', marginTop: 3 }}>Đúng <b style={{ color: ACCENT.a }}>{`${exScore}/5`}</b> — tai bạn đang quen dần với từng dây.</div>
            <button onClick={exRestart} style={{ marginTop: 16, padding: '11px 22px', border: 'none', borderRadius: 12, background: ACCENT.a, color: '#fff', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Luyện lại</button>
          </div>
        </div>
      )
    }
    const answered = exPicked !== null, ok = exPicked === exTarget
    const tgE = STR[exTarget]
    return (
      <div>{tabs}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#8A8478' }}>{`Câu ${exRound}/5`}</div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13.5, fontWeight: 700, color: ACCENT.a }}>{`Đúng ${exScore}`}</div>
        </div>
        <button onClick={exPlay} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18, border: 'none', borderRadius: 15, background: '#1C1A17', color: '#F4E9D8', fontFamily: 'inherit', fontSize: 17, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>🔊 Nghe âm</button>
        <div style={{ fontSize: 14.5, fontWeight: 700, textAlign: 'center', marginBottom: 12, color: '#3A352C' }}>Âm vừa nghe là dây buông nào?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          {STR.map((s, i) => {
            const c = strColor(i)
            let bg = '#fff', bd = '#E6E0D4'
            if (answered && i === exTarget) { bg = ACCENT.s; bd = ACCENT.a }
            else if (answered && i === exPicked) { bg = '#FBEDE9'; bd = '#D98A6E' }
            return (
              <button key={i} onClick={() => exPick(i)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 13px', border: `1.5px solid ${bd}`, borderRadius: 12, background: bg, cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                <div style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 8, background: c, color: '#fff', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.note}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#3A352C' }}>{`Dây ${s.n} · ${s.vn}`}</div>
              </button>
            )
          })}
        </div>
        {answered && (
          <div style={{ marginTop: 14 }}>
            <div style={{ padding: '12px 14px', borderRadius: 12, fontSize: 14, fontWeight: 600, lineHeight: 1.5, background: ok ? ACCENT.s : '#FBEDE9', color: ok ? ACCENT.d : '#A03B1C' }}>
              {ok ? `Chính xác — đó là dây ${tgE.n} (${tgE.vn} · ${tgE.note}).` : `Là dây ${tgE.n} (${tgE.vn} · ${tgE.note}). Bấm 🔊 nghe lại để ghi nhớ.`}
            </div>
            <button onClick={exNext} style={{ marginTop: 10, width: '100%', padding: 13, border: 'none', borderRadius: 12, background: ACCENT.a, color: '#fff', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{exRound >= 5 ? 'Xem kết quả' : 'Câu tiếp →'}</button>
          </div>
        )}
      </div>
    )
  }

  // ── Widget check-list ────────────────────────────────────────────────────────
  const CheckWidget = ({ items }: { items: string[] }) => {
    const all = items.length > 0 && items.every((_, i) => checks[i])
    return (
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, i) => {
            const on = checks[i]
            return (
              <button key={i} onClick={() => toggleCheck(i)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', border: `1.5px solid ${on ? ACCENT.a : '#E6E0D4'}`, borderRadius: 13, background: on ? ACCENT.s : '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%' }}>
                <div style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 7, border: `2px solid ${on ? ACCENT.a : '#D8CFBE'}`, background: on ? ACCENT.a : 'transparent', color: '#fff', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</div>
                <div style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: '#3A352C', lineHeight: 1.4 }}>{it}</div>
              </button>
            )
          })}
        </div>
        {all && (
          <div style={{ marginTop: 12, padding: '11px 14px', borderRadius: 12, background: ACCENT.s, color: ACCENT.d, fontSize: 14, fontWeight: 600, textAlign: 'center' }}>Xong rồi! Bạn đã sẵn sàng cho bước tiếp theo.</div>
        )}
      </div>
    )
  }

  // ── Chọn cách gảy (chỉ bài 9) ────────────────────────────────────────────────
  const StyleChips = () => {
    const chip = (id: PlayStyle, emoji: string, label: string, sub: string) => (
      <button key={id} onClick={() => setPlayStyle(id)}
        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px', border: `1.5px solid ${playStyle === id ? ACCENT.a : '#E6E0D4'}`, borderRadius: 13, background: playStyle === id ? ACCENT.s : '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <div style={{ fontSize: 19 }}>{emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#1C1A17' }}>{label}</div>
          <div style={{ fontSize: 11.5, color: '#8A8478', marginTop: 1 }}>{sub}</div>
        </div>
        {playStyle === id && <div style={{ color: ACCENT.a, fontWeight: 800, fontSize: 15 }}>✓</div>}
      </button>
    )
    return (
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {chip('fingers', '🖐️', 'Ngón tay', 'Ấm, linh hoạt')}
        {chip('pick', '🔻', 'Pick', 'Sáng, dứt khoát')}
      </div>
    )
  }

  // ── Bảng tên nốt (bài 4) ─────────────────────────────────────────────────────
  const NoteChart = () => {
    const N: [string, string][] = [['C', 'Đô'], ['D', 'Rê'], ['E', 'Mi'], ['F', 'Fa'], ['G', 'Sol'], ['A', 'La'], ['B', 'Si']]
    const used: Record<string, number> = { E: 1, A: 1, D: 1, G: 1, B: 1 }
    return (
      <div style={{ marginTop: 16, background: '#fff', border: '1px solid #EAE4D8', borderRadius: 16, padding: '14px 14px 12px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>Ký hiệu tên nốt</div>
        <div style={{ fontSize: 12.5, color: '#8A8478', lineHeight: 1.45, marginBottom: 12 }}>Guitar dùng 7 chữ cái quốc tế. Đây là bảng "phiên dịch" sang Đô-Rê-Mi quen thuộc:</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
          {N.map(([letter, vn]) => (
            <div key={letter} style={{ textAlign: 'center', padding: '8px 2px', borderRadius: 10, background: used[letter] ? ACCENT.s : '#F6F2EA', border: used[letter] ? `1.5px solid ${ACCENT.a}` : '1px solid #EAE4D8' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 17, fontWeight: 800, color: used[letter] ? ACCENT.a : '#1C1A17' }}>{letter}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B655A', marginTop: 2 }}>{vn}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#A8A294', lineHeight: 1.4 }}>Ô tô màu = 5 chữ cái xuất hiện trên 6 dây đàn (E, A, D, G, B).</div>
      </div>
    )
  }

  // ── Media: youtube / video upload, fallback bảng nốt cho bài 4 ───────────────
  const Media = () => {
    if (cfg?.youtube_id) {
      return (
        <div style={{ marginTop: 16, borderRadius: 16, overflow: 'hidden', background: '#000', position: 'relative', paddingBottom: '56.25%' }}>
          <iframe src={`https://www.youtube.com/embed/${cfg.youtube_id}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen title="Video bài học" />
        </div>
      )
    }
    if (cfg?.video_url) {
      return (
        <div style={{ marginTop: 16, borderRadius: 16, overflow: 'hidden' }}>
          <video src={cfg.video_url} controls playsInline style={{ width: '100%', display: 'block', background: '#000', maxHeight: 260 }} />
        </div>
      )
    }
    if (num === 4) return <NoteChart />
    return null
  }

  const ThaoTac = () => {
    if (L.thao.type === 'neck') return <NeckPick />
    if (L.thao.type === 'tool') return <ToolLaunch />
    if (L.thao.type === 'listen8') return <Listen8 />
    return <CheckWidget items={L.thao.items ?? []} />
  }

  const ctaLabel = isDone ? 'Hoàn thành bài này ✓' : 'Mình làm được rồi ✓'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F6F2EA', fontFamily: '"DM Sans", system-ui, sans-serif', color: '#1C1A17' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, background: 'rgba(246,242,234,.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', padding: 'calc(env(safe-area-inset-top,0px) + 12px) 16px 12px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #E8E2D6' }}>
        <button onClick={onBack} style={{ width: 38, height: 38, flexShrink: 0, border: '1px solid #E2DBCD', background: '#fff', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#5A5448" strokeWidth={2.4}><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT.a, letterSpacing: '.03em' }}>{L.crumb}</div>
          <div style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{L.title}</div>
        </div>
      </div>

      {/* Nội dung (cuộn được) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 0' }}>
        {studentName && <div style={{ marginBottom: 12, fontSize: 13.5, color: ACCENT.d, fontWeight: 600 }}>{`${studentName}`}</div>}
        {/* Mục tiêu */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '13px 15px', background: ACCENT.s, borderRadius: 14 }}>
          <span style={{ fontSize: 16, marginTop: 1 }}>🎯</span>
          <div style={{ fontSize: 14.5, color: '#3E463F', lineHeight: 1.5, fontWeight: 600 }}>{L.goal}</div>
        </div>

        <Media />

        {/* Các bước */}
        {L.steps.length > 0 && (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {L.steps.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 13, paddingBottom: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 99, background: '#1C1A17', color: '#F4E9D8', fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
                  <div style={{ width: 2, flex: 1, background: i < L.steps.length - 1 ? '#E2DBCD' : 'transparent', marginTop: 3, minHeight: 8 }} />
                </div>
                <div style={{ fontSize: 15, color: '#3A352C', lineHeight: 1.55, paddingTop: 3 }}>{t}</div>
              </div>
            ))}
          </div>
        )}

        {/* Thao tác */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#8A8478', letterSpacing: '.05em' }}>THAO TÁC NGAY</div>
          <div style={{ fontSize: 15.5, fontWeight: 700, margin: '5px 0 14px', lineHeight: 1.35 }}>{L.prompt}</div>
          <div style={{ background: '#fff', border: '1px solid #EAE4D8', borderRadius: 18, padding: '18px 16px' }}>
            {num === 9 && <StyleChips />}
            <ThaoTac />
          </div>
        </div>

        {/* Ghi chú của thầy */}
        <div style={{ margin: '18px 0 26px', display: 'flex', alignItems: 'center', gap: 11, padding: '13px 15px', background: '#F1ECE2', borderRadius: 14 }}>
          <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 99, background: 'linear-gradient(135deg,#2C2823,#5A5043)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F4E9D8', fontWeight: 700, fontSize: 12.5 }}>VA</div>
          <div style={{ fontSize: 13.5, color: '#5A5448', lineHeight: 1.45 }}>Thấy khó ở đâu? <b>Nhắn thầy Văn Anh</b> — vấp là chuyện bình thường.</div>
        </div>
      </div>

      {/* Nút hoàn thành */}
      <div style={{ flexShrink: 0, padding: 'calc(env(safe-area-inset-bottom,0px) + 14px) 20px calc(env(safe-area-inset-bottom,0px) + 14px)', background: 'linear-gradient(0deg,#F6F2EA 72%,rgba(246,242,234,0))' }}>
        <button onClick={onComplete} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 15, border: 'none', borderRadius: 15, background: ACCENT.a, color: '#fff', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: `0 12px 26px -12px ${ACCENT.a}` }}>
          {ctaLabel}
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4}><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  )
}
