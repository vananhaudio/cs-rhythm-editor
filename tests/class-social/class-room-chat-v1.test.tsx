/**
 * Class Room Chat V1 (phòng chat theo lớp): model thuần, route /me/chat/c/<lớp>, định tuyến RPC (dm_* · bandchat_* · classchat_*),
 * "phòng lớp là phần bổ sung — lỗi không làm hỏng chat cá nhân/Band", render danh sách/tin/thành viên, Hộp thư V2, bộ lọc an toàn.
 * DB + quyền + cách ly + đồng thời: scripts/test-class-room-chat-db.sh.
 */
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { readFileSync, readdirSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BAND_PREFIX, CLASS_PREFIX, buildUnread, classIdOf, inboxUnreadSplit, isBandConversation, isClassConversation, isGroupConversation, mergeConversationLists, previewText,
  toBandConversations, toBandMessages, toClassConversations, toConversations,
} from "../../src/class-social/chat/chatModel";
import { summarizeLocal, toInboxItems } from "../../src/class-social/chat/inboxModel";
import ConversationList from "../../src/class-social/chat/ConversationList";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chatConversationPath, keepsPathForGuest, sameView, viewFromPath, viewPath } from "../../src/class-social/resolveMeRoute";
import { SAFE_READ_REPLACEMENTS } from "../../src/class-safety/model";
void React;

const CLS = "22222222-0000-4000-8000-0000000000c1";
const BAND = "11111111-0000-4000-8000-0000000000a1";
const DM = "0b6f7c1e-5d2a-4c3b-9a8e-1f2d3c4b5a69";
const USER = "aaaaaaaa-0000-4000-8000-00000000000a";
const room = (over: Record<string, unknown> = {}) => ({
  class_id: CLS, class_name: " Lớp K1 ", last_seq: "4", last_body: "Mai học 7h", last_sender_name: "An", last_mine: false,
  last_at: "2026-11-16T03:00:00Z", unread: 2, member_count: 12, can_send: true, archived: false, support: false, ...over,
});
const bandRoom = () => ({ band_id: BAND, band_name: "Band X", cover_path: null, project_id: null, project_avatar_path: null, last_seq: 1, last_body: "x",
  last_sender_name: "B", last_mine: false, last_at: "2026-11-16T02:00:00Z", unread: 1, member_count: 3, can_send: true, archived: false, support: false });

test("toClassConversations: id class:<uuid>, tên lớp, canSend/readOnly do SERVER quyết, phòng chưa có tin vẫn hiện", () => {
  const [a] = toClassConversations([room()] as never);
  assert.deepEqual([a.kind, a.id, a.name, a.lastSeq, a.lastSender, a.unread, a.canSend, a.memberCount, a.isTeacher, a.avatarUrl, a.readOnly],
    ["class", CLASS_PREFIX + CLS, "Lớp K1", 4, "An", 2, true, 12, false, null, null]);
  assert.equal(isClassConversation(a.id) && !isClassConversation(DM) && !isClassConversation(BAND_PREFIX + BAND), true);
  assert.equal(isGroupConversation(a.id) && isGroupConversation(BAND_PREFIX + BAND) && !isGroupConversation(DM), true);
  assert.equal(classIdOf(a.id), CLS);
  assert.equal(isBandConversation(a.id), false, "id lớp không bị nhận nhầm là Band");
  const [arch] = toClassConversations([room({ can_send: false, archived: true })] as never);
  assert.deepEqual([arch.canSend, arch.readOnly], [false, "archived"]);
  const [sup] = toClassConversations([room({ can_send: false, support: true, unread: 0 })] as never);
  assert.deepEqual([sup.canSend, sup.readOnly, sup.unread], [false, "support", 0]);
  assert.equal(toClassConversations([room({ can_send: undefined })] as never)[0].canSend, false, "không biết = KHÔNG gửi được");
  const empty = toClassConversations([room({ last_seq: 0, last_body: null, last_sender_name: null, last_at: null, unread: null, member_count: null })] as never)[0];
  assert.deepEqual([empty.lastSeq, empty.lastBody, empty.unread, empty.memberCount], [0, "", 0, 0]);
  assert.equal(toClassConversations([{ class_id: "", class_name: "x" }, { class_id: CLS, class_name: "  " }] as never).length, 0, "bỏ hàng thiếu id/tên");
});

