// Dòng tên người bình luận — MỘT renderer cho bài Social (CommentItem) và thread/TeamLab (TargetComments.Row).
// Thầy → chỉ huy hiệu "Thầy" (không kèm nhãn lớp). Người khác → nhãn danh tính học tập (tối đa 1) từ IdentityBadges;
// không tự suy vai trò: vai trò lấy từ author_role của server, nhãn lớp lấy từ social_learning_identities.
import { PersonLink } from '../../ui'
import { IdentityBadges } from '../../identity/IdentityBadges'

export default function CommentAuthorLine({ userId, name, isTeacher, hidden, onOpenProfile }: {
  userId: string; name: string; isTeacher: boolean; hidden?: boolean; onOpenProfile?: (userId: string) => void
}) {
  return (
    <div className="cs-cmt-head">
      <PersonLink userId={userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${name}`} className="cs-cmt-author">{name}</PersonLink>
      {isTeacher ? <span className="cs-cmt-badge" title="Nhận xét của giáo viên">Thầy</span> : <IdentityBadges userId={userId} max={1} />}
      {hidden && <span className="cs-cmt-hidden">Đã ẩn · học sinh không thấy</span>}
    </div>
  )
}
