// Bạn bè — nền tảng giao diện. Chưa có dữ liệu bạn bè trong hệ thống nên không hiện
// danh sách / số lượng giả; chỉ trạng thái trống trung tính.
import { Users } from 'lucide-react'
import { EmptyState } from '../ui'

export default function Friends() {
  return (
    <div className="cs-col">
      <h1 className="cs-page-title">Bạn bè</h1>
      <section className="cs-card">
        <EmptyState icon={Users} title="Chưa có bạn bè">
          Bạn bè của bạn trên Class sẽ hiện ở đây.
        </EmptyState>
      </section>
    </div>
  )
}
