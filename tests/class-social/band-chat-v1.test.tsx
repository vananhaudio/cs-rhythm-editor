/**
 * Band Chat V1 (nhóm chat theo Band trong Trò chuyện): model thuần, route, định tuyến RPC (dm_* vs bandchat_*),
 * "nhóm Band là phần bổ sung — lỗi không làm hỏng chat cá nhân", render danh sách/dòng tin.
 * DB + quyền + đồng thời: scripts/test-band-chat-v1-db.sh.
 */
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BAND_PREFIX, bandIdOf, isBandConversation, layoutMessages, mergeConversationLists, previewText, toBandConversations, toBandMembers, toBandMessages,
  toConversations, type ChatMessage,
} from "../../src/class-social/chat/chatModel";
import ConversationList from "../../src/class-social/chat/ConversationList";
import MessageList from "../../src/class-social/chat/MessageList";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chatConversationPath, keepsPathForGuest, sameView, viewFromPath, viewPath } from "../../src/class-social/resolveMeRoute";
void React;

const BAND = "11111111-0000-4000-8000-0000000000a1";
const PROJECT = "11111111-0000-4000-8000-0000000000b1";
const DM = "0b6f7c1e-5d2a-4c3b-9a8e-1f2d3c4b5a69";
const USER = "aaaaaaaa-0000-4000-8000-00000000000a";
const room = (over: Record<string, unknown> = {}) => ({
  band_id: BAND, band_name: " Band X ", cover_path: null, project_id: PROJECT, project_avatar_path: `${PROJECT}/1700000000-ab12.jpg`,
  last_seq: "4", last_body: "Mai tập 7h", last_sender_name: "An", last_mine: false, last_at: "2026-10-15T03:00:00Z", unread: 2, member_count: 5, can_send: true, archived: false, support: false, ...over,
});

test("toBandConversations: id band:<uuid>, tên Band, ảnh Band → ảnh Team → null, canSend, nhóm chưa có tin vẫn hiện", () => {
  const [a] = toBandConversations([room()] as never);
  assert.deepEqual([a.kind, a.id, a.name, a.lastSeq, a.lastSender, a.unread, a.canSend, a.memberCount, a.isTeacher],
    ["band", BAND_PREFIX + BAND, "Band X", 4, "An", 2, true, 5, false]);
  assert.match(a.avatarUrl ?? "", /teamlab-team-avatars\/.*1700000000-ab12\.jpg$/, "không có bìa Band → dùng ảnh Team");
  const cover = toBandConversations([room({ cover_path: `${PROJECT}/cover-band-${BAND}-x1.jpg` })] as never)[0];
  assert.match(cover.avatarUrl ?? "", /cover-band-/, "có bìa Band → dùng bìa Band");
  const other = toBandConversations([room({ project_id: "22222222-0000-4000-8000-0000000000b9" })] as never)[0];
  assert.equal(other.avatarUrl, null, "khoá ảnh không thuộc đúng Team → không dựng URL");
  const empty = toBandConversations([room({ last_seq: 0, last_body: null, last_sender_name: null, last_at: null, unread: null, member_count: null })] as never)[0];
  assert.deepEqual([empty.lastSeq, empty.lastBody, empty.unread, empty.memberCount], [0, "", 0, 0]);
  assert.equal(toBandConversations([{ band_id: "", band_name: "x" }, { band_id: BAND, band_name: "  " }] as never).length, 0, "bỏ hàng thiếu id/tên");
  assert.equal(isBandConversation(a.id) && !isBandConversation(DM), true);
  assert.equal(bandIdOf(a.id), BAND);
});

test("toBandConversations: lưu trữ / hỗ trợ (Thầy-Admin) → chỉ đọc do SERVER quyết; thiếu can_send = không gửi được", () => {
  const [arch] = toBandConversations([room({ can_send: false, archived: true })] as never);
  assert.deepEqual([arch.canSend, arch.readOnly], [false, "archived"]);
  const [sup] = toBandConversations([room({ can_send: false, support: true, unread: 0 })] as never);
  assert.deepEqual([sup.canSend, sup.readOnly, sup.unread], [false, "support", 0]);
  const [unk] = toBandConversations([room({ can_send: undefined })] as never);
  assert.equal(unk.canSend, false, "không biết = KHÔNG gửi được");
  assert.equal(toBandConversations([room()] as never)[0].readOnly, null);
});

