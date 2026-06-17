import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

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
}

export default function FlowPlayer({ lessonId, studentId, onComplete, onBack, fullScreen, previewFlow }: Props) {
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
          // Nếu đã hoàn thành trước đó → bắt đầu lại từ slide 1
          if (data.finished_at) {
            setCurrent(0)
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
    return true
  }

  // ── Container style — fullScreen tự dùng position:fixed để tránh bug iOS WebKit ──────
  const containerStyle = fullScreen
    ? {
        position: 'fixed' as const,
        top: 0 as number | string, left: 0 as number | string,
        right: 0 as number | string, bottom: 0 as number | string,
        background: '#fff', zIndex: 100,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
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
    <div style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', gap: 16 }}>
      <div style={{ fontSize: 64 }}>🎉</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#4338CA' }}>Hoàn thành!</div>
      <div style={{ fontSize: 15, color: '#555' }}>{flow.title}</div>
      {flow.reward_xp > 0 && (
        <div style={{ background: '#FFF7ED', color: '#D97706', borderRadius: 99, padding: '8px 24px', fontWeight: 700, fontSize: 16 }}>
          +{flow.reward_xp} XP 🔥
        </div>
      )}
      <button onClick={onBack}
        style={{ marginTop: 8, padding: '14px 36px', borderRadius: 14, border: 'none', background: '#4338CA', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        ← Quay lại danh sách bài
      </button>
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

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #F0F0F2', flexShrink: 0 }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888', padding: '2px 8px 2px 0', lineHeight: 1 }}>
          ←
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: lm.bg, color: lm.color, borderRadius: 99, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>
            {lm.label}
          </span>
          <span style={{ fontSize: 12, color: '#AAA' }}>{current + 1} / {flow.slides.length}</span>
        </div>
      </div>

      {/* Slide body — cuộn NỘI BỘ nếu nội dung dài, nút bấm luôn hiển thị */}
      <div
        key={current}
        className={slideDir.current === 'next' ? '_fsNext' : '_fsPrev'}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '24px 16px 12px' }}>

        {slide.title && (
          <div style={{ fontSize: 18, fontWeight: 700, color: '#18181B', lineHeight: 1.45, marginBottom: 16 }}>
            {slide.title}
          </div>
        )}

        {/* TEXT / NEXT */}
        {(slide.type === 'text' || slide.type === 'next') && slide.content && (
          <div style={{ fontSize: 15, color: '#333', lineHeight: 1.9 }}
            dangerouslySetInnerHTML={{ __html: slide.content }} />
        )}

        {/* VIDEO */}
        {slide.type === 'video' && slide.mediaUrl && (
          <div style={{ borderRadius: 12, overflow: 'hidden', aspectRatio: '16/9', background: '#000', marginBottom: 8 }}>
            <iframe src={slide.mediaUrl} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen title={slide.title} />
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
      </div>

      {/* Bottom actions — flexShrink:0 đảm bảo nút LUÔN hiển thị dù nội dung dài */}
      <div style={{ padding: '12px 16px 28px', borderTop: '1px solid #F0F0F2', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
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
