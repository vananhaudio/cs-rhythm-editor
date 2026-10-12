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
  SOUND_KEY, createNoticeSoundGate, getSoundEnabled, playNoticePing, readSoundEnabled, unlockNoticeAudio, writeSoundEnabled,
} from "../../src/class-social/chat/noticeSound";
void React; void renderToStaticMarkup;

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const code = (f: string) => read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const S = (lastSeq: number, unread: number) => ({ lastSeq, unread });

test("Gate: lần đầu (tải trang, thông báo cũ chưa đọc) = im lặng, đặt mốc", () => {
  const g = createNoticeSoundGate();
  assert.equal(g.observe(null), false);
  assert.equal(g.observe(S(40, 3)), false);
});

test("Gate: thông báo mới kêu đúng một lần; polling lặp / dữ liệu cũ không kêu lại", () => {
  const g = createNoticeSoundGate();
  g.observe(S(5, 0));
  assert.equal(g.observe(S(6, 1)), true);
  assert.equal(g.observe(S(6, 1)), false, "polling lặp");
  assert.equal(g.observe(S(6, 1)), false);
  assert.equal(g.observe(S(5, 0)), false, "API trả lại dữ liệu cũ");
  assert.equal(g.observe(S(6, 1)), false, "mốc không bị kéo lùi");
});

test("Gate: đọc thông báo (unread→0, lastSeq giữ nguyên) không kêu; lỗi mạng (null) không đặt lại mốc", () => {
  const g = createNoticeSoundGate();
  g.observe(S(6, 2));
  assert.equal(g.observe(S(6, 0)), false);
  assert.equal(g.observe(null), false);
  assert.equal(g.observe(S(6, 0)), false, "sau lỗi, thông báo cũ không bị coi là mới");
  assert.equal(g.observe(S(7, 1)), true);
});

test("Gate: nhiều thông báo cùng đợt = MỘT tín hiệu; đã đọc ở nơi khác (unread 0) không kêu", () => {
  const g = createNoticeSoundGate();
  g.observe(S(10, 0));
  assert.equal(g.observe(S(13, 3)), true);
  assert.equal(g.observe(S(13, 3)), false);
  assert.equal(g.observe(S(14, 0)), false);
});

// ── Phát tiếng (Web Audio giả) ──
type Fake = { state: string; resume: () => Promise<void>; created: number; started: number }
function installFakeAudio(initial: "running" | "suspended" | "blocked"): Fake {
  const f: Fake = { state: initial === "running" ? "running" : "suspended", created: 0, started: 0, resume: async () => { if (initial !== "blocked") f.state = "running"; } };
  const node = () => ({ connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: { value: 0 }, type: "", start() { f.started++; }, stop() {} });
  class FakeAC {
    get state() { return f.state; }
    currentTime = 0; destination = {};
    constructor() { f.created++; }
    resume() { return f.resume(); }
    createGain() { return node(); }
    createOscillator() { return node(); }
  }
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = FakeAC;
  return f;
}
const nextNow = (() => { let t = 1_000_000; return () => (t += 10_000); })();

test("Phát: chưa có thao tác người dùng (chưa unlock) → im lặng, không lỗi", () => {
  writeSoundEnabled(true, null);
  installFakeAudio("running");
  assert.equal(playNoticePing(nextNow()), false);
});

test("Phát: sau unlock → một tiếng (2 nốt); phát chồng trong 1,5 s bị chặn", () => {
  const f = installFakeAudio("running");
  unlockNoticeAudio();
  const t = nextNow();
  assert.equal(playNoticePing(t), true);
  assert.equal(f.started, 2);
  assert.equal(playNoticePing(t + 200), false, "không chồng tiếng");
  assert.equal(playNoticePing(t + 2000), true);
});

test("Phát: Tắt → im lặng; Bật lại → thông báo kế tiếp kêu được", () => {
  installFakeAudio("running");
  unlockNoticeAudio();
  writeSoundEnabled(false, null);
  assert.equal(getSoundEnabled(), false);
  assert.equal(playNoticePing(nextNow()), false);
  writeSoundEnabled(true, null);
  assert.equal(playNoticePing(nextNow()), true);
});

test("Phát: trình duyệt chặn autoplay / không có AudioContext / ném lỗi → không ném, trả false", () => {
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
  const ui = code("src/class-social/sections/Chat.tsx");
  assert.match(ui, /role="switch"/);
  assert.match(ui, /Âm thanh thông báo/);
});
