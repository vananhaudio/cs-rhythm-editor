// ── Bước "Chuẩn bị xuất bản" ──
// Người kể xác nhận CÁCH HIỂN THỊ trước khi gửi Ban biên tập.
// Nguyên tắc: tái sử dụng hồ sơ học viên (edu_students + lớp qua nhóm),
// KHÔNG upload ảnh riêng, KHÔNG hỏi các thông tin này trong lúc kể.
// Tinh thần tạp chí — không phải biểu mẫu hành chính.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export type DisplayMode = 'full_name' | 'first_name' | 'pen_name' | 'anonymous'

export type PublishPrefs = {
  display_mode: DisplayMode
  author_name: string
  author_avatar_url: string | null
  class_display: string | null
  pen_name: string | null
  save_pen_name: boolean
  // ── Đôi nét về người kể (phần giới thiệu tác giả in ở cuối bài) ──
  author_full_name: string | null
  author_age: number | null
  author_hometown: string | null
  author_living_in: string | null
  author_job: string | null
  author_bio: string | null
  author_portrait_url: string | null
  consent_bio_edit: boolean
  consent_bio_publish: boolean
}

type StudentProfile = {
  id: string
  full_name: string | null
  display_name: string | null
  avatar_url: string | null
  default_pen_name: string | null
  default_display_mode: string | null
}

const ANON_LABEL = 'Một người yêu guitar'

/** Tên gọi thân mật: tiếng Việt đặt tên ở cuối ("Trần Văn Anh" → "Anh"). */
export function firstNameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : fullName.trim()
}

export function resolveAuthorName(mode: DisplayMode, fullName: string, penName: string): string {
  if (mode === 'anonymous') return ANON_LABEL
  if (mode === 'pen_name') return penName.trim() || ANON_LABEL
  if (mode === 'first_name') return firstNameOf(fullName)
  return fullName.trim()
}

