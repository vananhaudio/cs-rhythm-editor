import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// ── Design tokens (khớp TeacherAdminPage) ──
const S = {
  accent: '#4F46E5', accentLight: '#EEF2FF', border: '#E4E4E7',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', bg: '#F4F4F5', surface: '#FFFFFF',
  green: '#16A34A', greenBg: '#F0FDF4', danger: '#DC2626', dangerBg: '#FEF2F2',
  zalo: '#0068FF', fb: '#1877F2',
}

type Group = {
  id: string; name: string; group_type: string
  zalo_url: string | null; facebook_url: string | null
  is_active: boolean; sort_order: number
}
type Tok = { id: string; group_id: string; token: string; is_active: boolean }
type Member = { id: string; user_id: string; name: string }

// Token dễ đọc (bỏ ký tự dễ nhầm 0/O/1/I)
function randToken(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const arr = new Uint32Array(len); crypto.getRandomValues(arr)
  let s = ''; for (let i = 0; i < len; i++) s += chars[arr[i] % chars.length]
  return s
}

const emptyForm = { id: '', name: '', group_type: 'zalo', zalo_url: '', facebook_url: '', is_active: true }

export default function GroupManager() {
  const [groups, setGroups]   = useState<Group[]>([])
  const [counts, setCounts]   = useState<Record<string, number>>({})
  const [tokens, setTokens]   = useState<Record<string, Tok>>({})
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState<typeof emptyForm | null>(null)
  const [bulk, setBulk]       = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)
  const [copied, setCopied]   = useState<string | null>(null)
  const [membersOf, setMembersOf] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])

  const origin = window.location.origin

  const load = async () => {
    setLoading(true)
    const [{ data: gs }, { data: ms }, { data: ts }] = await Promise.all([
      supabase.from('edu_groups').select('*').order('group_type').order('sort_order').order('created_at'),
      supabase.from('edu_group_members').select('group_id').eq('status', 'active'),
      supabase.from('edu_group_claim_tokens').select('*').eq('is_active', true),
    ])
    setGroups((gs ?? []) as Group[])
    const c: Record<string, number> = {}
    ;(ms ?? []).forEach((m: any) => { c[m.group_id] = (c[m.group_id] ?? 0) + 1 })
    setCounts(c)
    const t: Record<string, Tok> = {}
    ;(ts ?? []).forEach((x: any) => { if (!t[x.group_id]) t[x.group_id] = x })
    setTokens(t)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const flash = (k: string) => { setCopied(k); setTimeout(() => setCopied(c => c === k ? null : c), 1500) }
  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); flash(key) }
    catch { alert('Không copy được. Link: ' + text) }
  }

  // ── CRUD nhóm ──
  const saveGroup = async () => {
    if (!form || !form.name.trim()) return
    setSaving(true)
    const patch = {
      name: form.name.trim(), group_type: form.group_type,
      zalo_url: form.zalo_url.trim() || null, facebook_url: form.facebook_url.trim() || null,
      is_active: form.is_active,
    }
    const { error } = form.id
      ? await supabase.from('edu_groups').update(patch).eq('id', form.id)
      : await supabase.from('edu_groups').insert(patch)
    setSaving(false)
    if (error) { alert('Lưu nhóm thất bại: ' + error.message); return }
    setForm(null); load()
  }

  const toggleActive = async (g: Group) => {
    const { error } = await supabase.from('edu_groups').update({ is_active: !g.is_active }).eq('id', g.id)
    if (error) { alert('Đổi trạng thái thất bại: ' + error.message); return }
    setGroups(prev => prev.map(x => x.id === g.id ? { ...x, is_active: !x.is_active } : x))
  }

  const bulkCreate = async () => {
    if (!bulk?.trim()) return
    const rows = bulk.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [name, url] = l.split('|').map(s => s.trim())
      return { name, group_type: 'zalo', zalo_url: url || null, facebook_url: null, is_active: true }
    }).filter(r => r.name)
    if (rows.length === 0) { alert('Không nhận diện được dòng nào. Cú pháp: Tên lớp | link Zalo'); return }
    setSaving(true)
    const { error } = await supabase.from('edu_groups').insert(rows)
    setSaving(false)
    if (error) { alert('Nhập hàng loạt thất bại: ' + error.message); return }
    setBulk(null); load()
  }

  // ── Token claim ──
  const genToken = async (g: Group) => {
    const old = tokens[g.id]
    if (old && !confirm(`Tạo token MỚI cho "${g.name}"? Link xác nhận cũ sẽ ngừng hoạt động.`)) return
    setSaving(true)
    if (old) await supabase.from('edu_group_claim_tokens').update({ is_active: false }).eq('id', old.id)
    const token = randToken()
    const { data, error } = await supabase.from('edu_group_claim_tokens')
      .insert({ group_id: g.id, token }).select('*').single()
    setSaving(false)
    if (error || !data) { alert('Tạo token thất bại: ' + (error?.message ?? '')); return }
    setTokens(prev => ({ ...prev, [g.id]: data as Tok }))
  }

  const claimLink = (tok: Tok) => `${origin}/join-group/${tok.token}`
  const zaloMsg = (g: Group, tok: Tok) =>
    `Anh/chị trong nhóm "${g.name}" bấm link dưới đây để app TVA Guitar ghi nhớ nhóm học của mình. ` +
    `Sau khi xác nhận, trong app sẽ hiện nút vào nhanh nhóm này.\n\nLink xác nhận: ${claimLink(tok)}`

  // ── Thành viên ──
  const viewMembers = async (g: Group) => {
    if (membersOf === g.id) { setMembersOf(null); return }
    setMembersOf(g.id); setMembers([])
    const { data } = await supabase.from('edu_group_members')
      .select('id, user_id').eq('group_id', g.id).eq('status', 'active')
    const ids = (data ?? []).map((m: any) => m.user_id)
    let names: Record<string, string> = {}
    if (ids.length) {
      const { data: st } = await supabase.from('edu_students')
        .select('user_id, display_name, full_name').in('user_id', ids)
      ;(st ?? []).forEach((s: any) => {
        const n = (s.display_name || s.full_name || '').trim()
        names[s.user_id] = n.includes('@') ? n.split('@')[0] : (n || 'Học viên')
      })
    }
    setMembers((data ?? []).map((m: any) => ({ id: m.id, user_id: m.user_id, name: names[m.user_id] ?? 'Học viên' })))
  }

  const removeMember = async (m: Member) => {
    if (!confirm(`Gỡ "${m.name}" khỏi nhóm?`)) return
    const { error } = await supabase.from('edu_group_members').update({ status: 'removed' }).eq('id', m.id)
    if (error) { alert('Gỡ thất bại: ' + error.message); return }
    setMembers(prev => prev.filter(x => x.id !== m.id))
    if (membersOf) setCounts(prev => ({ ...prev, [membersOf]: Math.max(0, (prev[membersOf] ?? 1) - 1) }))
  }

  // ── UI ──
  const btn = (bg: string, extra?: React.CSSProperties): React.CSSProperties => ({
    background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', ...extra,
  })
  const ghostBtn: React.CSSProperties = {
    background: S.surface, color: S.text2, border: `1px solid ${S.border}`, borderRadius: 8,
    padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 32, background: S.bg, fontFamily: '"Inter", system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 22 }}>🌱 Cộng đồng / Nhóm</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={ghostBtn} onClick={() => setBulk('')}>📋 Dán hàng loạt</button>
          <button style={btn(S.accent)} onClick={() => setForm({ ...emptyForm })}>+ Thêm nhóm</button>
        </div>
      </div>
      <div style={{ fontSize: 13, color: S.text2, marginBottom: 20, maxWidth: 720, lineHeight: 1.6 }}>
        Nhóm <b>Facebook</b> hiện cho mọi học viên. Nhóm <b>Zalo</b> chỉ hiện với học viên đã được gán —
        gửi <b>link xác nhận</b> vào đúng nhóm Zalo để học viên cũ tự nhận nhóm (khỏi dò email).
      </div>

      {loading ? <div style={{ color: S.text3 }}>Đang tải...</div> : groups.length === 0 ? (
        <div style={{ background: S.surface, borderRadius: 12, padding: 32, textAlign: 'center', color: S.text3, border: `1px solid ${S.border}` }}>
          Chưa có nhóm nào. Bấm "+ Thêm nhóm" hoặc "Dán hàng loạt" để bắt đầu.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.map(g => {
            const isFb = g.group_type === 'facebook'
            const tok = tokens[g.id]
            return (
              <div key={g.id} style={{ background: S.surface, borderRadius: 12, padding: 18, border: `1px solid ${S.border}`, opacity: g.is_active ? 1 : 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: isFb ? S.fb : S.zalo, borderRadius: 6, padding: '3px 8px' }}>
                    {isFb ? 'Facebook' : 'Zalo'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: S.text1 }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: S.text3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(isFb ? g.facebook_url : g.zalo_url) || <span style={{ color: S.danger }}>⚠ chưa có link</span>}
                      {!isFb && <span style={{ marginLeft: 10, color: S.text2 }}>· {counts[g.id] ?? 0} thành viên</span>}
                    </div>
                  </div>
                  <button onClick={() => toggleActive(g)} title={g.is_active ? 'Đang bật' : 'Đang tắt'}
                    style={{ ...ghostBtn, color: g.is_active ? S.green : S.text3, borderColor: g.is_active ? S.green : S.border }}>
                    {g.is_active ? '● Bật' : '○ Tắt'}
                  </button>
                  <button style={ghostBtn} onClick={() => setForm({ id: g.id, name: g.name, group_type: g.group_type, zalo_url: g.zalo_url ?? '', facebook_url: g.facebook_url ?? '', is_active: g.is_active })}>Sửa</button>
                </div>

                {/* Khu vực link xác nhận — chỉ nhóm Zalo */}
                {!isFb && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${S.border}` }}>
                    {tok ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        <code style={{ fontSize: 12, background: S.bg, padding: '4px 8px', borderRadius: 6, color: S.text2 }}>{claimLink(tok)}</code>
                        <button style={btn(S.accent, { padding: '6px 10px', fontSize: 12 })} onClick={() => copy(claimLink(tok), 'link-' + g.id)}>
                          {copied === 'link-' + g.id ? '✓ Đã copy' : '📋 Copy link'}
                        </button>
                        <button style={ghostBtn} onClick={() => copy(zaloMsg(g, tok), 'msg-' + g.id)}>
                          {copied === 'msg-' + g.id ? '✓ Đã copy' : '💬 Copy tin nhắn Zalo'}
                        </button>
                        <button style={ghostBtn} onClick={() => genToken(g)} disabled={saving}>↻ Đổi token</button>
                        <button style={ghostBtn} onClick={() => viewMembers(g)}>{membersOf === g.id ? 'Ẩn thành viên' : 'Xem thành viên'}</button>
                      </div>
                    ) : (
                      <button style={btn(S.green, { padding: '6px 12px', fontSize: 12 })} onClick={() => genToken(g)} disabled={saving}>
                        + Tạo link xác nhận
                      </button>
                    )}

                    {membersOf === g.id && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {members.length === 0 ? <div style={{ fontSize: 12, color: S.text3 }}>Chưa có thành viên nào tự xác nhận.</div>
                          : members.map(m => (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: S.text2 }}>
                              <span style={{ flex: 1 }}>• {m.name}</span>
                              <button onClick={() => removeMember(m)} style={{ background: 'none', border: 'none', color: S.danger, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Gỡ</button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal tạo/sửa nhóm ── */}
      {form && (
        <div onClick={() => setForm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.surface, borderRadius: 14, padding: 24, width: '90%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{form.id ? 'Sửa nhóm' : 'Thêm nhóm'}</div>
            <Field label="Tên nhóm" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="VD: KD17 - Guitar Khởi Đầu" />
            <div>
              <label style={lbl}>Loại nhóm</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['zalo', 'facebook'].map(t => (
                  <button key={t} onClick={() => setForm({ ...form, group_type: t })}
                    style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${form.group_type === t ? S.accent : S.border}`, background: form.group_type === t ? S.accentLight : S.surface, color: form.group_type === t ? S.accent : S.text2, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                    {t === 'zalo' ? 'Zalo (riêng)' : 'Facebook (chung)'}
                  </button>
                ))}
              </div>
            </div>
            {form.group_type === 'facebook'
              ? <Field label="Link Facebook" value={form.facebook_url} onChange={v => setForm({ ...form, facebook_url: v })} placeholder="https://facebook.com/groups/..." />
              : <Field label="Link Zalo" value={form.zalo_url} onChange={v => setForm({ ...form, zalo_url: v })} placeholder="https://zalo.me/g/..." />}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: S.text2, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Đang hoạt động (hiện cho học viên)
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={ghostBtn} onClick={() => setForm(null)}>Huỷ</button>
              <button style={btn(S.accent)} onClick={saveGroup} disabled={saving || !form.name.trim()}>{saving ? 'Đang lưu...' : '💾 Lưu'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal dán hàng loạt ── */}
      {bulk !== null && (
        <div onClick={() => setBulk(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.surface, borderRadius: 14, padding: 24, width: '90%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Dán hàng loạt nhóm Zalo</div>
            <div style={{ fontSize: 12, color: S.text2 }}>Mỗi dòng một nhóm, cú pháp: <code style={{ background: S.bg, padding: '2px 6px', borderRadius: 5 }}>Tên lớp | link Zalo</code></div>
            <textarea value={bulk} onChange={e => setBulk(e.target.value)} rows={8}
              placeholder={'KD17 - Guitar Khởi Đầu | https://zalo.me/g/abc123\nGL8 - Guitar Tỉa Nốt | https://zalo.me/g/def456'}
              style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${S.border}`, borderRadius: 8, padding: 12, fontSize: 13, fontFamily: 'monospace', resize: 'vertical', outline: 'none', color: S.text1 }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={ghostBtn} onClick={() => setBulk(null)}>Huỷ</button>
              <button style={btn(S.accent)} onClick={bulkCreate} disabled={saving}>{saving ? 'Đang tạo...' : 'Tạo nhóm'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#52525B', marginBottom: 5 }
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E4E4E7', borderRadius: 8, padding: '9px 12px', fontSize: 14, outline: 'none', color: '#18181B', fontFamily: 'inherit' }} />
    </div>
  )
}
