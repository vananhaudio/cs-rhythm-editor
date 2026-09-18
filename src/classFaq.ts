// FAQ trang tuyển sinh /class. Mỗi mục: q (câu hỏi) + a (mảng block).
// block là string = đoạn văn; string[] = danh sách gạch đầu dòng;
// { link, label } = nút deep-link (mở đúng modal/section qua runXem).
// QUY ƯỚC (vòng audit 1/9/2026): 7 câu ĐẦU là câu công khai — ngắn gọn,
// trả lời 7 chủ đề ưu tiên và link sâu thay vì copy cả bài giải thích;
// phần còn lại nằm sau "Xem tất cả câu hỏi →" (progressive disclosure).
export type FaqBlock = string | string[] | { link: string; label: string }
export interface Faq { q: string; a: FaqBlock[] }

export const FAQS: Faq[] = [
  // ─── 7 CÂU CÔNG KHAI (hiển thị trước) ───
  { q: 'Tôi đã biết chơi Guitar một chút rồi, bắt đầu ở đâu?', a: [
    'Bạn có thể chọn lớp trung cấp phù hợp với hướng muốn học: Đệm hát trung cấp hoặc Guitar trung cấp. Nếu chưa chắc lớp nào phù hợp, hãy hỏi Mira hoặc nhắn Thầy để được tư vấn.',
    { link: 'lopdangtuyen', label: 'Xem các lớp đang tuyển sinh →' },
  ] },
  { q: 'Tôi nên học lớp nào?', a: [
    'Mới bắt đầu: thích hát thì chọn Đệm hát căn bản, muốn học từ gốc và chơi giai điệu thì chọn Guitar căn bản. Đã biết chơi rồi thì chọn Đệm hát trung cấp hoặc Guitar trung cấp.',
    { link: 'lopdangtuyen', label: 'Xem các lớp đang tuyển sinh →' },
  ] },
  { q: 'Học phí thế nào?', a: [
    'Cùng một lớp học, bạn chỉ chọn cách đồng hành: Theo tháng 499.000đ/tháng (lớp và tài liệu của tháng đó), hoặc Đồng hành 6 tháng 396.000đ/tháng — tổng 2.376.000đ — kèm kho bài giảng, App đầy đủ, sách, hỏi Thầy, thực hành và cộng đồng.',
  ] },
  { q: 'Nếu tôi bận, lỡ một buổi thì sao?', a: [
    'Bạn báo Thầy trong nhóm lớp để được hướng dẫn theo kịp. Có App và nhóm lớp, bạn vẫn ôn lại được nội dung buổi đó.',
  ] },
  { q: 'Sau khi đăng ký, tôi bắt đầu thế nào?', a: [
    'Bạn nhận hướng dẫn kích hoạt tài khoản, cài App và Zoom, vào nhóm học, và biết rõ buổi đầu tiên của mình. Thầy hỗ trợ bạn trong suốt quá trình bắt đầu.',
    { link: 'batdau', label: 'Xem chi tiết từng bước →' },
  ] },
  { q: 'Tôi được hỗ trợ khi gặp chỗ không hiểu ra sao?', a: [
    'Gặp chỗ vướng, bạn hỏi Thầy qua Zalo — Thầy giải thích lại, chỉ ra chỗ đang sai và bước tiếp theo. Ngoài ra còn có nhóm học và kho bài giảng để ôn lại.',
    { link: 'thay', label: 'Xem cách hỏi Thầy →' },
  ] },
  { q: 'Có thể học thử / bắt đầu Free không?', a: [
    'Có. Bạn tải App Thầy Văn Anh Guitar và tự tạo tài khoản miễn phí trực tiếp trên App để bắt đầu — khoá Nhập Môn và Nhạc lý cơ bản mở ngay. Học phí chỉ khi bạn quyết định học cùng Thầy.',
    { link: 'signup', label: 'Tải App →' },
  ] },

  // ─── PHẦN CÒN LẠI (sau "Xem tất cả câu hỏi →") ───
  { q: 'Lớp học là online hay học trực tiếp tại trung tâm?', a: [
    'Các lớp của Thầy Văn Anh được tổ chức online trực tiếp qua Zoom — học cùng Thầy theo lịch lớp, không phải video quay sẵn. Mỗi tuần một buổi cùng Thầy theo lịch lớp.',
    'Ngoài giờ học, bạn tự luyện trên App TVA Guitar và ôn lại bài bất cứ lúc nào.',
  ] },
  { q: 'Tôi mới hoàn toàn từ số 0 thì nên bắt đầu từ lớp nào?', a: [
    'Nếu bạn mới hoàn toàn, có 2 cửa vào: thích hát thì bắt đầu với Đệm hát căn bản; muốn học guitar từ gốc — nốt nhạc, cần đàn, giai điệu — thì bắt đầu với Guitar căn bản.',
    'Chưa chắc hướng nào thì làm bài test hoặc hỏi trợ lý để được gợi ý.',
    { link: 'quiz', label: 'Làm bài test xếp trình độ →' },
  ] },
  { q: 'Tôi chưa biết gì về nhạc lý có học được không?', a: [
    'Được. Các lớp căn bản không yêu cầu biết nhạc lý trước — những kiến thức cần thiết được đưa vào từng bước trong quá trình học.',
  ] },
  { q: 'Tôi lớn tuổi rồi, học guitar có muộn không?', a: [
    'Không muộn. Nhiều học viên bắt đầu khi đã đi làm, có gia đình. Quan trọng là bài học rõ ràng, chia nhỏ, có hướng dẫn cụ thể và không tạo áp lực học quá nhanh.',
  ] },
  { q: 'Tôi không có năng khiếu âm nhạc thì có học được không?', a: [
    'Được. Giai đoạn đầu bạn cần cách học rõ ràng, bài tập vừa sức và luyện tập đều đặn hơn là năng khiếu — phương pháp học đúng mới giúp bạn đi bền.',
  ] },
  { q: 'Tôi nên học Đệm hát hay Guitar căn bản trước?', a: [
    'Muốn vừa đàn vừa hát ngay thì bắt đầu với Đệm hát căn bản. Muốn học guitar từ gốc — hiểu nốt nhạc, vị trí trên cần đàn và giai điệu — thì Guitar căn bản là nền tảng rất tốt.',
  ] },
  { q: 'Lớp Đệm Hát căn bản học những gì?', a: [
    'Lớp Đệm Hát căn bản dành cho người mới muốn tự đàn và hát các bài yêu thích. Bạn sẽ học:',
    ['Hợp âm căn bản', 'Cách chuyển hợp âm', 'Phách và nhịp', 'Cách giữ tay phải ổn định', 'Cách đàn và hát cho khớp tông', 'Cách đưa hợp âm vào bài hát đơn giản'],
  ] },
  { q: 'Lớp Guitar căn bản học những gì?', a: [
    'Lớp này dành cho người mới muốn học guitar từ gốc theo hướng chơi giai điệu. Bạn sẽ học:',
    ['Nốt nhạc căn bản', 'Vị trí nốt trên cần đàn', 'Cách bấm từng nốt', 'Làm quen với bản nhạc', 'Chơi những giai điệu đơn giản đầu tiên', 'Chủ yếu ở các giọng dễ như C và Am để không bị quá tải'],
  ] },
  { q: 'Tôi đã học guitar lâu rồi nhưng vẫn bị chững lại, nên học lớp nào?', a: [
    'Đệm bài nào cũng giống bài nào, nhịp chưa chắc, muốn đệm hay hơn → Đệm hát trung cấp. Đã chơi một thời gian nhưng muốn chơi giai điệu tốt hơn, bài bản hơn → Guitar trung cấp. Chưa chắc thì hỏi Mira để được gợi ý.',
    { link: 'chat', label: 'Hỏi Mira →' },
  ] },
  { q: 'Học online qua Zoom có hiệu quả không?', a: [
    'Có, nhờ hệ thống hỗ trợ quanh buổi học: Zoom học trực tiếp cùng Thầy, App để xem lại và luyện tập, nhóm lớp để nhận thông báo và trao đổi — không bị rơi vào tình trạng xem xong rồi tự bơi.',
  ] },
  { q: 'App TVA Guitar dùng để làm gì?', a: [
    'App là nơi bạn học bài, ôn tập, luyện theo hướng dẫn và theo dõi tiến độ sau mỗi buổi học — như "ba lô học tập" đi cùng bạn.',
    { link: 'app', label: 'Xem App TVA Guitar →' },
  ] },
  { q: 'Nếu tôi lỡ nghỉ một buổi thì sao?', a: [
    'Bạn nên báo lại với lớp hoặc trợ lý để được hướng dẫn theo kịp. Có App và nhóm lớp hỗ trợ, bạn vẫn ôn lại được phần nội dung chính — nhưng nên tham gia đầy đủ vì buổi trực tiếp giúp Thầy quan sát và sửa lỗi cho bạn.',
  ] },
  { q: 'Tôi đăng ký học trong bao lâu?', a: [
    'Tuỳ bạn chọn cách đồng hành khi đăng ký: Theo tháng, hoặc Đồng hành 6 tháng. Mỗi tuần một buổi cùng Thầy, hằng ngày luyện tập cùng App.',
  ] },
  { q: 'Học một thời gian rồi, tôi có được hướng dẫn học tiếp không?', a: [
    'Có. Thầy theo dõi quá trình học của bạn và sẽ tư vấn bước phù hợp tiếp theo. Bạn cũng có thể hỏi Mira hoặc nhắn Thầy bất cứ lúc nào.',
    { link: 'chat', label: 'Hỏi Mira →' },
  ] },
  { q: 'Tôi có cần mua đàn tốt mới học được không?', a: [
    'Không cần đàn quá đắt ngay từ đầu. Bạn cần một cây đàn dễ bấm, âm thanh ổn và kích thước phù hợp — đàn quá cứng, action quá cao thì người mới rất dễ nản.',
    'Chưa chắc đàn hiện tại có phù hợp không, bạn có thể hỏi trợ lý hoặc gửi hình/video ngắn để được tư vấn.',
  ] },
  { q: 'Tôi học trên YouTube nhiều rồi, lớp này có khác gì?', a: [
    'YouTube có nhiều kiến thức nhưng người học dễ bị học rời rạc — không biết thứ nào cần trước, thứ nào cần sau và mình đang thiếu mảnh nào. Lớp học giúp bạn học có thứ tự rõ ràng, có người hướng dẫn, có bài tập, có App để ôn và nhóm lớp để được hỗ trợ.',
  ] },
  { q: 'Làm sao biết tôi phù hợp lớp nào?', a: [
    'Bạn không cần tự đoán. Hỏi Mira hoặc nhắn Thầy để được gợi ý đúng lớp.',
    { link: 'chat', label: 'Hỏi Mira →' },
  ] },
]
