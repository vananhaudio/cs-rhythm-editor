import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { NeckPick, NoteChart, Checklist, Strum, Ear } from './elearn/guitarRenderers'
import type { NeckCfg, ChecklistCfg, NoteChartCfg, StrumCfg, EarCfg } from './elearn/guitarRenderers'
import SupportFlow from './SupportFlow'

// Slide tương tác cần "vượt" mới qua (cổng hard-mềm). Chỉ gồm loại ĐÃ có renderer.
const INTERACTIVE_TYPES = ['guitar_neck', 'guitar_strum', 'guitar_ear', 'checklist']

// Nhận MỌI dạng link YouTube → URL embed cho iframe.
// Bắt ID 11 ký tự bất kể thứ tự tham số (watch?v=, watch?app=desktop&v=, m.youtube, youtu.be, shorts, live, embed, hoặc ID trần).
export function toYouTubeEmbed(url: string): string {
  if (!url) return url
  const u = url.trim()
  if (/youtube\.com\/embed\/[\w-]{11}/.test(u)) return u // đã là embed hợp lệ
  let id: string | null = null
  let m: RegExpMatchArray | null
  if ((m = u.match(/[?&]v=([\w-]{11})/)))               id = m[1] // …watch?…v=ID (mọi thứ tự tham số)
  else if ((m = u.match(/youtu\.be\/([\w-]{11})/)))      id = m[1]
  else if ((m = u.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/))) id = m[1]
  else if (/^[\w-]{11}$/.test(u))                        id = u    // ID trần
  return id ? `https://www.youtube.com/embed/${id}?rel=0` : u
}

// ── Logic labels & colors ──────────────────────────────────────────────────
const LOGIC_META: Record<string, { label: string; bg: string; color: string }> = {
  NHAN:   { label: 'NHẬN',   bg: '#EEF2FF', color: '#4338CA' },
  NGHI:   { label: 'NGHĨ',   bg: '#FFF7ED', color: '#C2410C' },
  LAM:    { label: 'LÀM',    bg: '#F0FDF4', color: '#16A34A' },
  NGAM:   { label: 'NGẪM',   bg: '#FDF4FF', color: '#9333EA' },
  THUONG: { label: 'THƯỞNG', bg: '#FFFBEB', color: '#D97706' },
  DAN:    { label: 'DẪN',    bg: '#F0F9FF', color: '#0369A1' },
}

// ── Types ──────────────────────────────────────────────────────────────────
interface Slide {
  id: string
  order: number
  logic: string
  type: string
  title?: string
  content?: string
  mediaUrl?: string
  options?: string[]
  correctAnswer?: string
  buttonText?: string
  // GĐ1 — engine gộp elearn
  interactive?: Record<string, unknown>   // config riêng cho slide tương tác (guitar_*, checklist, callout…)
  hintText?: string
}

interface Flow {
  id: string
  title: string
  reward_xp: number
  reward_badge?: string
  slides: Slide[]
}

interface Props {
  lessonId: string
  studentId: string
  onComplete: () => void
  onBack: () => void
  fullScreen?: boolean   // true → tự dùng position:fixed, không cần wrapper ngoài
  previewFlow?: Flow     // preview mode: truyền thẳng data, không fetch DB
  onLogAction?: (type: string) => void   // ghi nhận "đã thực hành / gửi bài" ở màn hoàn thành
  doneActions?: Set<string>              // action_type đã ghi nhận của bài này
  actionBusy?: string | null
  onOpenTool?: (tool: string) => void    // mở công cụ (tuner/tempo/board) overlay
}

