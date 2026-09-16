// ── Màn KHOÁ của một buổi học ──
// Buổi chưa tới giờ vẫn hiện trong chương trình và vẫn bấm vào được — bấm vào thì
// thấy màn này: khi nào mở, vì sao khoá, và lối quay về buổi đang học.
import { useEffect, useState } from 'react'
import { soloUnlockLabel } from '../data/solo01Program'

const P = {
  bg: '#F7F5FC', surface: '#FFFFFF', ink: '#1D1930', inkSoft: '#3E3952', inkFaint: '#6A6580',
  purple: '#4338CA', line: '#E4E0F0', honey: '#A85F0E', honeyTint: '#FBF3E6',
}

function remain(ms: number): string {
  if (ms <= 0) return 'sắp mở'
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (d >= 1) return `còn ${d} ngày ${h % 24} giờ`
  if (h >= 1) return `còn ${h} giờ ${m % 60} phút`
  return `còn ${m} phút`
}

export default function LessonLocked(
  { sessionNo, title, unlockAt, prevNo, prevHref, backHref }:
  { sessionNo: number; title: string; unlockAt: string; prevNo?: number; prevHref?: string; backHref: string },
) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)   // tới giờ là tự mở, không cần tải lại
    return () => clearInterval(t)
  }, [])
  const left = new Date(unlockAt).getTime() - now

  return (
    <div className="lsnlock">
      <style>{CSS}</style>
      <div className="lsnlock-bar">
        <a href={backHref}>← SOLO GUITAR CĂN BẢN</a>
      </div>
      <main className="lsnlock-card">
        <div className="lsnlock-icon">🔒</div>
        <p className="lsnlock-kicker">BUỔI {String(sessionNo).padStart(2, '0')} · CHƯA MỞ</p>
        <h1>{title}</h1>

        <div className="lsnlock-when">
          <span>Mở lúc</span>
          <b>{soloUnlockLabel(unlockAt)}</b>
          <i>{remain(left)}</i>
        </div>

        <p className="lsnlock-why">
          {prevNo
            ? `Buổi này mở sau khi lớp học xong Buổi ${String(prevNo).padStart(2, '0')}. Buổi nào cũng dựng thẳng trên bài của buổi trước, nên tập cho chắc phần cũ đã.`
            : 'Buổi này mở theo lịch lớp. Trong lúc chờ, tập cho chắc phần đã học.'}
        </p>

        <div className="lsnlock-actions">
          {prevHref && prevNo && (
            <a className="lsnlock-go" href={prevHref}>Học Buổi {String(prevNo).padStart(2, '0')} →</a>
          )}
          <a className="lsnlock-back" href={backHref}>Xem chương trình</a>
        </div>
      </main>
    </div>
  )
}

const CSS = `
.lsnlock{background:${P.bg};color:${P.ink};font-family:'Be Vietnam Pro',system-ui,sans-serif;
  min-height:100vh;text-align:left;color-scheme:light;line-height:1.6;}
.lsnlock-bar{padding:12px 16px;border-bottom:1px solid ${P.line};}
.lsnlock-bar a{color:${P.purple};font-weight:600;font-size:13.5px;text-decoration:none;}
.lsnlock-card{max-width:560px;margin:0 auto;padding:40px 18px 60px;text-align:center;}
.lsnlock-icon{font-size:40px;line-height:1;}
.lsnlock-kicker{margin:14px 0 4px;font-size:12px;font-weight:800;letter-spacing:.1em;color:${P.purple};}
.lsnlock h1{margin:0 0 18px;font-size:23px;font-weight:800;line-height:1.35;}
.lsnlock-when{background:${P.surface};border:1px solid ${P.line};border-radius:14px;padding:16px;
  display:flex;flex-direction:column;gap:3px;}
.lsnlock-when span{font-size:12.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${P.inkFaint};}
.lsnlock-when b{font-size:18px;font-weight:800;}
.lsnlock-when i{font-style:normal;font-size:13.5px;color:${P.honey};}
.lsnlock-why{margin:16px 0 22px;font-size:15px;color:${P.inkSoft};text-align:left;
  background:${P.honeyTint};border:1px solid #F0DFC2;border-radius:12px;padding:13px 15px;}
.lsnlock-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;}
.lsnlock-actions a{text-decoration:none;font-weight:600;font-size:15px;border-radius:11px;padding:11px 18px;}
.lsnlock-go{background:${P.purple};color:#fff;}
.lsnlock-back{border:1px solid ${P.line};background:#fff;color:${P.ink};}
`
