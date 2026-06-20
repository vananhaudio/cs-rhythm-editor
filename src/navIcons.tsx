// Bộ icon line HỌC–TẬP–SỐNG cho thanh điều hướng học viên.
// Đơn sắc: nhận màu qua prop `color` (active = chàm, inactive = xám) → tự sáng theo trạng thái.
type Props = { name: string; color?: string; size?: number; strokeWidth?: number }

export function NavIcon({ name, color = 'currentColor', size = 24, strokeWidth = 1.6 }: Props) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color,
    strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  }

  // HỌC — sách mở + nốt nhạc + dòng nhạc
  if (name === 'hoc') return (
    <svg {...p}>
      <path d="M12 7.2v10.6" />
      <path d="M12 7.2C9.6 5.9 6.2 5.9 4 6.8v10.5c2.2-.9 5.6-.9 8 .5" />
      <path d="M12 7.2c2.4-1.3 5.8-1.3 8-.4v10.5c-2.2-.9-5.6-.9-8 .5" />
      <path d="M14.8 10.4h3.1M14.8 12.6h3.1" />
      <circle cx="6.7" cy="13.2" r="1.05" />
      <path d="M7.75 13.2V9.8" />
    </svg>
  )

  // TẬP — máy gõ nhịp (metronome)
  if (name === 'tap') return (
    <svg {...p}>
      <path d="M8.6 18.8 11 5.4h2l2.4 13.4Z" />
      <path d="M7.2 18.8h9.6" />
      <path d="M12 7.6l2.7 7.2" />
      <path d="M11.2 9.6h1.1M10.95 11.4h1.35M10.7 13.2h1.6" />
    </svg>
  )

  // SỐNG — nốt nhạc trong vòng xoay (nhạc sống động, ngân vang)
  return (
    <svg {...p}>
      <ellipse cx="9.6" cy="15" rx="1.9" ry="1.45" />
      <path d="M11.5 14.8V7.4l3.9 1.75" />
      <path d="M5.7 9.4A6.7 6.7 0 0 1 16.6 7.1" />
      <path d="M18.3 12A6.7 6.7 0 0 1 7.6 16.7" />
      <path d="M14.7 5.5l2.1 1.5-1.3 2" />
      <path d="M9.3 18.2 7.2 16.7l1.3-2" />
    </svg>
  )
}
