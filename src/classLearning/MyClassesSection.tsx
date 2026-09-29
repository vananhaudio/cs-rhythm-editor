// ── HỌC → "Lớp đang học": danh sách lớp trực tiếp của học viên (tách khỏi Khóa học số) ──
// Chỉ hiện khi có membership active. Giáo trình từng buổi do RLS quyết khi mở lớp.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { fetchMyClasses } from './api'
import type { ClassRow } from './outline'
import { CL } from './theme'

export default function MyClassesSection({ guest, onOpen }: { guest: boolean; onOpen: (cls: ClassRow) => void }) {
  const [classes, setClasses] = useState<ClassRow[] | null>(null)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (guest) return
    let cancelled = false
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const rows = session?.user ? await fetchMyClasses(supabase, session.user.id) : []
        if (!cancelled) { setClasses(rows); setError(false) }
      } catch {
        if (!cancelled) { setError(true); setClasses([]) }
      }
    })()
    return () => { cancelled = true }
  }, [guest, tick])

  if (guest) return null
  if (error) {
    return <div style={{ margin: '4px 18px 14px', padding: '12px 14px', borderRadius: 16, background: CL.surface, color: CL.t2, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: 1 }}>Chưa tải được Lớp đang học.</span>
      <button onClick={() => setTick(t => t + 1)} style={{ border: 'none', background: CL.a2, color: CL.a1, fontWeight: 800, borderRadius: 10, padding: '7px 12px', cursor: 'pointer' }}>Thử lại</button>
    </div>
  }
  if (!classes || classes.length === 0) return null

  return <div style={{ padding: '4px 18px 6px' }}>
    <div style={{ fontSize: 12, fontWeight: 900, color: CL.a1, letterSpacing: '.06em', margin: '6px 2px 10px' }}>🎓 LỚP ĐANG HỌC</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {classes.map(c => <button key={c.id} onClick={() => onOpen(c)} style={{
        textAlign: 'left', border: `1.5px solid ${CL.a1}33`, background: CL.surface, borderRadius: 20, padding: '14px 16px',
        boxShadow: CL.shadow, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit',
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: CL.a2, display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>🎸</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: CL.t1, lineHeight: 1.25 }}>{c.name}</div>
          <div style={{ fontSize: 12.5, color: CL.t2, marginTop: 3 }}>Lớp trực tiếp · {c.code}</div>
        </div>
        <div style={{ color: CL.a1, fontWeight: 900, fontSize: 13 }}>Giáo trình ›</div>
      </button>)}
    </div>
    <div style={{ fontSize: 12, fontWeight: 900, color: CL.t3, letterSpacing: '.06em', margin: '18px 2px 0' }}>KHÓA HỌC</div>
  </div>
}
