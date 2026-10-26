/**
 * Sound V1.2: tiếng "ting" cho DM mới từ người khác. Theo dõi lastSeq từng hội thoại (thuần), badge gộp vào dm_conversations
 * giữ ngữ nghĩa dm_unread_count, dùng chung cổng/công tắc Sound V1.1. Không DB/RPC/polling mới.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDmSoundTracker, createNoticeSoundGate, getSoundEnabled, playPendingNotice, resetNoticeAudioForTests, unlockNoticeAudio, writeSoundEnabled, PENDING_MAX_WAIT_MS, NOTICE_MAX_AGE_MS } from "../../src/class-social/chat/noticeSound";
import { INBOX_LIMIT, inboxUnread, toConversations } from "../../src/class-social/chat/chatModel";

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const code = (f: string) => read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const NOW = Date.parse("2026-10-13T09:00:00Z");
const row = (id: string, lastSeq: number, o: { mine?: boolean; unread?: number; ageMs?: number } = {}) =>
  ({ id, lastSeq, lastMine: o.mine ?? false, unread: o.unread ?? 1, lastAt: new Date(NOW - (o.ageMs ?? 1000)).toISOString() });

test("DM: lần tải đầu (tin cũ chưa đọc) = chỉ lập mốc, im lặng", () => {
  const t = createDmSoundTracker();
  t.observe([row("a", 7, { unread: 3 }), row("b", 2)], NOW);
  assert.equal(t.gate.hasPending(NOW), false);
});

test("DM: tin mới từ người khác (hội thoại đã đọc) → chờ kêu đúng MỘT lần; polling lặp không kêu lại", () => {
  const t = createDmSoundTracker();
  t.observe([row("a", 7, { unread: 0 })], NOW);
  t.observe([row("a", 8, { unread: 1 })], NOW + 30_000);
  assert.equal(t.gate.take(NOW + 30_000), true);
  t.observe([row("a", 8, { unread: 1 })], NOW + 60_000);
  assert.equal(t.gate.take(NOW + 60_000), false, "polling lặp");
});

test("DM: tin thứ hai trong hội thoại ĐANG chưa đọc vẫn kêu (lý do chọn phương án B)", () => {
  const t = createDmSoundTracker();
  t.observe([row("a", 7, { unread: 0 })], NOW);
  t.observe([row("a", 8, { unread: 1 })], NOW + 30_000);
  assert.equal(t.gate.take(NOW + 30_000), true);
  t.observe([row("a", 9, { unread: 2 })], NOW + 60_000);
  assert.equal(t.gate.take(NOW + 60_000), true);
});

test("DM: tin tự gửi (lastMine) / đã đọc ở nơi khác (unread 0) → không kêu", () => {
  const t = createDmSoundTracker();
  t.observe([row("a", 7, { unread: 0 })], NOW);
  t.observe([row("a", 8, { mine: true, unread: 0 })], NOW + 30_000);
  assert.equal(t.gate.hasPending(NOW + 30_000), false, "tự gửi");
  t.observe([row("a", 9, { unread: 0 })], NOW + 60_000);
  assert.equal(t.gate.hasPending(NOW + 60_000), false, "đã đọc (đang mở hội thoại)");
});

test("DM: nhiều tin / nhiều hội thoại trong một lượt poll → tối đa MỘT chờ", () => {
  const t = createDmSoundTracker();
  t.observe([row("a", 1, { unread: 0 }), row("b", 4, { unread: 0 })], NOW);
  t.observe([row("a", 5, { unread: 4 }), row("b", 6, { unread: 2 })], NOW + 30_000);
  assert.equal(t.gate.take(NOW + 30_000), true);
  assert.equal(t.gate.take(NOW + 30_000), false);
});

test("DM: hội thoại mới xuất hiện sau mốc, tin đầu của người khác → kêu; của mình → không", () => {
  const t = createDmSoundTracker();
  t.observe([row("a", 3, { unread: 0 })], NOW);
  t.observe([row("a", 3, { unread: 0 }), row("n", 1, { mine: true, unread: 0 })], NOW + 30_000);
  assert.equal(t.gate.hasPending(NOW + 30_000), false);
  t.observe([row("a", 3, { unread: 0 }), row("n", 1, { mine: true, unread: 0 }), row("m", 1)], NOW + 60_000);
  assert.equal(t.gate.take(NOW + 60_000), true);
});

test("DM: danh sách trả cũ/ngắn hơn rồi trở lại không bị coi là tin mới; hết hạn chờ / tin quá cũ → không kêu bù", () => {
  const t = createDmSoundTracker();
  t.observe([row("a", 7, { unread: 0 }), row("b", 3, { unread: 0 })], NOW);
  t.observe([row("a", 7, { unread: 0 })], NOW + 30_000);                         // b tạm không có (trần/lỗi)
  t.observe([row("a", 7, { unread: 0 }), row("b", 3, { unread: 0 })], NOW + 60_000);
  assert.equal(t.gate.hasPending(NOW + 60_000), false);
  t.observe([row("a", 8)], NOW + 90_000);
  assert.equal(t.gate.hasPending(NOW + 90_000 + PENDING_MAX_WAIT_MS + 1), false, "quá hạn chờ");
  const o = createDmSoundTracker();
  o.observe([row("a", 1, { unread: 0 })], NOW);
  o.observe([row("a", 2, { ageMs: NOTICE_MAX_AGE_MS + 1000 })], NOW + 30_000);
  assert.equal(o.gate.hasPending(NOW + 30_000), false, "tin quá cũ");
});

test("Badge: inboxUnread = số HỘI THOẠI chưa đọc, giống dm_unread_count (không đếm số tin, tin tự gửi không tính)", () => {
  const rows = toConversations([
    { conversation_id: "a", peer_id: "p1", peer_name: "A", last_seq: 9, last_body: "x", last_mine: false, last_at: "2026-10-13T08:00:00Z", unread: 5, can_send: true },
    { conversation_id: "b", peer_id: "p2", peer_name: "B", last_seq: 4, last_body: "y", last_mine: true, last_at: "2026-10-13T08:01:00Z", unread: 0, can_send: true },
    { conversation_id: "c", peer_id: "p3", peer_name: "C", last_seq: 1, last_body: "z", last_mine: false, last_at: "2026-10-13T08:02:00Z", unread: 1, can_send: false },
  ] as never);
  assert.equal(inboxUnread(rows), 2);
  assert.equal(inboxUnread([]), 0);
});

test("Phạm vi: một request gộp, fallback khi bị cắt trần, không DB/RPC mới, hook không tự dựng timer", () => {
  const live = code("src/class-social/chat/chatLive.ts");
  assert.match(live, /watchInbox\(onInbox\)[\s\S]*fetchConversations\(INBOX_LIMIT\)/);
  assert.match(live, /length >= INBOX_LIMIT\)[\s\S]*fetchUnreadCount\(\)/, "bị cắt trần → lấy số đếm chính xác từ RPC cũ");
  assert.equal(INBOX_LIMIT, 100, "bằng trần least(p_limit,100) của dm_conversations");
  const hook = code("src/class-social/chat/useChat.ts");
  assert.match(hook, /live\.watchInbox/);
  assert.match(hook, /live\.watchUnread\(setDm\)/, "live không có hộp thư vẫn chạy badge cũ");
  assert.equal(/setInterval|setTimeout/.test(hook), false);
  const api = code("src/class-social/chat/chatApi.ts");
  assert.equal([...api.matchAll(/rpc<[^>]*>\('([a-z_]+)'/g)].map(m => m[1]).filter(n => n.startsWith("dm_") && !["dm_conversations_safe", "dm_unread_count", "dm_messages_safe", "dm_send", "dm_mark_read", "dm_start", "dm_can_message", "dm_find", "dm_share"].includes(n)).length, 0, "không RPC DM mới");
});

test("Tích hợp cổng: DM + System Chat cùng chờ → MỘT tiếng; Tắt tiếng → cả hai im, bật lại không kêu bù", () => {
  resetNoticeAudioForTests();
  const stored = new Map<string, string>();
  (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => { stored.set(k, v); } };
  let resumed = 0, osc = 0;
  class Ctx {
    state = "running"; currentTime = 0; destination = {};
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createOscillator() { osc++; return { type: "", frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; }
    resume() { resumed++; return Promise.resolve(); }
    onstatechange: unknown = null;
  }
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = Ctx;
  unlockNoticeAudio();
  writeSoundEnabled(true);
  const sys = createNoticeSoundGate();
  const dm = createDmSoundTracker();
  sys.observe({ lastSeq: 1, unread: 0 }, NOW); dm.observe([row("a", 1, { unread: 0 })], NOW);
  sys.observe({ lastSeq: 2, unread: 1, lastAt: new Date(NOW).toISOString() }, NOW + 30_000);
  dm.observe([row("a", 2)], NOW + 30_000);
  const T = NOW + 31_000;
  const first = playPendingNotice(sys, T);
  const second = playPendingNotice(dm.gate, T + 100);
  assert.equal(first, true);
  assert.equal(second, false, "chống chồng: gate thứ hai bị bỏ");
  assert.equal(dm.gate.hasPending(T + 100), false);
  assert.equal(osc, 2, "một tiếng = 2 nốt");
  // Tắt → cả hai im
  dm.observe([row("a", 3)], NOW + 60_000);
  writeSoundEnabled(false);
  assert.equal(playPendingNotice(dm.gate, T + 10_000), false);
  assert.equal(dm.gate.hasPending(T + 10_000), false, "tắt tiếng → bỏ chờ");
  assert.equal(getSoundEnabled(), false);
  void resumed;
});
