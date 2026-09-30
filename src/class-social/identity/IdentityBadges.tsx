// Nhãn danh tính học tập — MỘT renderer cho mọi nơi (Feed, Tường, bình luận, bạn bè, thành viên lớp, cuộc trao đổi,
// trang cá nhân). Nhãn = chương trình (không mã lớp); bậc hiển thị theo độ đặc biệt của chương trình, không xếp hạng người.
import type { LearningIdentities, LearningIdentity } from './learningIdentity'
import { nameBadges } from './learningIdentity'
import { useLearningIdentity } from './identityStore'

export function IdentityBadge({ id }: { id: LearningIdentity }) {
  return (
    <span className={`cs-lid is-${id.tier} is-${id.state}`} title={id.title}>
      {id.tier === 'special' && <span className="cs-lid-mark" aria-hidden="true">◆</span>}
      {id.label}
    </span>
  )
}

/** Cạnh TÊN: chỉ chương trình ĐANG HỌC, tối đa `max`, thừa → +N (tooltip liệt kê). */
export function IdentityBadges({ userId, max = 2, exclude }: { userId: string | null | undefined; max?: number; exclude?: string | null }) {
  const ids = useLearningIdentity(userId)
  return ids ? <NameBadgesView ids={ids} max={max} exclude={exclude} /> : null
}

export function NameBadgesView({ ids, max = 2, exclude }: { ids: LearningIdentities; max?: number; exclude?: string | null }) {
  const { shown, more } = nameBadges(ids, max, exclude)
  if (shown.length === 0) return null
  return (
    <span className="cs-lid-list" aria-label={'Đang học: ' + [...shown, ...more].map(i => i.label).join(', ')}>
      {shown.map(i => <IdentityBadge key={i.key} id={i} />)}
      {more.length > 0 && <span className="cs-lid cs-lid-more" title={more.map(i => i.label).join(' · ')}>+{more.length}</span>}
    </span>
  )
}

const GROUPS: { key: 'current' | 'upcoming' | 'graduated'; label: string }[] = [
  { key: 'current', label: 'Đang học' },
  { key: 'upcoming', label: 'Sắp học' },
  { key: 'graduated', label: 'Đã tốt nghiệp' },
]

/** Trang cá nhân: DANH TÍNH HỌC TẬP đầy đủ (Đang học · Sắp học · Đã tốt nghiệp). Không có gì → không dựng khối. */
export function LearningIdentitySection({ userId }: { userId: string }) {
  const ids = useLearningIdentity(userId)
  return ids ? <IdentitySectionView ids={ids} /> : null
}

export function IdentitySectionView({ ids }: { ids: LearningIdentities }) {
  if (GROUPS.every(g => ids[g.key].length === 0)) return null
  return (
    <section className="cs-lid-section" aria-labelledby="cs-lid-title">
      <h2 id="cs-lid-title" className="cs-lid-heading">Danh tính học tập</h2>
      {GROUPS.filter(g => ids[g.key].length > 0).map(g => (
        <div key={g.key} className="cs-lid-group">
          <span className="cs-lid-group-label">{g.label}</span>
          <span className="cs-lid-list">{ids[g.key].map(i => <IdentityBadge key={i.key} id={i} />)}</span>
        </div>
      ))}
    </section>
  )
}
