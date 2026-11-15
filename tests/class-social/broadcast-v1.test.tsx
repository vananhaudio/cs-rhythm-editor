/**
 * Broadcast V1: mô hình (đếm/nhãn/kiểm đầu vào), render trang Owner, hiển thị thông báo broadcast, định tuyến /me/broadcast, migration an toàn.
 * DB + worker: scripts/test-broadcast-v1-db.sh.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  broadcastError, confirmLabel, draftProblems, EMPTY_DRAFT, progressPct, reasonList, resultLine, toCampaign, toRpcArgs, toStats, validLink,
  type Campaign, type Draft,
} from "../../src/class-social/broadcast/broadcastModel";
import { Notice } from "../../src/class-social/chat/SystemNoticeItem";
import { isInternalLink, toSystemNotices } from "../../src/class-social/chat/chatModel";
import { BROADCAST_PATH, sameView, viewFromPath, viewPath, keepsPathForGuest } from "../../src/class-social/resolveMeRoute";
import { adminQuickLinks } from "../../src/admin/adminNav";
void React;
const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const D = (o: Partial<Draft>): Draft => ({ ...EMPTY_DRAFT, ...o });

test("Kiểm đầu vào: nội dung, tiêu đề, liên kết nội bộ, chọn lớp/Band", () => {
  assert.deepEqual(draftProblems(D({})), ["Hãy nhập nội dung."]);
  assert.deepEqual(draftProblems(D({ body: "Xin chào" })), []);
  assert.equal(draftProblems(D({ body: "x".repeat(2001) })).length, 1);
  assert.equal(draftProblems(D({ body: "a", title: "t".repeat(81) })).length, 1);
  assert.equal(draftProblems(D({ body: "a", channel: "chat", title: "t".repeat(81) })).length, 0, "Chat không dùng tiêu đề");
  assert.equal(draftProblems(D({ body: "a", audience: "class" })).length, 1);
  assert.equal(draftProblems(D({ body: "a", audience: "class", ref: "id" })).length, 0);
  for (const bad of ["https://evil.example", "//evil.example", "javascript:alert(1)", "/\\evil", "me/friends", "/a b"]) assert.equal(validLink(bad), false, bad);
  for (const good of ["", "/me/friends", "/me/t/abc?focus=ket-qua"]) assert.equal(validLink(good), true, good);
  assert.equal(draftProblems(D({ body: "a", link: "https://x.y" })).length, 1);
});

test("toRpcArgs: ref chỉ khi lớp/Band; Chat bỏ tiêu đề + liên kết", () => {
  assert.deepEqual(toRpcArgs(D({ body: " Xin chào ", title: " T ", link: " /me " })), { p_channel: "notice", p_audience: "all", p_ref: null, p_title: "T", p_body: "Xin chào", p_link: "/me" });
  const c = toRpcArgs(D({ channel: "chat", audience: "class", ref: "c1", body: "b", title: "t", link: "/x" }));
  assert.deepEqual([c.p_ref, c.p_title, c.p_link], ["c1", null, null]);
  assert.equal(toRpcArgs(D({ audience: "students", ref: "stale", body: "b" })).p_ref, null);
});

test("Nút xác nhận mang đúng số người nhận do server báo", () => {
  assert.equal(confirmLabel(850), "Xác nhận gửi tới 850 người");
  assert.match(confirmLabel(1234), /^Xác nhận gửi tới 1\.234 người$|^Xác nhận gửi tới 1,234 người$/);
});

test("Lý do loại trừ + tiến độ + câu kết quả (phân biệt gửi/chờ/lỗi/hủy/đọc)", () => {
  assert.deepEqual(reasonList({ inactive: 2, blocked: 5, zero: 0 }).map(r => [r.key, r.count]), [["blocked", 5], ["inactive", 2]]);
  assert.equal(reasonList({ blocked: 1 })[0].label, "Đã chặn bạn (Trò chuyện)");
  const c = toCampaign({ id: "1", channel: "notice", audience_label: "Tất cả", title: "T", body: "b", status: "sending", created_at: "2026-01-01", eligible_total: 10,
    stats: { sent: 4, failed: 1, pending: 5, skipped: 2, cancelled: 0, read: 3 } }) as Campaign;
  assert.equal(progressPct(c), 50);
  assert.equal(resultLine(c), "4 đã gửi · 5 đang chờ · 1 lỗi · 2 bị loại · 3 đã đọc");
  assert.equal(progressPct({ ...c, eligible: 0 }), 100);
  assert.equal(progressPct({ ...c, stats: { ...c.stats, sent: 99 } }), 100, "không vượt 100%");
  const chat = { ...c, channel: "chat" as const, stats: { ...c.stats, read: null } };
  assert.doesNotMatch(resultLine(chat), /đã đọc/, "Chat không có thống kê đọc ở V1");
  assert.equal(toStats(null).sent, 0);
  assert.equal(toCampaign({ id: "1", channel: "x", audience_label: "", title: null, body: "", status: "lạ", created_at: "", eligible_total: 1, stats: null })!.status, "sending");
  assert.equal(toCampaign(null), null);
});

test("Lỗi: số người nhận đổi → buộc xem lại; lỗi nghiệp vụ giữ câu server; còn lại câu chung", () => {
  const e = broadcastError({ code: "22023", message: "BROADCAST_COUNT_CHANGED: số người nhận hiện là 7 (bạn đã xem 6). Hãy xem lại trước khi gửi." });
  assert.equal(e.countChanged, true);
  assert.match(e.text, /số người nhận hiện là 7/);
  assert.equal(broadcastError({ code: "42501", message: "Chỉ quản trị viên được gửi thông điệp" }).text, "Chỉ quản trị viên được gửi thông điệp");
  assert.equal(broadcastError({ code: "XX000", message: "internal" }).text, "Chưa thực hiện được. Hãy thử lại.");
  assert.match(broadcastError(null, true).text, /Không có mạng/);
});

test("Trang Owner (nguồn): cổng admin, 2 tab, kênh, xem trước, bước xác nhận cuối, không tự gửi", () => {
  const src = read("src/class-social/broadcast/BroadcastPage.tsx");
  assert.match(src, /if \(!isAdmin\)[\s\S]*Chỉ dành cho quản trị viên/, "người không phải admin chỉ thấy thông báo, không có form");
  assert.match(src, /Soạn thông điệp/); assert.match(src, /Lịch sử đã gửi/);
  assert.match(src, /confirmLabel\(preview\.eligible\)/, "nút xác nhận mang số do server báo");
  assert.match(src, /confirmBroadcast\(draft, keyRef\.current, preview\.eligible\)/, "gửi kèm số đã xem để server so khớp");
  assert.match(src, /sentRef\.current/, "chặn bấm lại sau khi đã gửi");
  assert.match(src, /countChanged[\s\S]*Số người nhận đã thay đổi/, "số đổi → bắt xem lại, không tự gửi");
  // confirmBroadcast chỉ được gọi trong hàm send (nút xác nhận) — không ở effect/tự động
  assert.equal((src.match(/confirmBroadcast\(/g) ?? []).length, 1);
  assert.match(src, /Tin đã gửi không thể thu hồi tự động/);
  assert.match(src, /Hủy phần chưa gửi/);
});

test("Thông báo broadcast: parse không cần thread; link chỉ nội bộ; hiển thị tiêu đề + nhiều dòng; thông báo thread cũ không đổi", () => {
  assert.equal(isInternalLink("/me/friends"), true); assert.equal(isInternalLink("//x"), false); assert.equal(isInternalLink("https://x"), false);
  const rows = toSystemNotices([
    { seq: 2, kind: "broadcast", body: "Dòng 1\nDòng 2", ref_type: "broadcast", ref_key: "0b6f7c1e-5d2a-4c3b-9a8e-1f2d3c4b5a69", created_at: "2026-01-01", unread: true, title: "Tiêu đề", link: "/me/friends" },
    { seq: 3, kind: "broadcast", body: "x", ref_type: "broadcast", ref_key: "k", created_at: "", unread: true, title: null, link: "https://evil.example" },
    { seq: 1, kind: "checkpoint_graded", body: "Bài trả Buổi 01 của bạn đã ĐẠT.", ref_type: "thread", ref_key: "0b6f7c1e-5d2a-4c3b-9a8e-1f2d3c4b5a69", created_at: "", unread: false },
    { seq: 4, kind: "checkpoint_graded", body: "hỏng", ref_type: "thread", ref_key: "không-phải-uuid", created_at: "", unread: false },
  ]);
  assert.deepEqual(rows.map(r => r.seq), [1, 2, 3]);
  const b = rows[1];
  assert.deepEqual([b.title, b.link, b.threadId], ["Tiêu đề", "/me/friends", ""]);
  assert.equal(rows[2].link, undefined, "link ngoài bị bỏ");
  const html = renderToStaticMarkup(<Notice n={b} onOpen={() => {}} />);
  assert.match(html, /Tiêu đề/); assert.match(html, /Thông điệp/); assert.match(html, /is-multiline/); assert.match(html, /Mở liên kết/);
  const noLink = renderToStaticMarkup(<Notice n={rows[2]} onOpen={() => {}} />);
  assert.doesNotMatch(noLink, /Mở liên kết/, "không có liên kết thì không hứa 'Mở'");
  assert.match(renderToStaticMarkup(<Notice n={rows[0]} onOpen={() => {}} />), /Xem kết quả/);
});

test("Định tuyến /me/broadcast + lối vào Admin", () => {
  assert.equal(BROADCAST_PATH, "/me/broadcast");
  assert.deepEqual(viewFromPath("/me/broadcast"), { kind: "broadcast" });
  assert.deepEqual(viewFromPath("/me/broadcast/"), { kind: "broadcast" });
  assert.equal(viewPath({ kind: "broadcast" }), "/me/broadcast");
  assert.ok(sameView({ kind: "broadcast" }, { kind: "broadcast" })); assert.ok(!sameView({ kind: "broadcast" }, { kind: "bands" }));
  assert.ok(keepsPathForGuest({ kind: "broadcast" }));
  assert.ok(adminQuickLinks("").some(l => l.href === "/me/broadcast" && l.label === "Gửi thông điệp"));
});

test("Ràng buộc kiến trúc: dùng RPC broadcast_*, không ghi thẳng bảng; mục chỉ hiện cho admin; migration không đụng dm_messages/friendships", () => {
  const api = read("src/class-social/broadcast/broadcastApi.ts");
  assert.match(api, /rpc\('/); assert.doesNotMatch(api, /\.from\(['"]/);
  assert.match(read("src/class-social/ClassSocialPage.tsx"), /onOpenBroadcast=\{me\.isAdmin \? onOpenBroadcast : undefined\}/);
  assert.match(read("src/class-social/ClassSocialPage.tsx"), /<BroadcastPage isAdmin=\{me\.isAdmin === true\}/);
  const sql = read("db/broadcast_v1_setup.sql").replace(/--.*$/gm, "");
  assert.doesNotMatch(sql, /^\s*(begin|commit|rollback)\s*;/im);
  assert.doesNotMatch(sql, /create policy/i);
  assert.doesNotMatch(sql, /(insert into|update|delete from)\s+public\.(dm_messages|friendships)/i);
  assert.match(sql, /revoke all on function public\.broadcast_tick\(int\) from public, anon, authenticated/);
  assert.match(sql, /public\.is_admin\(\)/);
});
