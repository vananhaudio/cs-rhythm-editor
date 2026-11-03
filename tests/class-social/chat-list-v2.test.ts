/**
 * Chat List V2: model thuần (gấp dấu, ánh xạ hàng RPC, con trỏ, ghép trang, lọc legacy, trạng thái trống, lỗi ghim).
 * DB (quyền, rò rỉ, con trỏ, ghim): scripts/test-chat-list-v2-db.sh · giao diện: tests/chat-list-v2/e2e-preview.mjs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  INBOX_PAGE, MAX_PINS, byRecency, cursorOf, emptyReason, filterLocal, foldVi, mergePages, normalizeQuery, summarizeLocal, toInboxItems, toInboxSummary, totalOf,
  type InboxRow,
} from "../../src/class-social/chat/inboxModel";
import { chatErrorText } from "../../src/class-social/chat/chatModel";

const row = (o: Partial<InboxRow> = {}): InboxRow => ({
  conv_key: "88888888-0000-4000-8000-000000000001", kind: "dm", peer_id: "99999999-0000-4000-8000-000000000001", name: " Lê Chi ", avatar_url: null, cover_path: null,
  project_id: null, project_avatar_path: null, peer_role: "student", last_seq: "4", last_body: "ok", last_sender_name: null, last_mine: false,
  last_at: "2026-11-02T03:00:00Z", sort_at: "2026-11-02T03:00:00Z", unread: 2, member_count: 2, can_send: true, archived: false, support: false, pinned: false, ...o,
});
const band = (o: Partial<InboxRow> = {}) => row({ conv_key: "band:77777777-0000-4000-8000-000000000001", kind: "band", peer_id: null, name: "Band X", project_id: "11111111-0000-4000-8000-0000000000b1", member_count: 5, last_sender_name: "An", ...o });

test("foldVi: bỏ dấu tiếng Việt, hoa/thường, đ → d (khớp SQL chat_fold)", () => {
  assert.equal(foldVi("Nguyễn Văn Đạt"), "nguyen van dat");
  assert.equal(foldVi("BÌNH – Hương"), "binh – huong");
  assert.equal(foldVi("Nhịp & Phách"), "nhip & phach");
  assert.equal(foldVi("Bình".normalize("NFD")), "binh", "chuỗi tổ hợp NFD vẫn khớp");
});

test("normalizeQuery: cắt khoảng trắng, NFC, tối đa 80 ký tự", () => {
  assert.equal(normalizeQuery("  binh  "), "binh");
  assert.equal(normalizeQuery("x".repeat(200)).length, 80);
});

test("toInboxItems: DM + Band dùng đúng bộ ánh xạ cũ; giữ thứ tự server; pinned/sortAt", () => {
  const items = toInboxItems([row({ pinned: true }), band({ unread: 0, support: true, can_send: false }), row({ conv_key: "", kind: "dm" }), row({ kind: "lạ" })]);
  assert.equal(items.length, 2, "bỏ hàng thiếu khoá / loại lạ");
  const [dm, bd] = items;
  assert.deepEqual([dm.id, dm.kind, dm.name, dm.unread, dm.canSend, dm.pinned, dm.isTeacher], ["88888888-0000-4000-8000-000000000001", "dm", "Lê Chi", 2, true, true, false]);
  assert.deepEqual([bd.id, bd.kind, bd.readOnly, bd.canSend, bd.memberCount, bd.pinned], ["band:77777777-0000-4000-8000-000000000001", "band", "support", false, 5, false]);
  assert.equal(dm.sortAt, "2026-11-02T03:00:00Z");
});

test("con trỏ + ghép trang: khử trùng theo id, thứ tự server, trang mới thắng", () => {
  const mk = (n: number, at: string, extra: Partial<InboxRow> = {}) => toInboxItems([row({ conv_key: `88888888-0000-4000-8000-${String(n).padStart(12, "0")}`, sort_at: at, last_at: at, ...extra })])[0];
  const a = mk(1, "2026-11-02T05:00:00Z"), b = mk(2, "2026-11-02T04:00:00Z"), c = mk(3, "2026-11-02T04:00:00Z");
  assert.deepEqual(cursorOf([a, b]), { at: "2026-11-02T04:00:00Z", key: b.id });
  assert.equal(cursorOf([]), null);
  const merged = mergePages([a, c], [b, { ...c, unread: 9 }]);
  assert.deepEqual(merged.map(x => x.id), [a.id, b.id, c.id], "mới → cũ; cùng giờ: khoá tăng dần");
  assert.equal(merged[2].unread, 9, "bản mới thắng");
  assert.equal(mergePages([a], []).length, 1);
  assert.ok([c, a, b].sort(byRecency)[0].id === a.id);
});

test("filterLocal (legacy): loại · chưa đọc · tìm không dấu", () => {
  const items = toInboxItems([row({ name: "Bình", unread: 0 }), row({ conv_key: "88888888-0000-4000-8000-000000000002", name: "Chi", unread: 3 }), band({ name: "Band Nắng", unread: 1 })]);
  const f = (o: Partial<{ kind: "all" | "dm" | "class" | "band"; unreadOnly: boolean; query: string }>) => filterLocal(items, { kind: "all", unreadOnly: false, query: "", ...o }).map(c => c.name);
  assert.deepEqual(f({ kind: "dm" }), ["Bình", "Chi"]);
  assert.deepEqual(f({ kind: "band" }), ["Band Nắng"]);
  assert.deepEqual(f({ kind: "class" }), []);
  assert.deepEqual(f({ unreadOnly: true }), ["Chi", "Band Nắng"]);
  assert.deepEqual(f({ query: "BINH" }), ["Bình"]);
  assert.deepEqual(f({ query: "nang" }), ["Band Nắng"]);
  assert.deepEqual(f({ query: "  " }).length, 3);
});

test("summary: ánh xạ server + tính cục bộ (legacy) + totalOf", () => {
  const s = toInboxSummary({ dm_total: 5, band_total: 2, class_total: 0, unread_dm: 3, unread_band: 1, unread_class: 0, pinned_total: 2, support_total: 40 });
  assert.deepEqual(s, { dm: 5, band: 2, class: 0, unreadDm: 3, unreadBand: 1, unreadClass: 0, pinned: 2, support: 40 });
  assert.equal(totalOf(s, "all"), 7); assert.equal(totalOf(s, "band"), 2); assert.equal(totalOf(s, "class"), 0);
  assert.deepEqual(toInboxSummary(null), { dm: 0, band: 0, class: 0, unreadDm: 0, unreadBand: 0, unreadClass: 0, pinned: 0, support: 0 });
  const l = summarizeLocal(toInboxItems([row({ unread: 0 }), band({ unread: 2 })]), 7);
  assert.deepEqual([l.dm, l.band, l.unreadBand, l.support], [1, 1, 1, 7]);
});

test("emptyReason: trạng thái trống đúng từng trường hợp", () => {
  const f = (o = {}) => ({ kind: "all" as const, unreadOnly: false, query: "", ...o });
  const some = toInboxSummary({ dm_total: 1, band_total: 0, class_total: 0, unread_dm: 0, unread_band: 0, unread_class: 0, pinned_total: 0, support_total: 0 });
  assert.equal(emptyReason(f({ query: "x" }), some), "search");
  assert.equal(emptyReason(f({ unreadOnly: true }), some), "unread");
  assert.equal(emptyReason(f({ kind: "dm" }), some), "kind-dm");
  assert.equal(emptyReason(f({ kind: "band" }), some), "kind-band");
  assert.equal(emptyReason(f({ kind: "class" }), some), "kind-class");
  assert.equal(emptyReason(f(), toInboxSummary(null)), "all");
  assert.equal(emptyReason(f(), some), "none");
});

test("hằng số khớp server + lỗi ghim riêng", () => {
  assert.equal(INBOX_PAGE, 30); assert.equal(MAX_PINS, 10);
  assert.match(chatErrorText({ code: "54000" }, false, "pin"), /tối đa 10/);
  assert.match(chatErrorText({ code: "54000" }, false), /quá nhanh/, "ngữ cảnh gửi tin giữ nguyên");
});
