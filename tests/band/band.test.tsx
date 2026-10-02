// Band — Tuyển thành viên V1: model thuần, route, render landing/form/admin, luồng gửi đơn (jsdom),
// và bằng chứng TÁI SỬ DỤNG: Band thứ 2 chỉ là dữ liệu khác, cùng component.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://class.vananhaudio.com/band/la-mua-thu' })
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  requestAnimationFrame: { configurable: true, value: (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, writable: true, value: true },
})
dom.window.HTMLElement.prototype.scrollIntoView = function () {}

const { render, act, cleanup, fireEvent } = await import('@testing-library/react')
const model = await import('../../src/band/bandModel')
const { BandRecruitView, default: BandRecruitPage } = await import('../../src/band/BandRecruitPage')
const { BandApplicationsView, BandsAdminView } = await import('../../src/band/BandAdmin')
const route = await import('../../src/class-social/resolveMeRoute')
void React

afterEach(() => cleanup())

// ── Dữ liệu server mẫu: ĐÚNG dạng band_recruitment_public trả về (seed db/band_la_mua_thu_seed.sql) ──
const SEED = readFileSync(new URL('../../db/band_la_mua_thu_seed.sql', import.meta.url), 'utf8')
const jsonLit = (marker: string) => {
  const i = SEED.indexOf(marker)
  assert.ok(i >= 0, 'seed có ' + marker)
  const start = SEED.lastIndexOf("'", i) + 1
  return JSON.parse(SEED.slice(start, SEED.indexOf("'", i)))
}
const LMT_SERVER = {
  band: { id: 'b1', slug: 'la-mua-thu', name: 'Lá Mùa Thu', leader_name: 'Thầy Văn Anh', tagline: 'Ban nhạc tình ca',
    music_style: 'Tình ca nhẹ nhàng, sâu lắng, giàu giai điệu', schedule_text: '19:00 Thứ Tư hàng tuần',
    reference_songs: jsonLit('[{"title": "Mùa thu cho em"}]'), highlights: jsonLit('[{"label": "Chương trình đào tạo"'), description: null },
  recruitment: { id: 'r1', title: 'Tuyển thành viên Lá Mùa Thu', intro: null, positions: jsonLit('[{"key": "vocal"'),
    questions: jsonLit('[{"key": "level"'), reason_label: 'Vì sao bạn muốn trở thành thành viên của Lá Mùa Thu?', success_message: 'Thầy đã nhận được đơn.' },
  rules: { id: 'v1', version: 1, title: 'Rule của Lá Mùa Thu', items: jsonLit('["Tôi tham gia đều đặn'), agree_label: 'Tôi đã đọc và đồng ý thực hiện' },
}
const BAND2_SERVER = {
  band: { id: 'b2', slug: 'acoustic-chu-nhat', name: 'Acoustic Chủ Nhật', leader_name: 'Bình', tagline: null, music_style: 'Acoustic pop',
    schedule_text: '9:00 Chủ Nhật', reference_songs: [{ title: 'Ngày mai em đi', artist: 'Lê Hiếu' }], highlights: [], description: null },
  recruitment: { id: 'r2', title: 'Tìm bạn cajon', intro: 'Nhóm nhỏ, vui là chính.', positions: [{ key: 'cajon', label: 'Cajon' }, { key: 'ukulele', label: 'Ukulele' }],
    questions: [{ key: 'mic', label: 'Bạn có micro riêng?', type: 'single', options: [{ value: 'y', label: 'Có' }, { value: 'n', label: 'Không' }] }],
    reason_label: 'Bạn mong gì ở Band?', success_message: null },
  rules: { id: 'v9', version: 3, title: 'Luật nhóm', items: ['Đến đúng giờ.'], agree_label: 'Tôi đồng ý' },
}
const LMT = model.parseBandPublic(LMT_SERVER)!
const BAND2 = model.parseBandPublic(BAND2_SERVER)!

