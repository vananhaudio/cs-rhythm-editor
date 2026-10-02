// Admin — MÃ THAM GIA của lớp (RPC admin_class_join_code: token trên edu_group_claim_tokens, gắn nhóm thành viên
// canonical). Mã chỉ phát khi Thầy bấm "Lấy mã"; "Đổi mã" làm mã cũ hết hiệu lực. Học sinh nhập ở /me → Lớp học.
import { useState, type CSSProperties } from 'react'
import type { supabase } from '../supabase'

const pretty = (c: string) => (c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c)
const btn: CSSProperties = { border: '1px solid #E4E4E7', borderRadius: 7, padding: '4px 10px', background: '#fff',
  font: '600 12.5px Inter, system-ui, sans-serif', cursor: 'pointer', color: '#18181B' }

export default function ClassJoinCode({ client, classId, disabled }: {
  client: Pick<typeof supabase, 'rpc'>; classId: string; disabled?: boolean
}) {
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const run = async (rotate: boolean) => {
    if (rotate && !window.confirm('Đổi mã tham gia? Mã cũ sẽ không dùng được nữa (người đã vào lớp vẫn ở lớp).')) return
    setBusy(true); setNote('')
    const { data, error } = await client.rpc('admin_class_join_code', { p_class: classId, p_rotate: rotate })
    setBusy(false)
    if (error) { setNote(error.message.includes('no member group') ? 'Lớp chưa có nhóm thành viên.' : error.message); return }
    setCode(String(data)); if (rotate) setNote('Đã đổi mã.')
  }
  const copy = async () => {
    if (!code) return
    try { await navigator.clipboard.writeText(pretty(code)); setNote('Đã sao chép.') } catch { setNote('Không sao chép được — chọn mã và copy tay.') }
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12.5 }}>
      🔑 Mã tham gia:
      {code
        ? <><b style={{ fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: '.08em', fontSize: 14 }}>{pretty(code)}</b>
            <button type="button" style={btn} onClick={() => void copy()}>Sao chép</button>
            <button type="button" style={btn} disabled={busy} onClick={() => void run(true)}>Đổi mã</button></>
        : <button type="button" style={btn} disabled={busy || disabled} onClick={() => void run(false)}>{busy ? 'Đang lấy…' : 'Lấy mã'}</button>}
      {note && <span style={{ color: '#52525B' }}>{note}</span>}
    </span>
  )
}
