// NỘI DUNG CHỮ của trang tuyển sinh — tách khỏi component để:
//   1) sửa nội dung không phải lục trong mã giao diện;
//   2) Mira đọc được (script scripts/mira-content.mjs bóc file này + các trang
//      Đệm hát / Tỉa nốt / Nâng cao thành JSON cho Mira).
// Sửa xong nhớ chạy: npm run mira:content

// ─── KIẾN TRÚC ĐÀO TẠO PUBLIC (09/2026) ───
// Khách chỉ thấy 4 SẢN PHẨM trên 2 tuyến. Mã chương trình nội bộ (DH1, TN1, Tỉa nốt,
// Cảm âm…) KHÔNG xuất hiện ở đây. Cohort thật nằm ở class_schedule và được gắn vào
// sản phẩm qua cột public_product (+ public_enroll=true khi đang tuyển) — xem
// db/class_public_enroll.sql. Key phải khớp CHECK constraint của cột đó.
export type PublicProductKey = 'dem_hat_can_ban' | 'guitar_can_ban' | 'dem_hat_nang_cao' | 'solo_guitar'
export type PublicProduct = { key: PublicProductKey; title: string; length: string; kind: 'funnel' | 'long'; desc: string; cta: string; path: 'dem_hat' | 'tia_not' }
export const PRODUCTS: Record<PublicProductKey, PublicProduct> = {
  dem_hat_can_ban: { key: 'dem_hat_can_ban', title: 'Đệm hát căn bản', length: '4 buổi', kind: 'funnel', path: 'dem_hat',
    desc: 'Dành cho người mới thích hát và muốn tự đệm những bài mình yêu thích.', cta: 'Bắt đầu Đệm hát' },
  guitar_can_ban: { key: 'guitar_can_ban', title: 'Guitar căn bản', length: '4 buổi', kind: 'funnel', path: 'tia_not',
    desc: 'Dành cho người muốn làm quen với nốt nhạc, cần đàn và chơi những giai điệu đầu tiên.', cta: 'Bắt đầu Guitar căn bản' },
  dem_hat_nang_cao: { key: 'dem_hat_nang_cao', title: 'Đệm hát nâng cao', length: '6 tháng', kind: 'long', path: 'dem_hat',
    desc: 'Cho người đã đệm được vài bài: phát triển điệu, tiết tấu, bố cục và cách xử lý một bài hát trọn vẹn.', cta: 'Tìm hiểu Đệm hát nâng cao' },
  solo_guitar: { key: 'solo_guitar', title: 'Solo Guitar', length: '6 tháng', kind: 'long', path: 'tia_not',
    desc: 'Cho người đã có nền nốt nhạc: chơi giai điệu, cảm âm và dựng những bản solo guitar của riêng mình.', cta: 'Tìm hiểu Solo Guitar' },
}
// 2 tuyến học: bước căn bản (cửa vào quanh năm) → bước dài hạn
export const TRACKS: { name: string; steps: [PublicProductKey, PublicProductKey] }[] = [
  { name: 'Tuyến Đệm hát', steps: ['dem_hat_can_ban', 'dem_hat_nang_cao'] },
  { name: 'Tuyến Guitar & Solo', steps: ['guitar_can_ban', 'solo_guitar'] },
]

// ─── 3 cửa vào — 2 cửa cho người mới trỏ thẳng vào sản phẩm phễu; cửa 3 cho người đã biết chơi ───
export const DOORS: { dq: string; badge: string; desc: string; cta: string; product?: PublicProductKey; advanced?: PublicProductKey[] }[] = [
  { dq: 'Tôi muốn vừa đàn vừa hát', badge: 'Đệm hát căn bản · 4 buổi', desc: PRODUCTS.dem_hat_can_ban.desc, cta: 'Bắt đầu Đệm hát', product: 'dem_hat_can_ban' },
  { dq: 'Tôi muốn học Guitar từ gốc, chơi theo giai điệu', badge: 'Guitar căn bản · 4 buổi', desc: PRODUCTS.guitar_can_ban.desc, cta: 'Bắt đầu Guitar căn bản', product: 'guitar_can_ban' },
  { dq: 'Tôi đã biết chơi Guitar', badge: 'Bạn đã có nền tảng?', desc: 'Bạn có thể vào thẳng Đệm hát nâng cao hoặc Solo Guitar. Nếu chưa biết mình phù hợp lớp nào, hỏi Mira nhé.', cta: 'Hỏi Mira', advanced: ['dem_hat_nang_cao', 'solo_guitar'] },
]

