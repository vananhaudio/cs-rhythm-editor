// Lát 1 — Tách Thông báo và Trò chuyện: chưa đọc theo TỪNG nguồn (dm · band · notice), không cộng chéo, không âm, không tự đánh dấu đọc.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildUnread, inboxUnreadSplit, type ConversationItem } from "../../src/class-social/chat/chatModel";

const code = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const conv = (id: string, kind: "dm" | "band", unread: number): ConversationItem => ({
  id, peerId: id, name: id, avatarUrl: null, isTeacher: false, lastSeq: 1, lastBody: "x", lastMine: false, lastAt: "2026-10-27T00:00:00Z", unread, canSend: true, kind,
} as ConversationItem);

test("buildUnread: chatTotal = dm + band; noticeTotal tách riêng; ba nguồn cùng có dữ liệu", () => {
  const u = buildUnread(2, 3, 4);
  assert.deepEqual(u, { dm: 2, band: 3, notice: 4, chatTotal: 5, noticeTotal: 4 });
});

test("buildUnread: một nguồn = 0 không ảnh hưởng nguồn khác; đọc nguồn này không đổi nguồn kia", () => {
  assert.deepEqual(buildUnread(0, 3, 4), { dm: 0, band: 3, notice: 4, chatTotal: 3, noticeTotal: 4 });
  assert.equal(buildUnread(2, 0, 4).chatTotal, 2);
  assert.equal(buildUnread(2, 3, 0).noticeTotal, 0);
  // đọc thông báo (4→0) không đổi Trò chuyện; đọc DM (2→0) không đổi Thông báo / Band
  assert.equal(buildUnread(2, 3, 0).chatTotal, buildUnread(2, 3, 4).chatTotal);
  assert.equal(buildUnread(0, 3, 4).noticeTotal, buildUnread(2, 3, 4).noticeTotal);
  assert.equal(buildUnread(2, 0, 4).dm, 2);
});

test("buildUnread: không số âm / NaN / số lẻ / null (nguồn lỗi hoặc timeout → 0)", () => {
  assert.deepEqual(buildUnread(-5, Number.NaN, undefined), { dm: 0, band: 0, notice: 0, chatTotal: 0, noticeTotal: 0 });
  assert.deepEqual(buildUnread("3", null, 2.9), { dm: 3, band: 0, notice: 2, chatTotal: 3, noticeTotal: 2 });
});

test("inboxUnreadSplit: tách dm / band từ hộp thư gộp, đếm hội thoại (không đếm tin), không tính trùng", () => {
  const rows = [conv("a", "dm", 5), conv("b", "dm", 0), conv("c", "band", 2), conv("d", "band", 9), conv("e", "band", 0)];
  assert.deepEqual(inboxUnreadSplit(rows), { dm: 1, band: 2 });
  assert.deepEqual(inboxUnreadSplit([]), { dm: 0, band: 0 });
  const legacy = { ...conv("f", "dm", 1), kind: undefined } as ConversationItem;
  assert.deepEqual(inboxUnreadSplit([legacy]), { dm: 1, band: 0 }, "hàng cũ không có kind → tính là dm");
});

test("Hook: badge chat KHÔNG gồm thông báo; không phép trừ thủ công; nguồn lỗi giữ số cũ", () => {
  const hook = code("src/class-social/chat/useChat.ts");
  const fn = hook.slice(hook.indexOf("export function useChatUnread"), hook.indexOf("export function useNoticeSound"));
  assert.match(fn, /return \{ count: unread\.chatTotal, unread, system, refresh \}/);
  assert.equal(/count\s*-|-\s*\(?system/.test(fn), false);
  assert.match(fn, /if \(a\.ok\) setChat\(a\.value\)/, "dm lỗi → giữ số cũ, không về 0 giả");
  assert.equal(/markRead|markSystemRead/.test(fn), false, "cập nhật badge không đánh dấu đã đọc");
});

test("API: breakdown dùng cả dm_unread_count và bandchat_unread_count; band lỗi → 0, dm lỗi → lỗi; tổng cũ giữ nguyên ngữ nghĩa", () => {
  const api = code("src/class-social/chat/chatApi.ts");
  const fn = api.slice(api.indexOf("export async function fetchUnreadBreakdown"), api.indexOf("/** Thành viên hiện hành"));
  assert.match(fn, /'dm_unread_count'/);
  assert.match(fn, /'bandchat_unread_count'/);
  assert.match(fn, /b\.ok \? n\(b\.value\) : 0/);
  assert.match(fn, /value\.dm \+ r\.value\.band/);
  assert.equal(/class_system_/.test(fn), false, "Trò chuyện không đọc nguồn thông báo");
});

test("Web/Mobile dùng CHUNG nguồn: shell chỉ đọc chatUnread.unread; chuông = noticeTotal, tab Trò chuyện = chatTotal", () => {
  const mobile = code("src/class-mobile/MobileShell.tsx");
  assert.match(mobile, /chatUnread\.unread\.chatTotal/);
  assert.match(mobile, /chatUnread\.unread\.noticeTotal/);
  assert.equal(/count - \(chatUnread\.system/.test(mobile), false, "không còn trừ thủ công");
  const web = code("src/class-social/ClassSocialPage.tsx");
  assert.match(web, /chat: chatUnread\.count/);
  assert.match(web, /count: chatUnread\.unread\.noticeTotal/);
});

test("Trò chuyện không chứa Thông báo; Thông báo là màn riêng và là nơi DUY NHẤT đánh dấu đã đọc", () => {
  assert.equal(/SystemNoticeView|SystemItem|markSystemRead|fetchSystemNotices/.test(code("src/class-social/sections/Chat.tsx") + code("src/class-social/chat/ConversationList.tsx")), false);
  assert.match(code("src/class-social/sections/Notices.tsx"), /SystemNoticeView/);
  const hooks = code("src/class-social/chat/useChat.ts");
  assert.equal((hooks.match(/markSystemRead\(/g) ?? []).length, 1);
  assert.equal((hooks.match(/\bmarkRead\(/g) ?? []).length, 1, "markRead (DM/Band) chỉ trong useConversation");
});

test("Route cũ /me/chat/system còn sống: Web chuẩn hoá sang /me/notices; Mobile hiển thị cùng màn Thông báo", () => {
  const page = code("src/class-social/ClassSocialPage.tsx");
  assert.match(page, /canonicalView\(viewFromPath\(window\.location\.pathname\)\)/);
  assert.match(page, /replaceState\(window\.history\.state, '', viewPath\(c\)\)/, "Back/Forward vào mục cũ cũng chuẩn hoá");
  const mobile = code("src/class-mobile/MobileShell.tsx");
  assert.match(mobile, /case 'notices':\s*\n\s*case 'chatSystem':/);
  assert.match(code("src/class-mobile/shellBar.ts"), /case 'notices':\s*\n\s*case 'chatSystem':/);
});

test("Web: chuông Thông báo có badge riêng, nhãn truy cập và không cộng vào badge menu", () => {
  const layout = code("src/class-social/ClassSocialLayout.tsx");
  assert.match(layout, /Thông báo, \$\{notices\.count\} chưa đọc/);
  const total = layout.slice(layout.indexOf("const totalBadge"), layout.indexOf("const [collapsed"));
  assert.equal(/notices/.test(total), false, "badge ☰ chỉ cộng các mục menu");
});