test('parse: config Lá Mùa Thu từ seed → 7 vị trí, 3 câu hỏi, Rule v1 5 điều', () => {
  assert.equal(LMT.band.name, 'Lá Mùa Thu')
  assert.deepEqual(LMT.recruitment!.positions.map(p => p.label),
    ['Vocal', 'Guitar đệm', 'Guitar tỉa / Lead', 'Keyboard', 'Bass', 'Trống / Percussion', 'Khác'])
  assert.equal(LMT.recruitment!.positions.at(-1)!.other, true)
  assert.deepEqual(LMT.recruitment!.questions.map(q => q.options.length), [4, 3, 3])
  assert.equal(LMT.recruitment!.questions[1].shortLabel, 'Gu nhạc')
  assert.equal(LMT.rules!.version, 1)
  assert.equal(LMT.rules!.items.length, 5)
})

test('parse: dữ liệu hỏng không crash; thiếu vị trí/Rule → không có form', () => {
  assert.equal(model.parseBandPublic(null), null)
  assert.equal(model.parseBandPublic({ band: { name: 'x' } }), null)
  const noRec = model.parseBandPublic({ ...LMT_SERVER, recruitment: null, rules: null })!
  assert.equal(noRec.recruitment, null)
  const badPos = model.parseBandPublic({ ...LMT_SERVER, recruitment: { ...LMT_SERVER.recruitment, positions: [{ key: 1 }] } })!
  assert.equal(badPos.recruitment, null, 'không vị trí hợp lệ → coi như chưa mở tuyển')
  assert.equal(model.parseQuestions([{ key: 'a', label: 'A', options: [] }, { key: 'b', label: 'B', type: 'text', options: [{ value: 'x', label: 'X' }] }]).length, 0)
})

test('normalizePhone: cùng luật với band_apply', () => {
  assert.equal(model.normalizePhone('+84 912 345 678'), '0912345678')
  assert.equal(model.normalizePhone('84912345678'), '0912345678')
  assert.equal(model.normalizePhone('0912.345.678'), '0912345678')
  assert.equal(model.normalizePhone('12345'), null)
  assert.equal(model.normalizePhone(''), null)
})

const filled = (o: Partial<ReturnType<typeof model.emptyBandForm>> = {}) => ({
  ...model.emptyBandForm(), fullName: 'Nguyễn An', phone: '0912345678', positionKey: 'vocal',
  answers: { level: 'basic', taste_fit: 'very', schedule: 'yes' }, reason: 'Mê tình ca', rulesAccepted: true, ...o,
})

test('validate: đủ 8 mục theo config; Rule bắt buộc; lý do bắt buộc', () => {
  const rec = LMT.recruitment!
  assert.deepEqual(model.validateBandForm(rec, filled()), {})
  const e = model.validateBandForm(rec, model.emptyBandForm())
  assert.deepEqual(Object.keys(e).sort(), ['fullName', 'level', 'phone', 'positionKey', 'reason', 'rules', 'schedule', 'taste_fit'].sort())
  assert.equal(model.firstErrorKey(rec, e), 'fullName')
  assert.ok(model.validateBandForm(rec, filled({ reason: '   ' })).reason)
  assert.ok(model.validateBandForm(rec, filled({ rulesAccepted: false })).rules)
  assert.ok(model.validateBandForm(rec, filled({ answers: { level: 'pro', taste_fit: 'very', schedule: 'yes' } })).level)
})

test('payload: có rule_version_id + client_key; KHÔNG gửi danh tính; câu trả lời ngoài config bị bỏ', () => {
  const p = model.buildApplyPayload(LMT.recruitment!, LMT.rules!, filled({ answers: { level: 'basic', taste_fit: 'very', schedule: 'yes', hack: '1' }, positionOther: 'bỏ' }), 'key-12345678')
  assert.equal(p.rule_version_id, 'v1')
  assert.equal(p.rules_accepted, true)
  assert.equal(p.position_other, null, 'vị trí không phải "Khác" → không gửi mô tả')
  assert.deepEqual(Object.keys(p.answers), ['level', 'taste_fit', 'schedule'])
  assert.ok(!('user_id' in p) && !('applicant_user_id' in p) && !('band_id' in p))
  const other = model.buildApplyPayload(LMT.recruitment!, LMT.rules!, filled({ positionKey: 'other', positionOther: ' Sáo ' }), 'k-12345678')
  assert.equal(other.position_other, 'Sáo')
})