// ─── Showcase hành động (tâm lý → 1 hành động nhỏ) ───
// slot: nếu có bài viết (articles) published cùng slot → thẻ "sống dậy", CTA mở bài viết.
export const STARTERS: { t: string; d: string; cta: string; href?: string; modal?: string; ready: boolean; note?: string; slot?: string; articleCta?: string; native?: string }[] = [
  { t: 'Tìm điểm bắt đầu của tôi', d: 'Bài test 2 phút. Không cần biết trình độ — trả lời vài câu để biết mình phù hợp lớp nào.', cta: 'Làm bài test', ready: true, native: 'quiz' },
  { t: 'Mở bài học thử trên app', d: 'Dùng thử app TVA Guitar 7 ngày: trải nghiệm bài học đầu tiên, cách luyện tập và theo dõi tiến độ.', cta: 'Dùng thử miễn phí', href: '#chat', ready: false, note: 'cần link bản dùng thử app', slot: 'dung-thu-app', articleCta: 'Tìm hiểu dùng thử' },
  { t: 'Xem một buổi học vận hành thế nào', d: 'Lớp Zoom có thầy dẫn, nhóm Zalo nhắc lịch & giao bài, app lưu bài, có trả bài. Học online không phải tự bơi.', cta: 'Xem một buổi học', ready: true, native: 'demo' },
  { t: '90 phút mỗi tuần cho cây đàn của bạn', d: 'Mỗi tuần một buổi cùng Thầy. Nếu không đặt lịch cho ước mơ, nó sẽ bị việc khác chen vào.', cta: 'Đọc bài viết', href: '#chat', ready: false, note: 'cần bài viết', slot: '90-phut-moi-tuan', articleCta: 'Đọc bài viết' },
  { t: 'Những học viên lớn tuổi bắt đầu thế nào', d: 'Nhiều người bắt đầu khi đã 40, 50, 60. Quan trọng không phải tuổi — mà là đi chậm và đúng cách.', cta: 'Xem video lớp học', href: '#chat', ready: false, note: 'cần video', slot: 'hoc-vien-lon-tuoi', articleCta: 'Đọc bài viết' },
  { t: 'Bạn được hỗ trợ gì sau khi đăng ký', d: 'Chọn sai lớp? Không theo kịp? Bận một buổi? Mỗi lo lắng đều có cách hệ thống hỗ trợ bạn.', cta: 'Xem cam kết', modal: 'camket', ready: true, slot: 'cam-ket', articleCta: 'Xem cam kết' },
]

export const CHAT_FAQ: Record<string, string> = {
  'Tôi nên bắt đầu từ đâu?': 'Người mới có 2 cửa: thích hát → <b>Đệm hát căn bản (4 buổi)</b>; muốn học từ gốc, chơi giai điệu → <b>Guitar căn bản (4 buổi)</b>. Đã biết chơi → <b>Đệm hát nâng cao</b> hoặc <b>Solo Guitar</b> (6 tháng).',
  'Học phí thế nào?': 'Cùng một lớp, có 2 cách đồng hành: <b>Theo tháng 499.000đ/tháng</b>, hoặc <b>Đồng hành 6 tháng 396.000đ/tháng</b> (2.376.000đ/6 tháng) với đầy đủ quyền lợi.',
  'Đệm hát hay Guitar căn bản?': 'Muốn tự đàn hát → <b>Đệm hát</b>. Muốn đọc nốt, chơi giai điệu → <b>Guitar căn bản</b>. Bạn thiên về cái nào?',
  'Lịch học ra sao?': 'Hai lớp căn bản mở vòng liên tục (mỗi vòng 4 buổi) để bạn luôn có cửa vào. Xem lịch khai giảng ở mục "Hai tuyến học", hoặc hỏi Mira/nhắn Thầy.',
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
      <div class="b-row"><span class="b-branch">Đệm hát</span> Đệm hát căn bản (4 buổi) → Đệm hát nâng cao (6 tháng)</div>
      <div class="b-row"><span class="b-branch">Guitar &amp; Solo</span> Guitar căn bản (4 buổi) → Solo Guitar (6 tháng)</div>
    </div>
    <p class="lead" style="margin-top:10px">Đã biết chơi? Bạn có thể vào thẳng bước dài hạn — hỏi Mira nếu chưa chắc.</p>
  `,
}
