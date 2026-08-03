// NỘI DUNG CHỮ của trang tuyển sinh — tách khỏi component để:
//   1) sửa nội dung không phải lục trong mã giao diện;
//   2) Mira đọc được (script scripts/mira-content.mjs bóc file này + các trang
//      Đệm hát / Tỉa nốt / Nâng cao thành JSON cho Mira).
// Sửa xong nhớ chạy: npm run mira:content

// ─── 3 cửa vào — nút mở bài viết (nếu có) hoặc cuộn tới lớp/chat ───
export const DOORS: { dq: string; badge: string; desc: string; cta: string; slot: string; fallback: string; native?: string }[] = [
  { dq: 'Tôi muốn vừa đàn vừa hát', badge: 'Guitar căn bản theo hướng Đệm hát', desc: 'Dành cho người mới thích hát, hay hát karaoke, muốn học hợp âm, nhịp phách và tự đệm các bài yêu thích.', cta: 'Xem lớp Đệm hát căn bản', slot: 'cua-dem-hat', fallback: 'lichlop', native: 'demhat' },
  { dq: 'Tôi muốn học Guitar từ gốc', badge: 'Guitar căn bản theo hướng Giai điệu', desc: 'Dành cho người mới muốn làm quen với nốt nhạc, vị trí trên cần đàn và chơi những giai điệu đầu tiên.', cta: 'Xem lớp Guitar căn bản', slot: 'cua-tia-not', fallback: 'lichlop', native: 'tianot' },
  { dq: 'Tôi đã biết chơi và muốn tiến xa hơn', badge: 'Xếp trình độ nâng cao', desc: 'Dành cho người đã học một thời gian nhưng còn bí nhịp, tông, nốt, âm giai, cảm âm hoặc cách xử lý bài hát.', cta: 'Xem mình đang ở đâu', slot: 'cua-cam-am', fallback: 'chat', native: 'nangcao' },
]

// ─── Showcase hành động (tâm lý → 1 hành động nhỏ) ───
// slot: nếu có bài viết (articles) published cùng slot → thẻ "sống dậy", CTA mở bài viết.
export const STARTERS: { t: string; d: string; cta: string; href?: string; modal?: string; ready: boolean; note?: string; slot?: string; articleCta?: string; native?: string }[] = [
  { t: 'Tìm điểm bắt đầu của tôi', d: 'Bài test 2 phút. Không cần biết trình độ — trả lời vài câu để biết mình phù hợp lớp nào.', cta: 'Làm bài test', ready: true, native: 'quiz' },
  { t: 'Mở bài học thử trên app', d: 'Dùng thử app TVA Guitar 7 ngày: trải nghiệm bài học đầu tiên, cách luyện tập và theo dõi tiến độ.', cta: 'Dùng thử miễn phí', href: '#chat', ready: false, note: 'cần link bản dùng thử app', slot: 'dung-thu-app', articleCta: 'Tìm hiểu dùng thử' },
  { t: 'Xem một buổi học vận hành thế nào', d: 'Lớp Zoom có thầy dẫn, nhóm Zalo nhắc lịch & giao bài, app lưu bài, có trả bài. Học online không phải tự bơi.', cta: 'Xem một buổi học', ready: true, native: 'demo' },
  { t: '90 phút mỗi tuần cho cây đàn của bạn', d: 'Một tuần chỉ 90 phút, lộ trình 8 buổi. Nếu không đặt lịch cho ước mơ, nó sẽ bị việc khác chen vào.', cta: 'Đọc bài viết', href: '#chat', ready: false, note: 'cần bài viết', slot: '90-phut-moi-tuan', articleCta: 'Đọc bài viết' },
  { t: 'Những học viên lớn tuổi bắt đầu thế nào', d: 'Nhiều người bắt đầu khi đã 40, 50, 60. Quan trọng không phải tuổi — mà là đi chậm và đúng cách.', cta: 'Xem video lớp học', href: '#chat', ready: false, note: 'cần video', slot: 'hoc-vien-lon-tuoi', articleCta: 'Đọc bài viết' },
  { t: 'Bạn được hỗ trợ gì sau khi đăng ký', d: 'Chọn sai lớp? Không theo kịp? Bận một buổi? Mỗi lo lắng đều có cách hệ thống hỗ trợ bạn.', cta: 'Xem cam kết', modal: 'camket', ready: true, slot: 'cam-ket', articleCta: 'Xem cam kết' },
]

