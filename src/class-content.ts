// NỘI DUNG CHỮ của trang tuyển sinh — tách khỏi component để:
//   1) sửa nội dung không phải lục trong mã giao diện;
//   2) Mira đọc được (script scripts/mira-content.mjs bóc file này thành JSON cho Mira).
// Sửa xong nhớ chạy: npm run mira:content
//
// NGUYÊN TẮC PUBLIC (09/2026): khách chỉ cần biết lớp nào hợp với mình, học lúc nào, khai giảng
// khi nào, đăng ký ở đâu. KHÔNG đưa ra ngoài: số buổi/thời hạn trên tên lớp, tuyến/lộ trình,
// cách Thầy xếp lớp sau đó, chặng/module, mã nội bộ (DH/TN…). Thời hạn chỉ xuất hiện ở checkout.

// ─── SẢN PHẨM (lớp) — key khớp CHECK class_schedule.public_product (db/class_model_t3_t4.sql).
// Lớp nào hiện trên landing do DỮ LIỆU quyết (class_schedule.public_enroll=true), không do danh sách này.
//   kind 'entry' = LỚP CỬA VÀO (chạy vòng ngắn, không phải curriculum dài hạn) → khu "Bắt đầu học Guitar"
//   kind 'main'  = LỚP CHÍNH (dài hạn theo slot; tên hiển thị = chặng đang học, class_stages) → khu "Các lớp đang nhận học viên"
// legacy: key của các phương án trước (còn trong CHECK để dữ liệu cũ hợp lệ) — không dùng cho lớp mới.
export type PublicProductKey =
  | 'guitar_can_ban_1' | 'guitar_can_ban_2' | 'solo_guitar' | 'dem_hat_nang_cao'
  | 'dem_hat_can_ban' | 'guitar_can_ban' | 'dem_hat_trung_cap' | 'guitar_trung_cap'
export type PublicProduct = { key: PublicProductKey; title: string; desc: string; path: string; kind: 'entry' | 'main'; legacy?: boolean }
export const PRODUCTS: Record<PublicProductKey, PublicProduct> = {
  guitar_can_ban_1: { key: 'guitar_can_ban_1', title: 'Guitar căn bản 1', kind: 'entry', path: 'guitar',
    desc: 'Bạn chưa biết gì về Guitar? Bắt đầu từ đây.' },
  guitar_can_ban_2: { key: 'guitar_can_ban_2', title: 'Guitar căn bản 2', kind: 'entry', path: 'guitar',
    desc: 'Bạn đã học Guitar một thời gian nhưng vẫn chưa tiến bộ như mong muốn? Vào lớp để củng cố những phần còn yếu, học thêm những kỹ năng mới và đưa khả năng chơi Guitar lên một mức cao hơn.' },
  solo_guitar: { key: 'solo_guitar', title: 'Solo Guitar', kind: 'main', path: 'solo',
    desc: 'Tự chơi trọn một bài hát bằng tiếng đàn: giai điệu, bass và hoà âm cùng lúc.' },
  dem_hat_nang_cao: { key: 'dem_hat_nang_cao', title: 'Đệm hát nâng cao', kind: 'main', path: 'dem_hat',
    desc: 'Đệm hát chắc nhịp, đa dạng điệu và xử lý bài hát trọn vẹn, có màu sắc riêng.' },
  dem_hat_can_ban: { key: 'dem_hat_can_ban', title: 'Đệm hát căn bản', kind: 'entry', path: 'dem_hat', legacy: true, desc: '' },
  guitar_can_ban: { key: 'guitar_can_ban', title: 'Guitar căn bản', kind: 'entry', path: 'tia_not', legacy: true, desc: '' },
  dem_hat_trung_cap: { key: 'dem_hat_trung_cap', title: 'Đệm hát trung cấp', kind: 'entry', path: 'dem_hat', legacy: true, desc: '' },
  guitar_trung_cap: { key: 'guitar_trung_cap', title: 'Guitar trung cấp', kind: 'entry', path: 'tia_not', legacy: true, desc: '' },
}
// Thứ tự hiện trong mỗi khu
export const PUBLIC_ORDER: PublicProductKey[] = ['guitar_can_ban_1', 'guitar_can_ban_2', 'solo_guitar', 'dem_hat_nang_cao']
// Lớp cửa vào Mira giới thiệu cho người mới. Lớp chính Mira tra dữ liệu thật (public_enroll + chặng).
export const MIRA_CLASSES: PublicProductKey[] = ['guitar_can_ban_1', 'guitar_can_ban_2']

