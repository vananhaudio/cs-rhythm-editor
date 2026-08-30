/**
 * CHIỀU SÂU 6 QUYỀN LỢI — trang /class (ClassLandingPage).
 *
 * NGUỒN THAM CHIẾU CHUẨN: /azz (class2-site, class.vananhaudio.com/azz) —
 * các showcase LESSON_LIBRARY / SACH_SHOWCASE / ZALO_SHOWCASE /
 * COMMUNITY_SHOWCASE trong class2-site/src/content.ts.
 *
 * QUY ƯỚC ĐỒNG BỘ: /class và /azz là 2 repo riêng biệt, KHÔNG share code được.
 * → File này PHẢN CHIẾU NGUYÊN VĂN nội dung /azz (không viết lại, không thêm bớt).
 * Khi sửa nội dung: sửa /azz TRƯỚC (nguồn chuẩn), rồi đồng bộ sang file này.
 * Đường dẫn ảnh đã đổi sang /assets/... (public root của cs-rhythm-editor) —
 * chính là các file được copy từ class2-site/public/assets.
 */

// ─── KHO BÀI GIẢNG (nguồn: LESSON_LIBRARY trong class2-site/src/content.ts) ───
export const BENEFIT_LESSON_LIBRARY = {
  title: 'Kho bài giảng',
  stat: 'Hơn 2.500 video bài giảng Guitar',
  desc: 'Từ những bài học đầu tiên đến những nội dung chuyên sâu — một kho bài giảng được tích lũy qua nhiều năm giảng dạy của Thầy Văn Anh.',
  overview: {
    image: '/assets/youtube/library-overview.jpg',
    alt: 'Danh sách playlist kho bài giảng trên kênh Văn Anh Guitar',
    caption: 'Một phần kho bài giảng của Thầy Văn Anh',
  },
  video: {
    id: 'yN26lNZYwis',
    title: 'Bí Quyết Luyện Ngón Đàn: Từ Chạy 4 Nốt Đến 8 Nốt',
    thumb: '/assets/youtube/video-thumb-luyen-ngon.jpg',
    heading: 'Xem thử một bài giảng',
    desc: 'Một đoạn từ bài học thực tế của Thầy Văn Anh.',
  },
  shelves: [
    {
      name: 'Dành cho người mới',
      items: [
        { image: '/assets/youtube/kd16-khoi-dau-k16.jpg', label: 'Khởi đầu đam mê — Khoá 16', meta: '8 video' },
        { image: '/assets/youtube/kd15-khoi-dau-k15.jpg', label: 'Khởi đầu đam mê — Khoá 15', meta: '2 video' },
        { image: '/assets/youtube/kd14-khoi-dau-k14.jpg', label: 'Khởi đầu đam mê — Khoá 14', meta: '8 bài học' },
        { image: '/assets/youtube/kd13-khoi-dau-k13.jpg', label: 'Khởi đầu đam mê — Khoá 13', meta: '3 video' },
      ],
    },
    {
      name: 'Đệm hát',
      items: [
        { image: '/assets/youtube/cac-dieu-dem-hat.jpg', label: 'Các điệu đệm hát phổ biến', meta: '6 video' },
        { image: '/assets/youtube/dh2-dem-hat-td2.jpg', label: 'Đệm hát trình độ 2 — Khoá 8/2026', meta: '1 video' },
      ],
    },
    {
      name: 'Giai điệu & Tỉa nốt',
      items: [
        { image: '/assets/youtube/gl9-karaoke-k9.jpg', label: 'Tỉa nốt trên nền karaoke — Khoá 9', meta: '8 video' },
        { image: '/assets/youtube/gl5-karaoke-k5.jpg', label: 'Tỉa nốt trên nền karaoke — Khoá 5', meta: '8 video' },
        { image: '/assets/youtube/gl10-karaoke-k10.jpg', label: 'Tỉa nốt trên nền karaoke — Khoá 10', meta: '8 video' },
        { image: '/assets/youtube/gl11-karaoke-k11.jpg', label: 'Tỉa nốt trên nền karaoke — Khoá 11', meta: '5 video' },
        { image: '/assets/youtube/gl8-karaoke-k8.jpg', label: 'Tỉa nốt trên nền karaoke — Khoá 8', meta: '7 video' },
        { image: '/assets/youtube/gl6-khoa-6.jpg', label: 'Lớp guitar tỉa nốt — Khoá 6', meta: '8 bài học' },
      ],
    },
    {
      name: 'Solo Guitar',
      items: [
        { image: '/assets/youtube/gl1-guitar-lead.jpg', label: 'Guitar Lead — GL1', meta: '8 bài học' },
      ],
    },
    {
      name: 'Kỹ thuật Guitar',
      items: [
        { image: '/assets/youtube/tu-lieu-thuc-hanh.jpg', label: 'Tư liệu thực hành lớp guitar tỉa nốt', meta: '6 bài học' },
      ],
    },
    {
      name: 'Các lớp học thực tế',
      items: [
        { image: '/assets/youtube/z2-lop-gen-z.jpg', label: 'Lớp guitar cho gen Z', meta: '8 video' },
        { image: '/assets/youtube/workshop-azz.jpg', label: 'Workshop AZZ — Hỏi đáp Guitar cùng Thầy', meta: '4 bài học' },
      ],
    },
  ],
  depth: {
    image: '/assets/youtube/hanh-trinh-nghe-si.jpg',
    alt: 'Playlist Hành trình để trở thành Nghệ sĩ Guitar',
    line1: 'Không chỉ là những bài học riêng lẻ.',
    line2: 'Khi muốn đi xa hơn, bạn có thể học theo những chuỗi nội dung được sắp xếp thành một hành trình hoàn chỉnh.',
  },
} as const

