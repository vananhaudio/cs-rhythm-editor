/**
 * System Chat Sound V1: cổng chống phát trùng (thuần), phát tiếng qua Web Audio giả, công tắc Bật/Tắt, và rào chắn phạm vi
 * (không Service Worker/Web Push/mạng mới/DB). Âm thật trên Safari/Chrome do Owner nghiệm thu.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  NOTICE_MAX_AGE_MS, PENDING_MAX_WAIT_MS, SOUND_KEY, createNoticeSoundGate, getSoundEnabled, onNoticeAudioReady, playNoticePing,
  playPendingNotice, readSoundEnabled, resetNoticeAudioForTests, tryResumeNoticeAudio, unlockNoticeAudio, writeSoundEnabled,
} from "../../src/class-social/chat/noticeSound";
void React; void renderToStaticMarkup;

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const code = (f: string) => read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const NOW = Date.parse("2026-10-12T21:23:00Z");
const S = (lastSeq: number, unread: number, ageMs = 1000) => ({ lastSeq, unread, lastAt: new Date(NOW - ageMs).toISOString() });
const rang = (g: ReturnType<typeof createNoticeSoundGate>, now = NOW) => g.take(now);

test("Gate: lần đầu (tải trang, thông báo cũ chưa đọc) = im lặng, đặt mốc, không chờ", () => {
  const g = createNoticeSoundGate();
  g.observe(null, NOW);
  g.observe(S(40, 3), NOW);
  assert.equal(g.hasPending(NOW), false);
});

test("Gate: thông báo mới = chờ kêu đúng MỘT lần; polling lặp / dữ liệu cũ không tạo thêm", () => {
  const g = createNoticeSoundGate();
  g.observe(S(5, 0), NOW);
  g.observe(S(6, 1), NOW);
  assert.equal(rang(g), true);
  g.observe(S(6, 1), NOW + 1000);
  g.observe(S(6, 1), NOW + 2000);
  assert.equal(rang(g, NOW + 2000), false, "polling lặp");
  g.observe(S(5, 0), NOW + 3000);
  assert.equal(rang(g, NOW + 3000), false, "API trả lại dữ liệu cũ");
  g.observe(S(6, 1), NOW + 4000);
  assert.equal(rang(g, NOW + 4000), false, "mốc không bị kéo lùi");
});

test("Gate: đọc thông báo (unread→0) bỏ chờ; lỗi mạng (null) không đặt lại mốc", () => {
  const g = createNoticeSoundGate();
  g.observe(S(6, 2), NOW);
  g.observe(S(6, 0), NOW);
  assert.equal(g.hasPending(NOW), false);
  g.observe(null, NOW);
  g.observe(S(6, 0), NOW);
  assert.equal(g.hasPending(NOW), false, "sau lỗi, thông báo cũ không bị coi là mới");
  g.observe(S(7, 1), NOW);
  assert.equal(rang(g), true);
});

test("Gate: nhiều thông báo cùng đợt = MỘT chờ; đã đọc ở nơi khác (unread 0) không chờ", () => {
  const g = createNoticeSoundGate();
  g.observe(S(10, 0), NOW);
  g.observe(S(13, 3), NOW);
  assert.equal(rang(g), true);
  assert.equal(rang(g), false);
  g.observe(S(14, 0), NOW);
  assert.equal(g.hasPending(NOW), false);
});

test("Gate A2: chờ KHÔNG bị tiêu thụ chỉ vì chưa phát được; hết hạn chờ → bỏ (không chuông bất ngờ)", () => {
  const g = createNoticeSoundGate();
  g.observe(S(1, 0), NOW);
  g.observe(S(2, 1), NOW);
  for (let i = 1; i <= 5; i++) assert.equal(g.hasPending(NOW + i * 10_000), true, "tab ẩn/âm thanh chưa sẵn sàng: vẫn chờ");
  assert.equal(g.hasPending(NOW + PENDING_MAX_WAIT_MS + 1), false, "quá hạn chờ");
  assert.equal(g.take(NOW + PENDING_MAX_WAIT_MS + 1), false);
});

test("Gate A2: thông báo đã cũ (tạo quá lâu theo đồng hồ) không kêu bù khi quay lại", () => {
  const g = createNoticeSoundGate();
  g.observe(S(1, 0), NOW);
  g.observe(S(2, 1, NOTICE_MAX_AGE_MS + 60_000), NOW);
  assert.equal(g.hasPending(NOW), false);
  g.observe(S(3, 1, 30_000), NOW);
  assert.equal(g.hasPending(NOW), true, "thông báo vừa đến vẫn được");
});

// ── Phát tiếng (Web Audio giả, có trạng thái) ──
type Fake = { state: string; created: number; started: number; blocked: boolean; fireState: () => void }
let current: Fake | null = null;
function installFakeAudio(initial: "running" | "suspended"): Fake {
  resetNoticeAudioForTests();
  const f: Fake = { state: initial, created: 0, started: 0, blocked: false, fireState: () => {} };
  current = f;
  const node = () => ({ connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: { value: 0 }, type: "", start() { f.started++; }, stop() {} });
  class FakeAC {
    onstatechange: (() => void) | null = null;
    currentTime = 0; destination = {};
    constructor() { f.created++; f.fireState = () => this.onstatechange?.(); }
    get state() { return f.state; }
    resume() { if (f.blocked) return Promise.reject(new Error("NotAllowedError")); f.state = "running"; f.fireState(); return Promise.resolve(); }
    createGain() { return node(); }
    createOscillator() { return node(); }
  }
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = FakeAC;
  return f;
}
const doc = globalThis as unknown as { document?: { visibilityState: string } };
const setVisibility = (v: "visible" | "hidden") => { doc.document = { visibilityState: v }; };
const nextNow = (() => { let t = 1_000_000; return () => (t += 10_000); })();
const tick = () => new Promise(r => setTimeout(r, 0));

test("Phát: chưa có thao tác người dùng (chưa unlock) → im lặng, không lỗi", () => {
  writeSoundEnabled(true, null);
  setVisibility("visible");
  installFakeAudio("suspended");
  assert.equal(playNoticePing(nextNow()), false);
});

test("Phát: sau unlock → một tiếng (2 nốt); phát chồng trong 1,5 s bị chặn; chỉ MỘT AudioContext", async () => {
  const f = installFakeAudio("suspended");
  unlockNoticeAudio(); await tick();
  unlockNoticeAudio(); unlockNoticeAudio(); await tick();
  assert.equal(f.created, 1, "dùng lại một AudioContext");
  const t = nextNow();
  assert.equal(playNoticePing(t), true);
  assert.equal(f.started, 2);
  assert.equal(playNoticePing(t + 200), false, "không chồng tiếng");
  assert.equal(playNoticePing(t + 2000), true);
});

test("Phát: Tắt → im lặng; Bật lại → thông báo kế tiếp kêu được", () => {
  writeSoundEnabled(false, null);
  assert.equal(getSoundEnabled(), false);
  assert.equal(playNoticePing(nextNow()), false);
  writeSoundEnabled(true, null);
  assert.equal(playNoticePing(nextNow()), true);
});

test("A1: iOS ngắt context (interrupted) → thông báo CHỜ; chạm lại → resume → kêu đúng một tiếng", async () => {
  setVisibility("visible"); writeSoundEnabled(true, null);
  const f = installFakeAudio("suspended");
  unlockNoticeAudio(); await tick();                 // lần chạm đầu: running
  const g = createNoticeSoundGate();
  g.observe(S(1, 0), NOW);
  f.state = "interrupted";                           // khoá màn hình / đổi app
  g.observe(S(2, 1), NOW);
  const t = nextNow();
  assert.equal(playPendingNotice(g, t), false, "context bị ngắt → chưa kêu");
  assert.equal(g.hasPending(NOW), true, "nhưng KHÔNG bị tiêu thụ");
  const before = f.started;
  const off = onNoticeAudioReady(() => { playPendingNotice(g, t + 20_000); });
  unlockNoticeAudio(); await tick();                 // người dùng chạm lại (listener liên tục)
  off();
  assert.equal(f.state, "running");
  assert.equal(f.started - before, 2, "đúng một tiếng sau khi resume");
  assert.equal(g.hasPending(NOW), false);
});

test("A1: resume bị trình duyệt từ chối → không ném lỗi, vẫn chờ, lần chạm sau thử lại", async () => {
  setVisibility("visible"); writeSoundEnabled(true, null);
  const f = installFakeAudio("suspended");
  unlockNoticeAudio(); await tick();
  f.state = "suspended"; f.blocked = true;
  const g = createNoticeSoundGate(); g.observe(S(1, 0), NOW); g.observe(S(2, 1), NOW);
  assert.doesNotThrow(() => { unlockNoticeAudio(); tryResumeNoticeAudio(); });
  await tick();
  assert.equal(playPendingNotice(g, nextNow()), false);
  assert.equal(g.hasPending(NOW), true);
  f.blocked = false;
  unlockNoticeAudio(); await tick();
  assert.equal(f.state, "running");
});

test("A2: tab ẩn khi phát hiện → chờ; quay lại tab → kêu đúng một lần; lần sau không kêu lại", async () => {
  writeSoundEnabled(true, null);
  const f = installFakeAudio("suspended");
  setVisibility("visible");
  unlockNoticeAudio(); await tick();
  const g = createNoticeSoundGate(); g.observe(S(1, 0), NOW); g.observe(S(2, 1), NOW);
  setVisibility("hidden");
  const before = f.started;
  assert.equal(playPendingNotice(g, nextNow()), false, "tab ẩn: không kêu, không tiêu thụ");
  assert.equal(g.hasPending(NOW), true);
  setVisibility("visible");
  assert.equal(playPendingNotice(g, nextNow()), true);
  assert.equal(f.started - before, 2);
  assert.equal(playPendingNotice(g, nextNow()), false, "không kêu lại");
});

test("Tắt âm thanh khi đang chờ → bỏ chờ; Bật lại không phát bù", async () => {
  setVisibility("visible"); writeSoundEnabled(true, null);
  const f = installFakeAudio("suspended");
  unlockNoticeAudio(); await tick();
  f.state = "interrupted";
  const g = createNoticeSoundGate(); g.observe(S(1, 0), NOW); g.observe(S(2, 1), NOW);
  writeSoundEnabled(false, null);
  assert.equal(playPendingNotice(g, nextNow()), false);
  assert.equal(g.hasPending(NOW), false, "không giữ chờ khi đã Tắt");
  writeSoundEnabled(true, null);
  f.state = "running";
  assert.equal(playPendingNotice(g, nextNow()), false, "bật lại: không phát bù");
  g.observe(S(3, 1), NOW);
  assert.equal(playPendingNotice(g, nextNow()), true, "thông báo mới tiếp theo kêu được");
});

test("Phát: trình duyệt chặn autoplay / không có AudioContext / ném lỗi → không ném, trả false", () => {
  setVisibility("visible");
  (globalThis as unknown as { AudioContext?: unknown }).AudioContext = class { constructor() { throw new Error("blocked"); } };
  assert.doesNotThrow(() => unlockNoticeAudio());
  assert.doesNotThrow(() => playNoticePing(nextNow()));
  delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
  assert.doesNotThrow(() => unlockNoticeAudio());
});

test("Tuỳ chọn: mặc định BẬT; 'off' → tắt; bộ nhớ hỏng/ném lỗi vẫn không vỡ", () => {
  const mem = new Map<string, string>();
  const s = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  assert.equal(readSoundEnabled(s), true);
  writeSoundEnabled(false, s);
  assert.equal(mem.get(SOUND_KEY), "off");
  assert.equal(readSoundEnabled(s), false);
  writeSoundEnabled(true, s);
  assert.equal(readSoundEnabled(s), true);
  const bad = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
  assert.equal(readSoundEnabled(bad), true);
  assert.doesNotThrow(() => writeSoundEnabled(false, bad));
});

test("Rào chắn phạm vi: không Service Worker/Web Push/WebSocket/mạng mới; hook chỉ dùng tóm tắt sẵn có; công tắc có role=switch", () => {
  const snd = code("src/class-social/chat/noticeSound.ts");
  for (const bad of ["serviceWorker", "PushManager", "Notification", "WebSocket", "fetch(", "supabase", "rpc("]) assert.ok(!snd.includes(bad), `noticeSound không được chứa ${bad}`);
  const hook = code("src/class-social/chat/useChat.ts");
  assert.match(hook, /gate\.current\.observe\(system\)/);
  assert.match(hook, /playPendingNotice/);
  assert.ok(!/removeEventListener\(e, on, true\)\s*if \(ctx/.test(snd), "listener mở khoá không được gỡ sau lần đầu");
  const ui = code("src/class-social/sections/Chat.tsx");
  assert.match(ui, /role="switch"/);
  assert.match(ui, /Âm thanh thông báo/);
});

test("Bố cục Chat: hàng Class 2.0 không ăn flex:1 của .cs-chat-items; mobile danh sách cao theo nội dung (không cắt hàng cuối)", () => {
  const css = read("src/class-social/classSocial.css");
  const sys = css.match(/\.cs-chat-items-system\s*\{([^}]*)\}/);
  assert.ok(sys, "có rule .cs-chat-items-system");
  assert.match(sys![1], /flex:\s*none/);
  assert.match(sys![1], /overflow:\s*visible/);
  const mobile = css.match(/@media \(max-width: 1023px\)[\s\S]*?\.cs-chat-items\s*\{([^}]*)\}/);
  assert.ok(mobile, "có rule .cs-chat-items trong media mobile");
  assert.match(mobile![1], /flex:\s*none/);
  assert.match(mobile![1], /overflow:\s*visible/);
});
