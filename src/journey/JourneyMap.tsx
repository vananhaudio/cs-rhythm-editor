// ── JOURNEY OS — Bản đồ hành trình (Journey Map) ──
// Vẽ các nhánh khoá theo tiên quyết (hanhtrinh.ts) + GẮN LỚP THẬT đang chạy vào từng mốc.
import type { CSSProperties } from 'react'
import { TEN_NANG_LUC } from '../hanhtrinh'
import { statusInfo, progressInfo, type SessionRow } from './sessions'
import type { ClassLite } from './ScheduleDashboard'

const S = { surface: '#FFFFFF', border: '#E4E4E7', text1: '#18181B', text2: '#52525B', text3: '#A1A1AA', accent: '#4F46E5', accentLight: '#EEF2FF', bg: '#F4F4F5' }

// Các nhánh, mỗi nhánh là chuỗi mã năng lực theo thứ tự học
const LANES: { label: string; codes: string[] }[] = [
  { label: 'Nhập môn', codes: ['NM'] },
  { label: 'Đệm hát', codes: ['DH1', 'DH2', 'DH3', 'DHNC'] },
  { label: 'Tỉa nốt', codes: ['TN1', 'TN2', 'TN3'] },
  { label: 'Nhạc lý', codes: ['NL1', 'NL2', 'NL3'] },
  { label: 'Solo', codes: ['SOLO'] },
]

interface Course { id: string; name: string; code: string | null }

export default function JourneyMap({ courses, classes, sessById }: {
  courses: Course[]; classes: ClassLite[]; sessById: Record<string, SessionRow[]>
}) {
  const hasCourse = (code: string) => courses.some(c => (c.code || '').toUpperCase() === code)
  const liveClasses = (code: string) => classes.filter(c => c.is_active && (c.mainCourseCode || '').toUpperCase() === code &&
    c.status !== 'completed' && c.status !== 'cancelled' && c.status !== 'merged')

  const chip: CSSProperties = { fontSize: 10.5, fontWeight: 800, padding: '1px 6px', borderRadius: 5 }

  return (
    <div>
      <div style={{ fontSize: 13, color: S.text2, marginBottom: 14 }}>
        Mỗi mốc là 1 khoá năng lực. Node đậm = đã có khoá trong hệ thống · node mờ = chưa dựng nội dung. Lớp thật đang chạy hiện ngay dưới mốc.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {LANES.map(lane => (
          <div key={lane.label} style={{ display: 'flex', alignItems: 'stretch', gap: 12 }}>
            {/* nhãn nhánh */}
            <div style={{ width: 78, flexShrink: 0, display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 800, color: S.text2 }}>
              {lane.label}
            </div>
            {/* chuỗi mốc */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
              {lane.codes.map((code, i) => {
                const on = hasCourse(code)
                const lives = liveClasses(code)
                return (
                  <div key={code} style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
                    {i > 0 && <div style={{ display: 'flex', alignItems: 'center', color: S.text3, fontSize: 16, flexShrink: 0 }}>→</div>}
                    <div style={{
                      minWidth: 150, background: on ? S.surface : '#FAFAFA', border: `1.5px solid ${on ? S.border : '#EDEDED'}`,
                      borderRadius: 10, padding: '9px 11px', opacity: on ? 1 : 0.6, display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ ...chip, color: on ? S.accent : S.text3, background: on ? S.accentLight : '#F0F0F0' }}>{code}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: on ? S.text1 : S.text3 }}>{TEN_NANG_LUC[code] ?? code}</span>
                      </div>
                      {/* lớp thật gắn vào mốc */}
                      {lives.length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {lives.map(cl => {
                            const pi = progressInfo(sessById[cl.id] ?? [])
                            const si = statusInfo(cl.status)
                            return (
                              <div key={cl.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, background: S.bg, borderRadius: 6, padding: '3px 6px' }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: si.c, flexShrink: 0 }} />
                                <span style={{ fontWeight: 700, color: S.text1 }}>{cl.code || cl.name}</span>
                                {pi.total > 0 && <span style={{ color: S.text3 }}>· {Math.min(pi.current, pi.total)}/{pi.total}</span>}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div style={{ fontSize: 10.5, color: S.text3 }}>{on ? 'chưa có lớp chạy' : 'chưa dựng khoá'}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Chú thích nhánh */}
      <div style={{ marginTop: 16, fontSize: 11.5, color: S.text3 }}>
        Nhánh theo bộ luật Hành trình 2027 · tiên quyết: DH2 cần DH1+NL1 · TN2 cần TN1+NL1 · Solo cần Đệm nâng cao. Chấm màu = trạng thái vận hành của lớp.
      </div>
    </div>
  )
}