test('route công khai /band/<slug> + route admin /me/bands', () => {
  assert.equal(model.bandSlugFromPublicPath('/band/la-mua-thu'), 'la-mua-thu')
  assert.equal(model.bandSlugFromPublicPath('/band/la-mua-thu/'), 'la-mua-thu')
  assert.equal(model.bandSlugFromPublicPath('/band/'), null)
  assert.equal(model.bandSlugFromPublicPath('/band/../x'), null)
  assert.equal(model.bandSlugFromPublicPath('/bands'), null)
  assert.equal(model.bandPublicPath('acoustic-chu-nhat'), '/band/acoustic-chu-nhat')
  assert.deepEqual(route.viewFromPath('/me/bands'), { kind: 'bands' })
  assert.deepEqual(route.viewFromPath('/me/bands/la-mua-thu'), { kind: 'bandAdmin', slug: 'la-mua-thu' })
  assert.deepEqual(route.viewFromPath('/me/bands/<x>'), { kind: 'section', section: 'home' })
  assert.equal(route.viewPath({ kind: 'bandAdmin', slug: 'la-mua-thu' }), '/me/bands/la-mua-thu')
  assert.ok(route.sameView({ kind: 'bandAdmin', slug: 'a' }, { kind: 'bandAdmin', slug: 'a' }))
  assert.ok(!route.sameView({ kind: 'bandAdmin', slug: 'a' }, { kind: 'bandAdmin', slug: 'b' }))
  assert.ok(route.keepsPathForGuest({ kind: 'bandAdmin', slug: 'a' }), 'link admin giữ qua bước đăng nhập')
  // /band/ KHÔNG đụng trang tuyển sinh class.*/class* và /me
  assert.equal(route.isMePath('/band/la-mua-thu'), false)
})

const noSubmit = async () => ({ ok: true as const, value: { duplicate: false } })

test('landing Lá Mùa Thu: thông tin Band + vị trí + form + Rule — toàn bộ từ dữ liệu', () => {
  const h = renderToStaticMarkup(<BandRecruitView data={LMT} submit={noSubmit} submitted={null} onSubmitted={() => {}} />)
  for (const s of ['Lá Mùa Thu', 'Thầy Văn Anh', 'Tình ca nhẹ nhàng, sâu lắng, giàu giai điệu', '19:00 Thứ Tư hàng tuần', 'Mùa thu cho em',
    'Chương trình đào tạo', 'Miễn phí cho Band đầu tiên', 'Guitar tỉa / Lead', 'Trống / Percussion', 'Đã từng chơi Band',
    'Không phải gu của tôi', 'Tôi chưa chắc chắn', 'Tôi chủ động cùng mọi người vận hành Band, không chờ Thầy bố trí mọi việc.',
    'Tôi đã đọc và đồng ý thực hiện', 'Vì sao bạn muốn trở thành thành viên của Lá Mùa Thu?', 'Họ và tên', 'Số điện thoại / Zalo']) {
    assert.ok(h.includes(s), 'landing có: ' + s)
  }
  assert.match(h, /<button type="submit"[^>]*disabled=""/, 'chưa tick Rule → nút Gửi bị khoá')
  assert.ok(h.indexOf('Tôi đã đọc và đồng ý') < h.indexOf('Vì sao bạn muốn'), 'thứ tự: Rule (7) trước lý do (8)')
})