// ─── SÁCH GIÁO TRÌNH (nguồn: SACH_SHOWCASE trong class2-site/src/content.ts) ───
// Lưu ý đồng bộ: /azz có link nhẹ "Xem thêm về sách" (#/sach — trang Sách của
// class2-site). /class KHÔNG có trang sách riêng → bỏ link (tránh link chết),
// nội dung còn lại giữ nguyên văn.
export const BENEFIT_SACH = {
  title: 'Sách giáo trình',
  headline: 'Những cuốn sách được biên soạn để đồng hành cùng quá trình học của bạn.',
  video: {
    videoId: null as string | null,
    thumb: '',
    heading: 'Xem Thầy giới thiệu cuốn sách',
    desc: 'Một đoạn ngắn để bạn nhìn thấy cuốn sách thực tế và hiểu cách sách được sử dụng trong quá trình học.',
  },
  images: [
    { src: '/assets/textbook/photos/cover.jpg', alt: 'Bìa sách Tỉa Nốt 1 in thật' },
    { src: '/assets/textbook/photos/spread-arpeggio.jpg', alt: 'Trang mở bài tỉa hợp âm trong sách Tỉa Nốt 1' },
    { src: '/assets/textbook/photos/poster.jpg', alt: 'Poster lộ trình 11 tập của bộ sách' },
  ],
  closer: 'Đây là cuốn sách bạn có thể cầm trên tay và học cùng trong suốt quá trình học Guitar.',
} as const

