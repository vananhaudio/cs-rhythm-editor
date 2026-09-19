import { ok as assert, deepStrictEqual as assertEquals } from 'node:assert'
const assertStringIncludes = (t: string, s: string) => assert(t.includes(s), `thiếu "${s}"`)
import { ENTRY_PRODUCTS, buildClassPlanEmail } from '../../supabase/functions/mail-worker/classPlanMail.ts'
import { PRODUCTS } from '../../src/class-content.ts'

const F = JSON.parse(Deno.readTextFileSync(new URL('./.fixture.json', import.meta.url)))
const TODAY = '2026-09-19'
const EXPECT: Record<string, { title: string; when: string; start: string }> = {
  'CB1.T3': { title: 'Guitar căn bản 1', when: 'Thứ 3 · 19:00–20:30', start: 'Khai giảng 06/10/2026' },
  'CB2.T3': { title: 'Guitar căn bản 2', when: 'Thứ 3 · 20:30–22:00', start: 'Khai giảng 06/10/2026' },
  'SOLO.T4': { title: 'Solo Guitar 1', when: 'Thứ 4 · 19:00–20:30', start: 'Khai giảng 14/10/2026' },
  'DEM.T4': { title: 'Đệm hát 2', when: 'Thứ 4 · 20:30–22:00', start: 'Khai giảng 14/10/2026' },
}
const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')

function mail(code: string, plan: string, note?: string) {
  const c = F.classes.find((x: { row: { code: string } }) => x.row.code === code)
  return buildClassPlanEmail({
    leadName: 'Nguyễn Test', className: `${EXPECT[code].title} · ${code}`, note: note ?? `[public-product:${c.row.public_product}][plan:${plan}]`,
    plans: F.plans, benefitLabels: F.benefits, cls: c.row, stages: c.stages,
    entryClass: ENTRY_PRODUCTS.includes(c.row.public_product), cfg: F.cfg, todayIso: TODAY,
  })
}

for (const code of Object.keys(EXPECT)) for (const plan of ['monthly', 'six_month']) {
  Deno.test(`${code} × ${plan}`, () => {
    const { content } = mail(code, plan); const t = strip(content); const e = EXPECT[code]
    assertStringIncludes(t, e.title); assertStringIncludes(t, e.when); assertStringIncludes(t, e.start)
    assertStringIncludes(t, 'Hình thức học: Online trực tiếp cùng Thầy qua Zoom, mỗi tuần 1 buổi, 90 phút/buổi.')
    if (plan === 'monthly') {
      assertStringIncludes(t, 'Học theo tháng'); assertStringIncludes(t, '499.000đ/tháng')
      assertStringIncludes(t, 'Số tiền cần chuyển: 499.000đ')
      for (const b of ['Lớp học cùng Thầy hàng tuần', 'Tài liệu PDF tháng này', 'App cơ bản']) assertStringIncludes(t, b)
    } else {
      assertStringIncludes(t, 'Đồng hành 6 tháng'); assertStringIncludes(t, '396.000đ/tháng')
      assertStringIncludes(t, '2.376.000đ / 6 tháng'); assertStringIncludes(t, 'Số tiền cần chuyển: 2.376.000đ')
      for (const b of ['Kho bài giảng', 'App luyện tập đầy đủ', 'Sách & giáo trình', 'Hỏi Thầy', 'Cộng đồng']) assertStringIncludes(t, b)
    }
    assertEquals((t.match(/Số tiền cần chuyển/g) ?? []).length, 1)
    for (const bad of ['990', 'Gói Học theo lớp', 'Gói Thực hành', 'Học cả hai', '8 buổi']) assert(!t.includes(bad), `có "${bad}"`)
    assertStringIncludes(t, 'TPBank'); assertStringIncludes(t, F.cfg.bank_account_number); assertStringIncludes(t, F.cfg.bank_account_name)
    assertStringIncludes(content, 'href="https://class.vananhaudio.com/qr-thanhtoan.png"')
    assertStringIncludes(content, `href="${F.cfg.zalo_url}"`)
    assert(!/zalo\.me\/g\//.test(content), 'không lộ link nhóm lớp trước thanh toán')
  })
}

Deno.test('regression: [plan:monthly] không bao giờ chứa 990000/990.000', () => {
  for (const code of Object.keys(EXPECT)) { const c = mail(code, 'monthly').content; assert(!/990[.,]?000/.test(c)) }
})
Deno.test('regression: [plan:six_month] số tiền chuyển = 2376000', () => {
  for (const code of Object.keys(EXPECT)) assertStringIncludes(strip(mail(code, 'six_month').content), 'Số tiền cần chuyển: 2.376.000đ')
})
Deno.test('gói không tồn tại → lỗi, không rơi về giá cũ', () => {
  let threw = false; try { buildClassPlanEmail({ leadName: 'x', className: null, note: '[plan:monthly]', plans: [], benefitLabels: {}, cls: null, stages: [], entryClass: false, cfg: {}, todayIso: TODAY }) } catch { threw = true }
  assert(threw)
})
Deno.test('drift: ENTRY_PRODUCTS khớp class-content (kind entry, không legacy)', () => {
  const entry = Object.values(PRODUCTS).filter(p => p.kind === 'entry' && !p.legacy).map(p => p.key).sort()
  assertEquals([...ENTRY_PRODUCTS].sort(), entry)
})
