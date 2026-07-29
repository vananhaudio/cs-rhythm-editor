// ── Ban biên tập — Mock data ──
export interface Story {
  id: string
  title: string
  author: string
  submittedAt: string
  status: 'submitted' | 'editing' | 'waiting_author' | 'published' | 'archived'
  content: string
}

export const STATUS_LABELS: Record<Story['status'], string> = {
  submitted: 'Chờ đọc',
  editing: 'Đang biên tập',
  waiting_author: 'Chờ tác giả duyệt',
  published: 'Đã xuất bản',
  archived: 'Lưu trữ',
}

export const MOCK_STORIES: Story[] = [
  {
    id: '1',
    title: 'Bố biết chơi guitar không?',
    author: 'Anh Minh',
    submittedAt: '2026-07-29T10:35:00',
    status: 'submitted',
    content: 'Hồi đại học mình từng chơi guitar gần như mỗi ngày. Ra trường, công việc, gia đình rồi con cái khiến cây đàn dần biến mất khỏi cuộc sống.\n\nMột hôm, con trai hỏi: "Bố biết chơi đàn không?" Mình trả lời: "Ngày xưa bố biết." Chính câu trả lời đó làm mình thấy tiếc.\n\nTối hôm ấy mình lấy đàn xuống. Những ngón tay cứng lại. Hợp âm cũng quên gần hết. Nhưng cảm giác khi tiếng đàn vang lên vẫn giống hệt ngày xưa.',
  },
  {
    id: '2',
    title: 'Chiếc capo đầu tiên',
    author: 'Nguyễn Lan',
    submittedAt: '2026-07-29T08:15:00',
    status: 'editing',
    content: 'Ngày trước mình rất sợ hợp âm Fa. Cứ nghĩ nếu chưa bấm được Fa thì chưa thể hát được bài nào. Cho đến khi một người bạn đưa cho mình chiếc capo và nói: "Thử đổi tông xem."\n\nLần đầu tiên mình nhận ra guitar không chỉ là sức mạnh của bàn tay. Nó còn là cách mình hiểu nhạc. Từ đó mình bớt cố chấp hơn. Biết tìm cách phù hợp với giọng hát của mình.',
  },
  {
    id: '3',
    title: 'Tôi học guitar ở tuổi 52',
    author: 'Anh Tuấn',
    submittedAt: '2026-07-28T14:20:00',
    status: 'published',
    content: 'Mọi người thường nói học nhạc cụ nên bắt đầu từ nhỏ. Nhưng mình bắt đầu học guitar ở tuổi 52 — sau khi nghỉ hưu.\n\nNhững ngón tay không còn linh hoạt như xưa. Lưng đau khi ngồi lâu. Nhưng mỗi lần bấm được một hợp âm mới, mình thấy vui như một đứa trẻ.\n\nBây giờ, mỗi tối mình đàn vài bài cho cháu nội nghe. Cháu cười, mình cũng cười. Vậy là đủ.',
  },
  {
    id: '4',
    title: 'Cây đàn cũ của ông ngoại',
    author: 'Thu Hà',
    submittedAt: '2026-07-28T09:00:00',
    status: 'waiting_author',
    content: 'Ông ngoại mất để lại một cây guitar cũ kỹ. Dây đã rỉ, cần đàn cong nhẹ. Mẹ định vứt đi nhưng mình xin giữ lại.\n\nMình mang đàn đi sửa. Bác thợ nói cây này ít nhất 40 năm tuổi rồi. Khi dây mới được lên, âm thanh vang lên ấm lạ. Như thể ông vẫn còn ở đâu đây.\n\nTừ hôm đó, mình bắt đầu học guitar. Mình muốn chơi được bài ông thích nhất — "Diễm xưa" của Trịnh Công Sơn.',
  },
  {
    id: '5',
    title: 'Bài hát ru con bằng guitar',
    author: 'Chị Hương',
    submittedAt: '2026-07-27T21:30:00',
    status: 'published',
    content: 'Con gái mình mới 4 tháng tuổi. Mỗi tối trước khi ngủ, mình thường đàn vài bài nhẹ nhàng cho con.\n\nMột lần, đang đàn bài "Ru con mùa đông" thì con tự nhiên ngừng khóc. Mình tiếp tục đàn thêm một lúc. Khi nhìn xuống, con đã ngủ từ lúc nào.\n\nTừ đó, guitar trở thành một phần trong giờ đi ngủ của con. Và với mình, đó là những phút giây bình yên nhất trong ngày.',
  },
  {
    id: '6',
    title: 'Lần đầu đứng trên sân khấu',
    author: 'Minh Khôi',
    submittedAt: '2026-07-27T16:45:00',
    status: 'submitted',
    content: 'Mình chưa từng nghĩ sẽ có ngày đứng trên sân khấu. Nhưng lớp học guitar của thầy Văn Anh có một buổi biểu diễn nhỏ cuối khóa.\n\nTim đập thình thịch. Tay run. Hợp âm đầu tiên suýt bấm sai. Nhưng khi nhìn xuống khán giả — chỉ có bạn học và người thân — mình thấy bình tĩnh hơn.\n\nKết thúc bài hát, mọi người vỗ tay. Mình không nhớ mình đã đàn hay hay dở. Chỉ nhớ cảm giác lúc đó: tự hào vì đã dám bước lên.',
  },
  {
    id: '7',
    title: 'Tôi từng ghét guitar',
    author: 'Hoàng Nam',
    submittedAt: '2026-07-26T11:10:00',
    status: 'archived',
    content: 'Hồi nhỏ mình bị ép học guitar. Mẹ muốn mình biết một loại nhạc cụ. Mỗi tuần 2 buổi học, mình đều tìm cách trốn.\n\nLớn lên, mình không đụng vào guitar suốt 10 năm. Cho đến một hôm, bạn cùng phòng có một cây đàn. Mình cầm lên nghịch vu vơ. Và tự nhiên nhớ ra vài hợp âm.\n\nLần này không ai ép. Mình tự học lại từ đầu. Và lạ thay — mình thấy thích thật sự. Có lẽ vì lần này mình chọn nó, chứ không phải bị ép.',
  },
  {
    id: '8',
    title: '30 ngày tập guitar mỗi sáng',
    author: 'Lê Phương',
    submittedAt: '2026-07-26T07:00:00',
    status: 'editing',
    content: 'Mình đặt mục tiêu: 30 ngày liên tục, mỗi sáng 20 phút tập guitar trước khi đi làm.\n\nNgày đầu: hào hứng. Ngày thứ 5: muốn bỏ cuộc. Ngày thứ 10: bắt đầu thấy quen. Ngày thứ 20: không tập là thấy thiếu.\n\nSau 30 ngày, mình có thể chơi được 3 bài hoàn chỉnh. Quan trọng hơn, mình đã tạo được một thói quen. Bây giờ, guitar là một phần của buổi sáng — như cà phê vậy.',
  },
]
