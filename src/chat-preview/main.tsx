// PREVIEW ONLY — chạy bằng `npm run dev` rồi mở /chat-preview.html (xem docs/CHAT-LIST-V2.md). Không có trong bản build production.
// Giao diện Trò chuyện thật (Chat → InboxList → ConversationView) + khung mobile thật (TopBar/TabBar); dữ liệu mẫu qua máy chủ giả ở lớp fetch.
import { MockChatServer, installMockFetch, type Scenario } from './mockServer'

const q = new URLSearchParams(location.search)
const num = (k: string, d: number) => { const v = Number(q.get(k)); return Number.isFinite(v) && q.has(k) ? v : d }
export const scenario: Scenario = {
  dms: num('dm', 120), bands: num('bands', 24), support: q.get('teacher') === '1' ? num('support', 60) : 0, pins: num('pins', 0),
  legacy: q.get('legacy') === '1', latency: num('lat', 0), fail: q.get('fail') === '1',
}
const server = new MockChatServer(scenario)
installMockFetch(server)

void (async () => {
  // nạp SAU khi đã thay fetch (supabase client giữ tham chiếu fetch lúc tạo)
  await import('../class-social/classSocial.css')
  await import('../class-mobile/classMobile.css')
  await import('../class-mobile/classMobileLight.css')
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { default: Chat } = await import('../class-social/sections/Chat')
  const { TopBar, TabBar } = await import('../class-mobile/chrome')
  const { createRpcInboxSource } = await import('../class-social/chat/inboxApi')
  const source = createRpcInboxSource()

  const mobile = (q.get('view') ?? (matchMedia('(max-width: 700px)').matches ? 'mobile' : 'desktop')) === 'mobile'
  function App() {
    const [sel, setSel] = React.useState<{ kind: 'none' } | { kind: 'conversation'; id: string }>(q.get('sel') ? { kind: 'conversation', id: q.get('sel')! } : { kind: 'none' })
    const chat = (
      <Chat meId="me" selection={sel} source={source} soundToggle={false}
        onOpenConversation={id => setSel({ kind: 'conversation', id })} onBackToList={() => setSel({ kind: 'none' })}
        onOpenProfile={() => {}} onOpenFriends={() => { (window as unknown as { __friends?: number }).__friends = 1; document.title = 'Mở Bạn bè' }} onUnreadChanged={() => {}} />
    )
    if (mobile) {
      return (
        <div className="cs-root cm-root" data-bar-title="1">
          <TopBar noticeCount={0} title="Trò chuyện" onBack={null} onHome={() => {}} onNotices={() => {}} onMore={() => {}} />
          <main className="cm-content cs-main">{chat}</main>
          <TabBar tab="chat" badges={{}} onSelect={() => {}} />
        </div>
      )
    }
    return <div className="cs-root"><main className="cs-main" style={{ padding: '24px 32px', minHeight: '100vh', boxSizing: 'border-box' }}>{chat}</main></div>
  }
  createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
})()
