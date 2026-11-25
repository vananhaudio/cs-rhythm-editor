// /admin/app-update — Owner đặt chính sách cập nhật app TVA Guitar, riêng iOS và Android. Không cần phát hành lại app.
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../supabase'
import { forceConfirmText, formError, saveArgs, toForm, type PolicyForm, type PolicyRow } from './appUpdateModel'

type LogRow = { id: number; platform: string; after_row: PolicyRow; changed_at: string }

const STORE = {
  ios: { name: 'iPhone / iPad (App Store)', url: 'https://apps.apple.com/vn/app/id6776205968' },
  android: { name: 'Android (Google Play)', url: 'https://play.google.com/store/apps/details?id=com.vananhaudio.guitar&hl=vi' },
} as const

const card: CSSProperties = { background: '#fff', border: '1px solid #E4E4E7', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, colorScheme: 'light', textAlign: 'left' }
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #D4D4D8', borderRadius: 8, font: 'inherit', fontSize: 16, background: '#fff', color: '#18181B' }
const label: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600, color: '#52525B' }
const check: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 15, fontWeight: 600, color: '#18181B' }

function PlatformCard({ row, onSaved }: { row: PolicyRow; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<PolicyForm>(() => toForm(row))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const android = row.platform === 'android'
  const set = (patch: Partial<PolicyForm>) => { setForm(f => ({ ...f, ...patch })); setMessage(null) }
  const field = (title: string, key: 'latestVersion' | 'latestBuild' | 'minVersion' | 'minBuild', hint: string) => (
    <label style={label}>{title}
      <input style={input} value={form[key]} placeholder={hint} inputMode={key.endsWith('Build') ? 'numeric' : 'decimal'} onChange={e => set({ [key]: e.target.value })} />
    </label>
  )
  const error = formError(row.platform, form)

  const save = async () => {
    if (error) return
    const ask = forceConfirmText(row, form)
    if (ask && !window.confirm(ask)) return
    setBusy(true); setMessage(null)
    const { error: e } = await supabase.rpc('app_update_policy_save', saveArgs(row, form))
    setBusy(false)
    if (e) { setMessage({ ok: false, text: e.message }); return }
    setMessage({ ok: true, text: 'Đã lưu.' })
    await onSaved()
  }

  return (
    <section style={card} aria-label={STORE[row.platform].name}>
      <div>
        <h2 style={{ margin: 0, fontSize: 17, color: '#18181B' }}>{STORE[row.platform].name}</h2>
        <a href={STORE[row.platform].url} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>Xem bản đang phát hành trên kho ↗</a>
      </div>
      <label style={check}><input type="checkbox" checked={form.enabled} onChange={e => set({ enabled: e.target.checked, ...(e.target.checked ? {} : { force: false }) })} />Bật thông báo cập nhật</label>
      {field('Phiên bản mới nhất', 'latestVersion', '1.7.0')}
      {android && field('versionCode mới nhất', 'latestBuild', '18')}
      <label style={label}>Nội dung mới (không bắt buộc, tối đa 300 ký tự)
        <textarea style={{ ...input, minHeight: 72 }} maxLength={300} value={form.notes} onChange={e => set({ notes: e.target.value })} />
      </label>
      <div style={{ border: '1px solid #FECACA', background: '#FEF2F2', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {android ? field('versionCode tối thiểu được hỗ trợ', 'minBuild', 'để trống') : field('Phiên bản tối thiểu được hỗ trợ', 'minVersion', 'để trống')}
        <label style={check}><input type="checkbox" checked={form.force} disabled={!form.enabled} onChange={e => set({ force: e.target.checked })} />Bắt buộc cập nhật với máy thấp hơn mức tối thiểu</label>
      </div>
      {error && <p role="alert" style={{ margin: 0, color: '#B91C1C', fontSize: 13 }}>{error}</p>}
      {message && <p role="status" style={{ margin: 0, color: message.ok ? '#15803D' : '#B91C1C', fontSize: 13 }}>{message.text}</p>}
      <button type="button" onClick={() => void save()} disabled={busy || !!error}
        style={{ minHeight: 44, border: 0, borderRadius: 10, background: busy || error ? '#A1A1AA' : '#4F46E5', color: '#fff', font: 'inherit', fontWeight: 700, cursor: busy || error ? 'default' : 'pointer' }}>
        {busy ? 'Đang lưu…' : 'Lưu'}
      </button>
    </section>
  )
}

export default function AppUpdateAdmin() {
  const [data, setData] = useState<{ policies: PolicyRow[]; log: LogRow[] } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const load = useCallback(async () => {
    const { data: d, error } = await supabase.rpc('app_update_policy_admin')
    if (error) { setFailed(error.message); return }
    setFailed(null); setData(d as { policies: PolicyRow[]; log: LogRow[] })
  }, [])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  if (failed) return <div role="alert"><p>Không tải được chính sách cập nhật: {failed}</p><button type="button" onClick={() => void load()}>Thử lại</button></div>
  if (!data) return <p>Đang tải…</p>
  return (
    <div style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'left' }}>
      <p style={{ margin: 0, color: '#52525B', fontSize: 14, lineHeight: 1.6 }}>
        Học viên chỉ được báo khi <b>cả hai</b> đúng: bạn bật ở đây, và chính kho ứng dụng xác nhận máy đó tải được bản mới.
        Chỉ áp dụng cho app từ bản 1.7.0 trở đi; các bản cũ hơn chưa có bộ kiểm tra này. Bấm “Để sau” thì 24 giờ sau app nhắc lại.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
        {data.policies.map(r => <PlatformCard key={`${r.platform}:${r.updated_at}`} row={r} onSaved={load} />)}
      </div>
      {data.log.length > 0 && (
        <section style={card}>
          <h2 style={{ margin: 0, fontSize: 15 }}>Lịch sử thay đổi (20 lần gần nhất)</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#52525B', lineHeight: 1.7 }}>
            {data.log.map(l => (
              <li key={l.id}>{new Date(l.changed_at).toLocaleString('vi-VN')} · {l.platform === 'ios' ? 'iOS' : 'Android'} · {l.after_row.enabled ? `bật, mới nhất ${l.after_row.latest_version ?? ''}` : 'tắt'}{l.after_row.force_enabled ? ' · BẮT BUỘC' : ''}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
