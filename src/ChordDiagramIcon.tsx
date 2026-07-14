// Icon line-art cho công cụ "Hợp âm" — sơ đồ hợp âm (khung cần đàn + chấm ngón bấm).
// Dùng chung cho StudentOnboarding, MobileStudentPortal, StudentPortalV2.
export default function ChordDiagramIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-6 -9 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <line x1="0" y1="0" x2="60" y2="0" stroke="#3F3F46" strokeWidth="6" strokeLinecap="round" />
      <g stroke="#3F3F46" strokeWidth="2.4" strokeLinecap="round">
        <line x1="0" y1="18" x2="60" y2="18" />
        <line x1="0" y1="36" x2="60" y2="36" />
        <line x1="0" y1="54" x2="60" y2="54" />
        <line x1="0" y1="0" x2="0" y2="54" />
        <line x1="15" y1="0" x2="15" y2="54" />
        <line x1="30" y1="0" x2="30" y2="54" />
        <line x1="45" y1="0" x2="45" y2="54" />
        <line x1="60" y1="0" x2="60" y2="54" />
      </g>
      <g fill="#4338CA">
        <circle cx="15" cy="27" r="7" />
        <circle cx="30" cy="27" r="7" />
        <circle cx="45" cy="45" r="7" />
      </g>
    </svg>
  )
}
