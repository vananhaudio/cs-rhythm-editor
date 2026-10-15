import { test } from 'node:test'
import { strictEqual as eq, ok } from 'node:assert'
import { ADMIN_NAV, ADMIN_NAV_GROUPS, adminSectionFromPath, adminPathForSection, adminQuickLinks } from '../../src/admin/adminNav.ts'

test('mọi mục có URL riêng và đọc ngược đúng', () => {
  for (const n of ADMIN_NAV) eq(adminSectionFromPath(adminPathForSection(n.id)), n.id)
})
test('id/slug/nhãn không trùng', () => {
  for (const k of ['id', 'slug', 'label'] as const) eq(new Set(ADMIN_NAV.map(n => n[k])).size, ADMIN_NAV.length)
})
test('đủ 18 mục cũ', () => eq(ADMIN_NAV.length, 18))
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
  eq(ADMIN_NAV_GROUPS[1].items.map(i => i.label).join('|'), 'Lớp & lịch|Giáo trình lớp|Thực hành HT2027|Học viên|Đăng ký|Nhóm cộng đồng')
})
test('Mở nhanh: có TeamLab tuyệt đối, /me theo meBase', () => {
  const l = adminQuickLinks('https://class.vananhaudio.com')
  ok(l.some(x => x.href === 'https://class.vananhaudio.com/me/bands'))
  eq(adminQuickLinks('').find(x => x.label === 'Quản lý Band')?.href, '/me/bands')
  ok(l.find(x => x.label === 'TeamLab')?.external)
})