test("previewText phòng lớp: 'Bạn: …' / 'Tên: …' / mời chào khi chưa có tin (chỉ đọc → không mời chào)", () => {
  assert.equal(previewText({ kind: "class", lastBody: "Mai học", lastMine: true, lastSender: "An" }), "Bạn: Mai học");
  assert.equal(previewText({ kind: "class", lastBody: "Mai học", lastMine: false, lastSender: "An" }), "An: Mai học");
  assert.equal(previewText({ kind: "class", lastBody: "", lastMine: false, readOnly: null }), "Chưa có tin nhắn — hãy chào cả nhóm");
  assert.equal(previewText({ kind: "class", lastBody: "", lastMine: false, readOnly: "archived" }), "Chưa có tin nhắn");
});

test("mergeConversationLists 3 nguồn: mới nhất trước, ổn định; buildUnread/inboxUnreadSplit cộng lớp vào Trò chuyện, KHÔNG vào thông báo", () => {
  const dm = toConversations([{ conversation_id: DM, peer_id: USER, peer_name: "Bình", peer_avatar_url: null, peer_role: null, last_seq: 1, last_body: "hi",
    last_mine: false, last_at: "2026-11-16T01:00:00Z", unread: 1, can_send: true }] as never);
  const m = mergeConversationLists(dm, toBandConversations([bandRoom()] as never), toClassConversations([room()] as never));
  assert.deepEqual(m.map(c => c.kind), ["class", "band", "dm"]);
  assert.deepEqual(inboxUnreadSplit(m), { dm: 1, band: 1, class: 1 });
  const u = buildUnread(1, 1, 7, 2);
  assert.deepEqual([u.class, u.chatTotal, u.noticeTotal], [2, 4, 7]);
  assert.equal(buildUnread(1, 1, 7).chatTotal, 2, "tương thích chỗ gọi cũ (không truyền lớp)");
  const s = summarizeLocal(m, 0);
  assert.deepEqual([s.dm, s.band, s.class, s.unreadClass], [1, 1, 1, 1]);
});

test("toBandMessages(fallback): tin phòng lớp có tên/ảnh người gửi, thiếu tên → 'Thành viên lớp'", () => {
  const [x] = toBandMessages([{ seq: 2, sender_id: USER, sender_name: "  ", sender_avatar_url: null, mine: false, body: "hi", created_at: "2026-11-16T03:00:00Z" }], "Thành viên lớp");
  assert.equal(x.sender?.name, "Thành viên lớp");
});

test("Hộp thư V2: hàng kind=class ↔ ConversationItem (giữ ghim/sortAt/readOnly)", () => {
  const items = toInboxItems([{ conv_key: "class:" + CLS, kind: "class", peer_id: null, name: "Lớp K1", avatar_url: null, cover_path: null, project_id: null,
    project_avatar_path: null, peer_role: null, last_seq: 3, last_body: "hi", last_sender_name: "An", last_mine: false, last_at: "2026-11-16T03:00:00Z",
    sort_at: "2026-11-16T03:00:00Z", unread: 1, member_count: 3, can_send: false, archived: true, support: false, pinned: true }]);
  assert.equal(items.length, 1);
  assert.deepEqual([items[0].kind, items[0].id, items[0].pinned, items[0].readOnly, items[0].canSend, items[0].unread], ["class", "class:" + CLS, true, "archived", false, 1]);
});

