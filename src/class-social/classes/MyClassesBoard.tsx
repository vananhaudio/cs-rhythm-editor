// LỚP CỦA TÔI — mỗi lớp ĐANG THAM GIA là một dashboard nhỏ, trả lời ngay: học lớp nào · đang ở buổi nào · lớp vừa có gì.
// Nguồn (không nguồn mới): social_my_classes (danh sách) · useClassLearning (buổi hiện tại) · social_class_activity (hoạt động).
// Lớp chưa tham gia KHÔNG hiện ở đây — chỉ một lối "Khám phá các lớp khác →".
import { useMemo } from 'react'
import { ArrowRight, Compass, GraduationCap } from 'lucide-react'
import { EmptyState } from '../ui'
import { classMetaLine, type ClassCard } from './classModel'
import type { SocialClasses } from './useSocialClasses'
import { useClassLearning } from './useClassLearning'
import { CurrentSessionBlock } from './LearnParts'
import { ClassRecentList } from './ClassActivity'

const BOARD_ACTIVITY = 3

export type MyClassesActions = {
  isTeacher: boolean
  onOpenClass: (classId: string) => void
  onOpenSession: (classId: string, sessionNo: number) => void
  onOpenThread: (threadId: string) => void
  onOpenDiscover: () => void
}

export function MyClassCard({ c, isTeacher, onOpenClass, onOpenSession, onOpenThread }: { c: ClassCard } & Omit<MyClassesActions, 'onOpenDiscover'>) {
  const { learn, loading } = useClassLearning(c.id, isTeacher)
  const now = useMemo(() => (learn?.serverNow ? new Date(learn.serverNow) : new Date()), [learn?.serverNow])
  const meta = classMetaLine(c)
  return (
    <article className="cs-card cs-myclass" aria-label={c.name}>
      <header className="cs-myclass-head">
        <h2 className="cs-myclass-name">{c.name}</h2>
        {meta && <span className="cs-myclass-meta">{meta}</span>}
      </header>
      {learn
        ? <CurrentSessionBlock state={learn} now={now} compact onOpenSession={no => onOpenSession(c.id, no)} />
        : loading && <p className="cs-act-note" role="status">Đang tải tiến độ…</p>}
      <section className="cs-myclass-act" aria-label={`Hoạt động mới của ${c.name}`}>
        <h3 className="cs-myclass-sub">Hoạt động mới</h3>
        <ClassRecentList classId={c.id} limit={BOARD_ACTIVITY} onOpenThread={onOpenThread} />
      </section>
      <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-myclass-enter" onClick={() => onOpenClass(c.id)}>
        Vào lớp <ArrowRight size={16} />
      </button>
    </article>
  )
}

export default function MyClassesBoard({ classes, ...act }: { classes: SocialClasses } & MyClassesActions) {
  return (
    <div className="cs-myclasses">
      {!classes.loaded && <p className="cs-loading" role="status">Đang tải lớp học…</p>}
      {classes.loaded && classes.error && classes.mine.length === 0 && <p className="cs-form-error" role="alert">{classes.error}</p>}
      {classes.loaded && !classes.error && classes.mine.length === 0 && (
        <EmptyState icon={GraduationCap} title="Bạn chưa ở trong lớp nào" quiet>Nhập mã lớp Thầy gửi ở “Khám phá các lớp khác”, hoặc chờ Thầy xếp bạn vào lớp.</EmptyState>
      )}
      {classes.mine.map(c => (
        <MyClassCard key={c.id} c={c} isTeacher={act.isTeacher} onOpenClass={act.onOpenClass} onOpenSession={act.onOpenSession} onOpenThread={act.onOpenThread} />
      ))}
      {classes.loaded && (
        <button type="button" className="cs-btn cs-btn-ghost cs-myclasses-discover" onClick={act.onOpenDiscover}>
          <Compass size={17} aria-hidden="true" /> Khám phá các lớp khác <ArrowRight size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
