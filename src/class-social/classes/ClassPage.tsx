// /me/classes/<id> — CLASS PAGE V2 · "BẢN ĐỒ SỐNG CỦA LỚP". MỘT trang cuộn dọc, con đường cố định (lần đầu = lần thứ 20):
//   A. Tên lớp + một dòng thông tin gọn
//   B. MỤC LỤC SỐNG — học + trả bài trên cùng bản đồ (ClassMap); bấm TÊN BUỔI → Trang Buổi sẵn có
//   C. LỚP MÌNH ĐANG HỌC — hoạt động học tập thật của lớp (social_class_activity), chạy tự nhiên xuống dưới
//   D. Thành viên — một dòng nhẹ cuối trang, bấm mới mở danh sách (kết bạn / quyền riêng tư giữ nguyên)
// Không tab, không "Tiếp tục học", không card "Đang học", không "Hoạt động gần đây" tóm tắt, không tự cuộn.
// Quyền do server quyết (RPC social_* / class_learning_state / RLS giáo trình); trang chỉ ĐỌC và trình bày.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import '../../learning-thread/styles'
import { respondFriendRequest, sendFriendRequest } from '../friends/friendsApi'
import { programKeyOfClass } from '../identity/learningIdentity'
import { isThreadEntry } from '../posts/postModel'
import { usePostsFeed } from '../posts/usePostsFeed'
import { currentSessionNo } from '../../classLearning/progress'
import { fetchClassActivityPage, fetchClassMembers, fetchLearningEntry, type LearningEntry } from './classesApi'
import { classMetaLine, type ClassCard, type ClassMember } from './classModel'
import { MemberList } from './ClassParts'
import ClassMap, { NoMapNote } from './ClassMap'
import { ActivityLine } from './ClassActivity'
import { rememberCheckpointFocus, useClassLearning, type Load } from './useClassLearning'