test('REUSABILITY: Band 2 = dữ liệu khác, CÙNG component — không còn dấu vết Lá Mùa Thu', () => {
  const h = renderToStaticMarkup(<BandRecruitView data={BAND2} submit={noSubmit} submitted={null} onSubmitted={() => {}} />)
  for (const s of ['Acoustic Chủ Nhật', 'Bình', '9:00 Chủ Nhật', 'Ngày mai em đi', 'Lê Hiếu', 'Cajon', 'Bạn có micro riêng?', 'Luật nhóm',
    'Đến đúng giờ.', 'Tôi đồng ý', 'Bạn mong gì ở Band?']) assert.ok(h.includes(s), 'Band 2 có: ' + s)
  for (const s of ['Lá Mùa Thu', 'Mùa thu cho em', 'Thứ Tư', 'Guitar đệm', 'Trình độ', 'Miễn phí']) assert.ok(!h.includes(s), 'Band 2 KHÔNG có: ' + s)
})

test('REUSABILITY: mã nguồn src/band không chứa nội dung riêng của Band nào', () => {
  const dir = new URL('../../src/band/', import.meta.url)
  const src = readdirSync(dir).map(f => readFileSync(new URL(f, dir), 'utf8')).join('\n')
  for (const s of ['Lá Mùa Thu', 'la-mua-thu', 'Mùa thu cho em', 'Thứ Tư', '19:00', 'Guitar đệm', 'Bass', 'Keyboard', 'Đã từng chơi Band', 'Rất đúng gu',
    'Tôi tham gia đều đặn']) assert.ok(!src.includes(s), 'src/band không hardcode: ' + s)
})

test('đóng tuyển / gửi xong / gửi trùng', () => {
  const closed = renderToStaticMarkup(<BandRecruitView data={{ ...LMT, recruitment: null, rules: null }} submit={noSubmit} submitted={null} onSubmitted={() => {}} />)
  assert.ok(closed.includes('chưa mở đợt tuyển') && !closed.includes('<form'))
  const done = renderToStaticMarkup(<BandRecruitView data={LMT} submit={noSubmit} submitted={{ duplicate: false }} onSubmitted={() => {}} />)
  assert.ok(done.includes('Đã gửi đơn ứng tuyển') && done.includes('Thầy đã nhận được đơn.') && !done.includes('<form'))
  const dup = renderToStaticMarkup(<BandRecruitView data={LMT} submit={noSubmit} submitted={{ duplicate: true }} onSubmitted={() => {}} />)
  assert.ok(dup.includes('Bạn đã gửi đơn trước đó'))
})

const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })

test('LUỒNG THẬT (jsdom): mở link → chọn vị trí → trả lời → tick Rule → gửi → thấy xác nhận', async () => {
  const calls: { id: string; payload: Record<string, unknown> }[] = []
  const submit = async (id: string, payload: Record<string, unknown>) => { calls.push({ id, payload }); return { ok: true as const, value: { duplicate: false } } }
  const load = async (slug: string) => { assert.equal(slug, 'la-mua-thu'); return { ok: true as const, value: LMT } }
  const v = render(<BandRecruitPage slug="la-mua-thu" submit={submit} load={load} />)
  await flush()
  assert.ok(v.getByText('Lá Mùa Thu'))
  const btn = v.getByRole('button', { name: 'Gửi đơn ứng tuyển' }) as HTMLButtonElement
  assert.equal(btn.disabled, true, 'chưa tick Rule → khoá')
  fireEvent.change(v.getByLabelText('Họ và tên'), { target: { value: 'Trần Bình' } })
  fireEvent.change(v.getByLabelText('Số điện thoại / Zalo'), { target: { value: '0987 654 321' } })
  fireEvent.click(v.getByLabelText('Khác'))
  fireEvent.change(v.getByLabelText('Vị trí khác (mô tả)'), { target: { value: 'Sáo trúc' } })
  fireEvent.click(v.getByLabelText('Chơi tương đối tốt'))
  fireEvent.click(v.getByLabelText('Rất đúng gu'))
  fireEvent.click(v.getByLabelText('Có, tôi có thể ưu tiên lịch này'))
  fireEvent.click(v.getByLabelText('Tôi đã đọc và đồng ý thực hiện'))
  assert.equal(btn.disabled, false)
  // Lý do bắt buộc: gửi khi trống → báo lỗi, không gọi server
  fireEvent.click(btn)
  await flush()
  assert.equal(calls.length, 0)
  assert.ok(v.getByText('Vui lòng cho biết lý do — Thầy đọc kỹ phần này.'))
  fireEvent.change(v.getByLabelText('Vì sao bạn muốn trở thành thành viên của Lá Mùa Thu?'), { target: { value: 'Muốn chơi tình ca cùng mọi người' } })
  fireEvent.click(btn)
  await flush()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].id, 'r1')
  assert.deepEqual({ ...calls[0].payload, client_key: '-' }, {
    full_name: 'Trần Bình', phone: '0987 654 321', position_key: 'other', position_other: 'Sáo trúc',
    answers: { level: 'good', taste_fit: 'very', schedule: 'yes' }, reason: 'Muốn chơi tình ca cùng mọi người',
    rules_accepted: true, rule_version_id: 'v1', client_key: '-', website: '',
  })
  assert.ok(v.getByText('Đã gửi đơn ứng tuyển'))
})