test("previewText nhóm Band: 'Bạn: …' / 'Tên: …' / lời mời chào khi chưa có tin", () => {
  const base = { kind: "band" as const, lastBody: "Mai tập 7h", lastMine: false, lastSender: "An" };
  assert.equal(previewText(base), "An: Mai tập 7h");
  assert.equal(previewText({ ...base, lastMine: true }), "Bạn: Mai tập 7h");
  assert.match(previewText({ ...base, lastBody: "" }), /Chưa có tin nhắn/);
  assert.equal(previewText({ lastBody: "Chào", lastMine: false }), "Chào", "hội thoại cá nhân không đổi");
});

test("mergeConversationLists: tin mới nhất trước, nhóm chưa có tin cuối theo tên, ổn định", () => {
  const dm = toConversations([{ conversation_id: DM, peer_id: USER, peer_name: "Bình", last_seq: 3, last_body: "hi", last_at: "2026-10-15T05:00:00Z", can_send: true, unread: 0 }] as never);
  const bands = toBandConversations([
    room({ band_id: "11111111-0000-4000-8000-0000000000a2", band_name: "Zeta", last_seq: 0, last_at: null }),
    room({ band_id: "11111111-0000-4000-8000-0000000000a3", band_name: "Alpha", last_seq: 0, last_at: null }),
    room(),
  ] as never);
  assert.deepEqual(mergeConversationLists(dm, bands).map(c => c.name), ["Bình", "Band X", "Alpha", "Zeta"]);
});

test("toBandMessages: có người gửi (tên/ảnh an toàn), sắp tăng dần; toBandMembers", () => {
  const rows = toBandMessages([
    { seq: "2", sender_id: USER, sender_name: "  ", sender_avatar_url: "javascript:x", mine: false, body: "b", created_at: "t" },
    { seq: 1, sender_id: USER, sender_name: "An", sender_avatar_url: "https://x.test/a.jpg", mine: true, body: "a", created_at: "t" },
  ] as never);
  assert.deepEqual(rows.map(m => m.seq), [1, 2]);
  assert.deepEqual([rows[0].sender?.name, rows[0].sender?.avatarUrl, rows[1].sender?.name, rows[1].sender?.avatarUrl],
    ["An", "https://x.test/a.jpg", "Thành viên Band", null]);
  assert.deepEqual(toBandMembers([{ user_id: USER, name: "An", avatar_url: null, role: "teacher" }, { user_id: "" }] as never), [{ id: USER, name: "An", avatarUrl: null, isTeacher: true }]);
});

test("layoutMessages: cụm liền nhau theo NGƯỜI GỬI (hai người khác nhau không gộp cụm)", () => {
  const at = "2026-10-15T03:00:00Z";
  const m = (seq: number, id: string, mine = false): ChatMessage => ({ seq, mine, body: "x", at, sender: { id, name: id, avatarUrl: null } });
  const rows = layoutMessages([m(1, "A"), m(2, "A"), m(3, "B"), m(4, "A"), m(5, "me", true)], new Date(at));
  assert.deepEqual(rows.map(r => r.cont), [false, true, false, false, false]);
});

test("Route: /me/chat/b/<band> ↔ id band:<band>; round-trip; id sai không nhận; khách không giữ link", () => {
  const id = BAND_PREFIX + BAND;
  assert.equal(chatConversationPath(id), `/me/chat/b/${BAND}`);
  assert.deepEqual(viewFromPath(`/me/chat/b/${BAND}`), { kind: "chatConversation", conversationId: id });
  assert.deepEqual(viewFromPath(`/me/chat/b/${BAND.toUpperCase()}/`), { kind: "chatConversation", conversationId: id });
  const v = viewFromPath(`/me/chat/b/${BAND}`);
  assert.equal(viewPath(v), `/me/chat/b/${BAND}`);
  assert.equal(sameView(v, v), true);
  assert.equal(keepsPathForGuest(v), false);
  assert.deepEqual(viewFromPath("/me/chat/b/khong-phai-uuid"), { kind: "section", section: "home" });
  assert.deepEqual(viewFromPath(`/me/chat/${DM}`), { kind: "chatConversation", conversationId: DM }, "hội thoại cá nhân không đổi");
});