export default function PublishPrep({ userId, onBack, onConfirm, busy }: {
  userId: string
  onBack: () => void
  onConfirm: (prefs: PublishPrefs) => void
  busy: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])

  const [mode, setMode] = useState<DisplayMode>('full_name')
  const [penName, setPenName] = useState('')
  const [savePen, setSavePen] = useState(false)
  const [classId, setClassId] = useState<string>('')      // '' = không hiển thị lớp
  const [okEdit, setOkEdit] = useState(false)
  const [okPublish, setOkPublish] = useState(false)

  // ── Đôi nét về người kể ──
  const [bioName, setBioName] = useState('')
  const [bioAge, setBioAge] = useState('')
  const [bioHometown, setBioHometown] = useState('')
  const [bioLivingIn, setBioLivingIn] = useState('')
  const [bioJob, setBioJob] = useState('')
  const [bioText, setBioText] = useState('')
  const [portrait, setPortrait] = useState<string | null>(null)
  const [upLoading, setUpLoading] = useState(false)
  const [upErr, setUpErr] = useState('')
  const [okBioEdit, setOkBioEdit] = useState(false)
  const [okBioPublish, setOkBioPublish] = useState(false)

  // ── Nạp hồ sơ học viên + lớp đang học (từ hệ thống, không hỏi người kể) ──
  useEffect(() => {
    let alive = true
    const load = async () => {
      const { data: stu } = await supabase.from('edu_students')
        .select('id,full_name,display_name,avatar_url,default_pen_name,default_display_mode')
        .eq('user_id', userId).maybeSingle()
      if (!alive) return
      if (stu) {
        setProfile(stu as StudentProfile)
        if (stu.default_pen_name) setPenName(stu.default_pen_name)
        const dm = stu.default_display_mode
        if (dm === 'full_name' || dm === 'first_name' || dm === 'pen_name' || dm === 'anonymous') setMode(dm)
      }
      // Chưa có hồ sơ học viên (hoặc hồ sơ chưa có tên) → không thể chọn "Họ và tên"
      if (!stu?.full_name && !stu?.display_name) setMode('pen_name')

      // Lớp: nhóm của học viên (RPC my_groups) → lớp tương ứng trong class_schedule
      try {
        const { data: groups } = await supabase.rpc('my_groups')
        const ids = (groups ?? []).map((g: { id: string }) => g.id)
        if (ids.length > 0) {
          const { data: cls } = await supabase.from('class_schedule')
            .select('id,name,group_id').in('group_id', ids)
          if (!alive) return
          const list = (cls ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
          setClasses(list)
          if (list.length === 1) setClassId(list[0].id)   // học một lớp → mặc định hiển thị
        }
      } catch { /* không lấy được lớp → chỉ ẩn phần lớp học */ }
      // Điền sẵn "Đôi nét về người kể" từ bài GẦN NHẤT của chính người này —
      // đây không phải hồ sơ, chỉ đỡ phải gõ lại; sửa thoải mái trước khi gửi.
      try {
        const { data: prev } = await supabase.from('stories')
          .select('author_full_name,author_age,author_hometown,author_living_in,author_job,author_bio,author_portrait_url')
          .eq('user_id', userId).not('author_bio', 'is', null)
          .order('updated_at', { ascending: false }).limit(1).maybeSingle()
        if (!alive) return
        if (prev) {
          setBioName(prev.author_full_name ?? '')
          setBioAge(prev.author_age != null ? String(prev.author_age) : '')
          setBioHometown(prev.author_hometown ?? '')
          setBioLivingIn(prev.author_living_in ?? '')
          setBioJob(prev.author_job ?? '')
          setBioText(prev.author_bio ?? '')
          setPortrait(prev.author_portrait_url ?? null)
        }
      } catch { /* chưa có bài nào — để trống */ }
      if (alive && !stu) { /* không có hồ sơ: bioName để người kể tự nhập */ }
      if (alive) setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [userId])

  // Chưa từng điền thì lấy tên từ hồ sơ học viên
  useEffect(() => {
    if (!loading && !bioName && profile) {
      setBioName((profile.full_name || profile.display_name || '').trim())
    }
  }, [loading, profile, bioName])

  // ── Tải ảnh chân dung (1 ảnh, thay được trước khi gửi) ──
  const pickPortrait = async (file: File | undefined) => {
    if (!file) return
    setUpErr('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUpErr('Ảnh cần ở định dạng JPG, PNG hoặc WEBP.'); return
    }
    if (file.size > 8 * 1024 * 1024) { setUpErr('Ảnh nặng quá 8MB, bạn chọn ảnh nhẹ hơn nhé.'); return }
    setUpLoading(true)
    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${userId}/portrait-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('story-photos')
        .upload(path, file, { upsert: true, cacheControl: '3600' })
      if (error) throw error
      const { data } = supabase.storage.from('story-photos').getPublicUrl(path)
      setPortrait(data.publicUrl)
    } catch (e) {
      console.error('portrait upload', e)
      setUpErr('Chưa tải được ảnh lên. Bạn thử lại nhé.')
    } finally { setUpLoading(false) }
  }

  const fullName = (profile?.full_name || profile?.display_name || '').trim()
  const preview = resolveAuthorName(mode, fullName, penName)
  const chosenClass = classes.find(c => c.id === classId) ?? null
  const showAvatar = mode !== 'anonymous'
  const canSend = okEdit && okPublish && okBioEdit && okBioPublish && !busy && !upLoading &&
    (mode !== 'pen_name' || penName.trim().length > 0)

  const submit = () => {
    if (!canSend) return
    onConfirm({
      display_mode: mode,
      author_name: preview,
      author_avatar_url: showAvatar ? (profile?.avatar_url ?? null) : null,
      class_display: chosenClass ? chosenClass.name : null,
      pen_name: mode === 'pen_name' ? penName.trim() : null,
      save_pen_name: mode === 'pen_name' && savePen && penName.trim().length > 0,
      author_full_name: bioName.trim() || null,
      author_age: bioAge.trim() ? Number(bioAge.trim()) : null,
      author_hometown: bioHometown.trim() || null,
      author_living_in: bioLivingIn.trim() || null,
      author_job: bioJob.trim() || null,
      author_bio: bioText.trim() || null,
      author_portrait_url: portrait,
      consent_bio_edit: okBioEdit,
      consent_bio_publish: okBioPublish,
    })
  }

  if (loading) {
    return <div className="pp-wrap"><div className="pp-loading">Đang mở hồ sơ của bạn…</div></div>
  }

  return (
    <div className="pp-wrap">
      <div className="pp-head">
        <div className="pp-eyebrow">Chuẩn bị xuất bản</div>
        <h2>Câu chuyện sẽ xuất hiện thế nào?</h2>
        <p>Bạn chọn cách hiển thị tên và thông tin của mình. Câu chuyện vẫn giữ nguyên như bạn đã kể.</p>
      </div>

      {/* ── Khối xem trước: đúng như dòng tên sẽ in trên tạp chí ── */}
      <div className="pp-preview">
        <div className="pp-byline">
          {showAvatar && (
            profile?.avatar_url
              ? <img className="pp-avatar" src={profile.avatar_url} alt="" />
              : <div className="pp-avatar pp-avatar-empty" aria-hidden="true">🎸</div>
          )}
          <div>
            <div className="pp-name">{preview || '—'}</div>
            {chosenClass && <div className="pp-class">Học viên lớp {chosenClass.name}</div>}
          </div>
        </div>
      </div>

      {/* ── 1. Ảnh đại diện — luôn lấy từ hồ sơ, không upload riêng ── */}
      {showAvatar && !profile?.avatar_url && (
        <section className="pp-sec pp-note">
          <p>Bạn chưa có ảnh đại diện. Hãy cập nhật để câu chuyện của bạn gần gũi hơn.</p>
          <a className="pp-link-btn" href="/me">Cập nhật hồ sơ</a>
        </section>
      )}

      {/* ── 2. Tên hiển thị ── */}
      <section className="pp-sec">
        <h3>Tên hiển thị</h3>
        <div className="pp-choices">
          {fullName && (
            <label className={`pp-choice ${mode === 'full_name' ? 'on' : ''}`}>
              <input type="radio" name="pp-mode" checked={mode === 'full_name'} onChange={() => setMode('full_name')} />
              <span><b>{fullName}</b><em>Họ và tên</em></span>
            </label>
          )}
          {fullName && (
            <label className={`pp-choice ${mode === 'first_name' ? 'on' : ''}`}>
              <input type="radio" name="pp-mode" checked={mode === 'first_name'} onChange={() => setMode('first_name')} />
              <span><b>{firstNameOf(fullName)}</b><em>Chỉ tên</em></span>
            </label>
          )}
          <label className={`pp-choice ${mode === 'pen_name' ? 'on' : ''}`}>
            <input type="radio" name="pp-mode" checked={mode === 'pen_name'} onChange={() => setMode('pen_name')} />
            <span><b>Bút danh</b><em>Tên bạn tự chọn</em></span>
          </label>
          <label className={`pp-choice ${mode === 'anonymous' ? 'on' : ''}`}>
            <input type="radio" name="pp-mode" checked={mode === 'anonymous'} onChange={() => setMode('anonymous')} />
            <span><b>Ẩn danh</b><em>{ANON_LABEL}</em></span>
          </label>
        </div>

        {mode === 'pen_name' && (
          <div className="pp-pen">
            <input
              className="pp-input" value={penName} maxLength={40}
              onChange={e => setPenName(e.target.value)}
              placeholder="Bút danh của bạn"
              aria-label="Bút danh"
            />
            <label className="pp-check pp-check-sm">
              <input type="checkbox" checked={savePen} onChange={e => setSavePen(e.target.checked)} />
              <span>Dùng bút danh này cho những câu chuyện sau</span>
            </label>
          </div>
        )}
      </section>

      {/* ── 3. Lớp học — lấy tự động từ hệ thống ── */}
      {classes.length > 0 && (
        <section className="pp-sec">
          <h3>Lớp học</h3>
          {classes.length === 1 ? (
            <label className="pp-check">
              <input type="checkbox" checked={classId === classes[0].id}
                onChange={e => setClassId(e.target.checked ? classes[0].id : '')} />
              <span>Hiển thị lớp học — <i>Học viên lớp {classes[0].name}</i></span>
            </label>
          ) : (
            <div className="pp-choices">
              {classes.map(c => (
                <label key={c.id} className={`pp-choice ${classId === c.id ? 'on' : ''}`}>
                  <input type="radio" name="pp-class" checked={classId === c.id} onChange={() => setClassId(c.id)} />
                  <span><b>{c.name}</b></span>
                </label>
              ))}
              <label className={`pp-choice ${classId === '' ? 'on' : ''}`}>
                <input type="radio" name="pp-class" checked={classId === ''} onChange={() => setClassId('')} />
                <span><b>Không hiển thị lớp học</b></span>
              </label>
            </div>
          )}
        </section>
      )}

      {/* ── 4. Đôi nét về người kể — phần giới thiệu tác giả in ở cuối bài ── */}
      <section className="pp-sec">
        <h3>Đôi nét về người kể</h3>
        <p className="pp-guide">
          Hãy giới thiệu ngắn gọn về bản thân để độc giả hiểu hơn về người kể.
          Ban biên tập có thể biên tập lại câu chữ cho ngắn gọn, rõ ràng nhưng
          không làm thay đổi nội dung.
        </p>

        <div className="pp-grid">
          <label className="pp-field">
            <span>Họ và tên</span>
            <input className="pp-input" value={bioName} maxLength={60}
              onChange={e => setBioName(e.target.value)} placeholder="Nguyễn Thị Nguyên" />
          </label>
          <label className="pp-field pp-field-sm">
            <span>Tuổi</span>
            <input className="pp-input" value={bioAge} inputMode="numeric" maxLength={3}
              onChange={e => setBioAge(e.target.value.replace(/\D/g, ''))} placeholder="49" />
          </label>
          <label className="pp-field">
            <span>Quê quán</span>
            <input className="pp-input" value={bioHometown} maxLength={60}
              onChange={e => setBioHometown(e.target.value)} placeholder="Nam Định" />
          </label>
          <label className="pp-field">
            <span>Nơi đang sinh sống</span>
            <input className="pp-input" value={bioLivingIn} maxLength={60}
              onChange={e => setBioLivingIn(e.target.value)} placeholder="Hà Nội" />
          </label>
          <label className="pp-field">
            <span>Nghề nghiệp</span>
            <input className="pp-input" value={bioJob} maxLength={60}
              onChange={e => setBioJob(e.target.value)} placeholder="Kinh doanh" />
          </label>
        </div>

        <label className="pp-field pp-field-full">
          <span>Đôi nét về người kể</span>
          <textarea className="pp-input pp-textarea" value={bioText} rows={4} maxLength={600}
            onChange={e => setBioText(e.target.value)}
            placeholder="Ví dụ: Tôi tên là Nguyễn Thị Nguyên, 49 tuổi, hiện sinh sống tại Hà Nội. Tôi làm kinh doanh và bắt đầu học Guitar để thực hiện ước mơ còn dang dở từ thời sinh viên." />
        </label>

        {/* Ảnh chân dung — 1 ảnh, xem trước, thay được */}
        <div className="pp-portrait">
          <div className="pp-portrait-row">
            {portrait
              ? <img className="pp-portrait-img" src={portrait} alt="Ảnh chân dung người kể" />
              : <div className="pp-portrait-img pp-portrait-empty" aria-hidden="true">🙂</div>}
            <div className="pp-portrait-side">
              <label className="pp-link-btn pp-file">
                {upLoading ? 'Đang tải ảnh…' : portrait ? 'Đổi ảnh khác' : 'Tải ảnh chân dung'}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={upLoading}
                  onChange={e => { pickPortrait(e.target.files?.[0]); e.currentTarget.value = '' }} />
              </label>
              {portrait && (
                <button className="pp-remove" onClick={() => setPortrait(null)} disabled={upLoading}>Bỏ ảnh</button>
              )}
              <p className="pp-hint">Một ảnh, định dạng JPG, PNG hoặc WEBP.<br />Ảnh này sẽ được Ban biên tập sử dụng ở cuối bài viết.</p>
            </div>
          </div>
          {upErr && <div className="pp-err">{upErr}</div>}
        </div>

        <label className="pp-check">
          <input type="checkbox" checked={okBioEdit} onChange={e => setOkBioEdit(e.target.checked)} />
          <span>Tôi đồng ý để Ban biên tập biên tập câu chữ trong phần “Đôi nét về người kể” nhưng không làm thay đổi nội dung tôi chia sẻ.</span>
        </label>
        <label className="pp-check">
          <input type="checkbox" checked={okBioPublish} onChange={e => setOkBioPublish(e.target.checked)} />
          <span>Tôi đồng ý công khai phần “Đôi nét về người kể” và ảnh chân dung (nếu có) ở cuối bài viết sau khi được Ban biên tập xuất bản.</span>
        </label>
      </section>

      {/* ── 5. Xác nhận xuất bản ── */}
      <section className="pp-sec">
        <h3>Xác nhận</h3>
        <label className="pp-check">
          <input type="checkbox" checked={okEdit} onChange={e => setOkEdit(e.target.checked)} />
          <span>Tôi đồng ý để Ban biên tập chỉnh sửa câu chữ nhưng không làm thay đổi nội dung câu chuyện.</span>
        </label>
        <label className="pp-check">
          <input type="checkbox" checked={okPublish} onChange={e => setOkPublish(e.target.checked)} />
          <span>Tôi đồng ý cho phép xuất bản câu chuyện này trên Tạp chí 1001 Câu chuyện cùng Guitar.</span>
        </label>
      </section>

      <div className="pp-actions">
        <button className="pp-btn pp-btn-primary" onClick={submit} disabled={!canSend}>
          {busy ? 'Đang gửi…' : 'Xác nhận gửi Ban biên tập'}
        </button>
        <button className="pp-btn" onClick={onBack} disabled={busy}>← Quay lại bản thảo</button>
      </div>
    </div>
  )
}

export const PUBLISH_PREP_CSS = `
/* ── Đôi nét về người kể ── */
.pp-guide { font-size: 14px; color: var(--ink-soft); line-height: 1.55; margin-bottom: 14px; }
.pp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.pp-field { display: flex; flex-direction: column; gap: 5px; }
.pp-field > span { font-size: 13px; color: var(--ink-muted); font-weight: 500; }
.pp-field-sm { max-width: 110px; }
.pp-field-full { grid-column: 1 / -1; margin-bottom: 14px; }
.pp-textarea { resize: vertical; min-height: 96px; line-height: 1.5; font-family: inherit; }
@media (max-width: 520px) { .pp-grid { grid-template-columns: 1fr; } .pp-field-sm { max-width: none; } }
.pp-portrait { margin-bottom: 14px; }
.pp-portrait-row { display: flex; gap: 14px; align-items: flex-start; }
.pp-portrait-img { width: 92px; height: 92px; border-radius: 12px; object-fit: cover; flex: none; background: var(--surface); }
.pp-portrait-empty { display: flex; align-items: center; justify-content: center; font-size: 30px; border: 1.5px dashed var(--separator); }
.pp-portrait-side { flex: 1; min-width: 0; }
.pp-file { display: inline-block; cursor: pointer; position: relative; overflow: hidden; }
.pp-file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; }
.pp-remove { display: block; margin-top: 8px; background: none; border: none; color: var(--ink-muted); font-size: 13px; font-family: inherit; cursor: pointer; padding: 0; text-decoration: underline; }
.pp-hint { font-size: 12.5px; color: var(--ink-muted); line-height: 1.5; margin-top: 9px; }
.pp-err { background: #FFF0EF; color: #C0342B; border-radius: 10px; padding: 9px 12px; font-size: 13.5px; margin-top: 10px; }

.pp-wrap { max-width: 600px; margin: 0 auto; padding: 24px 20px 56px; width: 100%; text-align: left; }
.pp-loading { text-align: center; color: var(--ink-muted); padding: 60px 0; }
.pp-head { margin-bottom: 20px; }
.pp-eyebrow { font-size: 12px; font-weight: 600; letter-spacing: .6px; text-transform: uppercase; color: var(--ink-muted); margin-bottom: 6px; }
.pp-head h2 { font-size: 26px; font-weight: 700; margin-bottom: 8px; letter-spacing: -.5px; line-height: 1.2; }
.pp-head p { font-size: 15px; color: var(--ink-soft); line-height: 1.5; }
.pp-preview { background: var(--surface); border-radius: 14px; padding: 16px 18px; margin-bottom: 26px; }
.pp-byline { display: flex; align-items: center; gap: 13px; }
.pp-avatar { width: 46px; height: 46px; border-radius: 999px; object-fit: cover; flex: none; }
.pp-avatar-empty { display: flex; align-items: center; justify-content: center; background: var(--mira-bg); font-size: 20px; }
.pp-name { font-size: 17px; font-weight: 600; }
.pp-class { font-size: 13.5px; color: var(--ink-muted); margin-top: 2px; }
.pp-sec { margin-bottom: 26px; }
.pp-sec h3 { font-size: 13px; font-weight: 600; letter-spacing: .4px; color: var(--ink-muted); margin-bottom: 10px; text-transform: uppercase; }
.pp-note { background: var(--surface); border-radius: 14px; padding: 15px 17px; }
.pp-note p { margin-bottom: 11px; font-size: 14.5px; color: var(--ink-soft); line-height: 1.45; }
.pp-link-btn { display: inline-block; border: 1.5px solid var(--separator); border-radius: 10px; padding: 8px 15px; font-size: 14px; font-weight: 600; color: var(--blue); text-decoration: none; }
.pp-choices { display: flex; flex-direction: column; gap: 8px; }
.pp-choice { display: flex; align-items: center; gap: 12px; background: var(--surface); border: 1.5px solid transparent; border-radius: 12px; padding: 13px 15px; cursor: pointer; transition: border-color .15s; }
.pp-choice.on { border-color: var(--blue); }
.pp-choice input { accent-color: var(--blue); width: 18px; height: 18px; flex: none; cursor: pointer; }
.pp-choice span { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.pp-choice b { font-size: 16px; font-weight: 500; overflow-wrap: anywhere; }
.pp-choice em { font-size: 13px; color: var(--ink-muted); font-style: normal; }
.pp-pen { margin-top: 10px; }
.pp-input { width: 100%; padding: 13px 15px; background: var(--surface); border: 1.5px solid var(--separator); border-radius: 12px; font-size: 16px; font-family: inherit; color: var(--ink); outline: none; }
.pp-input:focus { border-color: var(--blue); }
.pp-check { display: flex; align-items: flex-start; gap: 12px; padding: 12px 2px; cursor: pointer; font-size: 15px; line-height: 1.45; color: var(--ink); }
.pp-check input { accent-color: var(--blue); width: 20px; height: 20px; flex: none; margin-top: 1px; cursor: pointer; }
.pp-check i { font-style: normal; color: var(--ink-muted); }
.pp-check-sm { font-size: 14px; color: var(--ink-soft); }
.pp-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 28px; }
.pp-btn { border: none; background: var(--surface); color: var(--ink); border-radius: 12px; padding: 15px 20px; font-size: 16px; font-weight: 500; font-family: inherit; cursor: pointer; }
.pp-btn-primary { background: var(--blue); color: #fff; font-weight: 600; }
.pp-btn-primary:active:not(:disabled) { background: var(--blue-dark); }
.pp-btn:disabled { opacity: .4; cursor: not-allowed; }
@media (max-width: 520px) { .pp-wrap { padding: 20px 16px 44px; } .pp-head h2 { font-size: 23px; } }
`