test('LUỒNG: Rule đổi giữa chừng → giữ nội dung, bắt tick lại Rule mới', async () => {
  let rules = LMT.rules!
  const load = async () => ({ ok: true as const, value: { ...LMT, rules } })
  const submit = async () => { rules = { ...rules, id: 'v2', version: 2, items: ['Rule mới'] }; return { ok: false as const, code: 'rule_changed', message: 'Rule của Band vừa được cập nhật.' } }
  const v = render(<BandRecruitPage slug="la-mua-thu" submit={submit} load={load} />)
  await flush()
  fireEvent.change(v.getByLabelText('Họ và tên'), { target: { value: 'Chi' } })
  fireEvent.change(v.getByLabelText('Số điện thoại / Zalo'), { target: { value: '0911111111' } })
  fireEvent.click(v.getByLabelText('Vocal'))
  fireEvent.click(v.getByLabelText('Mới học'))
  fireEvent.click(v.getByLabelText('Khá phù hợp'))
  fireEvent.click(v.getByLabelText('Tôi chưa chắc chắn'))
  fireEvent.click(v.getByLabelText('Tôi đã đọc và đồng ý thực hiện'))
  fireEvent.change(v.getByLabelText('Vì sao bạn muốn trở thành thành viên của Lá Mùa Thu?'), { target: { value: 'Vui' } })
  fireEvent.click(v.getByRole('button', { name: 'Gửi đơn ứng tuyển' }))
  await flush(); await flush()
  assert.ok(v.getByText('Rule mới'), 'hiện Rule mới')
  assert.equal((v.getByLabelText('Họ và tên') as HTMLInputElement).value, 'Chi', 'giữ nội dung đã nhập')
  assert.equal((v.getByLabelText('Tôi đã đọc và đồng ý thực hiện') as HTMLInputElement).checked, false, 'phải tick lại')
})

test('LUỒNG: slug lạ / lỗi mạng', async () => {
  const miss = render(<BandRecruitPage slug="khong-co" load={async () => ({ ok: true as const, value: null })} />)
  await flush()
  assert.ok(miss.getByText('Không tìm thấy Band'))
  cleanup()
  const err = render(<BandRecruitPage slug="x" load={async () => ({ ok: false as const, message: 'Mất kết nối mạng.' })} />)
  await flush()
  assert.ok(err.getByText('Mất kết nối mạng.') && err.getByRole('button', { name: 'Thử lại' }))
})