test("Route: /me/chat/c/<lớp> ↔ id class:<lớp>; round-trip; id sai không nhận; Band & DM không đổi; khách không giữ link", () => {
  const id = CLASS_PREFIX + CLS;
  assert.equal(chatConversationPath(id), `/me/chat/c/${CLS}`);
  assert.deepEqual(viewFromPath(`/me/chat/c/${CLS}`), { kind: "chatConversation", conversationId: id });
  assert.deepEqual(viewFromPath(`/me/chat/c/${CLS.toUpperCase()}/`), { kind: "chatConversation", conversationId: id });
  const v = viewFromPath(`/me/chat/c/${CLS}`);
  assert.equal(viewPath(v), `/me/chat/c/${CLS}`);
  assert.equal(sameView(v, v), true);
  assert.equal(keepsPathForGuest(v), false);
  assert.deepEqual(viewFromPath("/me/chat/c/khong-phai-uuid"), { kind: "section", section: "home" });
  assert.equal(chatConversationPath(BAND_PREFIX + BAND), `/me/chat/b/${BAND}`);
  assert.deepEqual(viewFromPath(`/me/chat/${DM}`), { kind: "chatConversation", conversationId: DM });
});

test("An toàn: classchat_messages gốc bị cấm gọi trực tiếp → phải dùng classchat_messages_safe", () => {
  assert.equal(SAFE_READ_REPLACEMENTS.classchat_messages, "classchat_messages_safe");
});

