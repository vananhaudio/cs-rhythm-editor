/**
 * ClassAfterSignup — section "Sau khi đăng ký" + modal hướng dẫn chi tiết trên /class.
 *
 * Landing cực gọn: 4 bước + dòng cam kết hỗ trợ + CTA "Xem chi tiết từng bước →"
 * mở modal full-screen (pattern ClassBenefitDetail/ClassLearningWays: Escape/✕,
 * khóa scroll nền, giữ vị trí, focus restore, mobile fullscreen).
 *
 * Detail = HƯỚNG DẪN 8 bước (xác nhận → kích hoạt → email → App/Zoom → 3 nhánh
 * class/practice/both → nhóm học → buổi đầu tiên → học trước → gặp vấn đề) +
 * callout "Đừng đợi đến buổi đầu tiên" + checklist "Trước buổi đầu tiên".
 *
 * WORDING THEO AUDIT THẬT (chỉ hứa điều hệ thống/vận hành làm được):
 * - Activation: THỦ CÔNG (Thầy kích hoạt sau xác nhận) → "sau khi được xác nhận".
 * - Email onboarding: chưa có automation → "bạn sẽ nhận được hướng dẫn..." (email/Zalo).
 * - Nhóm học: thủ công → dùng wording trung tính "nhóm học".
 * - Zoom: chưa có hướng dẫn tích hợp → không hardcode link giả.
 */
import { useEffect, useRef } from 'react'

const ZALO_LINK = 'https://zalo.me/vananhguitarist'

const STEPS = [
  { ic: '📘', name: 'Kích hoạt tài khoản', desc: 'Bạn được cấp quyền truy cập hệ thống và App.' },
  { ic: '📧', name: 'Nhận hướng dẫn cài đặt', desc: 'Hướng dẫn đăng nhập, App, Zoom và những bước cần thiết được gửi qua email/Zalo.' },
  { ic: '📅', name: 'Nhận lịch & vào nhóm học', desc: 'Tùy hình thức đăng ký, bạn được thêm vào lớp hoặc nhóm thực hành phù hợp.' },
  { ic: '🎸', name: 'Học trước buổi đầu tiên', desc: 'Bạn có thể vào hệ thống xem bài và chuẩn bị trước khi gặp Thầy.' },
]

