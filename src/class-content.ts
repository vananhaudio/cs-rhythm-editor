// NỘI DUNG CHỮ của trang tuyển sinh — tách khỏi component để:
//   1) sửa nội dung không phải lục trong mã giao diện;
//   2) Mira đọc được (script scripts/mira-content.mjs bóc file này thành JSON cho Mira).
// Sửa xong nhớ chạy: npm run mira:content
//
// NGUYÊN TẮC PUBLIC (09/2026): khách chỉ cần biết lớp nào hợp với mình, học lúc nào, khai giảng
// khi nào, đăng ký ở đâu. KHÔNG đưa ra ngoài: số buổi/thời hạn trên tên lớp, tuyến/lộ trình,
// cách Thầy xếp lớp sau đó, chặng/module, mã nội bộ (DH/TN…). Thời hạn chỉ xuất hiện ở checkout.

// ─── SẢN PHẨM (lớp) — key khớp CHECK class_schedule.public_product (db/class_public_products_trung_cap.sql).
// Lớp nào hiện trên landing do DỮ LIỆU quyết (class_schedule.public_enroll=true), không do danh sách này.
// Solo / Đệm hát nâng cao vẫn là sản phẩm (Admin + kích hoạt gói dùng) nhưng hiện không tuyển công khai.
export type PublicProductKey =
  | 'dem_hat_can_ban' | 'guitar_can_ban' | 'dem_hat_trung_cap' | 'guitar_trung_cap'
  | 'dem_hat_nang_cao' | 'solo_guitar'
export type PublicProduct = { key: PublicProductKey; title: string; desc: string; path: 'dem_hat' | 'tia_not' }
export const PRODUCTS: Record<PublicProductKey, PublicProduct> = {
  dem_hat_can_ban: { key: 'dem_hat_can_ban', title: 'Đệm hát căn bản', path: 'dem_hat',
    desc: 'Dành cho người mới muốn vừa đàn vừa hát những bài mình yêu thích.' },
  guitar_can_ban: { key: 'guitar_can_ban', title: 'Guitar căn bản', path: 'tia_not',
    desc: 'Dành cho người mới muốn bắt đầu từ những điều cơ bản và chơi những giai điệu đầu tiên.' },
  dem_hat_trung_cap: { key: 'dem_hat_trung_cap', title: 'Đệm hát trung cấp', path: 'dem_hat',
    desc: 'Dành cho người đã biết hợp âm, đã đệm được một số bài và muốn chơi chắc hơn.' },
  guitar_trung_cap: { key: 'guitar_trung_cap', title: 'Guitar trung cấp', path: 'tia_not',
    desc: 'Dành cho người đã biết chơi Guitar một thời gian và muốn phát triển kỹ năng, giai điệu tốt hơn.' },
  dem_hat_nang_cao: { key: 'dem_hat_nang_cao', title: 'Đệm hát nâng cao', path: 'dem_hat',
    desc: 'Dành cho người đã đệm hát vững và muốn xử lý bài hát trọn vẹn, có màu sắc riêng.' },
  solo_guitar: { key: 'solo_guitar', title: 'Solo Guitar', path: 'tia_not',
    desc: 'Dành cho người muốn tự chơi trọn một bài hát bằng tiếng đàn Guitar.' },
}
// Thứ tự hiện các lớp đang tuyển (lớp khác nếu được bật tuyển thì xếp sau)
// Các lớp Mira được giới thiệu (lớp đang mở cửa tuyển). Lịch/ngày khai giảng Mira KHÔNG lấy ở đây —
// dữ liệu đó sống trong class_schedule; Mira hướng khách tới mục "Các lớp đang tuyển sinh".
export const MIRA_CLASSES: PublicProductKey[] = ['dem_hat_can_ban', 'guitar_can_ban', 'dem_hat_trung_cap', 'guitar_trung_cap']
export const PUBLIC_ORDER: PublicProductKey[] = ['dem_hat_can_ban', 'guitar_can_ban', 'dem_hat_trung_cap', 'guitar_trung_cap', 'dem_hat_nang_cao', 'solo_guitar']

// ─── 3 cửa vào — theo nhu cầu của khách; nút đưa tới đúng lớp đang tuyển ───
export const DOORS: { dq: string; badge: string; desc: string; cta: string; product?: PublicProductKey; options?: PublicProductKey[] }[] = [
  { dq: 'Tôi muốn vừa đàn vừa hát', badge: 'Đệm hát căn bản', desc: PRODUCTS.dem_hat_can_ban.desc, cta: 'Bắt đầu Đệm hát', product: 'dem_hat_can_ban' },
  { dq: 'Tôi muốn học Guitar từ gốc', badge: 'Guitar căn bản', desc: PRODUCTS.guitar_can_ban.desc, cta: 'Bắt đầu Guitar căn bản', product: 'guitar_can_ban' },
  { dq: 'Tôi đã biết chơi và muốn tiến xa hơn', badge: 'Lớp trung cấp', desc: 'Chọn lớp trung cấp theo điều bạn muốn chơi tốt hơn. Chưa chắc lớp nào hợp với mình? Hỏi Mira nhé.', cta: 'Xem lớp trung cấp', options: ['dem_hat_trung_cap', 'guitar_trung_cap'] },
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
  'Tôi nên học lớp nào?': 'Mới bắt đầu: thích hát thì chọn <b>Đệm hát căn bản</b>, muốn học từ gốc và chơi giai điệu thì chọn <b>Guitar căn bản</b>. Đã biết chơi rồi: chọn <b>Đệm hát trung cấp</b> hoặc <b>Guitar trung cấp</b>.',
  'Học phí thế nào?': 'Cùng một lớp, bạn chọn cách đồng hành: <b>Theo tháng 499.000đ/tháng</b>, hoặc <b>Đồng hành 6 tháng 396.000đ/tháng</b> (2.376.000đ) với đầy đủ quyền lợi.',
  'Đệm hát hay Guitar?': 'Muốn tự đàn hát → <b>Đệm hát</b>. Muốn chơi giai điệu bằng tiếng đàn → <b>Guitar</b>. Bạn thiên về cái nào?',
  'Lịch học ra sao?': 'Mỗi lớp học một buổi mỗi tuần, buổi tối. Lịch và ngày khai giảng của từng lớp có ở mục <b>Các lớp đang tuyển sinh</b>.',
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
}
