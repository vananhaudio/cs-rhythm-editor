// Logo Thầy Văn Anh Guitar — monogram "G#" (chữ C/G + dấu thăng) trong vòng tròn.
// Dạng line-art, nền TRONG SUỐT (dùng trên nền sáng). Màu theo prop (mặc định xanh thương hiệu).
export default function BrandMark({ size = 38, color = '#2E6E4E' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Thầy Văn Anh Guitar">
      {/* vòng tròn ngoài */}
      <circle cx="50" cy="50" r="37" stroke={color} strokeWidth="4.4" />
      {/* chữ C (mở về bên phải) — cùng dấu # tạo thành "G#" */}
      <path d="M48.5 35.2 A 18 18 0 1 0 48.5 64.8" stroke={color} strokeWidth="5.4" strokeLinecap="round" />
      {/* dấu thăng # */}
      <g stroke={color} strokeWidth="3.6" strokeLinecap="round">
        <line x1="50" y1="33" x2="50" y2="71" />
        <line x1="61" y1="33" x2="61" y2="71" />
        <line x1="37" y1="48" x2="80" y2="48" />
        <line x1="37" y1="58" x2="80" y2="58" />
      </g>
    </svg>
  )
}