export default function ClassAfterSignup({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  return (
    <section className="band asu-sec" id="sau-dang-ky">
      <div className="wrap">
        <div className="eyebrow">Sau khi đăng ký</div>
        <h2>Bạn có thể bắt đầu ngay.</h2>
        <p className="lead">Chuyển tiền xong là bạn biết chính xác mình phải làm gì tiếp theo — không cần tự tìm cách bắt đầu.</p>
        <div className="asu-steps">
          {STEPS.map((s, i) => (
            <div className="asu-step" key={s.name}>
              <div className="asu-num">{i + 1}</div>
              <span className="asu-ic" aria-hidden>{s.ic}</span>
              <div>
                <h3>{s.name}</h3>
                <p>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="asu-foot">
          <p className="asu-support">Thầy sẽ hỗ trợ bạn trong suốt quá trình bắt đầu.</p>
          <button type="button" className="btn btn-primary" onClick={onOpen} aria-haspopup="dialog">Xem chi tiết từng bước →</button>
        </div>
      </div>

      {open && <AfterSignupDetail onClose={onClose} />}
      <style>{CSS}</style>
    </section>
  )
}

/** Modal hướng dẫn chi tiết — 8 bước, scan được toàn bộ (không accordion). */
function AfterSignupDetail({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const prevFocus = useRef<Element | null>(null)

  useEffect(() => {
    prevFocus.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      if (prevFocus.current instanceof HTMLElement) prevFocus.current.focus()
    }
  }, [onClose])

  return (
    <div className="asu-overlay" role="dialog" aria-modal="true" aria-label="Sau khi đăng ký, bạn sẽ bắt đầu như thế nào?">
      <div className="asu-card">
        <div className="asu-head">
          <h2 className="asu-title">Sau khi đăng ký, bạn sẽ bắt đầu như thế nào?</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Đóng" className="asu-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="asu-body">
          <p className="asu-intro">Bạn không cần tự tìm cách bắt đầu. Sau khi đăng ký, hệ thống và Thầy sẽ hướng dẫn bạn từng bước để có thể vào học nhanh nhất.</p>

          {/* 1 — Xác nhận đăng ký */}
          <section className="asu-sec">
            <h3 className="asu-h3">1. Xác nhận đăng ký</h3>
            <p className="asu-p">Sau khi hoàn tất đăng ký và thanh toán theo hướng dẫn, hệ thống/Thầy xác nhận đăng ký của bạn.</p>
            <p className="asu-p">Nếu bạn đăng ký <b>Học theo lớp</b>: chuyển khoản theo QR/ thông tin tài khoản hiển thị sau khi đăng ký, rồi <b>gửi bill qua Zalo Thầy</b> để được xác nhận và kích hoạt nhanh nhất.</p>
            <p className="asu-p">Nếu bạn đăng ký <b>Gói Thực hành</b> hoặc <b>Cả hai</b>: đăng ký được ghi nhận và Thầy sẽ liên hệ xác nhận trực tiếp.</p>
          </section>

          {/* 2 — Kích hoạt tài khoản */}
          <section className="asu-sec">
            <h3 className="asu-h3">2. Tài khoản học tập được kích hoạt</h3>
            <p className="asu-p">Sau khi đăng ký được xác nhận, tài khoản sẽ được kích hoạt và bạn có thể bắt đầu học.</p>
            <ul className="asu-list">
              <li>Email bạn đăng ký chính là tài khoản học tập.</li>
              <li>App TVA Guitar dùng đúng tài khoản này để đăng nhập.</li>
              <li>Nếu bạn đã có tài khoản từ trước, hệ thống tiếp tục dùng tài khoản đó.</li>
              <li>Nếu chưa có, bạn sẽ được hướng dẫn tạo/kích hoạt tài khoản.</li>
            </ul>
          </section>

          {/* 3 — Email hướng dẫn */}
          <section className="asu-sec">
            <h3 className="asu-h3">3. Nhận email hướng dẫn</h3>
            <p className="asu-p">Bạn sẽ nhận được hướng dẫn đăng nhập và cài đặt, giúp bạn không phải nhớ các bước qua chat.</p>
            <p className="asu-p">Nội dung hướng dẫn bao gồm: cách đăng nhập hệ thống · cách cài và đăng nhập App · hướng dẫn Zoom nếu hình thức học cần · cách vào nhóm học · nơi xem lịch · bước đầu tiên nên làm.</p>
          </section>

          {/* 4 — App & Zoom */}
          <section className="asu-sec">
            <h3 className="asu-h3">4. Chuẩn bị App và Zoom</h3>
            <p className="asu-p"><b>App TVA Guitar</b> dùng để học bài, luyện tập, theo dõi tiến độ và sử dụng các công cụ hỗ trợ.</p>
            <p className="asu-p"><b>Zoom</b> dùng khi tham gia buổi học hoặc buổi thực hành online. Hướng dẫn cài Zoom và kiểm tra mic/loa/camera sẽ được gửi kèm khi bạn vào nhóm học.</p>
          </section>

          {/* 5 — 3 nhánh */}
          <section className="asu-sec">
            <h3 className="asu-h3">5. Bạn được đưa vào đúng hình thức học</h3>

            <div className="asu-branch asu-branch-cls">
              <span className="asu-branch-tag">Học theo lớp</span>
              <p className="asu-p">Bạn nhận: tên lớp · lịch học cố định · ngày khai giảng/buổi tiếp theo · nhóm lớp · link Zoom hoặc cách vào buổi học · nội dung nên xem trước.</p>
              <p className="asu-p asu-branch-line"><b>Bạn đi theo nhịp của lớp từ đầu đến cuối.</b></p>
            </div>

            <div className="asu-branch asu-branch-mem">
              <span className="asu-branch-tag">Gói Thực hành</span>
              <p className="asu-p">Bạn được hướng dẫn: chọn hướng học trên App (<b>Đệm hát / Tỉa nốt / Solo...</b>) · xác định nhóm thực hành phù hợp (<b>Cơ bản / Trung cấp / Nâng cao</b>) · xem lịch thực hành · biết cách sử dụng số buổi trong gói · chọn buổi phù hợp với lịch của mình.</p>
              <p className="asu-p asu-branch-line"><b>Bạn chủ động học theo hướng của mình và chọn buổi thực hành phù hợp.</b></p>
            </div>

            <div className="asu-branch asu-branch-both">
              <span className="asu-branch-tag">Học cả hai</span>
              <p className="asu-p">Bạn nhận cả hai luồng: lớp cố định + Gói Thực hành linh hoạt.</p>
              <p className="asu-p asu-branch-line"><b>Học theo lớp để đi lên · Thực hành để đi sâu.</b></p>
            </div>
          </section>

          {/* 6 — Nhóm học */}
          <section className="asu-sec">
            <h3 className="asu-h3">6. Vào nhóm học</h3>
            <p className="asu-p">Tùy đăng ký, bạn được thêm vào nhóm lớp, nhóm thực hành hoặc cả hai. Nhóm học dùng để nhận thông báo, cập nhật lịch, nhận link và trao đổi các nội dung liên quan.</p>
          </section>

          {/* 7 — Buổi đầu tiên */}
          <section className="asu-sec">
            <h3 className="asu-h3">7. Biết rõ buổi đầu tiên của mình</h3>
            <p className="asu-p">Bạn sẽ biết rõ buổi học hoặc buổi thực hành đầu tiên của mình: ngày, giờ, cách tham gia và những gì nên chuẩn bị.</p>
          </section>

          {/* Callout — học trước buổi đầu tiên */}
          <div className="asu-callout">
            <h3 className="asu-callout-h">Đừng đợi đến buổi đầu tiên mới bắt đầu học</h3>
            <p className="asu-p">Ngay khi tài khoản được kích hoạt, bạn đã có thể vào hệ thống xem bài, làm quen nội dung và luyện tập trước.</p>
            <p className="asu-p">Trước khi gặp Thầy, hãy xem trước nội dung được hướng dẫn và ghi lại những chỗ bạn chưa hiểu.</p>
            <p className="asu-p">Nhờ vậy, khi vào buổi học hoặc buổi thực hành, thời gian với Thầy được dùng nhiều hơn cho hỏi đáp, sửa bài và giải quyết đúng chỗ bạn đang vướng.</p>
            <p className="asu-callout-line"><b>Buổi gặp Thầy là một điểm trong quá trình học — việc học đã bắt đầu từ trước đó.</b></p>
          </div>

          {/* Reinforcement — ĐÃ BỎ: 2 dòng "không phải chờ cả tuần" trùng nguyên văn
              với note section "Một tuần học" phía trên (mỗi ý chỉ một nơi nói mạnh nhất).
              Callout "Đừng đợi đến buổi đầu tiên" phía trên đã giữ vai trò khích lệ. */}

          {/* 8 — Gặp vấn đề */}
          <section className="asu-sec">
            <h3 className="asu-h3">8. Nếu có chỗ nào chưa rõ</h3>
            <p className="asu-p">Gặp bất kỳ tình huống nào dưới đây — không đăng nhập được, không thấy bài học, chưa biết nên học bài nào, chưa cài được App hoặc Zoom, chưa vào được nhóm, chưa biết lịch, không biết mình thuộc nhóm thực hành nào:</p>
            <p className="asu-p asu-help-line"><b>Bạn không cần tự xử lý một mình. Hãy liên hệ Thầy để được hướng dẫn.</b></p>
            <a className="zalo-btn" href={ZALO_LINK} target="_blank" rel="noreferrer">💬 Liên hệ Thầy qua Zalo →</a>
          </section>

          {/* Checklist */}
          <div className="asu-check">
            <h3 className="asu-h3">Trước buổi đầu tiên</h3>
            <ul className="asu-check-list">
              {['Đăng nhập được hệ thống', 'Cài App', 'Cài Zoom', 'Vào nhóm học', 'Biết lịch buổi đầu tiên', 'Xem trước nội dung được hướng dẫn', 'Ghi lại câu hỏi muốn hỏi Thầy'].map(c => (
                <li key={c}><span className="asu-check-box" aria-hidden />{c}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Style scoped — design token .tva-class ─── */
const CSS = `
.tva-class{--mem:#EA580C;--mem-soft:#FDF0E7;--mem-line:#F5CFB6;}
.tva-class .asu-sec{padding:58px 0;}
.tva-class .asu-steps{display:grid;gap:14px;margin-top:28px;grid-template-columns:1fr;}
@media(min-width:640px){.tva-class .asu-steps{grid-template-columns:repeat(2,1fr);}}
@media(min-width:860px){.tva-class .asu-steps{grid-template-columns:repeat(4,1fr);gap:16px;}}
.tva-class .asu-step{position:relative;border:1.5px solid var(--line);border-radius:16px;background:var(--surface);padding:22px 20px 20px;box-shadow:0 1px 3px rgba(33,28,50,.05);}
.tva-class .asu-num{position:absolute;top:14px;right:16px;font-size:26px;font-weight:800;color:rgba(33,28,50,.09);line-height:1;}
.tva-class .asu-ic{display:block;font-size:26px;line-height:1;}
.tva-class .asu-step h3{margin:12px 0 0;font-size:15.5px;font-weight:800;color:var(--ink);line-height:1.3;}
.tva-class .asu-step p{margin:7px 0 0;font-size:13.5px;line-height:1.6;color:var(--ink-soft);}
.tva-class .asu-foot{margin-top:24px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;}
.tva-class .asu-support{margin:0;font-size:14.5px;font-weight:600;color:var(--ink-soft);}

/* Modal detail */
.tva-class .asu-overlay{position:fixed;inset:0;z-index:130;background:rgba(33,28,50,.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:0;}
@media(min-width:768px){.tva-class .asu-overlay{padding:24px;}}
.tva-class .asu-card{background:var(--surface);width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 70px -20px rgba(0,0,0,.45);}
@media(min-width:768px){.tva-class .asu-card{height:auto;max-height:92vh;max-width:760px;border-radius:16px;}}
.tva-class .asu-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:16px 20px;border-bottom:1px solid var(--line);}
@media(min-width:768px){.tva-class .asu-head{padding:20px 28px;}}
.tva-class .asu-title{font-size:19px;font-weight:800;letter-spacing:-.3px;color:var(--ink);margin:0;line-height:1.35;}
@media(min-width:768px){.tva-class .asu-title{font-size:22px;}}
.tva-class .asu-close{flex-shrink:0;width:38px;height:38px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);display:flex;align-items:center;justify-content:center;cursor:pointer;font-family:inherit;box-shadow:0 1px 3px rgba(33,28,50,.08);}
.tva-class .asu-close:hover{color:var(--ink);}
.tva-class .asu-body{flex:1;overflow-y:auto;padding:22px 20px 32px;}
@media(min-width:768px){.tva-class .asu-body{padding:26px 28px 36px;}}
.tva-class .asu-intro{margin:0 0 6px;font-size:15px;line-height:1.7;color:var(--ink-soft);}
.tva-class .asu-sec{margin-top:26px;border-top:1px solid var(--line);padding-top:22px;}
.tva-class .asu-h3{font-size:17px;font-weight:800;letter-spacing:-.2px;color:var(--ink);margin:0;}
.tva-class .asu-p{margin:10px 0 0;font-size:14.5px;line-height:1.7;color:var(--ink-soft);}
.tva-class .asu-p b{color:var(--ink);}
.tva-class .asu-list{margin:10px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:7px;}
.tva-class .asu-list li{font-size:14px;line-height:1.6;color:var(--ink-soft);padding-left:22px;position:relative;}
.tva-class .asu-list li::before{content:'✓';position:absolute;left:0;top:0;color:var(--online);font-weight:800;}
.tva-class .asu-branch{margin-top:14px;border:1.5px solid var(--line);border-radius:14px;padding:16px 18px;}
.tva-class .asu-branch-cls{border-color:#D3CEE8;background:#F9F7FE;}
.tva-class .asu-branch-mem{border-color:var(--mem-line);background:var(--mem-soft);}
.tva-class .asu-branch-both{border-color:#D3CEE8;background:linear-gradient(90deg,var(--mem-soft) 0%,#F9F7FE 100%);}
.tva-class .asu-branch-tag{display:inline-block;font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;border-radius:999px;padding:3px 11px;margin-bottom:6px;}
.tva-class .asu-branch-cls .asu-branch-tag{color:var(--indigo);background:var(--indigo-tint);}
.tva-class .asu-branch-mem .asu-branch-tag{color:var(--mem);background:#fff;}
.tva-class .asu-branch-both .asu-branch-tag{color:var(--indigo);background:var(--indigo-tint);}
.tva-class .asu-branch-line{margin-top:8px;}
.tva-class .asu-callout{margin-top:26px;border:1.5px solid var(--mem-line);border-radius:16px;background:var(--mem-soft);padding:20px 20px 18px;}
.tva-class .asu-callout-h{font-size:17.5px;font-weight:800;color:var(--mem);margin:0;}
.tva-class .asu-callout-line{margin-top:10px;font-size:14.5px;color:var(--ink);}
.tva-class .asu-help-line{margin-top:12px;}
.tva-class .asu-check{margin-top:26px;border:1.5px dashed var(--line);border-radius:16px;padding:18px 20px;}
.tva-class .asu-check-list{margin:12px 0 0;padding:0;list-style:none;display:grid;gap:8px;grid-template-columns:1fr;}
@media(min-width:640px){.tva-class .asu-check-list{grid-template-columns:1fr 1fr;}}
.tva-class .asu-check-list li{display:flex;align-items:center;gap:9px;font-size:13.5px;color:var(--ink);}
.tva-class .asu-check-box{width:16px;height:16px;border:1.5px solid var(--indigo);border-radius:4px;flex-shrink:0;background:#fff;}
`