// ── Định tuyến RPC: bundle chatApi với client supabase GIẢ (import.meta.env chỉ có dưới Vite) ──
type Call = { fn: string; args: Record<string, unknown> };
type Handler = (fn: string, args: Record<string, unknown>) => { data?: unknown; error?: { code?: string; message: string } };
type Api = typeof import("../../src/class-social/chat/chatApi");
let handler: Handler = () => ({ data: [] });
const calls: Call[] = [];
(globalThis as unknown as { __bandChatRpc: unknown }).__bandChatRpc = async (fn: string, args: Record<string, unknown> = {}) => {
  calls.push({ fn, args });
  const r = handler(fn, args);
  return { data: r.data ?? null, error: r.error ?? null, status: r.error ? 400 : 200 };
};
async function loadApi(): Promise<Api> {
  const dir = mkdtempSync(join(tmpdir(), "bandchat-api-"));
  const stub = join(dir, "supabase-stub.mjs");
  writeFileSync(stub, "export const supabase = { rpc: (...a) => globalThis.__bandChatRpc(...a) }\n");
  const out = join(dir, "chatApi.mjs");
  const r = await build({
    entryPoints: [fileURLToPath(new URL("../../src/class-social/chat/chatApi.ts", import.meta.url))],
    bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent",
    define: { "import.meta.env.DEV": "false" },
    plugins: [{ name: "stub-supabase", setup(b) { b.onResolve({ filter: /\/supabase$/ }, () => ({ path: stub })); } }],
  });
  writeFileSync(out, r.outputFiles[0].text);
  return await import(pathToFileURL(out).href) as Api;
}
function use(h: Handler) { handler = h; calls.length = 0; }

test("API: id band:<uuid> đi qua bandchat_*; id cá nhân đi qua dm_* (không lẫn)", async () => {
  const { fetchMessages, sendMessage, markRead } = await loadApi();
  use(() => ({ data: [] }));
  await fetchMessages(BAND_PREFIX + BAND, { afterSeq: 3, limit: 100 });
  await sendMessage(BAND_PREFIX + BAND, "chào");
  await markRead(BAND_PREFIX + BAND, 5);
  await fetchMessages(DM);
  await sendMessage(DM, "hi");
  await markRead(DM, 2);
  assert.deepEqual(calls.map(c => c.fn), ["bandchat_messages", "bandchat_send", "bandchat_mark_read", "dm_messages", "dm_send", "dm_mark_read"]);
  assert.deepEqual(calls[0].args, { p_band: BAND, p_after_seq: 3, p_before_seq: null, p_limit: 100 });
  assert.deepEqual(calls[1].args, { p_band: BAND, p_body: "chào" });
  assert.deepEqual(calls[3].args, { p_conversation: DM, p_after_seq: null, p_before_seq: null, p_limit: 30 });
});

test("API: danh sách = cá nhân + nhóm Band; bandchat_* lỗi/chưa có → chat cá nhân vẫn hiện; dm lỗi → báo lỗi; badge cộng cả hai", async () => {
  const { fetchConversations, fetchUnreadCount } = await loadApi();
  const dmRow = { conversation_id: DM, peer_id: USER, peer_name: "Bình", last_seq: 1, last_body: "hi", last_at: "2026-10-15T01:00:00Z", can_send: true, unread: 1 };

  use(fn => fn === "dm_conversations" ? { data: [dmRow] } : fn === "bandchat_rooms" ? { data: [room()] } : { data: 0 });
  let r = await fetchConversations();
  assert.ok(r.ok && r.value.map(c => c.kind).sort().join() === "band,dm");

  use(fn => fn === "dm_conversations" ? { data: [dmRow] } : { error: { code: "PGRST202", message: "Could not find the function public.bandchat_rooms" } });
  r = await fetchConversations();
  assert.ok(r.ok && r.value.length === 1 && r.value[0].kind === "dm", "chưa migrate Band Chat → chat cá nhân không bị ảnh hưởng");

  use(fn => fn === "dm_unread_count" ? { data: 2 } : { error: { message: "x" } });
  let u = await fetchUnreadCount();
  assert.ok(u.ok && u.value === 2, "bandchat_unread_count lỗi → vẫn đếm cá nhân");

  use(fn => fn === "dm_unread_count" ? { data: 2 } : fn === "bandchat_unread_count" ? { data: 3 } : { data: [] });
  u = await fetchUnreadCount();
  assert.ok(u.ok && u.value === 5, "badge = hội thoại cá nhân + nhóm Band chưa đọc");

  use(fn => fn === "dm_conversations" ? { error: { code: "XX000", message: "boom" } } : { data: [room()] });
  r = await fetchConversations();
  assert.equal(r.ok, false, "lỗi phần cá nhân vẫn là lỗi (không giả danh sách)");
});

