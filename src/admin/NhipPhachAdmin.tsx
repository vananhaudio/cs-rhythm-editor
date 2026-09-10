import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../supabase'
import {
  NHIPPHACH_CAPS,
  CAP_LABEL,
  isKhoa,
  type Capability,
} from '../nhipphach/capabilities'

// Cùng bộ màu với Admin shell (TeacherAdminPage) — không dựng theme riêng.
const C = {
  accent: '#2D6A4F', accentLight: '#E9F3EC', border: '#E4E4E7',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  surface: '#FFFFFF', danger: '#DC2626',
}

const TOOL = 'nhipphach'
const VAI_TRO = [
  { id: 'student' as const, ten: 'Học viên' },
  { id: 'teacher' as const, ten: 'Giáo viên' },
]
type VaiTro = (typeof VAI_TRO)[number]['id']
type Dong = { role: VaiTro; capability: string; allowed: boolean; updated_at: string; updated_by: string | null }

/**
 * Admin → Nhịp phách.
 *
 * Ma trận quyền tính năng. Ba thứ tách biệt: vai trò, mức giao diện, quyền
 * tính năng — trang này chỉ chỉnh cái thứ ba. Học viên được bật Nhiều bài thì
 * học viên dùng được; giáo viên bị tắt thì giáo viên không thấy.
 */
