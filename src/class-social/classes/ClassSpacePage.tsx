// /me/classes/<id>/space — KHÔNG GIAN LỚP (Class UX V3): Social của ĐÚNG MỘT lớp, tách khỏi trang học.
// Hoạt động = social_class_activity (Learning Thread của lớp: trả bài / hỏi bài / Thầy phản hồi / Đạt / làm lại),
// dòng gọn ActivityLine (không lặp tên lớp) · Thành viên = social_class_members + MemberList (kết bạn, quyền riêng tư
// giữ nguyên — server quyết can_view_members). Không hệ Social mới. "← <tên lớp>" về đúng trang học của lớp.
// Hai phạm vi rõ: Home → tab "Lớp" = hoạt động mọi lớp của tôi · Lớp → Không gian lớp = hoạt động của một lớp.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import '../../learning-thread/styles'
import { respondFriendRequest, sendFriendRequest } from '../friends/friendsApi'
import { programKeyOfClass } from '../identity/learningIdentity'
import { isThreadEntry } from '../posts/postModel'
import { usePostsFeed } from '../posts/usePostsFeed'
import { fetchClassActivityPage, fetchClassDetail, fetchClassMembers } from './classesApi'
import type { ClassCard, ClassMember } from './classModel'
import { MemberList } from './ClassParts'
import { ActivityLine } from './ClassActivity'
import type { Load } from './useClassLearning'

export default function ClassSpacePage({ classId, onBackToClass, onOpenThread, onOpenProfile }: {
  classId: string
  /** "← <tên lớp>": về trang học của lớp (lịch sử trong /me nếu có, ngược lại mở trang lớp) */
  onBackToClass: () => void
  onOpenThread: (id: string) => void
  onOpenProfile: (userId: string) => void
}) {
  const [detail, setDetail] = useState<Load<ClassCard>>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    void fetchClassDetail(classId).then(r => { if (alive) setDetail(r.ok ? { status: 'ready', value: r.value } : { status: 'error', message: r.message }) })
    return () => { alive = false }
  }, [classId])
  const c = detail.status === 'ready' ? detail.value : null
  useEffect(() => { if (c?.name) document.title = `Không gian lớp · ${c.name} · Thầy Văn Anh Guitar` }, [c?.name])

  const fetchPage = useCallback((cur?: { createdAt: string; id: string; key: string }) => fetchClassActivityPage(classId, cur), [classId])
  const { state: feed, loadMore } = usePostsFeed(fetchPage)
  const now = useMemo(() => new Date(), [])
  const items = feed.status === 'ready' ? feed.posts.filter(isThreadEntry) : []

  // quyền xem danh sách do SERVER quyết (social_class_detail.can_view_members)
  const canViewMembers = !!c && c.canViewMembers
  const [members, setMembers] = useState<Load<ClassMember[]> | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actError, setActError] = useState<string | null>(null)
  useEffect(() => {
    if (!canViewMembers || members) return
    let alive = true
    void fetchClassMembers(classId).then(r => { if (alive) setMembers(r.ok ? { status: 'ready', value: r.value } : { status: 'error', message: r.message }) })
    return () => { alive = false }
  }, [canViewMembers, members, classId])
  const act = async (m: ClassMember, action: 'send' | 'accept') => {
    setBusyId(m.userId); setActError(null)
    const r = action === 'send' ? await sendFriendRequest(m.userId) : await respondFriendRequest(m.userId, true)
    setBusyId(null)
    if (!r.ok) { setActError(r.message); return }
    setMembers(cur => cur && cur.status === 'ready'
      ? { status: 'ready', value: cur.value.map(x => (x.userId === m.userId ? { ...x, relationship: r.value } : x)) } : cur)
  }

  return (
    <div className="cs-col cs-home cs-classv2 cs-classspace">
      <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-profile-back cs-classspace-back" onClick={onBackToClass}>
        <ArrowLeft size={16} /> {c?.name ?? 'Về lớp'}
      </button>
      <header className="cs-classv2-head">
        <h1 className="cs-class-name">Không gian lớp</h1>
        {c && <p className="cs-classv2-meta">{c.name}</p>}
      </header>
      {detail.status === 'error' && <p className="cs-act-note" role="alert">{detail.message}</p>}

      <section className="cs-classv2-sec" aria-labelledby="cs-space-feed" aria-busy={feed.status === 'loading'}>
        <h2 id="cs-space-feed" className="cs-classv2-h2">Hoạt động</h2>
        {feed.status === 'loading' && <p className="cs-act-note" role="status">Đang tải…</p>}
        {feed.status === 'error' && <p className="cs-act-note" role="alert">{feed.message}</p>}
        {feed.status === 'ready' && items.length === 0 && <p className="cs-act-note">Chưa có bài trả hay câu hỏi nào trong lớp.</p>}
        {items.length > 0 && (
          <ul className="cs-act-list cs-classv2-feed">
            {items.map(p => isThreadEntry(p) && <ActivityLine key={p.id} card={p.card} now={now} onOpenThread={onOpenThread} />)}
          </ul>
        )}
        {feed.status === 'ready' && feed.hasMore && (
          <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-classv2-more" onClick={() => void loadMore()} disabled={feed.loadingMore}>
            {feed.loadingMore ? 'Đang tải…' : 'Xem thêm'}</button>
        )}
      </section>

      <section className="cs-classv2-sec" aria-labelledby="cs-space-members">
        <h2 id="cs-space-members" className="cs-classv2-h2">Thành viên{c ? ` · ${c.memberCount}` : ''}</h2>
        {!c ? null
          : !canViewMembers ? <p className="cs-act-note">Danh sách thành viên chỉ hiện với thành viên của lớp.</p>
          : !members || members.status === 'loading' ? <p className="cs-act-note" role="status">Đang tải thành viên…</p>
          : members.status === 'error' ? <p className="cs-act-note" role="alert">{members.message}</p>
          : <>
              {actError && <p className="cs-form-error" role="alert">{actError}</p>}
              <MemberList members={members.value} busyId={busyId} onAct={(m, a) => void act(m, a)} onOpenProfile={onOpenProfile}
                excludeIdentity={programKeyOfClass(c)} />
            </>}
      </section>
    </div>
  )
}
