// Trang lớp — khối "HỌC": lớp là cửa vào học. Trỏ vào route học SẴN CÓ (/course?id= — LessonViewerPage, Trả/Hỏi bài
// bằng Learning Thread trong bài) — không có giáo trình hay hệ trả bài thứ hai. Quyền học do server (class_learning_entry
// → has_course_access); Giáo trình lớp (class_curriculum_access) báo RIÊNG, không coi là thành viên.
import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { fetchLearningEntry, type LearningEntry } from './classesApi'

export default function ClassLearnEntry({ classId, onOpenCurriculum }: { classId: string; onOpenCurriculum?: () => void }) {
  const [entry, setEntry] = useState<LearningEntry | null>(null)
  useEffect(() => {
    let alive = true
    void fetchLearningEntry(classId).then(r => { if (alive && r.ok) setEntry(r.value) })
    return () => { alive = false }
  }, [classId])
  if (!entry) return null
  const { course, curriculum } = entry
  return (
    <section className="cs-card cs-class-learn" aria-labelledby="cs-class-learn-title">
      <h2 id="cs-class-learn-title"><BookOpen size={17} aria-hidden="true" style={{ verticalAlign: '-3px' }} /> Học</h2>
      {course && (
        <div className="cs-class-learn-row">
          <span style={{ flex: 1, minWidth: 0 }}><b>{course.name}</b>{course.code ? ` · ${course.code}` : ''}</span>
          {course.hasAccess
            ? <a className="cs-btn cs-btn-primary cs-btn-sm" href={`/course?id=${encodeURIComponent(course.id)}`}>Tiếp tục học</a>
            : <span className="cs-section-hint" style={{ margin: 0 }}>Khoá học của lớp chưa mở cho bạn — Thầy sẽ mở khi lớp bắt đầu.</span>}
        </div>
      )}
      {curriculum.published && (curriculum.hasAccess
        ? onOpenCurriculum && <button type="button" className="cs-btn cs-btn-soft cs-btn-sm" onClick={onOpenCurriculum}>Mở Giáo trình lớp</button>
        : <p>Giáo trình lớp chưa bật cho bạn. Thầy bật khi lớp vào chặng học.</p>)}
      {!course && !curriculum.published && <p>Lớp chưa gắn khoá học hay giáo trình — Thầy sẽ cập nhật tại đây.</p>}
      <p>Trả bài / Hỏi bài: làm ngay trong bài học. Bài của cả lớp hiện ở tab Hoạt động.</p>
    </section>
  )
}
