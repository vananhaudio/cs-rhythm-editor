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
    'Tuỳ chỗ bạn đang đứng: chuyển hợp âm còn chậm, nhịp chưa chắc thì củng cố lại nền; đã đệm được vài bài thì học tiếp trình độ cao hơn. Làm bài test hoặc hỏi Thầy để xếp đúng trình độ — tránh học lại thứ đã biết hoặc nhảy quá nhanh.',
    { link: 'quiz', label: 'Làm bài test xếp trình độ →' },
  ] },
  { q: 'Gói Thực hành và Gói Học theo lớp khác nhau thế nào?', a: [
    'Gói Thực hành: linh hoạt — học theo hướng và nhóm trình độ của bạn, chủ động chọn buổi thực hành theo lịch hàng tuần. Gói Học theo lớp: cố định — học cùng một lớp từ ngày khai giảng đến hết chương trình.',
    { link: 'cachhoc', label: 'Xem hai cách học chi tiết →' },
  ] },
  { q: 'Tôi có thể học cả hai không?', a: [
    'Có. Lớp giúp bạn đi lên theo chương trình; thực hành giúp bạn đi sâu vào kỹ năng. Bạn có thể đăng ký "Học cả hai" để kết hợp.',
  ] },
  { q: 'Nếu tôi bận, lịch không cố định thì sao?', a: [
    'Gói Thực hành sinh ra cho trường hợp này: bạn chủ động chọn buổi phù hợp mỗi tuần, không cần cố định một ngày. Học theo lớp thì cần tham gia buổi học chính theo lịch lớp.',
    { link: 'thuchanh', label: 'Xem lịch thực hành →' },
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
    'Các lớp của Thầy Văn Anh được tổ chức online trực tiếp qua Zoom — học cùng Thầy theo lịch lớp, không phải video quay sẵn. Mỗi khoá khoảng 2 tháng, gồm 8 buổi, mỗi buổi 90 phút.',
    'Ngoài giờ học, bạn tự luyện trên App TVA Guitar và ôn lại bài bất cứ lúc nào.',
  ] },
  { q: 'Tôi mới hoàn toàn từ số 0 thì nên bắt đầu từ lớp nào?', a: [
    'Nếu bạn mới hoàn toàn, có 2 cửa vào: thích hát thì bắt đầu với Đệm Hát căn bản (Khởi Đầu Đam Mê 1); muốn học guitar từ gốc — nốt nhạc, cần đàn, giai điệu — thì bắt đầu với Guitar căn bản (Tỉa Nốt 1).',
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
    'Được. Giai đoạn đầu bạn cần lộ trình rõ, bài tập vừa sức và luyện tập đều đặn hơn là năng khiếu — phương pháp học đúng mới giúp bạn đi bền.',
  ] },
  { q: 'Tôi nên học Đệm Hát hay Tỉa Nốt trước?', a: [
    'Muốn vừa đàn vừa hát ngay thì bắt đầu với Đệm Hát 1. Muốn học guitar từ gốc — hiểu nốt nhạc, vị trí trên cần đàn và giai điệu — thì Tỉa Nốt 1 là nền tảng rất tốt.',
    'Sau này bạn có thể bổ sung hướng còn lại hoặc đi tiếp các lớp phù hợp.',
  ] },
  { q: 'Lớp Đệm Hát căn bản học những gì?', a: [
    'Lớp Đệm Hát căn bản dành cho người mới muốn tự đàn và hát các bài yêu thích. Bạn sẽ học:',
    ['Hợp âm căn bản', 'Cách chuyển hợp âm', 'Phách và nhịp', 'Cách giữ tay phải ổn định', 'Cách đàn và hát cho khớp tông', 'Cách đưa hợp âm vào bài hát đơn giản'],
  ] },
  { q: 'Lớp Guitar căn bản / Tỉa Nốt 1 học những gì?', a: [
    'Lớp này dành cho người mới muốn học guitar từ gốc theo hướng chơi giai điệu. Bạn sẽ học:',
    ['Nốt nhạc căn bản', 'Vị trí nốt trên cần đàn', 'Cách bấm từng nốt', 'Làm quen với bản nhạc', 'Chơi những giai điệu đơn giản đầu tiên', 'Chủ yếu ở các giọng dễ như C và Am để không bị quá tải'],
  ] },
  { q: 'Tôi đã học guitar lâu rồi nhưng vẫn bị chững lại, nên học lớp nào?', a: [
    'Nhóm này cần xác định mình đang kẹt ở đâu. Đệm bài nào cũng giống bài nào, chưa biết phát triển điệu, bố cục, dồn nhịp → Đệm Hát 2. Chơi theo tab được nhưng không hiểu nốt, chưa liên kết bản nhạc với cần đàn → Tỉa Nốt 2. Muốn nghe bài hát rồi tự tìm giai điệu → Tỉa Nốt 3 hoặc Lớp Hành Trình.',
    { link: 'quiz', label: 'Làm bài test xếp trình độ →' },
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
  { q: 'Một khóa học kéo dài bao lâu?', a: [
    'Một khoá khoảng 2 tháng, gồm 8 buổi học, mỗi buổi 90 phút — hằng ngày luyện tập cùng App.',
    'Mỗi khoá là một chặng nhỏ trong lộ trình: học xong, bạn có thể luyện thêm hoặc học tiếp chặng sau khi sẵn sàng.',
  ] },
  { q: 'Học phí một khóa là bao nhiêu?', a: [
    'Học phí từng khóa hiện tại là 990.000đ / khóa (2 tháng / 8 buổi học).',
    'Riêng lớp HÀNH TRÌNH 2027 là combo trọn 10 khóa, học phí 9.990.000đ (tiết kiệm so với học lẻ).',
    'Ngoài buổi học, học viên còn được sử dụng App TVA Guitar, tham gia nhóm lớp và nhận hướng dẫn theo lộ trình của khóa.',
  ] },
  { q: 'Sau khi học xong khóa đầu tiên thì tôi học tiếp gì?', a: [
    'Đệm Hát 1 xong → Đệm Hát 2 (tiết tấu, điệu, bố cục). Tỉa Nốt 1 xong → Tỉa Nốt 2 (thị tấu, chơi nhiều giọng hơn). Đã có nền tốt hơn → Tỉa Nốt 3, Đệm Hát 3 hoặc Lớp Hành Trình.',
    { link: 'hanhtrinh', label: 'Xem bản đồ hành trình →' },
  ] },
  { q: 'Lớp Hành Trình là gì?', a: [
    'Lớp Hành Trình dành cho học viên đã có nền tảng nhất định, muốn kết nối các mảnh học rời rạc thành một hệ thống: đệm hát, tỉa nốt, cảm âm, hòa âm, xử lý bài hát, Solo Guitar.',
    'Lớp này phù hợp với người đã qua các trình độ căn bản — không phải điểm bắt đầu cho người mới hoàn toàn.',
  ] },
  { q: 'Tôi có cần mua đàn tốt mới học được không?', a: [
    'Không cần đàn quá đắt ngay từ đầu. Bạn cần một cây đàn dễ bấm, âm thanh ổn và kích thước phù hợp — đàn quá cứng, action quá cao thì người mới rất dễ nản.',
    'Chưa chắc đàn hiện tại có phù hợp không, bạn có thể hỏi trợ lý hoặc gửi hình/video ngắn để được tư vấn.',
  ] },
  { q: 'Tôi học trên YouTube nhiều rồi, lớp này có khác gì?', a: [
    'YouTube có nhiều kiến thức nhưng người học dễ bị học rời rạc — không biết thứ nào cần trước, thứ nào cần sau và mình đang thiếu mảnh nào. Lớp học giúp bạn đi theo lộ trình rõ, có người hướng dẫn, có bài tập, có App để ôn và nhóm lớp để được hỗ trợ.',
  ] },
  { q: 'Làm sao biết tôi phù hợp lớp nào?', a: [
    'Bạn không cần tự đoán. Làm bài test xếp trình độ, hỏi trợ lý tư vấn, hoặc xem bản đồ Hành Trình 2027 để biết mình đang ở đâu trên lộ trình dài hạn.',
    { link: 'quiz', label: 'Làm bài test xếp trình độ →' },
    { link: 'hanhtrinh', label: 'Xem bản đồ hành trình →' },
  ] },
]
