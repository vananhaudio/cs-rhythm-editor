// ── Migrate 11 bài Nhập Môn (elearn) → engine Flow ───────────────────────────
// Teacher-only, chạy 1 lần. HIỆN BẢNG MAP cho thầy duyệt TRƯỚC khi ghi.
// Build slides từ data.ts (ưu tiên nội dung đã soạn ở elearn_lessons nếu có).
import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { LESSONS, getLesson } from './elearn/data'

const ELEARN_URL = '/lessons/khoi-dau-dam-me.html'
const COURSE_SLUG = 'khoi-dau-dam-me'

interface Slide { id: string; order: number; logic: string; type: string; title?: string; content?: string; mediaUrl?: string; interactive?: Record<string, unknown> }
interface Row { num: number; lessonId: string; title: string; hasFlow: boolean; slides: Slide[]; note?: string }

const C = { accent: '#4F46E5', bg: '#F4F4F5', surface: '#fff', border: '#E4E4E7', t1: '#18181B', t2: '#52525B', t3: '#A1A1AA', green: '#16A34A', amber: '#D97706' }

// Dựng slides cho 1 bài
function buildSlides(num: number, cfg: Record<string, unknown> | undefined): { slides: Slide[]; note?: string } {
  const L = num === 9 ? getLesson(9, 'fingers') : LESSONS[num]
  const goal = (cfg?.goal as string) || L.goal
  const steps = ((cfg?.steps as string[])?.length ? (cfg!.steps as string[]) : L.steps) ?? []
  const prompt = (cfg?.prompt as string) || L.prompt
  const thaoType = (cfg?.thao_type as string) || L.thao.type
  const items = ((cfg?.items as string[])?.length ? (cfg!.items as string[]) : L.thao.items) ?? []
  const yt = cfg?.youtube_id as string | undefined
  const vid = cfg?.video_url as string | undefined

  const slides: Slide[] = []
  let n = 1
  const add = (s: Omit<Slide, 'id' | 'order'>) => slides.push({ id: `m${num}_${n}`, order: n++, ...s })

  if (yt) add({ logic: 'NHAN', type: 'video', title: L.title, mediaUrl: `https://www.youtube.com/embed/${yt}` })
  else if (vid) add({ logic: 'NHAN', type: 'video', title: L.title, mediaUrl: vid })

  if (goal) add({ logic: 'NHAN', type: 'text', title: L.title, content: `🎯 ${goal}` })
  if (num === 4) add({ logic: 'NHAN', type: 'note_chart', title: 'Tên 6 dây ↔ nốt', interactive: {} })
  if (steps.length) add({ logic: 'NHAN', type: 'text', title: 'Các bước', content: steps.map(s => `• ${s}`).join('<br/>') })

  if (thaoType === 'neck') add({ logic: 'LAM', type: 'guitar_neck', title: prompt, interactive: { target: 1 } })
  else if (thaoType === 'tool') add({ logic: 'LAM', type: 'guitar_tool', title: prompt, interactive: { tool: 'tuner', label: 'Mở Tuner lên dây', sub: 'Lên dây chuẩn trước khi tập' } })
  else if (thaoType === 'listen8') {
    add({ logic: 'LAM', type: 'guitar_strum', title: prompt || 'Gảy lần lượt 6 dây buông', interactive: { sequence: [1, 2, 3, 4, 5, 6] } })
    add({ logic: 'LAM', type: 'guitar_ear', title: 'Luyện tai: âm này là dây nào?', interactive: { rounds: 5 } })
  } else {
    add({ logic: 'NGAM', type: 'checklist', title: prompt, interactive: { items } })
  }

  add({ logic: 'DAN', type: 'callout', title: 'Lời thầy', interactive: { variant: 'teacher' }, content: 'Tốt lắm! Cứ thong thả — vấp ở đâu, quay lại chỗ đó. 🎸' })

  const note = num === 9 ? 'Dùng biến thể "ngón tay" — thầy chỉnh thêm nếu muốn cả pick' : undefined
  return { slides, note }
}

