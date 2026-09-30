// Ba góc nhìn của Feed trên Home — tab gạch chân (cùng kiểu Tường | Hành trình). Nút thật, aria-pressed.
import { FEED_SCOPES, type FeedScope } from '../posts/feedScope'

export default function FeedTabs({ scope, onChange }: { scope: FeedScope; onChange: (s: FeedScope) => void }) {
  return (
    <div className="lt-profile-tabs cs-feed-tabs" role="group" aria-label="Xem hoạt động">
      {FEED_SCOPES.map(s => (
        <button key={s.id} type="button" aria-pressed={scope === s.id} onClick={() => { if (s.id !== scope) onChange(s.id) }}>
          {s.label}
        </button>
      ))}
    </div>
  )
}