// ── Định tuyến RPC: bundle chatApi với client supabase GIẢ (import.meta.env chỉ có dưới Vite) ──
type Call = { fn: string; args: Record<string, unknown> };
type Handler = (fn: string, args: Record<string, unknown>) => { data?: unknown; error?: { code?: string; message: string } };
type Api = typeof import("../../src/class-social/chat/chatApi");
let handler: Handler = () => ({ data: [] });
const calls: Call[] = [];
(globalThis as unknown as { __classChatRpc: unknown }).__classChatRpc = async (fn: string, args: Record<string, unknown> = {}) => {
  calls.push({ fn, args });
  const r = handler(fn, args);
  return { data: r.data ?? null, error: r.error ?? null, status: r.error ? 400 : 200 };
};
async function loadApi(): Promise<Api> {
  const dir = mkdtempSync(join(tmpdir(), "classchat-api-"));
  const stub = join(dir, "supabase-stub.mjs");
  writeFileSync(stub, "export const supabase = { rpc: (...a) => globalThis.__classChatRpc(...a) }\n");
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

test("API: id class:<uuid> đi qua classchat_*; Band qua bandchat_*; cá nhân qua dm_* (không lẫn)", async () => {
  const { fetchMessages, sendMessage, markRead, fetchClassMembers } = await loadApi();
  use(() => ({ data: [] }));
  await fetchMessages(CLASS_PREFIX + CLS, { afterSeq: 3, limit: 100 });
  await sendMessage(CLASS_PREFIX + CLS, "chào lớp");
  await markRead(CLASS_PREFIX + CLS, 5);
  await fetchClassMembers(CLASS_PREFIX + CLS);
  await fetchMessages(BAND_PREFIX + BAND); await sendMessage(BAND_PREFIX + BAND, "b"); await markRead(BAND_PREFIX + BAND, 1);
  await fetchMessages(DM); await sendMessage(DM, "hi"); await markRead(DM, 2);
  assert.deepEqual(calls.map(c => c.fn), ["classchat_messages_safe", "classchat_send", "classchat_mark_read", "classchat_members",
    "bandchat_messages_safe", "bandchat_send", "bandchat_mark_read", "dm_messages_safe", "dm_send", "dm_mark_read"]);
  assert.deepEqual(calls[0].args, { p_class: CLS, p_after_seq: 3, p_before_seq: null, p_limit: 100 });
  assert.deepEqual(calls[1].args, { p_class: CLS, p_body: "chào lớp" });
  assert.deepEqual(calls[3].args, { p_class: CLS });
});

test("API: danh sách = cá nhân + Band + lớp; classchat_* lỗi/chưa có → cá nhân & Band vẫn hiện; dm lỗi → báo lỗi; badge cộng cả ba", async () => {
  const { fetchConversations, fetchUnreadCount, fetchUnreadBreakdown } = await loadApi();
  const dmRow = { conversation_id: DM, peer_id: USER, peer_name: "Bình", last_seq: 1, last_body: "hi", last_at: "2026-11-16T01:00:00Z", can_send: true, unread: 1 };
  use(fn => fn === "dm_conversations_safe" ? { data: [dmRow] } : fn === "bandchat_rooms" ? { data: [bandRoom()] } : fn === "classchat_rooms" ? { data: [room()] } : { data: 0 });
  let r = await fetchConversations();
  assert.ok(r.ok && r.value.map(c => c.kind).sort().join() === "band,class,dm");

  use(fn => fn === "dm_conversations_safe" ? { data: [dmRow] } : fn === "bandchat_rooms" ? { data: [bandRoom()] }
    : { error: { code: "PGRST202", message: "Could not find the function public.classchat_rooms" } });
  r = await fetchConversations();
  assert.ok(r.ok && r.value.map(c => c.kind).sort().join() === "band,dm", "chưa migrate Chat Lớp → chat cá nhân + Band không bị ảnh hưởng");

  use(fn => fn === "dm_unread_count" ? { data: 2 } : { error: { message: "x" } });
  let u = await fetchUnreadCount();
  assert.ok(u.ok && u.value === 2, "band/class unread lỗi → vẫn đếm cá nhân");

  use(fn => fn === "dm_unread_count" ? { data: 2 } : fn === "bandchat_unread_count" ? { data: 3 } : fn === "classchat_unread_count" ? { data: 4 } : { data: [] });
  u = await fetchUnreadCount();
  assert.ok(u.ok && u.value === 9, "badge = cá nhân + Band + lớp");
  const b = await fetchUnreadBreakdown();
  assert.ok(b.ok && b.value.dm === 2 && b.value.band === 3 && b.value.class === 4);

  use(fn => fn === "dm_conversations_safe" ? { error: { code: "XX000", message: "boom" } } : { data: [room()] });
  r = await fetchConversations();
  assert.equal(r.ok, false, "lỗi phần cá nhân vẫn là lỗi (không giả danh sách)");
});

test("API: thành viên đã rời lớp → P0002 → 'Không tìm thấy cuộc trò chuyện.'; lớp chỉ đọc → 42501 không báo thành công", async () => {
  const { sendMessage } = await loadApi();
  use(() => ({ error: { code: "P0002", message: "Không tìm thấy cuộc trò chuyện" } }));
  let r = await sendMessage(CLASS_PREFIX + CLS, "x");
  assert.ok(!r.ok && r.message === "Không tìm thấy cuộc trò chuyện.");
  use(() => ({ error: { code: "42501", message: "Nhóm này đang ở chế độ chỉ đọc" } }));
  r = await sendMessage(CLASS_PREFIX + CLS, "x");
  assert.equal(r.ok, false);
});

test("ConversationList: hàng phòng lớp có nhãn 'Lớp', tin cuối kèm tên người gửi, badge chưa đọc; chỉ đọc có nhãn riêng", () => {
  const items = toClassConversations([room(), room({ class_id: "22222222-0000-4000-8000-0000000000c3", class_name: "Lớp K3", archived: true, can_send: false, unread: 0 })] as never);
  const html = renderToStaticMarkup(<ConversationList state={{ status: "ready", items }} selectedId={null} onSelect={() => {}} onRetry={() => {}} onOpenFriends={() => {}} />);
  assert.match(html, /Lớp K1/); assert.match(html, /An: Mai học 7h/); assert.match(html, />2</);
  assert.match(html, /Lớp · chỉ đọc/); assert.match(html, /aria-label="Lớp Lớp K1/);
});

test("Chat Lớp KHÔNG tạo hệ thống chat thứ hai: dùng chung ConversationView/MessageList/Composer/useConversation/chatApi, không có UI/hook riêng", () => {
  const view = readFileSync(fileURLToPath(new URL("../../src/class-social/chat/ConversationView.tsx", import.meta.url)), "utf8");
  assert.match(view, /fetchClassMembers/); assert.match(view, /<MessageList/); assert.match(view, /<Composer/);
  const names = readdirSync(fileURLToPath(new URL("../../src/class-social/chat/", import.meta.url)));
  assert.equal(names.some(n => /^Class(Chat|Room)/i.test(n)), false, "không có component Chat Lớp riêng");
});