export default function FlowMigratePage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: lsns }, { data: cfgs }, { data: flows }] = await Promise.all([
      supabase.from('edu_course_lessons').select('id,title,content').eq('content_url', ELEARN_URL),
      supabase.from('elearn_lessons').select('*').eq('course_slug', COURSE_SLUG),
      supabase.from('flows').select('id,lesson_id'),
    ])
    const cfgMap: Record<number, Record<string, unknown>> = {}
    ;(cfgs ?? []).forEach((r: Record<string, unknown>) => { cfgMap[r.lesson_num as number] = r })
    const flowLessonIds = new Set((flows ?? []).map((f: { lesson_id: string }) => f.lesson_id))

    const out: Row[] = []
    ;(lsns ?? []).forEach((l: { id: string; title: string; content: unknown }) => {
      try {
        const c = typeof l.content === 'string' ? JSON.parse(l.content) : l.content
        if (c?.elearn && c?.num) {
          const { slides, note } = buildSlides(c.num, cfgMap[c.num])
          out.push({ num: c.num, lessonId: l.id, title: l.title, hasFlow: flowLessonIds.has(l.id), slides, note })
        }
      } catch { /* bỏ qua */ }
    })
    out.sort((a, b) => a.num - b.num)
    setRows(out)
    setLoading(false)
  }

  async function runMigrate() {
    if (!confirm(`Tạo/cập nhật Flow cho ${rows.length} bài? Bài sẽ chuyển sang loại "Flow".`)) return
    setRunning(true); setLog([])
    for (const r of rows) {
      try {
        const { data: existing } = await supabase.from('flows').select('id').eq('lesson_id', r.lessonId).maybeSingle()
        const payload = { lesson_id: r.lessonId, title: r.title, reward_xp: 10, status: 'published', slides: r.slides }
        if (existing) await supabase.from('flows').update(payload).eq('id', existing.id)
        else await supabase.from('flows').insert(payload)
        await supabase.from('edu_course_lessons').update({ lesson_type: 'flow' }).eq('id', r.lessonId)
        setLog(p => [...p, `✓ Bài ${r.num}: ${r.title} — ${r.slides.length} slide`])
      } catch (e: unknown) {
        setLog(p => [...p, `✗ Bài ${r.num}: LỖI — ${e instanceof Error ? e.message : String(e)}`])
      }
    }
    setRunning(false); setDone(true)
    load()
  }

  if (loading) return <div style={{ padding: 40, fontFamily: 'system-ui', color: C.t3 }}>Đang tải 11 bài…</div>

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: '"Inter", system-ui, sans-serif', color: C.t1, padding: '28px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <button onClick={() => window.location.href = '/admin'} style={{ border: `1px solid ${C.border}`, background: '#fff', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>← Admin</button>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Migrate 11 bài Nhập Môn → Flow</div>
        </div>
        <div style={{ fontSize: 14.5, color: C.t2, lineHeight: 1.6, marginBottom: 18 }}>
          Duyệt bảng dưới trước. Bấm "Chạy migrate" sẽ tạo Flow cho từng bài (dựng từ nội dung hiện có) và chuyển loại bài sang <b>Flow</b>. Nội dung elearn cũ vẫn giữ làm dự phòng — có thể đảo lại bằng cách đổi loại bài về "Link".
        </div>

        {rows.some(r => r.hasFlow) && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, color: '#92400E', marginBottom: 14 }}>
            ⚠️ Một số bài ĐÃ có Flow — chạy lại sẽ <b>ghi đè</b> bằng bản dựng mới (cập nhật, không tạo trùng).
          </div>
        )}

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 18 }}>
          {rows.map((r, i) => (
            <div key={r.lessonId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: C.accent, color: '#fff', fontSize: 13.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{r.num}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                <div style={{ fontSize: 12.5, color: C.t3 }}>
                  {r.slides.length} slide ({r.slides.map(s => s.type).join(', ')})
                  {r.note && <span style={{ color: C.amber }}> · {r.note}</span>}
                </div>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: r.hasFlow ? C.amber : C.t3, flexShrink: 0 }}>{r.hasFlow ? 'đã có Flow' : 'mới'}</div>
            </div>
          ))}
        </div>

        {!done ? (
          <button onClick={runMigrate} disabled={running}
            style={{ width: '100%', padding: 14, border: 'none', borderRadius: 12, background: running ? '#C7D2FE' : C.accent, color: '#fff', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: running ? 'default' : 'pointer' }}>
            {running ? 'Đang chạy…' : `🚀 Chạy migrate ${rows.length} bài`}
          </button>
        ) : (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 16, textAlign: 'center', color: C.green, fontWeight: 700 }}>
            ✓ Xong! 11 bài giờ chạy trên engine Flow. Vào app học viên kiểm tra nhé.
          </div>
        )}

        {log.length > 0 && (
          <div style={{ marginTop: 16, background: '#0B1020', borderRadius: 12, padding: 14, fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#C8D2E0', lineHeight: 1.7 }}>
            {log.map((l, i) => <div key={i} style={{ color: l.startsWith('✗') ? '#FCA5A5' : '#86EFAC' }}>{l}</div>)}
          </div>
        )}
      </div>
    </div>
  )
}
