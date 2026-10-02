// Harness E2E (CHỈ `npm run dev` + stack local — scripts/e2e-learning-thread.sh). KHÔNG nằm trong build production.
// Gắn đúng component App học dùng trong MobileStudentPortal (LessonThreadPanel) cho các bài ?lessons=…,
// đăng nhập người dùng ?as=<email> qua auth giả lập của stack local.
import { createRoot } from 'react-dom/client'
import { supabase } from '../../src/supabase'
import LessonThreadPanel from '../../src/learning-thread/LessonThreadPanel'
import MyClassesSection from '../../src/classLearning/MyClassesSection'
import ClassCurriculumAdminView from '../../src/admin/ClassCurriculumAdminView'
import ScheduleManager from '../../src/ScheduleManager'

const q = new URLSearchParams(location.search)
const lessons = (q.get('lessons') ?? '').split(',').filter(Boolean)
;(window as unknown as { __sb: typeof supabase }).__sb = supabase

async function main() {
  const email = q.get('as')
  if (email) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: 'e2e' })
    if (error) throw error
  }
  createRoot(document.getElementById('root')!).render(
    <div style={{ maxWidth: q.get('admin') ? 1100 : 520, margin: '0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ?classes=1 → App "Lớp đang học" (component thật của MobileStudentPortal) · ?admin=classes|schedule → màn Admin thật */}
      {q.get('classes') && <div data-app-classes><MyClassesSection guest={false} onOpen={() => {}} /></div>}
      {q.get('admin') === 'classes' && <div data-admin-classes style={{ display: 'flex', minHeight: 600 }}><ClassCurriculumAdminView client={supabase} /></div>}
      {q.get('admin') === 'schedule' && <div data-admin-schedule><ScheduleManager /></div>}
      {lessons.map(id => (
        <div key={id} data-lesson={id} style={{ background: '#fff', borderRadius: 16, padding: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Bài {id.slice(-2)}</div>
          <LessonThreadPanel lessonId={id} lessonTitle={`Bài ${id.slice(-2)}`} />
        </div>
      ))}
      <div id="ready">ready</div>
    </div>,
  )
}
void main()