// ─── HỎI ĐÁP CÙNG THẦY QUA ZALO (nguồn: ZALO_SHOWCASE trong class2-site/src/content.ts) ───
export const BENEFIT_ZALO = {
  title: 'Hỏi đáp cùng Thầy qua Zalo',
  headline: 'Có chỗ chưa hiểu hoặc chưa làm được? Bạn có thể hỏi Thầy ngay trên Zalo.',
  desc: 'Trong quá trình học, nếu gặp một chỗ khiến bạn bị dừng lại, hãy gửi câu hỏi cho Thầy. Thầy sẽ giúp bạn nhìn ra vấn đề và biết mình nên làm tiếp như thế nào.',
  chat: {
    heading: 'Có gì chưa rõ, cứ hỏi Thầy.',
    label: 'Tình huống minh họa',
    student: 'Thầy ơi, phần nhịp 3/4 em vẫn chưa nắm được.',
    teacher: 'Để Thầy xem chỗ em đang vướng nhé.',
    helpIntro: 'Thầy sẽ:',
    helps: ['Giải thích lại', 'Chỉ ra chỗ đang sai', 'Gửi hướng dẫn phù hợp', 'Chỉ bước tiếp theo để bạn tiếp tục luyện'],
  },
  depth: {
    heading: 'Hỏi để biết mình nên làm gì tiếp theo.',
    body: 'Có khi bạn chỉ cần được chỉ ra một nhịp chưa đúng, một thế tay chưa hợp lý hay một phần kiến thức mình đang hiểu thiếu. Khi tháo được chỗ vướng đó, bạn có thể tiếp tục học và luyện tập.',
    image: '/assets/thay-van-anh.jpg',
    alt: 'Thầy Văn Anh hướng dẫn học viên',
  },
  questions: {
    heading: 'Có thể hỏi Thầy những gì?',
    items: [
      '“Em đánh đoạn này chưa đều, sai ở đâu ạ?”',
      '“Em chưa hiểu hợp âm này dùng khi nào.”',
      '“Em nghe được giai điệu nhưng chưa tìm được nốt.”',
      '“Em đã học phần này rồi, tiếp theo nên học gì?”',
      '“Em tập mãi vẫn chưa làm được đoạn này.”',
    ],
  },
  closer: 'Gặp một chỗ chưa hiểu, bạn không cần tự xoay xở một mình.',
  closerTag: 'Hỏi Thầy qua Zalo',
} as const

// ─── CỘNG ĐỒNG HỌC VIÊN (nguồn: COMMUNITY_SHOWCASE trong class2-site/src/content.ts) ───
export const BENEFIT_COMMUNITY = {
  title: 'Cộng đồng học viên',
  headline: 'Có những người cùng yêu Guitar đang học và chơi đàn cùng bạn.',
  desc: 'Cùng chia sẻ những điều đã học, những bài đàn mình đang tập và niềm vui khi mỗi ngày chơi Guitar tốt hơn một chút.',
  hero: {
    src: '/assets/dem-hat.jpg',
    alt: 'Một buổi online đông học viên cùng học guitar',
    caption: 'Ảnh chụp một buổi online cùng nhau học guitar',
  },
  gallery: [
    { src: '/assets/kho-tri-thuc.jpg', alt: 'Buổi online đông học viên guitar' },
    { src: '/assets/solo.jpg', alt: 'Các học viên cùng chơi guitar trong một buổi học' },
    { src: '/assets/tia-not.jpg', alt: 'Học viên chơi guitar cùng Thầy trong buổi học 1-1' },
  ],
  together: {
    heading: 'Học Guitar cũng là một niềm vui để chia sẻ.',
    items: [
      {
        name: 'Cùng học',
        desc: 'Gặp những người cũng đang đi trên hành trình với Guitar.',
      },
      {
        name: 'Cùng chia sẻ',
        desc: 'Chia sẻ bài đang tập, điều vừa học được và những câu chuyện với cây đàn.',
      },
      {
        name: 'Cùng chơi',
        desc: 'Có những lúc Guitar đưa mọi người từ những màn hình học tập đến những buổi cùng nhau chơi nhạc thật sự.',
      },
    ],
  },
  closer: 'Guitar có thể bắt đầu từ một người, nhưng niềm vui với Guitar không nhất thiết phải chỉ có một mình.',
  closerTag: 'Cộng đồng học viên',
} as const
