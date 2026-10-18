// KIỂM KHẢ NĂNG NHÌN THẤY của nút/chip (Curriculum Guard V1, 18/10/2026) — dùng chung cho các kịch bản E2E Chrome.
// Lý do: lỗi "nút Kiểm tra vô hình" (03→18/10) lọt vì E2E chỉ kiểm isVisible / bấm được; biến màu --lt-p thiếu → nền trong suốt + chữ trắng.
// Đo MÀU THẬT (computed style, gộp mọi lớp nền tổ tiên): chữ so với nền tương phản < 2.5:1, hoặc .lt-btn không nền không viền.
// KHÔNG phải framework: một hàm thuần chạy trong trang + hai tiện ích assert.
import assert from 'node:assert/strict'

const SELECTOR = 'button, [role=button], a[href], input[type=submit], input[type=button], summary, .lt-btn, .lt-chip, .cs-btn, label.cs-quiz-opt'

/** Trả danh sách điều khiển đang hiển thị nhưng nhìn không thấy. */
export function findInvisibleControls(page) {
  return page.evaluate((sel) => {
    const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1] }
    const over = (top, bot) => { const a = top[3] + bot[3] * (1 - top[3]); if (a === 0) return [0, 0, 0, 0]; return [0, 1, 2].map(i => (top[i] * top[3] + bot[i] * bot[3] * (1 - top[3])) / a).concat(a) }
    const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b) }
    const cr = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }
    const backdrop = el => { let acc = [255, 255, 255, 1]; const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e); for (const e of chain.reverse()) acc = over(parse(getComputedStyle(e).backgroundColor), acc); return acc }
    const out = []
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
      if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue
      const text = (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)
      const own = parse(cs.backgroundColor), fg = parse(cs.color), bg = backdrop(el)
      const bcol = parse(cs.borderTopColor)
      const hasBorder = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' && bcol[3] > .15
      const hasBg = own[3] > .1 && cr(own.slice(0, 3), backdrop(el.parentElement).slice(0, 3)) > 1.05
      const why = []
      if (text && cr(fg, bg) < 2.5) why.push(`chữ ${cs.color} trên nền ${bg.slice(0, 3).map(Math.round)} = ${cr(fg, bg).toFixed(2)}:1`)
      if (el.tagName === 'BUTTON' && el.classList.contains('lt-btn') && !hasBg && !hasBorder) why.push(`.lt-btn không nền (${cs.backgroundColor}) không viền (${cs.borderTopWidth})`)
      if (why.length) out.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), text, why: why.join('; ') })
    }
    return out
  }, SELECTOR)
}

/** Fail nếu có nút/chip nhìn không thấy ở trạng thái hiện tại của trang. */
export async function assertControlsVisible(page, label) {
  const bad = await findInvisibleControls(page)
  assert.deepEqual(bad, [], `${label}: có nút/chip nhìn không thấy → ${bad.map(b => `${b.tag}.${b.cls} "${b.text}" (${b.why})`).join(' | ')}`)
}

/** Đối chứng dương: gỡ biến --lt-p khỏi mọi .lt-panel → bộ quét PHẢI bắt được (nếu không, bộ quét hỏng/vô dụng). */
export async function assertScannerCatchesInvisible(page) {
  await page.evaluate(() => document.querySelectorAll('.lt-panel').forEach(p => p.style.setProperty('--lt-p', 'initial')))
  const caught = (await findInvisibleControls(page)).length
  await page.evaluate(() => document.querySelectorAll('.lt-panel').forEach(p => p.style.removeProperty('--lt-p')))
  assert.ok(caught > 0, 'bộ quét nhìn-thấy KHÔNG bắt được nút vô hình khi gỡ --lt-p (đối chứng dương hỏng)')
  return caught
}