// ── Admin ──
const DETAIL = model.parseAdminDetail({
  band: { id: 'b1', slug: 'la-mua-thu', name: 'Lá Mùa Thu' },
  recruitments: [{ id: 'r1', title: 't', status: 'open', positions: LMT_SERVER.recruitment.positions, questions: LMT_SERVER.recruitment.questions,
    reason_label: LMT_SERVER.recruitment.reason_label }],
  applications: [
    { id: 'a1', recruitment_id: 'r1', full_name: 'Trần Bình', phone: '0987654321', position_key: 'other', position_other: 'Sáo trúc',
      answers: { level: 'good', taste_fit: 'very', schedule: 'sometimes', cu: 'x' }, reason: 'Muốn chơi tình ca', rule_version: 1,
      rules_accepted_at: '2026-10-02T12:00:00Z', status: 'NEW', has_account: false, created_at: '2026-10-02T12:00:00Z' },
    { id: 'a2', recruitment_id: 'r1', full_name: 'An', phone: '0912345678', position_key: 'bass', position_other: null,
      answers: {}, reason: 'Thích bass', rule_version: 2, rules_accepted_at: '2026-10-03T01:00:00Z', status: 'ACCEPTED', has_account: true,
      created_at: '2026-10-03T01:00:00Z' },
  ],
})!

test('Admin: đủ cột Owner cần — tên, vị trí, trình độ, lịch, gu, lý do, Rule version, thời gian, trạng thái', () => {
  const h = renderToStaticMarkup(<BandApplicationsView detail={DETAIL} filter="ALL" onFilter={() => {}} busyId={null} errorId={null} errorText={null} onStatus={() => {}} />)
  for (const s of ['Trần Bình', '0987654321', 'Khác: Sáo trúc', 'Chơi tương đối tốt', 'Rất đúng gu', 'Thỉnh thoảng sẽ vắng', 'Gu nhạc', 'Lịch tập',
    'Trình độ', 'Muốn chơi tình ca', 'Đã đồng ý bản v1', '19:00 02/10/2026', 'Mới', 'Đang xem xét', 'Chấp nhận', 'Từ chối',
    'Đã đồng ý bản v2', 'Bass', 'có tài khoản']) assert.ok(h.includes(s), 'Admin có: ' + s)
  assert.ok(h.includes('<dt>cu</dt><dd>x</dd>'), 'câu trả lời ngoài config vẫn hiện (không mất dữ liệu)')
  const onlyNew = renderToStaticMarkup(<BandApplicationsView detail={DETAIL} filter="NEW" onFilter={() => {}} busyId={null} errorId={null} errorText={null} onStatus={() => {}} />)
  assert.ok(onlyNew.includes('Trần Bình') && !onlyNew.includes('Thích bass'))
  assert.deepEqual(model.countByStatus(DETAIL.applications), { ALL: 2, NEW: 1, REVIEWING: 0, ACCEPTED: 1, REJECTED: 0 })
})

test('Admin: đổi trạng thái gọi onStatus đúng đơn', () => {
  const got: string[] = []
  const v = render(<BandApplicationsView detail={DETAIL} filter="ALL" onFilter={() => {}} busyId={null} errorId={null} errorText={null}
    onStatus={(a, s) => got.push(a.id + ':' + s)} />)
  fireEvent.click(v.getByRole('group', { name: 'Trạng thái đơn của Trần Bình' }).querySelector('button:nth-child(2)')!)
  assert.deepEqual(got, ['a1:REVIEWING'])
})

test('Admin: danh sách Band + số đơn mới', () => {
  const h = renderToStaticMarkup(<BandsAdminView bands={model.parseAdminBands([
    { id: 'b1', slug: 'la-mua-thu', name: 'Lá Mùa Thu', status: 'active', recruitment_status: 'open', total: 3, new: 2 },
    { id: 'b2', slug: 'acoustic', name: 'Acoustic', status: 'draft', recruitment_status: null, total: 0, new: 0 }])} onOpenBand={() => {}} />)
  assert.ok(h.includes('Lá Mùa Thu') && h.includes('Đang tuyển') && h.includes('2 mới') && h.includes('3 đơn'))
  assert.ok(h.includes('Chưa mở tuyển') && h.includes('Band chưa công khai'))
  assert.ok(renderToStaticMarkup(<BandsAdminView bands={[]} onOpenBand={() => {}} />).includes('Chưa có Band nào'))
})