test("API: người đã rời Band → P0002 → 'Không tìm thấy cuộc trò chuyện.'; gửi thất bại không báo thành công", async () => {
  const { sendMessage } = await loadApi();
  use(() => ({ error: { code: "P0002", message: "Không tìm thấy cuộc trò chuyện" } }));
  const r = await sendMessage(BAND_PREFIX + BAND, "x");
  assert.ok(!r.ok && r.message === "Không tìm thấy cuộc trò chuyện.");
});

// ── Render ──────────────────────────────────────────────────────────────────
test("ConversationList: hàng nhóm Band có nhãn 'Band', tin cuối kèm tên người gửi, badge chưa đọc; chat cá nhân không có nhãn", () => {
  const items = [...toBandConversations([room()] as never),
    ...toConversations([{ conversation_id: DM, peer_id: USER, peer_name: "Bình", last_seq: 1, last_body: "hi", last_at: "2026-10-15T01:00:00Z", can_send: true, unread: 0 }] as never)];
  const html = renderToStaticMarkup(<ConversationList state={{ status: "ready", items }} selectedId={null} onSelect={() => {}} onRetry={() => {}} onOpenFriends={() => {}} />);
  assert.match(html, /cs-chat-item-tag[^>]*>.*Band</);
  assert.match(html, /An: Mai tập 7h/);
  assert.match(html, /aria-label="Nhóm Band Band X, 2 tin chưa đọc"/);
  assert.equal((html.match(/cs-chat-item-tag/g) ?? []).length, 1, "chỉ nhóm Band có nhãn");
  assert.match(html, />2</, "badge 2");
});

test("MessageList: tin người khác trong nhóm có tên + ảnh người gửi; tin của mình không; cụm cùng người chỉ hiện tên một lần", () => {
  const at = "2026-10-15T03:00:00Z";
  const s = (id: string, name: string) => ({ id, name, avatarUrl: null });
  const messages: ChatMessage[] = [
    { seq: 1, mine: false, body: "một", at, sender: s("u1", "An") },
    { seq: 2, mine: false, body: "hai", at, sender: s("u1", "An") },
    { seq: 3, mine: false, body: "ba", at, sender: s("u2", "Bình") },
    { seq: 4, mine: true, body: "tôi", at, sender: s("me", "Tôi") },
  ];
  const html = renderToStaticMarkup(<MessageList messages={messages} pending={[]} hasMore={false} loadingOlder={false} onLoadOlder={() => {}} onRetry={() => {}} onDiscard={() => {}} />);
  assert.equal((html.match(/cs-msg-sender/g) ?? []).length, 2, "An (một lần) + Bình");
  assert.match(html, /cs-msg-sender">An</);
  assert.match(html, /cs-msg-sender">Bình</);
  assert.doesNotMatch(html, /cs-msg-sender">Tôi</, "tin của mình không hiện tên");
});

test("ConversationList + ConversationView: nhóm hỗ trợ có mục riêng 'chỉ xem'; nhóm lưu trữ có nhãn; ghi chú quyền Thầy/Admin ở thành viên", () => {
  const items = toBandConversations([
    room(),
    room({ band_id: "11111111-0000-4000-8000-0000000000a2", band_name: "Band Y", can_send: false, support: true, unread: 0 }),
    room({ band_id: "11111111-0000-4000-8000-0000000000a3", band_name: "Band Z", can_send: false, archived: true }),
  ] as never);
  const html = renderToStaticMarkup(<ConversationList state={{ status: "ready", items }} selectedId={null} onSelect={() => {}} onRetry={() => {}} onOpenFriends={() => {}} />);
  assert.match(html, /Hỗ trợ · nhóm Band bạn không thuộc \(chỉ xem\)/);
  assert.match(html, /Band · xem/);
  assert.match(html, /Band · lưu trữ/);
  const src = readFileSync(new URL("../../src/class-social/chat/ConversationView.tsx", import.meta.url), "utf8");
  assert.match(src, /Thầy\/Admin có thể xem nhóm Band để hỗ trợ và quản lý/);
  assert.match(src, /chỉ đọc, không gửi tin vào nhóm/);
});
