// FAQ trang tuyển sinh /class. Mỗi mục: q (câu hỏi) + a (mảng block).
// block là string = đoạn văn; block là string[] = danh sách gạch đầu dòng.
export type FaqBlock = string | string[]
export interface Faq { q: string; a: FaqBlock[] }

export const FAQS: Faq[] = [
  { q: 'Lớp học là online hay học trực tiếp tại trung tâm?', a: [
    'Các lớp Guitar của Thầy Văn Anh hiện được tổ chức theo hình thức online trực tiếp qua Zoom.',
    'Mỗi khóa thường kéo dài khoảng 2 tháng, gồm 8 buổi học Zoom trên lớp, mỗi buổi khoảng 90 phút. Trong buổi học, bạn được học trực tiếp cùng thầy, theo lịch lớp cố định — không phải video quay sẵn.',
    'Ngoài giờ học Zoom, bạn có thể tự luyện hằng ngày trên app TVA Guitar 24/24 để xem lại bài, ôn tập, làm bài tập và theo dõi tiến độ.',
    'Hiện tại, hệ thống ưu tiên lớp online để học viên ở nhiều tỉnh thành vẫn có thể tham gia. Nếu có lớp trực tiếp hoặc workshop offline, thầy sẽ thông báo riêng theo từng thời điểm.' ] },
  { q: 'Tôi mới hoàn toàn từ số 0 thì nên bắt đầu từ lớp nào?', a: [
    'Nếu bạn mới hoàn toàn, có 2 cửa vào phù hợp.',
    'Nếu bạn thích hát, hay hát karaoke, muốn vừa đàn vừa hát, bạn nên bắt đầu với Đệm Hát căn bản – Khởi Đầu Đam Mê 1.',
    'Nếu bạn muốn học guitar từ gốc, làm quen với nốt nhạc, vị trí trên cần đàn và chơi những giai điệu đầu tiên, bạn có thể bắt đầu với Guitar căn bản (Tỉa Nốt 1).',
    'Nếu chưa chắc mình phù hợp hướng nào, bạn có thể làm bài test nhanh hoặc hỏi trợ lý để được gợi ý.' ] },
  { q: 'Tôi chưa biết gì về nhạc lý có học được không?', a: [
    'Được. Các lớp căn bản được thiết kế cho người mới, không yêu cầu bạn phải biết nhạc lý trước. Những kiến thức cần thiết sẽ được đưa vào từng bước trong quá trình học.',
    'Điều quan trọng nhất ở giai đoạn đầu không phải là biết nhiều lý thuyết, mà là bắt đầu đúng, tập đúng và hiểu mình đang luyện điều gì.' ] },
  { q: 'Tôi lớn tuổi rồi, học guitar có muộn không?', a: [
    'Không muộn. Rất nhiều học viên bắt đầu học guitar khi đã đi làm, đã có gia đình, thậm chí lớn tuổi hơn. Vấn đề không nằm ở tuổi, mà nằm ở cách học có phù hợp hay không.',
    'Với người lớn, điều quan trọng là bài học cần rõ ràng, chia nhỏ, có hướng dẫn cụ thể và không tạo áp lực phải học quá nhanh.' ] },
  { q: 'Tôi không có năng khiếu âm nhạc thì có học được không?', a: [
    'Có thể học được. Ở giai đoạn đầu, bạn không cần năng khiếu đặc biệt. Bạn cần một lộ trình rõ, bài tập vừa sức và sự luyện tập đều đặn.',
    'Năng khiếu có thể giúp một số người đi nhanh hơn, nhưng phương pháp học đúng mới là thứ giúp người học đi bền và không bỏ cuộc giữa chừng.' ] },
  { q: 'Tôi nên học Đệm Hát hay Tỉa Nốt trước?', a: [
    'Nếu xét theo hướng học guitar từ gốc, Tỉa Nốt 1 là nền tảng rất tốt vì giúp bạn hiểu nốt nhạc, vị trí trên cần đàn và giai điệu.',
    'Nhưng thực tế nhiều học viên đến với guitar vì muốn vừa đàn vừa hát. Nếu mục tiêu trước mắt của bạn là đàn hát ngay, bạn có thể bắt đầu với Đệm Hát 1.',
    'Sau đó, khi muốn hiểu cây đàn sâu hơn, bạn có thể bổ sung Tỉa Nốt 1 hoặc đi tiếp các lớp phù hợp.' ] },
  { q: 'Lớp Đệm Hát căn bản học những gì?', a: [
    'Lớp Đệm Hát căn bản dành cho người mới muốn tự đàn và hát các bài yêu thích. Bạn sẽ học:',
    ['Hợp âm căn bản', 'Cách chuyển hợp âm', 'Phách và nhịp', 'Cách giữ tay phải ổn định', 'Cách đàn và hát cho khớp tông', 'Cách đưa hợp âm vào bài hát đơn giản'],
    'Đây là lớp nền cho người muốn bắt đầu theo hướng vừa đàn vừa hát.' ] },
  { q: 'Lớp Guitar căn bản / Tỉa Nốt 1 học những gì?', a: [
    'Lớp này dành cho người mới muốn học guitar từ gốc theo hướng chơi giai điệu. Bạn sẽ học:',
    ['Nốt nhạc căn bản', 'Vị trí nốt trên cần đàn', 'Cách bấm từng nốt', 'Làm quen với bản nhạc', 'Chơi những giai điệu đơn giản đầu tiên', 'Chủ yếu ở các giọng dễ như C và Am để không bị quá tải'],
    'Đây là lớp giúp bạn hiểu cây đàn như một bản đồ âm thanh, không chỉ là dây và phím.' ] },
  { q: 'Tôi đã biết vài hợp âm rồi thì có cần học lại từ đầu không?', a: [
    'Chưa chắc. Nếu bạn đã biết vài hợp âm nhưng chuyển còn chậm, nhịp chưa chắc, hát vào bị lệch hoặc chưa biết bắt tông, bạn vẫn có thể cần củng cố lại nền tảng Đệm Hát 1.',
    'Nếu bạn đã đệm được vài bài cơ bản, có thể bạn phù hợp với Đệm Hát 2.',
    'Tốt nhất là làm bài test hoặc hỏi trợ lý để xếp đúng trình độ, tránh học lại thứ đã biết hoặc nhảy quá nhanh sang phần chưa đủ nền.' ] },
  { q: 'Tôi đã học guitar lâu rồi nhưng vẫn bị chững lại, nên học lớp nào?', a: [
    'Nhóm này cần xác định mình đang kẹt ở đâu.',
    'Nếu bạn đệm bài nào cũng giống bài nào, chưa biết phát triển điệu, bố cục, dồn nhịp, ngắt nghỉ, bạn có thể phù hợp với Đệm Hát 2.',
    'Nếu bạn chơi theo tab được nhưng không hiểu nốt, không chơi được nhiều giọng, chưa liên kết bản nhạc với cần đàn, bạn có thể phù hợp với Tỉa Nốt 2.',
    'Nếu bạn muốn nghe bài hát rồi tự tìm giai điệu trên đàn, bạn có thể phù hợp với Tỉa Nốt 3 hoặc Lớp Hành Trình.' ] },
  { q: 'Học online qua Zoom có hiệu quả không?', a: [
    'Có, nếu có hệ thống hỗ trợ đủ rõ. Lớp học không chỉ là xem video một mình. Mô hình học gồm:',
    ['Zoom: học trực tiếp cùng thầy', 'App TVA Guitar: xem bài, ôn tập, theo dõi nội dung học', 'Nhóm lớp: nhận thông báo, hỗ trợ, nhắc bài và trao đổi trong quá trình học'],
    'Nhờ vậy, học viên không bị rơi vào tình trạng xem xong rồi tự bơi.' ] },
  { q: 'App TVA Guitar dùng để làm gì?', a: [
    'App TVA Guitar giúp học viên có nơi học và ôn tập sau buổi học. Trong app, bạn có thể xem bài học, theo dõi nội dung khóa học, luyện tập theo hướng dẫn và sử dụng các công cụ hỗ trợ học guitar.',
    'App không thay thế lớp học trực tiếp, mà đóng vai trò như “ba lô học tập” để bạn có thể ôn lại và luyện tập đều hơn.' ] },
  { q: 'Nếu tôi bận, mỗi tuần có ít thời gian thì học được không?', a: [
    'Học được, nhưng cần nghiêm túc sắp xếp thời gian. Mỗi khóa thường đi theo lộ trình cố định trong khoảng 2 tháng. Bạn cần tham gia buổi học chính và dành thêm thời gian luyện tập ở nhà.',
    'Không cần tập quá nhiều ngay từ đầu, nhưng cần đều. Guitar không tiến bộ bằng việc học thật nhiều trong một ngày rồi bỏ quên nhiều tuần, mà tiến bộ nhờ sự lặp lại ổn định.' ] },
  { q: 'Nếu tôi lỡ nghỉ một buổi thì sao?', a: [
    'Bạn nên báo lại với lớp hoặc trợ lý để được hướng dẫn cách theo kịp nội dung.',
    'Vì có app và nhóm lớp hỗ trợ, bạn vẫn có thể ôn lại phần nội dung chính. Tuy nhiên, bạn nên cố gắng tham gia đầy đủ vì buổi học trực tiếp giúp thầy quan sát, định hướng và sửa lỗi tốt hơn.' ] },
  { q: 'Một khóa học kéo dài bao lâu?', a: [
    'Một khóa thường kéo dài khoảng 2 tháng, gồm 8 buổi học. Mỗi buổi 90 phút học Zoom cùng cả lớp, hằng ngày luyện tập cùng app.',
    'Mỗi khóa là một chặng nhỏ trong lộ trình. Bạn không cần học cả hành trình ngay từ đầu. Chỉ cần chọn đúng chặng hiện tại, học xong có thể luyện thêm hoặc học tiếp chặng sau khi sẵn sàng.' ] },
  { q: 'Học phí một khóa là bao nhiêu?', a: [
    'Học phí từng khóa hiện tại là 990.000đ / khóa, trong khoảng 2 tháng / 8 buổi học.',
    'Riêng lớp HÀNH TRÌNH 2027 là combo trọn 10 khóa, học phí 9.990.000đ (tiết kiệm so với học lẻ).',
    'Ngoài buổi học, học viên còn được sử dụng app TVA Guitar, tham gia nhóm lớp và nhận hướng dẫn theo lộ trình của khóa.' ] },
  { q: 'Sau khi học xong khóa đầu tiên thì tôi học tiếp gì?', a: [
    'Tùy mục tiêu của bạn.',
    'Nếu bạn học Đệm Hát 1, bạn có thể đi tiếp Đệm Hát 2 để phát triển tiết tấu, điệu và bố cục đệm hát.',
    'Nếu bạn học Tỉa Nốt 1, bạn có thể đi tiếp Tỉa Nốt 2 để học thị tấu, chơi nhiều giọng hơn trên toàn cần đàn.',
    'Nếu đã có nền tốt hơn, bạn có thể đi tiếp Tỉa Nốt 3, Đệm Hát 3 hoặc Lớp Hành Trình.' ] },
  { q: 'Lớp Hành Trình là gì?', a: [
    'Lớp Hành Trình dành cho học viên đã có nền tảng nhất định và muốn đi sâu hơn. Đây là giai đoạn kết nối các mảnh học rời rạc thành một hệ thống:',
    ['Đệm hát', 'Tỉa nốt', 'Cảm âm', 'Hòa âm', 'Xử lý bài hát', 'Solo Guitar', 'Tư duy làm chủ cây đàn'],
    'Lớp này phù hợp hơn với người đã qua các trình độ căn bản, không phải điểm bắt đầu cho người mới hoàn toàn.' ] },
  { q: 'Tôi có cần mua đàn tốt mới học được không?', a: [
    'Không cần mua đàn quá đắt ngay từ đầu. Bạn cần một cây đàn dễ bấm, âm thanh ổn và kích thước phù hợp. Nếu đàn quá cứng, action quá cao hoặc khó bấm, người mới rất dễ nản.',
    'Nếu chưa chắc đàn hiện tại có phù hợp không, bạn có thể hỏi trợ lý hoặc gửi hình/video ngắn để được tư vấn thêm.' ] },
  { q: 'Tôi học trên YouTube nhiều rồi, lớp này có khác gì?', a: [
    'YouTube có rất nhiều kiến thức, nhưng người học thường dễ bị rơi vào tình trạng học rời rạc: hôm nay học một điệu, mai học một hợp âm, ngày khác học một đoạn tab — nhưng không biết thứ nào cần trước, thứ nào cần sau, và mình đang thiếu mảnh nào.',
    'Lớp học giúp bạn đi theo lộ trình rõ hơn, có người hướng dẫn, có bài tập, có app để ôn và có nhóm lớp để được hỗ trợ trong quá trình học.' ] },
  { q: 'Làm sao biết tôi phù hợp lớp nào?', a: [
    'Bạn có thể bắt đầu bằng một trong ba cách:',
    ['Làm bài test xếp trình độ — phù hợp nếu bạn muốn tự kiểm tra nhanh.', 'Hỏi trợ lý tư vấn — phù hợp nếu bạn đang phân vân giữa Đệm hát, Tỉa nốt hoặc Hành Trình.', 'Xem bản đồ Hành Trình 2027 — phù hợp nếu bạn đã học một thời gian và muốn hiểu mình đang ở đâu trên lộ trình dài hạn.'],
    'Bạn không cần tự đoán một mình. Điều quan trọng là chọn đúng chặng hiện tại, không học lan man và không học lại từ đầu nếu không cần thiết.' ] },
]
