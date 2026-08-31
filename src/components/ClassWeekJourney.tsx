/**
 * ClassWeekJourney — section "Một tuần học của bạn có thể diễn ra như thế này" trên /class.
 *
 * Trả lời câu hỏi "Tôi sử dụng những quyền lợi đó như thế nào?" sau section 6 quyền lợi.
 * 4 bước compact (học bài giảng → luyện App → hỏi Thầy → thực hành hàng tuần) + note
 * linh hoạt "Bận thì nghỉ. Tuần nào phù hợp thì tham gia."
 *
 * KHÔNG nói đây là lớp lý thuyết mới: buổi thực hành = thực hành, hỏi đáp, sửa, lặp lại.
 * Không thêm sales copy/scarcity — section ngắn, đi thẳng vào việc.
 */
const STEPS = [
  {
    ic: '📺',
    title: 'Học một nội dung mới',
    body: 'Xem bài giảng trên hệ thống theo hướng học và năng lực hiện tại.',
  },
  {
    ic: '🎸',
    title: 'Tự luyện trên App',
    body: 'Lặp lại bài tập để quen tay và làm kỹ hơn những điều vừa học.',
  },
  {
    ic: '💬',
    title: 'Gặp chỗ không hiểu',
    body: 'Hỏi Thầy qua Zalo để biết mình đang vướng ở đâu và nên luyện tiếp thế nào.',
  },
  {
    ic: '🤝',
    title: 'Đến buổi thực hành hàng tuần',
    body: 'Cùng Thầy thực hành, hỏi đáp, sửa bài và luyện kỹ những điều bạn đang học.',
  },
]

export default function ClassWeekJourney() {
  return (
    <section id="tuan-hoc" className="cwj-sec">
      <div className="wrap">
        <div className="eyebrow">Một tuần học của bạn</div>
        <h2>Một tuần học của bạn có thể diễn ra như thế này</h2>
        <p className="lead">6 quyền lợi phía trên là những gì bạn có. Đây là cách bạn dùng chúng trong một tuần bình thường.</p>

        <div className="cwj-steps">
          {STEPS.map((s, i) => (
            <div className="cwj-step" key={s.title}>
              <div className="cwj-num">{i + 1}</div>
              <span className="cwj-ic" aria-hidden>{s.ic}</span>
              <div className="cwj-body">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Học mỗi ngày — không phải chờ cả tuần */}
        <div className="cwj-note">
          <p className="cwj-note-line"><b>Bạn không phải chờ cả tuần mới được học một bài mới.</b></p>
          <p className="cwj-note-line">Ngày nào bạn cũng có thể học, luyện tập và tương tác với Thầy.</p>
        </div>
      </div>
      <style>{CSS}</style>
    </section>
  )
}

/* ─── Style scoped — dùng đúng design token của .tva-class ─── */
const CSS = `
.tva-class .cwj-sec{padding:58px 0;}
.tva-class .cwj-steps{display:grid;gap:14px;margin-top:28px;grid-template-columns:1fr;}
@media(min-width:640px){.tva-class .cwj-steps{grid-template-columns:repeat(2,1fr);}}
@media(min-width:860px){.tva-class .cwj-steps{grid-template-columns:repeat(4,1fr);gap:16px;}}
.tva-class .cwj-step{position:relative;border:1.5px solid var(--line);border-radius:16px;background:var(--surface);padding:22px 20px 20px;box-shadow:0 1px 3px rgba(33,28,50,.05);}
.tva-class .cwj-num{position:absolute;top:14px;right:16px;font-size:26px;font-weight:800;color:rgba(33,28,50,.09);line-height:1;}
.tva-class .cwj-ic{display:block;font-size:26px;line-height:1;}
.tva-class .cwj-body h3{margin:12px 0 0;font-size:15.5px;font-weight:800;color:var(--ink);line-height:1.3;}
.tva-class .cwj-body p{margin:7px 0 0;font-size:13.5px;line-height:1.6;color:var(--ink-soft);}
.tva-class .cwj-note{margin-top:22px;border:1.5px dashed var(--mem-line,#F5CFB6);border-radius:14px;background:var(--mem-soft,#FDF0E7);padding:18px 22px;}
.tva-class .cwj-note-line{margin:0;font-size:15.5px;line-height:1.6;color:var(--ink);}
.tva-class .cwj-note-line b{color:var(--mem,#EA580C);}
`
