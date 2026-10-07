/**
 * Chat V1a (Text 1-1): model thuần, route, polling (không chồng lượt · dừng khi tab ẩn · giãn nhịp khi lỗi),
 * render danh sách/dòng tin/ô soạn, và các rào chắn "không làm gì ngoài V1a" (không realtime, không media, không đọc thẳng bảng).
 * DB + quyền: scripts/test-dm-v1-db.sh · UI thật: scripts/e2e-chat-v1.sh.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MAX_BODY, canSendBody, chatErrorText, dividerLabel, mergeMessages, normalizeBody, previewText, shortTime, toConversations, toMessages,
  type ChatMessage,
} from "../../src/class-social/chat/chatModel";
import ConversationList from "../../src/class-social/chat/ConversationList";
import MessageList from "../../src/class-social/chat/MessageList";
import Composer from "../../src/class-social/chat/Composer";
import ChatHeader from "../../src/class-social/chat/ChatHeader";
import {
  chatConversationPath, chatWithPath, keepsPathForGuest, sameView, viewFromPath, viewPath, SECTION_PATHS,
} from "../../src/class-social/resolveMeRoute";
void React;

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const code = (f: string) => read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const CONV = "0b6f7c1e-5d2a-4c3b-9a8e-1f2d3c4b5a69";
const USER = "aaaaaaaa-0000-4000-8000-00000000000a";
const msg = (seq: number, mine: boolean, body = `tin ${seq}`, at = "2026-10-07T03:00:00Z"): ChatMessage => ({ seq, mine, body, at });

// ── Model ───────────────────────────────────────────────────────────────────
test("toConversations: map đủ trường, tên rỗng → 'Thành viên Class', số/bigint → number, avatar không an toàn bị bỏ", () => {
  const [c] = toConversations([{
    conversation_id: CONV, peer_id: USER, peer_name: "  ", peer_avatar_url: "javascript:alert(1)", peer_role: "teacher",
    last_seq: "12", last_body: "Chào", last_mine: true, last_at: "2026-10-07T03:00:00Z", unread: 3, can_send: true,
  }, { conversation_id: "", peer_id: USER } as never, { conversation_id: CONV } as never]);
  assert.deepEqual([c.id, c.peerId, c.name, c.avatarUrl, c.isTeacher, c.lastSeq, c.lastMine, c.unread, c.canSend],
    [CONV, USER, "Thành viên Class", null, true, 12, true, 3, true]);
  assert.equal(toConversations([{ conversation_id: "", peer_id: USER } as never]).length, 0, "bỏ hàng thiếu id");
  assert.deepEqual(toConversations(null), []);
  assert.equal(toConversations([{ conversation_id: CONV, peer_id: USER, can_send: null, unread: -4 } as never])[0].canSend, false, "không biết = KHÔNG gửi được");
  assert.equal(toConversations([{ conversation_id: CONV, peer_id: USER, unread: -4 } as never])[0].unread, 0);
});

test("toMessages sắp tăng dần theo seq; mergeMessages khử trùng, giữ thứ tự, không mất tin", () => {
  const rows = toMessages([{ seq: "3", mine: false, body: "c", created_at: "t" }, { seq: 1, mine: true, body: "a", created_at: "t" }, { seq: 2, mine: false, body: "b", created_at: "t" }]);
  assert.deepEqual(rows.map(m => m.seq), [1, 2, 3]);
  const merged = mergeMessages([msg(1, true), msg(2, false)], [msg(2, false, "tin 2 (lại)"), msg(3, true)]);
  assert.deepEqual(merged.map(m => m.seq), [1, 2, 3]);
  assert.equal(merged[1].body, "tin 2 (lại)");
  const same = [msg(1, true)];
  assert.equal(mergeMessages(same, []), same, "không có tin mới → giữ nguyên tham chiếu (không render lại)");
  assert.deepEqual(mergeMessages([msg(5, true), msg(6, true)], [msg(3, false), msg(4, false)]).map(m => m.seq), [3, 4, 5, 6], "tin cũ chèn lên đầu");
});

test("canSendBody: trim, tối đa 2000 KÝ TỰ (emoji tính 1), không gửi tin rỗng/chỉ khoảng trắng/xuống dòng", () => {
  assert.equal(canSendBody(""), false);
  assert.equal(canSendBody("   \n\t "), false);
  assert.equal(canSendBody("a"), true);
  assert.equal(canSendBody("😀".repeat(MAX_BODY)), true, "2000 emoji = 2000 ký tự (khớp char_length của DB)");
  assert.equal(canSendBody("😀".repeat(MAX_BODY + 1)), false);
  assert.equal(canSendBody("é".repeat(MAX_BODY)), true);
  assert.equal(normalizeBody("  xin chào \n"), "xin chào");
  assert.equal(MAX_BODY, 2000);
});

test("previewText: 'Bạn: …' khi tin cuối của mình, xuống dòng → khoảng trắng", () => {
  assert.equal(previewText({ lastBody: "Dòng 1\n\nDòng 2", lastMine: false }), "Dòng 1 Dòng 2");
  assert.equal(previewText({ lastBody: "ok", lastMine: true }), "Bạn: ok");
});

test("shortTime / dividerLabel: hôm nay → giờ, hôm qua, thứ, ngày; nhãn giờ chỉ chen khi cách >30 phút", () => {
  const now = new Date(2026, 9, 7, 15, 30);
  assert.equal(shortTime(new Date(2026, 9, 7, 9, 5).toISOString(), now), "09:05");
  assert.equal(shortTime(new Date(2026, 9, 6, 23, 0).toISOString(), now), "Hôm qua");
  assert.match(shortTime(new Date(2026, 9, 3, 10, 0).toISOString(), now), /^(CN|T[2-7])$/);
  assert.equal(shortTime(new Date(2026, 8, 1, 10, 0).toISOString(), now), "01/09");
  assert.equal(shortTime(new Date(2025, 8, 1, 10, 0).toISOString(), now), "01/09/2025");
  assert.equal(shortTime("not-a-date", now), "");
  const t = (m: number) => new Date(2026, 9, 7, 10, m).toISOString();
  assert.equal(dividerLabel(null, t(0), now), "10:00", "tin đầu luôn có nhãn");
  assert.equal(dividerLabel(t(0), t(29), now), null);
  assert.equal(dividerLabel(t(0), t(31), now), "10:31");
  assert.match(dividerLabel(new Date(2026, 9, 5).toISOString(), new Date(2026, 9, 6, 8, 0).toISOString(), now)!, /^06\/10 08:00$/);
});

test("chatErrorText: mọi lỗi → câu tiếng Việt, không lộ chi tiết; 'không thấy' dùng chung cho không tồn tại và không thuộc về mình", () => {
  assert.equal(chatErrorText({ code: "P0002", message: "bất kỳ" }, false), "Không tìm thấy cuộc trò chuyện.");
  assert.equal(chatErrorText({ code: "42501", message: "permission denied for table dm_messages" }, false), "Bạn chưa thể nhắn tin cho người này.");
  assert.equal(chatErrorText({ code: "54000" }, false), "Bạn gửi quá nhanh. Hãy chờ một chút rồi gửi tiếp.");
  assert.equal(chatErrorText({ code: "22023", message: "Tin nhắn quá dài (tối đa 2000 ký tự)" }, false), "Tin nhắn quá dài (tối đa 2000 ký tự)");
  assert.equal(chatErrorText({ code: "22023", message: "lỗi lạ nội bộ" }, false), "Tin nhắn chưa hợp lệ.");
  assert.match(chatErrorText({ message: "Failed to fetch" }, false), /kết nối mạng/);
  assert.match(chatErrorText({ code: "x" }, true), /kết nối mạng/);
  assert.match(chatErrorText({ status: 401 }, false), /hết hạn/);
  assert.equal(chatErrorText({ code: "XX000", message: "relation dm_x does not exist" }, false), "Chưa thực hiện được. Hãy thử lại.");
});

// ── Route ───────────────────────────────────────────────────────────────────
test("Route: /me/chat · /me/chat/<id> · /me/chat/u/<id>; round-trip; id sai → không nhận; khách không giữ link chat", () => {
  assert.deepEqual(viewFromPath("/me/chat"), { kind: "section", section: "chat" });
  assert.deepEqual(viewFromPath(`/me/chat/${CONV}`), { kind: "chatConversation", conversationId: CONV });
  assert.deepEqual(viewFromPath(`/me/chat/${CONV.toUpperCase()}/`), { kind: "chatConversation", conversationId: CONV });
  assert.deepEqual(viewFromPath(`/me/chat/u/${USER}`), { kind: "chatWith", userId: USER });
  assert.equal(chatConversationPath(CONV), `/me/chat/${CONV}`);
  assert.equal(chatWithPath(USER), `/me/chat/u/${USER}`);
  for (const v of [viewFromPath(`/me/chat/${CONV}`), viewFromPath(`/me/chat/u/${USER}`)]) {
    assert.equal(viewFromPath(viewPath(v)).kind, v.kind);
    assert.equal(sameView(v, v), true);
    assert.equal(keepsPathForGuest(v), false, "chưa đăng nhập → về /me, không giữ link tin nhắn");
  }
  assert.equal(sameView({ kind: "chatConversation", conversationId: CONV }, { kind: "chatWith", userId: USER }), false);
  assert.deepEqual(viewFromPath("/me/chat/khong-phai-uuid"), { kind: "section", section: "home" });
  assert.deepEqual(viewFromPath(`/me/chat/u/${CONV}x`), { kind: "section", section: "home" });
  assert.equal(SECTION_PATHS.chat, "/me/chat");
});

// ── Polling ─────────────────────────────────────────────────────────────────
type Listener = () => void;
function fakeDom() {
  const doc = { visibilityState: "visible" as "visible" | "hidden", ls: new Map<string, Set<Listener>>(),
    addEventListener(t: string, l: Listener) { (this.ls.get(t) ?? this.ls.set(t, new Set()).get(t)!).add(l) },
    removeEventListener(t: string, l: Listener) { this.ls.get(t)?.delete(l) },
    fire(t: string) { this.ls.get(t)?.forEach(l => l()) } };
  const win = { ls: new Map<string, Set<Listener>>(),
    addEventListener(t: string, l: Listener) { (this.ls.get(t) ?? this.ls.set(t, new Set()).get(t)!).add(l) },
    removeEventListener(t: string, l: Listener) { this.ls.get(t)?.delete(l) } };
  Object.assign(globalThis, { document: doc, window: win });
  return { doc, win, listeners: () => [...doc.ls.values(), ...win.ls.values()].reduce((n, s) => n + s.size, 0) };
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

test("startPolling: chạy ngay, lặp theo nhịp, KHÔNG chồng lượt, dừng hẳn khi unsubscribe và gỡ sạch listener", async () => {
  const { listeners } = fakeDom();
  const { startPolling } = await import("../../src/class-social/chat/polling");
  let calls = 0, inflight = 0, maxInflight = 0;
  const stop = startPolling(async () => { calls++; inflight++; maxInflight = Math.max(maxInflight, inflight); await sleep(35); inflight--; return true }, 10);
  await sleep(160);
  assert.ok(calls >= 2, `đã lặp (${calls})`);
  assert.equal(maxInflight, 1, "không bao giờ hai lượt cùng lúc dù tick chậm hơn nhịp");
  stop();
  const after = calls;
  await sleep(80);
  assert.equal(calls, after, "dừng hẳn sau unsubscribe");
  assert.equal(listeners(), 0, "đã gỡ listener visibility/focus");
});

test("startPolling: tab ẩn → không gọi; hiện lại/focus → gọi ngay; lỗi → giãn nhịp", async () => {
  const { doc, win } = fakeDom();
  const { startPolling } = await import("../../src/class-social/chat/polling");
  doc.visibilityState = "hidden";
  let calls = 0;
  const stop = startPolling(async () => { calls++; return true }, 10);
  await sleep(60);
  assert.equal(calls, 0, "tab ẩn: không gọi mạng");
  doc.visibilityState = "visible";
  doc.fire("visibilitychange");
  await sleep(15);
  assert.ok(calls >= 1, "hiện lại tab → tải ngay");
  doc.visibilityState = "hidden";
  doc.fire("visibilitychange");
  const frozen = calls;
  await sleep(60);
  assert.equal(calls, frozen, "ẩn lại → dừng");
  stop();
  void win;

  // lỗi liên tiếp: khoảng cách giữa các lượt tăng dần (không dồn dập khi mạng/DB đang lỗi)
  fakeDom();
  const t: number[] = [];
  const stop2 = startPolling(async () => { t.push(Date.now()); return false }, 10);
  await sleep(220);
  stop2();
  assert.ok(t.length >= 3, `có ${t.length} lượt`);
  const gaps = t.slice(1).map((x, i) => x - t[i]);
  assert.ok(gaps[gaps.length - 1] > gaps[0], `giãn nhịp khi lỗi: ${gaps.join(",")}`);
});

// ── Render ──────────────────────────────────────────────────────────────────
test("ConversationList: đang tải · lỗi (Thử lại) · trống (hướng sang Bạn bè, KHÔNG hứa nhắn mọi thành viên) · có dữ liệu", () => {
  const noop = () => {};
  const render = (state: Parameters<typeof ConversationList>[0]["state"], selectedId: string | null = null) =>
    renderToStaticMarkup(<ConversationList state={state} selectedId={selectedId} onSelect={noop} onRetry={noop} onOpenFriends={noop} />);
  assert.match(render({ status: "loading" }), /aria-label="Đang tải"/);
  const err = render({ status: "error", message: "Không có kết nối mạng." });
  assert.match(err, /role="alert"/); assert.match(err, />Thử lại</);
  const empty = render({ status: "ready", items: [] });
  assert.match(empty, /Chưa có cuộc trò chuyện/); assert.match(empty, />Mở Bạn bè</);
  assert.match(empty, /Vào Bạn bè và chọn Nhắn tin/);
  assert.doesNotMatch(empty, /mọi thành viên|thành viên Class/, "không hứa nhắn được mọi thành viên Class");
  const items = toConversations([
    { conversation_id: CONV, peer_id: USER, peer_name: "Bình", peer_avatar_url: null, peer_role: "student", last_seq: 3, last_body: "Hẹn mai nhé", last_mine: true, last_at: new Date().toISOString(), unread: 0, can_send: true },
    { conversation_id: "1b6f7c1e-5d2a-4c3b-9a8e-1f2d3c4b5a69", peer_id: "bbbbbbbb-0000-4000-8000-00000000000b", peer_name: "Cúc", peer_avatar_url: null, peer_role: "student", last_seq: 9, last_body: "Em chào thầy", last_mine: false, last_at: new Date().toISOString(), unread: 150, can_send: true },
  ]);
  const html = render({ status: "ready", items }, CONV);
  assert.match(html, />Bình</); assert.match(html, />Bạn: Hẹn mai nhé</); assert.match(html, />Em chào thầy</);
  assert.match(html, /aria-current="true"/, "mục đang chọn");
  assert.equal((html.match(/is-unread/g) ?? []).length, 1, "chỉ hội thoại có tin chưa đọc được tô đậm");
  assert.match(html, />99\+</, "badge chặn ở 99+");
  assert.match(html, /aria-label="Cúc, 150 tin chưa đọc"/);
});

test("MessageList: tin mình bên phải / người kia bên trái, nhãn giờ khi cách >30 phút, nút 'Xem tin cũ hơn', tin lỗi có Thử lại/Xoá", () => {
  const html = renderToStaticMarkup(<MessageList
    messages={[msg(1, false, "Chào bạn", "2026-10-07T03:00:00Z"), msg(2, true, "Chào thầy", "2026-10-07T03:05:00Z"), msg(3, true, "Hẹn gặp lại", "2026-10-07T05:00:00Z")]}
    pending={[{ localId: "L1", body: "Đang gửi", state: "sending" }, { localId: "L2", body: "Gửi lỗi", state: "failed" }]}
    hasMore loadingOlder={false} onLoadOlder={() => {}} onRetry={() => {}} onDiscard={() => {}} />);
  assert.match(html, /is-theirs[^"]*"[^>]*><div class="cs-msg-bubble">Chào bạn</);
  assert.match(html, /is-mine[^"]*"[^>]*><div class="cs-msg-bubble">Chào thầy</);
  assert.equal((html.match(/cs-chat-divider/g) ?? []).length, 2, "tin đầu + tin cách >30 phút");
  assert.match(html, />Xem tin cũ hơn</);
  assert.match(html, /is-pending">Đang gửi</);
  assert.match(html, /is-pending is-failed">Gửi lỗi</);
  assert.match(html, />Thử lại</); assert.match(html, />Xoá</);
  assert.match(html, /role="log"/);
  assert.match(html, /is-mine is-cont/, "tin liền nhau cùng người: gần nhau hơn");
});

test("MessageList: nội dung tin là TEXT thuần — HTML trong tin không thành thẻ", () => {
  const html = renderToStaticMarkup(<MessageList messages={[msg(1, false, '<img src=x onerror=alert(1)><script>alert(1)</script>')]}
    pending={[]} hasMore={false} loadingOlder={false} onLoadOlder={() => {}} onRetry={() => {}} onDiscard={() => {}} />);
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("Composer: một ô text + Gửi (khoá khi rỗng); KHÔNG có ảnh/file/mic/sticker", () => {
  const html = renderToStaticMarkup(<Composer onSend={() => true} />);
  assert.match(html, /<textarea/); assert.match(html, /aria-label="Gửi"[^>]*disabled|disabled=""[^>]*aria-label="Gửi"/);
  assert.match(html, /enterkeyhint="send"/i);
  assert.doesNotMatch(html, /type="file"|<input|accept=|capture=|sticker|microphone|camera/i);
});

test("ChatHeader: nút ← có nhãn rõ; tên bấm được → trang cá nhân; chưa biết tên → khung chờ", () => {
  const h = renderToStaticMarkup(<ChatHeader name="Bình" avatarUrl={null} isTeacher onBack={() => {}} onOpenProfile={() => {}} />);
  assert.match(h, /aria-label="Quay lại danh sách trò chuyện"/); assert.match(h, /aria-label="Trang cá nhân của Bình"/); assert.match(h, /Giáo viên/);
  const wait = renderToStaticMarkup(<ChatHeader name={null} avatarUrl={null} onBack={() => {}} />);
  assert.match(wait, /cs-skeleton/); assert.doesNotMatch(wait, /Trang cá nhân của/);
});

// ── Rào chắn phạm vi V1a ────────────────────────────────────────────────────
test("Phạm vi V1a: không realtime, không đọc/ghi thẳng bảng dm_*, không upload/media/share/Mira trong code Chat", () => {
  const files = readdirSync(new URL("../../src/class-social/chat/", import.meta.url)).map(f => `src/class-social/chat/${f}`).concat("src/class-social/sections/Chat.tsx");
  const all = files.map(code).join("\n");
  assert.equal(/\.channel\(|postgres_changes|supabase_realtime|realtime/i.test(all), false, "V1a không realtime");
  assert.equal(/\.from\(\s*['"`]dm_/.test(all), false, "không truy cập thẳng bảng dm_*");
  assert.equal(/type="file"|\.upload\(|getUserMedia|MediaRecorder|FileReader|sticker/i.test(all), false, "không media");
  assert.equal(/ref_type|ref_key|shared_object|class-ai|@Mira|sender_kind/i.test(all), false, "chưa Share/Mira");
  for (const rpc of ["dm_conversations", "dm_messages", "dm_send", "dm_start", "dm_mark_read", "dm_unread_count", "dm_find", "dm_can_message"]) {
    assert.match(code("src/class-social/chat/chatApi.ts"), new RegExp(`['"]${rpc}['"]`), `chatApi gọi RPC ${rpc}`);
  }
  // Client không tự quyết quyền: không suy luận từ quan hệ bạn bè để cho phép nhắn tin
  assert.equal(/relationship\s*===\s*['"]friends['"]/.test(code("src/class-social/sections/ProfilePage.tsx").replace(/[\s\S]*function OtherHeader/, "")), false);
  assert.match(code("src/class-social/sections/ProfilePage.tsx"), /useCanMessage\(/, "nút Nhắn tin ở hồ sơ hỏi server (dm_can_message)");
});

test("Hook/transport: hook chỉ biết interface ChatLive — thay polling bằng realtime không phải sửa UI", () => {
  const hooks = code("src/class-social/chat/useChat.ts");
  assert.equal(/setInterval|setTimeout/.test(hooks), false, "hook không tự dựng timer");
  assert.match(hooks, /live\.watch(Unread|List|Conversation)\(/);
  const live = code("src/class-social/chat/chatLive.ts");
  assert.match(live, /export interface ChatLive/);
  assert.match(code("src/class-social/chat/polling.ts"), /visibilityState/, "tab ẩn → dừng polling");
  assert.match(live, /afterSeq: afterSeq\(\)/, "hội thoại đang mở chỉ hỏi tin MỚI");
});

test("Điều hướng: Nhắn tin ở Bạn bè + Hồ sơ; mục Trò chuyện có badge chưa đọc; Chat không còn là khung rỗng", () => {
  const page = code("src/class-social/ClassSocialPage.tsx");
  assert.match(page, /chat: chatUnread\.count/);
  assert.match(page, /<Chat meId=\{me\.userId\}/);
  assert.match(page, /<Friends requests=\{requests\} onOpenProfile=\{onOpenProfile\} onMessage=\{onOpenChatWith\}/);
  assert.match(page, /onMessage=\{onOpenChatWith\}/);
  assert.match(code("src/class-social/sections/Friends.tsx"), /Nhắn tin cho \$\{p\.name\}/);
  assert.doesNotMatch(code("src/class-social/sections/Chat.tsx"), /Chưa có backend tin nhắn/);
  assert.match(code("src/class-social/ClassSocialLayout.tsx"), /cuộc trò chuyện chưa đọc/);
});