export default function NhipPhachAdmin() {
  const [rows, setRows] = useState<Dong[]>([])
  const [ten, setTen] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [dangLuu, setDangLuu] = useState<string | null>(null)
  const [admin, setAdmin] = useState(false)

  const load = async () => {
    setLoading(true)
    // Ma trận này CHỈ quản trị viên đọc và sửa được. Giáo viên mở trang vẫn
    // vào được Admin shell, nên phải nói rõ vì sao trống thay vì báo lỗi kỹ thuật.
    const { data: caps } = await supabase.rpc('my_nhipphach_caps')
    const laAdmin = (caps as { role?: string } | null)?.role === 'admin'
    setAdmin(laAdmin)
    if (!laAdmin) { setRows([]); setLoading(false); return }
    const { data, error } = await supabase
      .from('tool_capabilities')
      .select('role,capability,allowed,updated_at,updated_by')
      .eq('tool_id', TOOL)
    if (error) { setNote('Không đọc được cấu hình quyền: ' + error.message); setLoading(false); return }
    setRows((data ?? []) as Dong[])
    // Tên người sửa gần nhất — chỉ để hiện, không dùng vào quyết định nào.
    const ids = [...new Set((data ?? []).map(r => r.updated_by).filter(Boolean))] as string[]
    if (ids.length) {
      const { data: us } = await supabase.from('app_users').select('id,email').in('id', ids)
      setTen(Object.fromEntries((us ?? []).map(u => [u.id, u.email ?? u.id.slice(0, 8)])))
    }
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const giaTri = (role: VaiTro, cap: Capability) =>
    rows.find(r => r.role === role && r.capability === cap)?.allowed ?? false
  const suaLuc = (role: VaiTro, cap: Capability) =>
    rows.find(r => r.role === role && r.capability === cap)

  async function bat(role: VaiTro, cap: Capability, next: boolean) {
    // Khoá ở Giai đoạn 12: RLS của preset/lịch sử vẫn là is_teacher(), bật cờ
    // lên chỉ tạo ra nút bấm rồi API trả lỗi.
    if (isKhoa(role, cap)) return
    const khoa = `${role}:${cap}`
    setDangLuu(khoa); setNote('')
    const { error } = await supabase
      .from('tool_capabilities')
      .upsert({ tool_id: TOOL, role, capability: cap, allowed: next }, { onConflict: 'tool_id,role,capability' })
    setDangLuu(null)
    if (error) { setNote('Chưa lưu được: ' + error.message); return }
    await load()
  }

  const nutO: CSSProperties = {
    border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 14px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', minWidth: 74, fontFamily: 'inherit',
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
      <h2 style={{ fontSize: 20, margin: '0 0 6px', color: C.text1 }}>Nhịp phách</h2>
      <p style={{ fontSize: 14, color: C.text2, margin: '0 0 20px', maxWidth: 640, lineHeight: 1.6 }}>
        Ai được dùng tính năng nào. Vai trò, mức giao diện và quyền tính năng là ba
        thứ khác nhau — bật ở đây là học viên dùng được ngay, không cần đổi vai trò.
        Quản trị viên luôn đủ quyền để không tự khoá mình.
      </p>

      {note && (
        <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {note}
        </div>
      )}

      {loading ? (
        <p style={{ color: C.text3, fontSize: 14 }}>Đang tải…</p>
      ) : !admin ? (
        <div style={{ background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 12, padding: '16px 18px', fontSize: 14, lineHeight: 1.6, maxWidth: 640 }}>
          <b>Chỉ quản trị viên chỉnh được ma trận quyền.</b>
          <div style={{ marginTop: 6 }}>
            Tài khoản giáo viên xem và dùng công cụ bình thường, nhưng không tự
            đổi được quyền của mình hay của học viên.
          </div>
        </div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', maxWidth: 720 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#FAFAFA' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700, color: C.text2, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Tính năng
                </th>
                {VAI_TRO.map(v => (
                  <th key={v.id} style={{ padding: '12px 16px', fontWeight: 700, color: C.text2, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '.06em', width: 150 }}>
                    {v.ten}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NHIPPHACH_CAPS.map(cap => (
                <tr key={cap} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: '11px 16px', color: C.text1, fontWeight: 600 }}>
                    {CAP_LABEL[cap]}
                    <div style={{ fontSize: 11.5, color: C.text3, fontWeight: 400, fontFamily: 'ui-monospace, monospace', marginTop: 2 }}>
                      nhipphach.{cap}
                    </div>
                  </td>
                  {VAI_TRO.map(v => {
                    const on = giaTri(v.id, cap)
                    const khoa = isKhoa(v.id, cap)
                    const r = suaLuc(v.id, cap)
                    return (
                      <td key={v.id} style={{ padding: '11px 16px', textAlign: 'center' }}>
                        {khoa ? (
                          <>
                            <span style={{ ...nutO, display: 'inline-block', background: '#FAFAFA', color: C.text3, cursor: 'not-allowed', borderStyle: 'dashed' }}>
                              Khoá
                            </span>
                            <div style={{ fontSize: 11, color: C.text3, marginTop: 5, lineHeight: 1.4 }}>
                              Chưa hỗ trợ cho học viên
                            </div>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              aria-pressed={on}
                              aria-label={`${CAP_LABEL[cap]} · ${v.ten}`}
                              disabled={dangLuu === `${v.id}:${cap}`}
                              onClick={() => void bat(v.id, cap, !on)}
                              style={{
                                ...nutO,
                                background: on ? C.accentLight : C.surface,
                                color: on ? C.accent : C.text3,
                                borderColor: on ? C.accent : C.border,
                                opacity: dangLuu === `${v.id}:${cap}` ? 0.5 : 1,
                              }}
                            >
                              {on ? '✓ Bật' : 'Tắt'}
                            </button>
                            {r?.updated_at && (
                              <div style={{ fontSize: 11, color: C.text3, marginTop: 5 }}>
                                {new Date(r.updated_at).toLocaleDateString('vi-VN')}
                                {r.updated_by && ten[r.updated_by] ? ` · ${ten[r.updated_by]}` : ''}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: 12.5, color: C.text3, marginTop: 16, maxWidth: 720, lineHeight: 1.7 }}>
        Người dùng tải lại trang là quyền mới có hiệu lực. Mẫu trình bày và Lịch sử
        còn khoá với học viên vì hai bảng đó đang giới hạn ở tài khoản giáo viên —
        mở được sau khi đổi policy, không phải bằng cách bật cờ ở đây.
      </p>
    </div>
  )
}