export const CHAT_FAQ: Record<string, string> = {
  'Tôi nên bắt đầu từ đâu?': 'Người mới hoàn toàn nên bắt đầu từ <b>Nhập môn (miễn phí)</b>, rồi chọn nhánh Đệm hát hoặc Tỉa nốt. Bạn đang ở mức nào?',
  'Học phí thế nào?': 'Mỗi khoá <b>990k</b>, học 2 tháng (8 buổi). Nhập môn &amp; Nhạc lý căn bản miễn phí.',
  'Đệm hát hay tỉa nốt?': 'Muốn tự đàn hát → <b>Đệm hát</b>. Muốn chơi giai điệu, đọc nốt → <b>Tỉa nốt</b>. Bạn thiên về cái nào?',
  'Lịch học ra sao?': 'Các lớp sắp mở chủ yếu <b>tối trong tuần (19h–20h30)</b>. Xem mục "Lớp sắp khai giảng", hoặc cho mình biết khung giờ bạn rảnh.',
}

export const MODALS: Record<string, string> = {
  mohinh: `<h3>Một buổi học vận hành thế nào?</h3>
    <p class="lead" style="margin-top:6px">Học ở đây không phải tự xem video rồi tự bơi — có cả một mô hình hỗ trợ quanh bạn.</p>
    <div class="mh-grid">
      <div class="mh-card"><div class="mh-ph">Ảnh lớp Zoom thật</div><h4>Lớp Zoom có người dẫn</h4><p>Học theo lịch cố định, thầy giảng trực tiếp.</p></div>
      <div class="mh-card"><div class="mh-ph">Ảnh nhóm Zalo lớp</div><h4>Nhóm Zalo lớp</h4><p>Nhắc lịch, giao bài, hỏi đáp sau buổi học.</p></div>
      <div class="mh-card"><div class="mh-ph">Ảnh màn hình app</div><h4>App TVA Guitar</h4><p>Bài học, bài tập, tiến độ được lưu để ôn lại.</p></div>
      <div class="mh-card"><div class="mh-ph">Ảnh hướng dẫn trả bài</div><h4>Trả bài có góp ý</h4><p>Gửi bài để thầy/trợ lý xem và sửa cho bạn.</p></div>
    </div>`,
  camket: `<h3>Bạn được hỗ trợ gì sau khi đăng ký?</h3>
    <p class="lead" style="margin-top:6px">Bạn không bị ném vào một khoá học rồi tự xoay xở.</p>
    <table class="ck-table"><tbody>
      <tr><td>Chọn sai lớp</td><td>Được tư vấn trước khi vào lớp</td></tr>
      <tr><td>Không theo kịp</td><td>App xem lại bài + bài tập sau buổi</td></tr>
      <tr><td>Bận một buổi</td><td>Có nội dung ôn lại trong app / nhóm lớp</td></tr>
      <tr><td>Không biết tập gì</td><td>Có bài tập rõ sau mỗi buổi học</td></tr>
      <tr><td>Vào lớp chưa phù hợp</td><td>Thầy/trợ lý sẽ định hướng lại</td></tr>
    </tbody></table>`,
  banDo: `<h3>Bản đồ hành trình dài hạn</h3>
    <p class="lead" style="margin-top:6px">Bạn không cần học hết ngay — chỉ cần bắt đầu bằng khóa đầu tiên phù hợp. Đây là con đường nếu bạn muốn đi xa.</p>
    <div class="bando">
      <div class="b-row"><span class="b-node b-free">Nhập môn (miễn phí)</span></div>
      <div class="b-row"><span class="b-branch">Nhạc lý</span> 1 → 2 → 3 (hoà âm cảm âm)</div>
      <div class="b-row"><span class="b-branch">Đệm hát</span> 1 → 2 → 3</div>
      <div class="b-row"><span class="b-branch">Tỉa nốt</span> 1 → 2 → 3</div>
      <div class="b-row b-converge">↓ hội tụ: Đệm hát nâng cao → Solo Guitar</div>
    </div>
    <p class="lead" style="margin-top:10px"><b>Học có điều kiện</b>: mỗi khoá chỉ mở khi đủ nền — ví dụ Đệm hát 2 cần xong Đệm hát 1 + Nhạc lý 1. Không nhảy cóc, không hổng gốc.</p>`,
}