export default function ClassPage({ classId, isTeacher = false, onOpenThread, onOpenProfile, onOpenClasses, onOpenSession }: {
  classId: string
  /** Bấm một buổi → Trang Buổi (/me/classes/<id>/sessions/<n>) */
  onOpenSession: (sessionNo: number) => void
  /** Thầy/admin: xem trước (đọc giáo trình nhờ RLS teacher có sẵn) — không cần là học viên lớp */
  isTeacher?: boolean
  onOpenThread: (id: string) => void
  onOpenProfile: (userId: string) => void
  onOpenClasses: () => void
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

  // B dự phòng: lớp không có bản đồ giáo trình → hỏi server khoá chính / quyền (chỉ thành viên/Thầy)
  const member = !!c && (c.isMember || isTeacher)
  const [entry, setEntry] = useState<LearningEntry | null | 'loading'>('loading')
  useEffect(() => {
    if (loading || learn || !member) return
    let alive = true
    void fetchLearningEntry(classId).then(r => { if (alive) setEntry(r.ok ? r.value : null) })
    return () => { alive = false }
  }, [loading, learn, member, classId])

  // C: hoạt động học tập thật của lớp (Learning Thread: trả bài / hỏi bài / Thầy phản hồi / Đạt / làm lại)
  const fetchPage = useCallback((cur?: { createdAt: string; id: string; key: string }) => fetchClassActivityPage(classId, cur), [classId])
  const { state: feed, loadMore } = usePostsFeed(fetchPage)
  const feedNow = useMemo(() => new Date(), [])
  const items = feed.status === 'ready' ? feed.posts.filter(isThreadEntry) : []

  // D: thành viên — chỉ tải khi mở
  const [showMembers, setShowMembers] = useState(false)
  const [members, setMembers] = useState<Load<ClassMember[]> | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actError, setActError] = useState<string | null>(null)
  // quyền xem danh sách do SERVER quyết (social_class_detail.can_view_members)
  const canViewMembers = !!c && c.canViewMembers
  useEffect(() => {
    if (!showMembers || !canViewMembers || members) return
    let alive = true
    void fetchClassMembers(classId).then(r => { if (alive) setMembers(r.ok ? { status: 'ready', value: r.value } : { status: 'error', message: r.message }) })
    return () => { alive = false }
  }, [showMembers, canViewMembers, members, classId])
  const act = async (m: ClassMember, action: 'send' | 'accept') => {
    setBusyId(m.userId); setActError(null)
    const r = action === 'send' ? await sendFriendRequest(m.userId) : await respondFriendRequest(m.userId, true)
    setBusyId(null)
    if (!r.ok) { setActError(r.message); return }
    setMembers(cur => cur && cur.status === 'ready'
      ? { status: 'ready', value: cur.value.map(x => (x.userId === m.userId ? { ...x, relationship: r.value } : x)) } : cur)
  }

  const back = <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-profile-back" onClick={onOpenClasses}><ArrowLeft size={16} /> Lớp của tôi</button>
  if (detail.status === 'loading' || (loading && !learn)) return <div className="cs-col cs-home cs-classv2">{back}<p className="cs-loading" role="status">Đang mở lớp…</p></div>
  if (detail.status === 'error' && !learn) return <div className="cs-col cs-home cs-classv2">{back}<div className="cs-card cs-feed-error" role="alert"><p>{detail.message}</p></div></div>

  const name = learn?.className ?? c?.name ?? 'Lớp học'
  const meta = c ? classMetaLine(c) : ''
  const teacherNames = c?.teachers.map(t => t.name).join(', ')
  return (
    <div className="cs-col cs-home cs-classv2">
      {back}
      {/* A — tên lớp + MỘT dòng gọn */}
      <header className="cs-classv2-head">
        <h1 className="cs-class-name">{name}</h1>
        {(meta || teacherNames) && <p className="cs-classv2-meta">{[meta, teacherNames ? `Thầy ${teacherNames.replace(/^Thầy\s+/u, '')}` : ''].filter(Boolean).join(' · ')}</p>}
        {c && !c.isMember && !isTeacher && <p className="cs-classv2-meta">Bạn đang xem lớp này — bạn chưa tham gia.</p>}
        {learn?.role === 'teacher' && <p className="cs-classv2-meta">Giáo viên xem trước: mọi buổi đều mở.</p>}
      </header>

      {/* B — MỤC LỤC SỐNG */}
      <section className="cs-classv2-sec" aria-labelledby="cs-map-title">
        <h2 id="cs-map-title" className="cs-classv2-h2">Mục lục</h2>
        {learn
          ? <ClassMap state={learn} current={current} onOpenSession={openSession} onOpenThread={onOpenThread} />
          : <NoMapNote entry={entry} isMember={member} />}
      </section>

      {/* C — LỚP MÌNH ĐANG HỌC */}
      <section className="cs-classv2-sec" aria-labelledby="cs-feed-title" aria-busy={feed.status === 'loading'}>
        <h2 id="cs-feed-title" className="cs-classv2-h2">Lớp mình đang học</h2>
        {feed.status === 'loading' && <p className="cs-act-note" role="status">Đang tải…</p>}
        {feed.status === 'error' && <p className="cs-act-note" role="alert">{feed.message}</p>}
        {feed.status === 'ready' && items.length === 0 && <p className="cs-act-note">Chưa có bài trả hay câu hỏi nào trong lớp.</p>}
        {items.length > 0 && (
          <ul className="cs-act-list cs-classv2-feed">
            {items.map(p => isThreadEntry(p) && <ActivityLine key={p.id} card={p.card} now={feedNow} onOpenThread={onOpenThread} />)}
          </ul>
        )}
        {feed.status === 'ready' && feed.hasMore && (
          <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-classv2-more" onClick={() => void loadMore()} disabled={feed.loadingMore}>
            {feed.loadingMore ? 'Đang tải…' : 'Xem thêm'}</button>
        )}
      </section>

      {/* D — THÀNH VIÊN (nhẹ, cuối trang) */}
      {c && (
        <section className="cs-classv2-sec cs-classv2-members" aria-label="Thành viên lớp">
          {canViewMembers
            ? <button type="button" className="cs-classv2-members-toggle" aria-expanded={showMembers} onClick={() => setShowMembers(x => !x)}>
                Lớp mình · {c.memberCount} thành viên {showMembers ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
              </button>
            : <p className="cs-act-note">Lớp có {c.memberCount} học viên · danh sách chỉ hiện với thành viên của lớp.</p>}
          {showMembers && canViewMembers && (
            !members || members.status === 'loading' ? <p className="cs-act-note" role="status">Đang tải thành viên…</p>
            : members.status === 'error' ? <p className="cs-act-note" role="alert">{members.message}</p>
            : <>
                {actError && <p className="cs-form-error" role="alert">{actError}</p>}
                <MemberList members={members.value} busyId={busyId} onAct={(m, a) => void act(m, a)} onOpenProfile={onOpenProfile}
                  excludeIdentity={programKeyOfClass(c)} />
              </>
          )}
        </section>
      )}
    </div>
  )
}
