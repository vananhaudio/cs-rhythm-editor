import { test } from 'node:test'
import { strictEqual as eq, ok } from 'node:assert'
import { ADMIN_NAV, ADMIN_NAV_GROUPS, adminSectionFromPath, adminPathForSection, adminQuickLinks, parseAdminClassPath, adminClassPath, CLASS_TABS } from '../../src/admin/adminNav.ts'

test('mọi mục có URL riêng và đọc ngược đúng', () => {
  for (const n of ADMIN_NAV) eq(adminSectionFromPath(adminPathForSection(n.id)), n.id)
})
test('id/slug/nhãn không trùng', () => {
  for (const k of ['id', 'slug', 'label'] as const) eq(new Set(ADMIN_NAV.map(n => n[k])).size, ADMIN_NAV.length)
})
test('18 mục cũ + Danh sách lớp', () => eq(ADMIN_NAV.length, 19))
test('URL cũ vẫn vào đúng mục', () => {
  eq(adminSectionFromPath('/admin'), 'dashboard')
  eq(adminSectionFromPath('/admin/'), 'dashboard')
  eq(adminSectionFromPath('/admin/daily-mail'), 'dailymail')
  eq(adminSectionFromPath('/admin/chat-mail'), 'chatmail')
  eq(adminSectionFromPath('/admin/showcase'), 'showcase')
  eq(adminSectionFromPath('/admin/showcase/anything'), 'showcase')
  eq(adminSectionFromPath('/admin/nhipphach'), 'nhipphach')
  eq(adminSectionFromPath('/admin/dailymail'), 'dailymail')   // slug cũ = id nội bộ
  eq(adminSectionFromPath('/admin/chatmail'), 'chatmail')
  eq(adminSectionFromPath('/admin/schedule'), 'schedule')
})
test('URL không hợp lệ → null; không phải /admin → null', () => {
  eq(adminSectionFromPath('/admin/khong-co'), null)
  eq(adminSectionFromPath('/thuvien'), null)
  eq(adminSectionFromPath('/administrator'), null)
})
test('thứ tự nhóm theo quyết định', () => {
  eq(ADMIN_NAV_GROUPS.map(g => g.title).join('|'), '|Lớp học|Học liệu|Nội dung & truyền thông|Trợ lý AI')
  eq(ADMIN_NAV_GROUPS[1].items.map(i => i.label).join('|'), 'Danh sách lớp|Lớp & lịch|Giáo trình lớp|Thực hành HT2027|Học viên|Đăng ký|Nhóm cộng đồng')
})
test('Mở nhanh: có TeamLab tuyệt đối, /me theo meBase', () => {
  const l = adminQuickLinks('https://class.vananhaudio.com')
  ok(l.some(x => x.href === 'https://class.vananhaudio.com/me/bands'))
  eq(adminQuickLinks('').find(x => x.label === 'Quản lý Band')?.href, '/me/bands')
  ok(l.find(x => x.label === 'TeamLab')?.external)
})

test('V2: /admin/lop[/id[/tab]] thuộc mục lop; đường cũ giữ nguyên', () => {
  eq(adminSectionFromPath('/admin/lop'), 'lop')
  eq(adminSectionFromPath('/admin/lop/abc-123'), 'lop')
  eq(adminSectionFromPath('/admin/lop/abc-123/hoc-vien'), 'lop')
  eq(adminSectionFromPath('/admin/classes'), 'classes')
  eq(adminSectionFromPath('/admin/ht2027'), 'ht2027')
})
test('V2: phân tích đường dẫn lớp', () => {
  eq(parseAdminClassPath('/admin/lop'), null)
  eq(parseAdminClassPath('/admin/lop/'), null)
  eq(parseAdminClassPath('/admin/classes'), null)
  const a = parseAdminClassPath('/admin/lop/abc')!
  eq(a.classKey, 'abc'); eq(a.tab, 'overview'); eq(a.tabValid, true)
  for (const t of CLASS_TABS) {
    const r = parseAdminClassPath(adminClassPath('id-1', t.id))!
    eq(r.classKey, 'id-1'); eq(r.tab, t.id); eq(r.tabValid, true)
  }
  const bad = parseAdminClassPath('/admin/lop/abc/khong-co')!
  eq(bad.tab, 'overview'); eq(bad.tabValid, false)
  eq(parseAdminClassPath('/admin/lop/abc/lich/')!.tab, 'schedule')
  eq(parseAdminClassPath('/admin/lop/%E0%A4%A')?.classKey, undefined)   // %-escape hỏng → null, không ném lỗi
})
test('V2: slug tab không trùng và không phá URL cũ', () => {
  eq(new Set(CLASS_TABS.map(t => t.slug)).size, CLASS_TABS.length)
  eq(adminClassPath('x'), '/admin/lop/x')
  eq(adminClassPath('x', 'curriculum'), '/admin/lop/x/giao-trinh')
})
