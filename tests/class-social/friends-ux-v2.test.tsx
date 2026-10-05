/**
 * Friends UX V2: nút quan hệ một-trạng-thái-một-nút (Facebook), câu báo sau hành động, xác nhận trước Huỷ kết bạn,
 * trang Bạn bè 3 mục, migration additive. Hành vi đầy đủ end-to-end: scripts/e2e-friends-v2.sh; DB: scripts/test-friends-ux-v2-db.sh.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  actionNotice, needsConfirm, patchList, relationshipUi, toPeople, unfriendConfirm, withPerson, without,
  type FriendAction, type PeopleList, type Relationship,
} from "../../src/class-social/friends/friendModel";
import RelationshipButton from "../../src/class-social/sections/RelationshipButton";
import { ConfirmDialog } from "../../src/class-social/ui";
void React;

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const code = (f: string) => read(f).replace(/\/\/.*$/gm, "");
const A = "0b6f7c1e-5d2a-4c3b-9a8e-1f2d3c4b5a69";
const card = (userId: string, name: string) => ({ userId, name, avatarUrl: null, isTeacher: false, at: null });

// ── Trang cá nhân: mỗi trạng thái đúng MỘT nút ───────────────────────────────
test("NONE → [Kết bạn] làm ngay; OUTGOING/INCOMING/FRIENDS → một nút mở menu", () => {
  const none = relationshipUi("none")!;
  assert.deepEqual([none.label, none.tone, none.direct, none.menu.length], ["Kết bạn", "primary", "send", 0]);
  const out = relationshipUi("outgoing")!;
  assert.deepEqual([out.label, out.direct], ["Đã gửi lời mời", null]);
  assert.deepEqual(out.menu.map(m => [m.id, m.label]), [["cancel", "Huỷ lời mời"]]);
  const inc = relationshipUi("incoming")!;
  assert.deepEqual([inc.label, inc.direct], ["Phản hồi lời mời", null]);
  assert.deepEqual(inc.menu.map(m => [m.id, m.label]), [["accept", "Xác nhận"], ["decline", "Xóa lời mời"]]);
  const fr = relationshipUi("friends")!;
  assert.deepEqual([fr.label, fr.direct], ["Bạn bè", null]);
  assert.deepEqual(fr.menu.map(m => [m.id, m.label, m.danger]), [["unfriend", "Huỷ kết bạn", true]]);
  assert.equal(relationshipUi("self"), null);
});

test("Render nút: 4 trạng thái → 4 nhãn khác nhau, mỗi lần đúng một nút chính; self không có nút", () => {
  const html = (rel: Relationship) => renderToStaticMarkup(<RelationshipButton relationship={rel} name="Bình" busy={false} onAct={() => {}} />);
  const labels: Record<string, RegExp> = { none: />Kết bạn</, outgoing: />Đã gửi lời mời</, incoming: />Phản hồi lời mời</, friends: />Bạn bè</ };
  for (const [rel, re] of Object.entries(labels)) {
    const h = html(rel as Relationship);
    assert.match(h, re, rel);
    assert.equal((h.match(/<button/g) ?? []).length, 1, `${rel}: một nút (menu đóng)`);
    for (const [other, re2] of Object.entries(labels)) if (other !== rel) assert.doesNotMatch(h, re2, `${rel} không lẫn nhãn ${other}`);
  }
  assert.match(html("friends"), /aria-haspopup="menu" aria-expanded="false"/);
  assert.doesNotMatch(html("none"), /aria-haspopup/);
  assert.equal(html("self"), "");
  const busy = renderToStaticMarkup(<RelationshipButton relationship="none" name="Bình" busy onAct={() => {}} />);
  assert.match(busy, /disabled=""/);
  assert.match(busy, /Đang gửi…/);
});

// ── Câu báo theo KẾT QUẢ DB ───────────────────────────────────────────────────
test("Sau Kết bạn: 'Đã gửi lời mời — chờ người kia chấp nhận.'; các hành động khác có câu riêng", () => {
  assert.equal(actionNotice("send", "outgoing", "Bình"), "Đã gửi lời mời — chờ người kia chấp nhận.");
  assert.equal(actionNotice("send", "friends", "Bình"), "Bạn và Bình đã là bạn bè.");   // họ đã mời mình trước
  assert.equal(actionNotice("accept", "friends", "Bình"), "Bạn và Bình đã là bạn bè.");
  assert.equal(actionNotice("decline", "none", "Bình"), "Đã xoá lời mời.");
  assert.equal(actionNotice("cancel", "none", "Bình"), "Đã huỷ lời mời.");
  assert.equal(actionNotice("unfriend", "none", "Bình"), "Đã huỷ kết bạn với Bình.");
  // DB trả trạng thái khác điều người dùng mong → không báo thành công sai
  assert.equal(actionNotice("cancel", "friends", "Bình"), "");
  assert.equal(actionNotice("unfriend", "incoming", "Bình"), "");
});

// ── Huỷ kết bạn: bắt buộc xác nhận ───────────────────────────────────────────
test("Chỉ Huỷ kết bạn cần xác nhận; hộp thoại '[Huỷ] [Huỷ kết bạn]'", () => {
  const all: FriendAction[] = ["send", "cancel", "accept", "decline", "unfriend"];
  assert.deepEqual(all.filter(needsConfirm), ["unfriend"]);
  const c = unfriendConfirm("Bình");
  assert.equal(c.title, "Huỷ kết bạn với Bình?");
  assert.deepEqual([c.cancel, c.confirm], ["Huỷ", "Huỷ kết bạn"]);
  const h = renderToStaticMarkup(<ConfirmDialog title={c.title} confirmLabel={c.confirm} cancelLabel={c.cancel} danger
    onConfirm={() => {}} onCancel={() => {}}>{c.body}</ConfirmDialog>);
  assert.match(h, /role="alertdialog" aria-modal="true"/);
  assert.match(h, /Huỷ kết bạn với Bình\?/);
  assert.match(h, />Huỷ<\/button><button type="button" class="cs-btn cs-btn-danger"[^>]*>Huỷ kết bạn<\/button>/);
});

test("Nguồn: RPC unfriend chỉ chạy từ nút xác nhận (trang cá nhân + trang Bạn bè)", () => {
  const prof = code("src/class-social/sections/ProfilePage.tsx");
  assert.match(prof, /if \(needsConfirm\(action\)\) setConfirming\(true\); else void run\(action\)/);
  assert.equal((prof.match(/run\('unfriend'\)/g) ?? []).length, 1);
  assert.match(prof, /<ConfirmDialog[^]*?onConfirm=\{\(\) => void run\('unfriend'\)\}/);
  const fr = code("src/class-social/sections/Friends.tsx");
  assert.equal((fr.match(/void unfriend\(/g) ?? []).length, 1);
  assert.match(fr, /onConfirm=\{\(\) => void unfriend\(confirming\)\}/);
  assert.match(fr, /onSelect: \(\) => \{ if \(!anyBusy\) setConfirming\(p\) \}/);
});

// ── Trang Bạn bè ──────────────────────────────────────────────────────────────
test("Trang Bạn bè: 3 mục từ 3 RPC; lời mời đã gửi có Huỷ lời mời; danh sách sửa ngay sau khi server xác nhận", () => {
  const fr = code("src/class-social/sections/Friends.tsx");
  for (const t of ["Lời mời kết bạn", "Lời mời đã gửi", "Tất cả bạn bè", "Huỷ lời mời", "Đã gửi lời mời"]) assert.ok(fr.includes(t), t);
  assert.match(fr, /if \(r\.ok\) \{ patchOutgoing\(without\(p\.userId\)\)/);
  assert.match(fr, /if \(r\.ok\) \{ patchFriends\(without\(p\.userId\)\)/);
  assert.match(fr, /if \(person\) patchFriends\(withPerson/);
  const hook = code("src/class-social/friends/useFriendLists.ts");
  assert.match(hook, /fetchFriends\(\)/);
  assert.match(hook, /fetchOutgoingRequests\(\)/);
  assert.match(code("src/class-social/friends/friendsApi.ts"), /rpc<RequestRow\[\]>\('outgoing_friend_requests', \{\}, 'load'\)/);
});

test("patch danh sách: thêm theo tên (không trùng), bỏ theo id; đang tải/lỗi thì giữ nguyên", () => {
  const ready: PeopleList = { status: "ready", items: [card("b", "Bình"), card("d", "Dũng")] };
  const added = patchList(ready, withPerson(card("c", "Chi")));
  assert.deepEqual(added.status === "ready" && added.items.map(x => x.name), ["Bình", "Chi", "Dũng"]);
  const again = patchList(added, withPerson(card("c", "Chi")));
  assert.equal(again.status === "ready" && again.items.length, 3);
  const removed = patchList(added, without("b"));
  assert.deepEqual(removed.status === "ready" && removed.items.map(x => x.userId), ["c", "d"]);
  const loading: PeopleList = { status: "loading" };
  assert.equal(patchList(loading, without("b")), loading);
});

test("toPeople giữ thời điểm lời mời (requested_at) / thành bạn (since)", () => {
  const [p] = toPeople([{ user_id: A, name: "An", avatar_url: null, role: "student", requested_at: "2026-10-04T10:00:00Z" }]);
  assert.equal(p.at, "2026-10-04T10:00:00Z");
  const [q] = toPeople([{ user_id: A, name: "An", avatar_url: null, role: "student", since: "2026-10-03T10:00:00Z" }]);
  assert.equal(q.at, "2026-10-03T10:00:00Z");
});

// ── Migration ─────────────────────────────────────────────────────────────────
test("Migration V2: additive, không begin/commit, hàm mới REVOKE public/anon, bảng friendships không cấp quyền", () => {
  const sql = read("db/friends_ux_v2_setup.sql").replace(/^\s*--.*$/gm, "");
  assert.equal(/^\s*(begin|commit|rollback)\s*;/im.test(sql), false);
  assert.equal(/\b(drop table|truncate|alter table)\b/i.test(sql), false, "không đổi schema bảng");
  assert.equal(/\binsert into\b|\bupdate public\.friendships set status = 'declined'/i.test(sql), false);
  assert.match(sql, /revoke all on function public\.outgoing_friend_requests\(\) from public, anon;/);
  assert.match(sql, /grant execute on function public\.outgoing_friend_requests\(\) to authenticated;/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /f\.requester_id = auth\.uid\(\)/);
  assert.equal(/grant [^;]* on public\.friendships/i.test(sql), false);
  // cổng dữ liệu: dấu vân tay trước/sau trong cùng transaction
  assert.match(sql, /friends_ux_v2\.fingerprint/);
  assert.match(sql, /DỪNG — dữ liệu friendships đổi trong migration/);
  const rb = read("db/friends_ux_v2_rollback.sql");
  assert.match(rb, /drop function if exists public\.outgoing_friend_requests\(\);/);
  assert.equal(/delete from public\.friendships|drop table/i.test(rb.replace(/^\s*--.*$/gm, "")), false);
});
