// ── Ban biên tập — Mock data ──
export interface Story {
  id: string
  title: string
  author: string
  submittedAt: string
  status: 'submitted' | 'editing' | 'waiting_author' | 'published' | 'archived'
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
  },
  {
    id: '2',
    title: 'Chiếc capo đầu tiên',
    author: 'Nguyễn Lan',
    submittedAt: '2026-07-29T08:15:00',
    status: 'editing',
  },
  {
    id: '3',
    title: 'Tôi học guitar ở tuổi 52',
    author: 'Anh Tuấn',
    submittedAt: '2026-07-28T14:20:00',
    status: 'published',
  },
  {
    id: '4',
    title: 'Cây đàn cũ của ông ngoại',
    author: 'Thu Hà',
    submittedAt: '2026-07-28T09:00:00',
    status: 'waiting_author',
  },
  {
    id: '5',
    title: 'Bài hát ru con bằng guitar',
    author: 'Chị Hương',
    submittedAt: '2026-07-27T21:30:00',
    status: 'published',
  },
  {
    id: '6',
    title: 'Lần đầu đứng trên sân khấu',
    author: 'Minh Khôi',
    submittedAt: '2026-07-27T16:45:00',
    status: 'submitted',
  },
  {
    id: '7',
    title: 'Tôi từng ghét guitar',
    author: 'Hoàng Nam',
    submittedAt: '2026-07-26T11:10:00',
    status: 'archived',
  },
  {
    id: '8',
    title: '30 ngày tập guitar mỗi sáng',
    author: 'Lê Phương',
    submittedAt: '2026-07-26T07:00:00',
    status: 'editing',
  },
]
