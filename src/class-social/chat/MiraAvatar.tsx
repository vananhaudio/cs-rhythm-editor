// Nhận diện Mira: vòng tròn nền #4338CA, chữ M trắng, đậm 800 — đúng avatar Mira của ClassLandingPage (.mc-av). Màu nằm ở CSS (.cs-mira-avatar).
export default function MiraAvatar({ size }: { size: number }) {
  return <span className="cs-avatar cs-mira-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden="true">M</span>
}
