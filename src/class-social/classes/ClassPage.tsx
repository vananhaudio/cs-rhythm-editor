// /me/classes/<id> — CLASS UX V3 · TRANG HỌC CỦA LỚP (không phải Social). Con đường cố định (lần đầu = lần thứ 20):
//   A. Tên lớp + lịch (nếu có) — không lặp tên khoá / mã / sĩ số
//   B. MỤC LỤC SỐNG ↔ BÀI TRẢ CỦA TÔI
//        • vùng nội dung rộng (desktop): master-detail — mục lục trái (~62%) · "Bài trả của tôi" phải (~38%)
//        • vùng hẹp (mobile / tablet hẹp): một cột, bấm "1/3 bài trả Đạt" bung tại chỗ
//        • lớp không có bài trả (chế độ giáo trình / không giáo trình): KHÔNG master-detail giả
//   C. Cánh cửa nhẹ "Không gian lớp" (/me/classes/<id>/space) — Feed của lớp + Thành viên ở đó, không preview ở đây
// Không tab, không "Tiếp tục học", không card "Đang học", không tự cuộn. Quyền do server quyết; trang chỉ ĐỌC + trình bày.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import '../../learning-thread/styles'
import { currentSessionNo } from '../../classLearning/progress'
import { fetchLearningEntry, type LearningEntry } from './classesApi'
import type { ClassCard } from './classModel'
import ClassMap, { NoMapNote } from './ClassMap'
import { ClassSpaceDoor } from './ClassParts'
import SubmissionsPanel from './SubmissionsPanel'
import { rememberCheckpointFocus, useClassLearning } from './useClassLearning'

/** Vùng nội dung tối thiểu cho master-detail (px) — dưới mức này giữ một cột (mobile, tablet, desktop hẹp). */
const MASTER_DETAIL_MIN = 900

function useWide(min: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [wide, setWide] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current?.parentElement
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setWide(e.contentRect.width >= min))
    ro.observe(el)
    return () => ro.disconnect()
  }, [min])
  return { ref, wide }
}

export default function ClassPage({ classId, isTeacher = false, onOpenThread, onOpenClasses, onOpenSession, onOpenSpace }: {
  classId: string
  /** Bấm một buổi → Trang Buổi (/me/classes/<id>/sessions/<n>) */
  onOpenSession: (sessionNo: number) => void
  /** Thầy/admin: xem trước (đọc giáo trình nhờ RLS teacher có sẵn) — không cần là học viên lớp */
  isTeacher?: boolean
  onOpenThread: (id: string) => void
  onOpenClasses: () => void
  /** Không gian lớp (/me/classes/<id>/space) */
  onOpenSpace: () => void
}) {
  const { detail, learn, loading } = useClassLearning(classId, isTeacher)
  const c: ClassCard | null = detail.status === 'ready' ? detail.value : null
  useEffect(() => { if (c?.name) document.title = `${c.name} · Thầy Văn Anh Guitar` }, [c?.name])
  const serverNow = learn?.serverNow ?? null
  const now = useMemo(() => (serverNow ? new Date(serverNow) : new Date()), [serverNow])
  const current = learn ? currentSessionNo(learn, now) : null
  const openSession = (no: number, checkpointId?: string) => {
    if (checkpointId) rememberCheckpointFocus(classId, no, checkpointId)
    onOpenSession(no)
  }

  // Master-detail chỉ khi THẬT có bài trả để diễn giải + vùng đủ rộng
  const hasSubmissions = !!learn && learn.mode === 'checkpoint' && learn.sessions.some(s => s.checkpoints.length > 0)
  const { ref, wide } = useWide(MASTER_DETAIL_MIN)
  const side = wide && hasSubmissions
  const [picked, setPicked] = useState<number | null>(null)
  const firstWithSubs = learn?.sessions.find(s => s.checkpoints.length > 0)?.no ?? null
  const currentHasSubs = current != null && !!learn?.sessions.find(s => s.no === current)?.checkpoints.length
  const selected = picked ?? (currentHasSubs ? current : firstWithSubs)

  // B dự phòng: lớp không có bản đồ giáo trình → hỏi server khoá chính / quyền (chỉ thành viên/Thầy)
  const member = !!c && (c.isMember || isTeacher)
  const [entry, setEntry] = useState<LearningEntry | null | 'loading'>('loading')
  useEffect(() => {
    if (loading || learn || !member) return
    let alive = true
    void fetchLearningEntry(classId).then(r => { if (alive) setEntry(r.ok ? r.value : null) })
    return () => { alive = false }
  }, [loading, learn, member, classId])

  const back = <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-profile-back" onClick={onOpenClasses}><ArrowLeft size={16} /> Lớp của tôi</button>
  const shell = (body: ReactNode) => <div ref={ref} className={'cs-home cs-classv2 cs-classv3' + (side ? ' is-wide' : ' cs-col')}>{body}</div>
  if (detail.status === 'loading' || (loading && !learn)) return shell(<>{back}<p className="cs-loading" role="status">Đang mở lớp…</p></>)
  if (detail.status === 'error' && !learn) return shell(<>{back}<div className="cs-card cs-feed-error" role="alert"><p>{detail.message}</p></div></>)

  const name = learn?.className ?? c?.name ?? 'Lớp học'
  return shell(
    <>
      {back}
      {/* A — tên lớp + lịch (thông tin thật sự hữu ích); không lặp tên khoá / Thầy / mã */}
      <header className="cs-classv2-head">
        <h1 className="cs-class-name">{name}</h1>
        {c?.schedule && <p className="cs-classv2-meta">{c.schedule}</p>}
        {c && !c.isMember && !isTeacher && <p className="cs-classv2-meta">Bạn đang xem lớp này — bạn chưa tham gia.</p>}
        {learn?.role === 'teacher' && <p className="cs-classv2-meta">Giáo viên xem trước: mọi buổi đều mở.</p>}
      </header>

      {/* B — MỤC LỤC SỐNG ↔ BÀI TRẢ CỦA TÔI */}
      <div className={side ? 'cs-learnmap is-split' : 'cs-learnmap'}>
        <section className="cs-classv2-sec cs-learnmap-main" aria-labelledby="cs-map-title">
          <h2 id="cs-map-title" className="cs-classv2-h2">Mục lục</h2>
          {learn
            ? <ClassMap state={learn} current={current} onOpenSession={openSession} onOpenThread={onOpenThread}
                layout={side ? 'side' : 'inline'} selected={selected} onSelect={setPicked} />
            : <NoMapNote entry={entry} isMember={member} />}
        </section>
        {side && learn && (
          <div className="cs-classv2-sec cs-learnmap-side">
            <SubmissionsPanel state={learn} sessionNo={selected} onOpenSession={openSession} onOpenThread={onOpenThread} />
          </div>
        )}
      </div>

      {/* C — cánh cửa Không gian lớp (Feed + Thành viên ở trang riêng) */}
      {c && <ClassSpaceDoor onOpen={onOpenSpace} />}
    </>
  )
}