// ─── LỘ TRÌNH HỌC THUẬT CHÍNH THỨC (09/2026) — cho Mira/tư vấn. Khác lớp cửa vào (không là tiên quyết).
// Mã TN2–TN4 là dữ liệu LEGACY (vẫn giải thích được nội dung); bảng course_prereqs trong DB giữ nguyên
// vì đang dùng để mở khoá cho học viên cũ — không phải bản đồ tư vấn hiện hành.
export const CURRICULUM = {
  branches: [
    { name: 'Nhánh Đệm hát', steps: ['Đệm 1 (DH1)', 'Đệm 2 (DH2)', 'Đệm 3 (DH3)', 'Đệm hát nâng cao (DHNC)'] },
    { name: 'Nhánh Tỉa nốt / Solo', steps: ['Tỉa 1 (TN1)', 'Solo 1', 'Solo 2', 'Solo nâng cao'] },
  ],
  notes: [
    'Solo 1 đã bao gồm phần nội dung trước đây là Tỉa 2 (TN2).',
    'Lộ trình cũ TN1 → TN2 → TN3 → TN4 → Solo KHÔNG còn là lộ trình tư vấn hiện hành; mã TN2/TN3/TN4 vẫn dùng để giải thích nội dung các khoá đã học.',
    'Guitar căn bản 1 / 2 là lớp bắt đầu, không phải bậc bắt buộc trong lộ trình: người đã có nền được Thầy tư vấn vào lớp chính phù hợp.',
    'Lớp chính học theo chặng (mỗi chặng tập trung một nhóm kỹ năng); học viên phù hợp có thể vào lớp khi lớp đang học — Thầy quyết định.',
  ],
}

// ─── 3 cửa vào — theo tình trạng của khách; không bắt người mới chọn Đệm hay Solo ───
export const DOORS: { dq: string; badge: string; desc: string; cta: string; product?: PublicProductKey; toMain?: boolean }[] = [
  { dq: 'Tôi chưa biết gì về Guitar', badge: 'Guitar căn bản 1', desc: PRODUCTS.guitar_can_ban_1.desc, cta: 'Bắt đầu từ đây', product: 'guitar_can_ban_1' },
  { dq: 'Tôi đã học nhưng chưa tiến bộ như mong muốn', badge: 'Guitar căn bản 2', desc: 'Củng cố phần còn yếu, học thêm kỹ năng mới và chơi Guitar lên một mức cao hơn.', cta: 'Xem lớp Guitar căn bản 2', product: 'guitar_can_ban_2' },
  { dq: 'Tôi đã có nền và muốn học Solo hoặc Đệm hát chuyên sâu', badge: 'Lớp đang nhận học viên', desc: 'Xem các lớp Solo Guitar / Đệm hát đang nhận học viên. Chưa chắc lớp nào hợp với mình? Hỏi Mira nhé.', cta: 'Xem các lớp', toMain: true },
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
  'Tôi nên học lớp nào?': 'Chưa biết gì về Guitar → <b>Guitar căn bản 1</b>. Đã học một thời gian nhưng chưa tiến bộ như mong muốn → <b>Guitar căn bản 2</b>. Đã có nền rõ và muốn học Solo hoặc Đệm hát chuyên sâu → xem mục <b>Các lớp đang nhận học viên</b>.',
  'Học phí thế nào?': 'Cùng một lớp, bạn chọn cách đồng hành: <b>Theo tháng 499.000đ/tháng</b>, hoặc <b>Đồng hành 6 tháng 396.000đ/tháng</b> (2.376.000đ) với đầy đủ quyền lợi.',
  'Tôi có phải chọn Đệm hát hay Solo ngay không?': 'Không cần. Người mới cứ bắt đầu ở <b>Guitar căn bản 1</b>; trong quá trình học Thầy sẽ tư vấn hướng phù hợp với bạn.',
  'Lịch học ra sao?': 'Mỗi lớp học một buổi mỗi tuần, buổi tối. Lịch và ngày khai giảng từng lớp có ngay trên trang.',
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