export default function FlowPlayer({ lessonId, studentId, onComplete, onBack, fullScreen, previewFlow, onLogAction, doneActions, actionBusy, onOpenTool }: Props) {
  const [flow,     setFlow]     = useState<Flow | null>(previewFlow ?? null)
  const [loading,  setLoading]  = useState(!previewFlow)
  const [current,  setCurrent]  = useState(0)
  const [completed, setCompleted] = useState<string[]>([])
  const [answer,   setAnswer]   = useState<string | null>(null)
  const [inputVal, setInputVal] = useState('')
  const [checked,  setChecked]  = useState<'correct' | 'wrong' | null>(null)
  const [done,     setDone]     = useState(false)
  const [startedAt] = useState(new Date().toISOString())
  // Animation & swipe
  const slideDir    = useRef<'next' | 'prev'>('next')
  const touchStartX = useRef<number | null>(null)
  // Đã hoàn thành flow trước đó chưa (để KHÔNG thưởng XP lại khi xem lại)
  const wasFinishedRef = useRef(false)
  // Cổng slide tương tác: slide đã "vượt" + số lần thử (cho lối thoát danh dự)
  const [passed,   setPassed]   = useState<Set<string>>(new Set())
  const [attempts, setAttempts] = useState<Record<string, number>>({})
  // Có slide LÀM nào được vượt THẬT không → để tự ghi "đã thực hành" cuối bài
  const practicedRef = useRef(false)

  const [supportOpen, setSupportOpen] = useState(false)
  const buzz = (ok: boolean) => { try { navigator.vibrate?.(ok ? 26 : [0, 14, 40, 14]) } catch { /* */ } }
  const markPassed = (id: string, isLam: boolean) => {
    setPassed(p => p.has(id) ? p : new Set(p).add(id))
    if (isLam) practicedRef.current = true
    buzz(true)
  }
  const bumpAttempt = (id: string) => { setAttempts(a => ({ ...a, [id]: (a[id] ?? 0) + 1 })); buzz(false) }
  const softPass = (id: string) => setPassed(p => new Set(p).add(id))

  // Load flow by lessonId — bỏ qua nếu đang ở preview mode
  useEffect(() => {
    if (previewFlow) return
    supabase.from('flows')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('status', 'published')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const slides = (Array.isArray(data.slides) ? data.slides : [])
            .sort((a: Slide, b: Slide) => a.order - b.order)
          setFlow({ ...data, slides })
        }
        setLoading(false)
      })
  }, [lessonId])

  // Load existing progress — bỏ qua nếu preview hoặc chưa có học viên (khách)
  useEffect(() => {
    if (!flow || previewFlow || !studentId) return
    supabase.from('flow_progress')
      .select('*')
      .eq('student_id', studentId)
      .eq('flow_id', flow.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCompleted(data.completed_slides ?? [])
          wasFinishedRef.current = !!data.finished_at
          // Đã hoàn thành trước đó → hiện thẳng màn "Hoàn thành" (có nút thực hành/gửi bài)
          if (data.finished_at) {
            setCurrent(0)
            setDone(true)
          } else {
            const savedIdx = data.current_slide ?? 0
            setCurrent(Math.min(savedIdx, flow.slides.length - 1))
          }
        }
      })
  }, [flow])

  // Save progress to DB — bỏ qua nếu preview
  const saveProgress = async (slideIdx: number, comp: string[], finished = false) => {
    if (!flow || previewFlow || !studentId) return
    const { data: existing } = await supabase.from('flow_progress')
      .select('id').eq('student_id', studentId).eq('flow_id', flow.id).maybeSingle()
    const payload: Record<string, unknown> = {
      student_id: studentId, flow_id: flow.id, lesson_id: lessonId,
      current_slide: slideIdx, completed_slides: comp,
    }
    if (finished) payload.finished_at = new Date().toISOString()
    if (existing) {
      await supabase.from('flow_progress').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('flow_progress').insert({ ...payload, started_at: startedAt })
    }
  }

  const goPrev = () => {
    if (current <= 0) return
    slideDir.current = 'prev'
    setCurrent(current - 1)
    setAnswer(null); setInputVal(''); setChecked(null)
  }

  const goNext = async () => {
    if (!flow) return
    slideDir.current = 'next'
    const slide = flow.slides[current]
    const newComp = completed.includes(slide.id) ? completed : [...completed, slide.id]
    setCompleted(newComp)
    setAnswer(null); setInputVal(''); setChecked(null)

    if (current >= flow.slides.length - 1) {
      await saveProgress(current, newComp, true)
      // Thưởng XP THẬT lần đầu hoàn thành flow (không thưởng lại khi xem lại / preview / khách)
      if (studentId && !previewFlow && !wasFinishedRef.current && flow.reward_xp > 0) {
        wasFinishedRef.current = true
        const { error: xpErr } = await supabase.from('student_xp_log').insert({
          student_id: studentId, xp: flow.reward_xp, source: 'flow', ref_id: flow.id,
        })
        if (xpErr) console.error('Ghi XP flow lỗi:', xpErr)
      }
      // Tự ghi "đã thực hành" (70đ/cam) khi bài có slide LÀM được vượt THẬT
      // → đường ghi practiced_lesson DUY NHẤT ở FlowPlayer (tránh cộng đôi với portal)
      if (practicedRef.current && !previewFlow && onLogAction && !doneActions?.has('practiced_lesson')) {
        onLogAction('practiced_lesson')
      }
      setDone(true)
      onComplete()
    } else {
      const next = current + 1
      setCurrent(next)
      await saveProgress(next, newComp)
    }
  }

  // Normalize true/false từ mọi dạng: true, false, "true", "false", "Đúng", "Sai"
  const normalizeTF = (v: unknown): boolean | null => {
    if (v === true  || v === 'true'  || v === 'Đúng' || v === 'Dung') return true
    if (v === false || v === 'false' || v === 'Sai')                   return false
    return null
  }

  const checkAnswer = (slide: Slide) => {
    if (!answer) return
    if (slide.type === 'true_false') {
      const selected  = normalizeTF(answer)           // "Đúng" → true / "Sai" → false
      const correct   = normalizeTF(slide.correctAnswer)
      if (selected === null || correct === null) { setChecked('wrong'); return }
      setChecked(selected === correct ? 'correct' : 'wrong')
    } else {
      setChecked(answer === slide.correctAnswer ? 'correct' : 'wrong')
    }
  }

  const canProceed = (slide: Slide) => {
    if (slide.type === 'quiz' || slide.type === 'true_false') return checked === 'correct'
    if (slide.type === 'input') return inputVal.trim().length > 0
    if (INTERACTIVE_TYPES.includes(slide.type)) return passed.has(slide.id)
    return true
  }

  // ── Container style — fullScreen tự dùng position:fixed để tránh bug iOS WebKit ──────
  // Safe-area KHÔNG đặt ở container (dễ bị màn Done/Loading dùng `padding` shorthand ghi đè)
  // → đẩy thẳng vào header (nút back) & thanh nút đáy bên dưới.
  const containerStyle = fullScreen
    ? {
        position: 'fixed' as const,
        top: 0 as number | string, left: 0 as number | string,
        right: 0 as number | string, bottom: 0 as number | string,
        background: '#fff', zIndex: 100,
        boxSizing: 'border-box' as const,
        display: 'flex' as const, flexDirection: 'column' as const, overflow: 'hidden' as const,
      }
    : {
        display: 'flex' as const, flexDirection: 'column' as const,
        flex: 1, minHeight: 0, overflow: 'hidden' as const,
      }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center', color: '#999' }}>
      Đang tải bài học...
    </div>
  )

  // ── No flow ──────────────────────────────────────────────────────────────
  if (!flow || flow.slides.length === 0) return (
    <div style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
      <div style={{ color: '#888', marginBottom: 16 }}>Bài học này chưa có nội dung Flow.</div>
      <button onClick={onBack}
        style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: '#4338CA', color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
        ← Quay lại
      </button>
    </div>
  )

  // ── Done screen ──────────────────────────────────────────────────────────
  if (done) return (
    <div style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center', padding: 'calc(env(safe-area-inset-top,0px) + 28px) 28px calc(env(safe-area-inset-bottom,0px) + 28px)', textAlign: 'center', gap: 14, overflow: 'auto' }}>
      <div style={{ fontSize: 52 }}>🎉</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#4338CA' }}>Hoàn thành!</div>
      <div style={{ fontSize: 15, color: '#555' }}>{flow.title}</div>
      {flow.reward_xp > 0 && !wasFinishedRef.current && (
        <div style={{ background: '#FFF7ED', color: '#D97706', borderRadius: 99, padding: '8px 24px', fontWeight: 700, fontSize: 16 }}>
          +{flow.reward_xp} XP 🔥
        </div>
      )}
      {onLogAction && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 340 }}>
          {[
            { type: 'practiced_lesson', label: 'Tôi đã thực hành bài này', xp: 10, icon: '🎸' },
            { type: 'submitted_video_self_report', label: 'Tôi đã gửi bài cho thầy', xp: 50, icon: '📹' },
          ].map(a => {
            const dn = doneActions?.has(a.type)
            return (
              <button key={a.type} onClick={() => { if (!dn) onLogAction(a.type) }} disabled={dn || actionBusy === a.type}
                style={{ display: 'flex', alignItems: 'center', gap: 10, background: dn ? '#F0FDF4' : '#fff', border: `1.5px solid ${dn ? '#16A34A' : '#E4E4E7'}`, borderRadius: 12, padding: '12px 14px', cursor: dn ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: actionBusy === a.type ? 0.6 : 1 }}>
                <span style={{ fontSize: 18 }}>{dn ? '✅' : a.icon}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: dn ? '#16A34A' : '#18181B' }}>{dn ? `${a.label} — đã ghi nhận` : a.label}</span>
                {!dn && <span style={{ fontSize: 11, fontWeight: 700, color: '#EA580C' }}>+{a.xp} XP</span>}
              </button>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button onClick={() => { setDone(false); setCurrent(0); setAnswer(null); setChecked(null) }}
          style={{ padding: '12px 20px', borderRadius: 14, border: '1px solid #E4E4E7', background: '#fff', color: '#52525B', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          ↺ Xem lại
        </button>
        <button onClick={onBack}
          style={{ padding: '12px 26px', borderRadius: 14, border: 'none', background: '#4338CA', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          ← Quay lại
        </button>
      </div>
    </div>
  )

  const slide = flow.slides[current]
  const lm = LOGIC_META[slide.logic] ?? LOGIC_META.NHAN
  const progress = (current / flow.slides.length) * 100

  // ── Swipe handlers ───────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !flow) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    const THRESHOLD = 50
    if (dx < -THRESHOLD && canProceed(slide)) { goNext() }
    else if (dx > THRESHOLD && current > 0)   { goPrev() }
  }

  // ── Main player ──────────────────────────────────────────────────────────
  // Quy tắc vàng: FlowPlayer = trải nghiệm từng màn hình, KHÔNG cuộn dọc
  // Ngoại lệ duy nhất: slide type='input' cho phép scroll nội bộ textarea
  return (
    <div style={containerStyle}>

      {/* Slide transition keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes _fsNext { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: none; } }
        @keyframes _fsPrev { from { opacity: 0; transform: translateX(-18px); } to { opacity: 1; transform: none; } }
        ._fsNext { animation: _fsNext .22s ease; }
        ._fsPrev { animation: _fsPrev .22s ease; }
      ` }} />

      {/* Progress bar */}
      <div style={{ height: 4, background: '#E8EAF0', flexShrink: 0 }}>
        <div style={{ height: '100%', background: '#4338CA', width: `${progress}%`, transition: 'width .35s ease', borderRadius: 2 }} />
      </div>

      {/* Header — badge + TIÊU ĐỀ cùng hàng (gọn, không đẩy nội dung xuống) + chừa tai thỏ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px', borderBottom: '1px solid #F0F0F2', flexShrink: 0 }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888', padding: '2px 4px 2px 0', lineHeight: 1, flexShrink: 0 }}>
          ←
        </button>
        <span style={{ background: lm.bg, color: lm.color, borderRadius: 99, padding: '3px 11px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
          {lm.label}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: '#18181B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {slide.title ?? ''}
        </span>
        <span style={{ fontSize: 12, color: '#AAA', flexShrink: 0 }}>{current + 1} / {flow.slides.length}</span>
      </div>

      {/* Slide body — cuộn NỘI BỘ nếu nội dung dài, nút bấm luôn hiển thị */}
      <div
        key={current}
        className={slideDir.current === 'next' ? '_fsNext' : '_fsPrev'}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '18px 16px 12px' }}>

        {/* TEXT / NEXT */}
        {(slide.type === 'text' || slide.type === 'next') && slide.content && (
          <div style={{ fontSize: 15, color: '#333', lineHeight: 1.9 }}
            dangerouslySetInnerHTML={{ __html: slide.content }} />
        )}

        {/* VIDEO */}
        {slide.type === 'video' && slide.mediaUrl && (
          <div style={{ borderRadius: 12, overflow: 'hidden', aspectRatio: '16/9', background: '#000', marginBottom: 8 }}>
            <iframe src={toYouTubeEmbed(slide.mediaUrl)} style={{ width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen title={slide.title} />
          </div>
        )}

        {/* IMAGE */}
        {slide.type === 'image' && (
          <div style={{ marginBottom: 8 }}>
            {slide.content && (
              <div style={{ fontSize: 15, color: '#333', lineHeight: 1.85, marginBottom: 14 }}>{slide.content}</div>
            )}
            {slide.mediaUrl ? (
              <img
                src={slide.mediaUrl}
                alt={slide.title ?? ''}
                style={{ width: '100%', borderRadius: 14, display: 'block', objectFit: 'cover', maxHeight: 320 }}
                onError={e => {
                  const el = e.currentTarget
                  el.style.display = 'none'
                  const ph = el.nextElementSibling as HTMLElement | null
                  if (ph) ph.style.display = 'flex'
                }}
              />
            ) : null}
            {/* Placeholder — hiện khi không có URL hoặc ảnh lỗi */}
            <div style={{
              display: slide.mediaUrl ? 'none' : 'flex',
              alignItems: 'center', justifyContent: 'center',
              height: 160, borderRadius: 14, background: '#F4F4F5',
              border: '2px dashed #D4D4D8', color: '#A1A1AA',
              flexDirection: 'column', gap: 8, fontSize: 13
            }}>
              <span style={{ fontSize: 32 }}>🖼</span>
              Chưa có hình ảnh
            </div>
          </div>
        )}

        {/* QUIZ */}
        {slide.type === 'quiz' && (
          <div>
            {slide.content && (
              <div style={{ fontSize: 15, color: '#333', lineHeight: 1.8, marginBottom: 14 }}>{slide.content}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(slide.options ?? []).map((opt, i) => {
                const sel = answer === opt
                const isCorrect = opt === slide.correctAnswer
                let bg = '#F8F8FA', border = '2px solid #E8EAF0', color = '#18181B'
                if (checked && sel && isCorrect)  { bg = '#F0FDF4'; border = '2px solid #16A34A'; color = '#16A34A' }
                if (checked && sel && !isCorrect) { bg = '#FEF2F2'; border = '2px solid #EF4444'; color = '#EF4444' }
                if (!checked && sel)              { bg = '#EEF2FF'; border = '2px solid #4338CA'; color = '#4338CA' }
                return (
                  <div key={i} onClick={() => {
                      if (checked === 'correct') return
                      setAnswer(opt)
                      setChecked(opt === slide.correctAnswer ? 'correct' : 'wrong')
                    }}
                    style={{ padding: '13px 16px', borderRadius: 14, background: bg, border, color, fontSize: 14, fontWeight: 500, cursor: checked === 'correct' ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all .15s' }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: sel ? (checked ? (isCorrect ? '#16A34A' : '#EF4444') : '#4338CA') : '#DDD', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </div>
                )
              })}
              {checked === 'wrong'   && <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', color: '#DC2626', fontSize: 13 }}>❌ Chưa đúng — chọn lại nhé!</div>}
              {checked === 'correct' && <div style={{ background: '#F0FDF4', borderRadius: 10, padding: '10px 14px', color: '#16A34A', fontSize: 13 }}>✅ Chính xác!</div>}
            </div>
          </div>
        )}

        {/* TRUE / FALSE */}
        {slide.type === 'true_false' && (
          <div>
            {slide.content && (
              <div style={{ fontSize: 15, color: '#333', lineHeight: 1.8, marginBottom: 14 }}>{slide.content}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Đúng', 'Sai'].map(opt => {
                const sel = answer === opt
                // Normalize cả 2 phía trước khi so sánh
                const optNorm     = normalizeTF(opt)
                const correctNorm = normalizeTF(slide.correctAnswer)
                const isCorrect   = optNorm !== null && optNorm === correctNorm
                let bg = '#F8F8FA', border = '2px solid #E8EAF0', color = '#18181B'
                if (checked && sel && isCorrect)  { bg = '#F0FDF4'; border = '2px solid #16A34A'; color = '#16A34A' }
                if (checked && sel && !isCorrect) { bg = '#FEF2F2'; border = '2px solid #EF4444'; color = '#EF4444' }
                if (!checked && sel)              { bg = '#EEF2FF'; border = '2px solid #4338CA'; color = '#4338CA' }
                return (
                  <div key={opt}
                    onClick={() => {
                      if (checked === 'correct') return
                      setAnswer(opt)
                      const sel = normalizeTF(opt)
                      const cor = normalizeTF(slide.correctAnswer)
                      setChecked(sel !== null && cor !== null && sel === cor ? 'correct' : 'wrong')
                    }}
                    style={{ padding: '16px', borderRadius: 14, background: bg, border, color, fontSize: 16, fontWeight: 700, cursor: checked === 'correct' ? 'default' : 'pointer', textAlign: 'center', transition: 'all .15s' }}>
                    {opt === 'Đúng' ? '✓ Đúng' : '✗ Sai'}
                  </div>
                )
              })}
              {checked === 'wrong'   && <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', color: '#DC2626', fontSize: 13 }}>❌ Chưa đúng — chọn lại nhé!</div>}
              {checked === 'correct' && <div style={{ background: '#F0FDF4', borderRadius: 10, padding: '10px 14px', color: '#16A34A', fontSize: 13 }}>✅ Chính xác!</div>}
            </div>
          </div>
        )}

        {/* INPUT */}
        {slide.type === 'input' && (
          <div>
            {slide.content && (
              <div style={{ fontSize: 15, color: '#333', lineHeight: 1.8, marginBottom: 12 }}>{slide.content}</div>
            )}
            <textarea value={inputVal} onChange={e => setInputVal(e.target.value)}
              placeholder="Nhập câu trả lời của bạn..."
              style={{ width: '100%', boxSizing: 'border-box', minHeight: 130, borderRadius: 14, border: '2px solid #E8EAF0', padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.7, color: '#18181B', background: '#fff' }} />
          </div>
        )}

        {/* ACTION */}
        {slide.type === 'action' && slide.content && (
          <div style={{ fontSize: 15, color: '#333', lineHeight: 1.9 }}>
            {slide.content}
          </div>
        )}

        {/* REWARD */}
        {slide.type === 'reward' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 60, marginBottom: 12 }}>🎉</div>
            {slide.content && (
              <div style={{ fontSize: 16, color: '#4338CA', fontWeight: 600, lineHeight: 1.7 }}>{slide.content}</div>
            )}
          </div>
        )}

        {/* CALLOUT — lời thầy / mẹo (giữ "người thầy hiện diện") */}
        {slide.type === 'callout' && (() => {
          const v = (slide.interactive?.variant as string) ?? 'tip'
          const teacher = v === 'teacher'
          return (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '15px 16px', borderRadius: 16, background: teacher ? '#F1ECE2' : v === 'warn' ? '#FEF3C7' : '#EEF2FF', border: `1px solid ${teacher ? '#E2DBCD' : v === 'warn' ? '#FDE68A' : '#E0E7FF'}` }}>
              <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 99, background: teacher ? 'linear-gradient(135deg,#2C2823,#5A5043)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F4E9D8', fontWeight: 700, fontSize: 13 }}>
                {teacher ? 'VA' : v === 'warn' ? '⚠️' : '💡'}
              </div>
              <div style={{ flex: 1 }}>
                {teacher && <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5A5448', marginBottom: 3 }}>Thầy Văn Anh</div>}
                <div style={{ fontSize: 14.5, color: '#3A352C', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: slide.content ?? '' }} />
              </div>
            </div>
          )
        })()}

        {/* NOTE CHART — bảng nốt */}
        {slide.type === 'note_chart' && (
          <NoteChart cfg={(slide.interactive ?? {}) as NoteChartCfg} />
        )}

        {/* GUITAR_NECK — chạm đúng dây (LÀM) */}
        {slide.type === 'guitar_neck' && (
          <div>
            <NeckPick
              cfg={(slide.interactive ?? {}) as NeckCfg}
              onPass={() => markPassed(slide.id, true)}
              onWrong={() => bumpAttempt(slide.id)}
            />
            {!passed.has(slide.id) && (attempts[slide.id] ?? 0) >= 2 && (
              <button onClick={() => softPass(slide.id)}
                style={{ marginTop: 14, width: '100%', padding: '12px', border: '1.5px dashed #C9C0AF', borderRadius: 12, background: '#fff', color: '#8A8478', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                Mình đã thử trên đàn rồi → tiếp tục
              </button>
            )}
          </div>
        )}

        {/* GUITAR_STRUM — gảy đủ dãy đúng thứ tự (LÀM) */}
        {slide.type === 'guitar_strum' && (
          <div>
            <Strum cfg={(slide.interactive ?? {}) as StrumCfg}
              onPass={() => markPassed(slide.id, true)} onWrong={() => bumpAttempt(slide.id)} />
            {!passed.has(slide.id) && (attempts[slide.id] ?? 0) >= 2 && (
              <button onClick={() => softPass(slide.id)} style={{ marginTop: 14, width: '100%', padding: '12px', border: '1.5px dashed #C9C0AF', borderRadius: 12, background: '#fff', color: '#8A8478', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                Mình đã thử trên đàn rồi → tiếp tục
              </button>
            )}
          </div>
        )}

        {/* GUITAR_EAR — nghe đoán dây (LÀM) */}
        {slide.type === 'guitar_ear' && (
          <Ear cfg={(slide.interactive ?? {}) as EarCfg} onPass={() => markPassed(slide.id, true)} />
        )}

        {/* CHECKLIST — tự đánh giá (NGẪM) */}
        {slide.type === 'checklist' && (
          <Checklist cfg={(slide.interactive ?? {}) as ChecklistCfg} onPass={() => markPassed(slide.id, false)} />
        )}

        {/* GUITAR_TOOL — mở công cụ ngay trong bài (LÀM/DẪN) */}
        {slide.type === 'guitar_tool' && (() => {
          const tool = (slide.interactive?.tool as string) ?? 'tuner'
          const label = (slide.interactive?.label as string) ?? 'Mở công cụ'
          const sub = (slide.interactive?.sub as string) ?? ''
          return (
            <button onClick={() => { onOpenTool?.(tool); markPassed(slide.id, true) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: 16, border: 'none', borderRadius: 15, background: '#1C1A17', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 13, background: '#3F6B4E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎚️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#F4E9D8' }}>{label}</div>
                {sub && <div style={{ fontSize: 12, color: '#9A9082', marginTop: 2 }}>{sub}</div>}
              </div>
              <span style={{ color: '#F4E9D8', fontSize: 18 }}>›</span>
            </button>
          )
        })()}

        {/* SUPPORT — Gỡ rối & Đào sâu (opt-in, thầy tự gắn vào bài cần) */}
        {slide.type === 'support' && (
          <div>
            <div style={{ fontSize: 15, color: '#3A352C', lineHeight: 1.7, marginBottom: 16 }}>
              {slide.content || 'Vấp là chuyện bình thường. Nếu bạn chưa hiểu, làm chưa được, hoặc muốn hiểu sâu hơn — bấm vào đây để cùng gỡ.'}
            </div>
            <button onClick={() => setSupportOpen(true)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: 16, border: 'none', borderRadius: 15, background: '#3F6B4E', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 13, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🧭</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: '#fff' }}>Gỡ rối & Đào sâu</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 2 }}>Tự gỡ → tìm bài giảng → hỏi thầy</div>
              </div>
              <span style={{ color: '#fff', fontSize: 18 }}>›</span>
            </button>
          </div>
        )}
      </div>

      {/* Overlay Gỡ rối & Đào sâu */}
      {supportOpen && (
        <SupportFlow
          lessonId={lessonId}
          lessonTitle={flow.title}
          studentId={previewFlow ? undefined : studentId}
          teacherUrl={slide.interactive?.teacherUrl as string | undefined}
          oaUrl={slide.interactive?.oaUrl as string | undefined}
          onClose={() => setSupportOpen(false)}
        />
      )}

      {/* Bottom actions — flexShrink:0 + chừa safe-area đáy → nút LUÔN hiển thị & bấm được */}
      <div style={{ padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 20px)', borderTop: '1px solid #F0F0F2', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        {/* Hàng nút điều hướng: Trước + Tiếp tục */}
        <div style={{ display: 'flex', gap: 8 }}>
          {current > 0 && (
            <button onClick={goPrev}
              style={{ padding: '15px 18px', borderRadius: 14, border: '2px solid #E8EAF0', background: '#fff', color: '#4338CA', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
              ← Trước
            </button>
          )}
          <button onClick={goNext} disabled={!canProceed(slide)}
            style={{ flex: 1, padding: '15px', borderRadius: 14, border: 'none', background: canProceed(slide) ? '#4338CA' : '#E8EAF0', color: canProceed(slide) ? '#fff' : '#AAA', fontSize: 15, fontWeight: 700, cursor: canProceed(slide) ? 'pointer' : 'not-allowed', fontFamily: 'inherit', transition: 'all .2s' }}>
            {current >= flow.slides.length - 1
              ? '✓ Hoàn thành bài học'
              : slide.type === 'action'
                ? (slide.buttonText || '✓ Tôi đã làm xong')
                : (slide.buttonText || 'Tiếp tục →')}
          </button>
        </div>
      </div>
    </div>
  )
}
