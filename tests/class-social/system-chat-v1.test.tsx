/**
 * System Chat V1 (Class 2.0): model thuần, route, hàng "Class 2.0" trong danh sách, và các rào chắn phạm vi
 * ("Chat là cổng điều hướng": không ô nhập, không đường ghi thông báo ở client, không sao chép nhận xét).
 * DB + quyền: scripts/test-class-system-chat-db.sh · UI thật: scripts/e2e-class-system-chat.sh.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  NOTICE_TARGET_SEARCH, SYSTEM_FOOTNOTE, mergeNotices, toSystemNotices, toSystemSummary,
  type SystemNotice,
} from "../../src/class-social/chat/chatModel";
import ConversationList from "../../src/class-social/chat/ConversationList";
import { CHAT_SYSTEM_PATH, NOTICES_PATH, canonicalView, keepsPathForGuest, sameView, viewFromPath, viewPath } from "../../src/class-social/resolveMeRoute";
void React;

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const code = (f: string) => read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const TID = "99999999-0000-4000-8000-000000000001";

test("toSystemNotices: chỉ nhận thông báo hợp lệ (ref thread UUID, có nội dung), sắp tăng dần, seq bigint → number", () => {
  const rows = toSystemNotices([
    { seq: "12", kind: "checkpoint_graded", body: " Bài trả Buổi 02 của bạn đã được chấm. ", ref_type: "thread", ref_key: TID.toUpperCase(), created_at: "2026-10-12T10:00:00Z", unread: true },
    { seq: 7, kind: "checkpoint_graded", body: "Bài trả Buổi 01 của bạn đã được chấm.", ref_type: "thread", ref_key: TID, created_at: "2026-10-11T10:00:00Z", unread: false },
    { seq: 8, kind: "x", body: "đích lạ", ref_type: "post", ref_key: TID, created_at: "", unread: true },
    { seq: 9, kind: "x", body: "đích hỏng", ref_type: "thread", ref_key: "../../admin", created_at: "", unread: true },
    { seq: 10, kind: "x", body: "   ", ref_type: "thread", ref_key: TID, created_at: "", unread: true },
  ]);
  assert.deepEqual(rows.map(r => r.seq), [7, 12]);
  assert.equal(rows[1].body, "Bài trả Buổi 02 của bạn đã được chấm.");
  assert.equal(rows[1].threadId, TID, "threadId chuẩn hoá chữ thường");
  assert.equal(rows[1].unread, true);
  assert.deepEqual(toSystemNotices(null), []);
});

test("toSystemSummary: rỗng → 0 chưa đọc; số/bigint → number", () => {
  assert.deepEqual(toSystemSummary([{ last_seq: null, last_body: null, last_at: null, unread: null }]), { lastSeq: 0, lastBody: "", lastAt: "", unread: 0 });
  assert.deepEqual(toSystemSummary([{ last_seq: "5", last_body: "x", last_at: "2026-10-12T00:00:00Z", unread: 3 }]), { lastSeq: 5, lastBody: "x", lastAt: "2026-10-12T00:00:00Z", unread: 3 });
  assert.equal(toSystemSummary([]).unread, 0);
});

test("mergeNotices: khử trùng theo seq, tăng dần, giữ cờ chưa đọc của lần tải đầu", () => {
  const a: SystemNotice = { seq: 1, kind: "checkpoint_graded", body: "a", threadId: TID, at: "", unread: true };
  const b: SystemNotice = { seq: 2, kind: "checkpoint_graded", body: "b", threadId: TID, at: "", unread: false };
  const m = mergeNotices([a], [{ ...a, unread: false }, b]);
  assert.deepEqual(m.map(n => n.seq), [1, 2]);
  assert.equal(m[0].unread, true, "đã đọc ở server nhưng màn đang mở vẫn thấy chấm chưa đọc tới lần mở sau");
  assert.deepEqual(mergeNotices([a], []), [a]);
});

test("Route: /me/chat/system là màn riêng; không nhầm với UUID hội thoại; vòng tròn viewPath", () => {
  assert.equal(CHAT_SYSTEM_PATH, "/me/chat/system");
  const v = viewFromPath("/me/chat/system/");
  assert.deepEqual(v, { kind: "chatSystem" });
  assert.equal(viewPath(v), "/me/chat/system");
  assert.equal(sameView(v, { kind: "chatSystem" }), true);
  assert.equal(sameView(v, { kind: "section", section: "chat" }), false);
  assert.deepEqual(viewFromPath("/me/chat"), { kind: "section", section: "chat" });
  assert.deepEqual(canonicalView(v), { kind: "notices" }, "đường cũ chuyển sang màn Thông báo riêng, không route chết");
  assert.deepEqual(viewFromPath("/me/notices"), { kind: "notices" });
  assert.equal(viewPath({ kind: "notices" }), NOTICES_PATH);
  assert.equal(NOTICES_PATH, "/me/notices");
  assert.equal(sameView({ kind: "notices" }, { kind: "chatSystem" }), false);
  assert.deepEqual(canonicalView({ kind: "section", section: "chat" }), { kind: "section", section: "chat" }, "route khác không đổi");
  assert.equal(keepsPathForGuest(v), false, "khách không giữ link kênh thông báo (đích bài trả thì có: kind thread)");
  assert.equal(keepsPathForGuest({ kind: "thread", threadId: TID }), true);
});

const noop = () => {};
const items = [{ id: "c1", peerId: "p1", name: "Bạn A", avatarUrl: null, isTeacher: false, lastSeq: 1, lastBody: "chào", lastMine: false, lastAt: "2026-10-12T00:00:00Z", unread: 2, canSend: true }];

test("Danh sách Trò chuyện CHỈ có hội thoại thật — không còn hàng Class 2.0 / thông báo hệ thống", () => {
  const html = renderToStaticMarkup(
    <ConversationList state={{ status: "ready", items }} selectedId={null} onSelect={noop} onRetry={noop} onOpenFriends={noop} />,
  );
  assert.match(html, /Bạn A/, "hội thoại cá nhân vẫn còn");
  assert.doesNotMatch(html, /Class 2\.0|cs-chat-item-system|thông báo chính thức/);
  const empty = renderToStaticMarkup(
    <ConversationList state={{ status: "ready", items: [] }} selectedId={null} onSelect={noop} onRetry={noop} onOpenFriends={noop} />);
  assert.doesNotMatch(empty, /Class 2\.0|Chưa có thông báo/);
  const list = code("src/class-social/chat/ConversationList.tsx");
  assert.equal(/SystemSummary|SystemItem|onSelectSystem|BellRing/.test(list), false, "mã danh sách không còn nhánh thông báo");
});

test("Rào chắn phạm vi: màn Class 2.0 chỉ đọc — không ô nhập/gửi, không ghi, đích chỉ là thread; API chỉ 3 RPC", () => {
  const view = code("src/class-social/chat/SystemNoticeView.tsx");
  assert.equal(/<textarea|<input|Composer|sendMessage|onSend|contentEditable/i.test(view), false, "không có ô nhập");
  assert.match(view, /SYSTEM_FOOTNOTE/);
  assert.match(SYSTEM_FOOTNOTE, /thông báo chính thức từ Class 2\.0/);
  assert.match(code("src/class-social/chat/chatModel.ts"), /Xem kết quả/, "nhãn V1 giữ nguyên (nay nằm ở noticeAction)");
  const api = code("src/class-social/chat/chatApi.ts");
  for (const rpc of ["class_system_notice_summary", "class_system_notices", "class_system_notice_mark_read"]) assert.match(api, new RegExp(`['"]${rpc}['"]`));
  assert.equal(/\.from\(\s*['"`]class_system_/.test(api + code("src/class-social/chat/useChat.ts")), false, "không đọc/ghi thẳng bảng thông báo");
  assert.equal(/class_system_notices?['"`]\s*\)\s*\.(insert|update|delete|upsert)/.test(api), false);
  // Mở danh sách KHÔNG tự đánh dấu đã đọc: markSystemRead chỉ nằm trong hook của MÀN Class 2.0
  const hooks = code("src/class-social/chat/useChat.ts");
  assert.equal((hooks.match(/markSystemRead\(/g) ?? []).length, 1);
  assert.match(hooks.slice(hooks.indexOf("export function useSystemNotices")), /markSystemRead\(seq\)/);
  assert.equal(/markSystemRead|markRead/.test(code("src/class-social/chat/ConversationList.tsx")), false);
  assert.equal(NOTICE_TARGET_SEARCH, "?focus=ket-qua");
});
