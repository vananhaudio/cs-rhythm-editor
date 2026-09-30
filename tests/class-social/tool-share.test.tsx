// Tool Share V1 — registry (payload → hiển thị), deep link BPM, phiên luyện tập đo thật, card Feed, Metronome chỉ chia sẻ khi có onShareSession.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describeToolShare, formatPracticeDuration, parseMetronomeTempo } from "../../src/class-social/toolshare/registry";
import { ToolShareBodyView } from "../../src/class-social/toolshare/ToolShareCard";
import { changeSessionBpm, endSession, startSession } from "../../src/lib/practiceSession";
import { toFeedPost, POST_TYPE_LABEL } from "../../src/class-social/posts/postModel";

void React;
const ok = { v: 1, tool: "metronome", kind: "practice_session", bpm: 80, seconds: 600, client_key: "k" };

test("registry: payload Metronome hợp lệ → tiêu đề, ghi chú, CTA deep link", () => {
  const v = describeToolShare(ok)!;
  assert.equal(v.toolLabel, "Metronome");
  assert.equal(v.headline, "80 BPM · 10 phút");
  assert.equal(v.note, "Hoàn thành một phiên luyện tập");
  assert.deepEqual(v.action, { label: "Thử ở 80 BPM", href: "/metronome?tempo=80" });
});

test("registry: payload hỏng / công cụ lạ / ngoài dải → null (không crash, không bịa)", () => {
  for (const bad of [null, undefined, "x", [1], {}, { ...ok, v: 0 }, { ...ok, tool: "bms" }, { ...ok, tool: "toString" },
    { ...ok, tool: "__proto__" }, { ...ok, kind: "award" }, { ...ok, bpm: 999 }, { ...ok, bpm: 29 }, { ...ok, bpm: "80" },
    { ...ok, bpm: 80.5 }, { ...ok, seconds: 30 }, { ...ok, seconds: null }]) {
    assert.equal(describeToolShare(bad), null, JSON.stringify(bad));
  }
});

test("thời lượng chỉ từ số giây đo thật", () => {
  assert.equal(formatPracticeDuration(60), "1 phút");
  assert.equal(formatPracticeDuration(659), "10 phút");
  assert.equal(formatPracticeDuration(3600), "1 giờ");
  assert.equal(formatPracticeDuration(3900), "1 giờ 5 phút");
});

test("deep link ?tempo=: chỉ số nguyên trong 30–260", () => {
  assert.equal(parseMetronomeTempo("?tempo=80"), 80);
  assert.equal(parseMetronomeTempo("?x=1&tempo=260"), 260);
  for (const s of ["", "?tempo=", "?tempo=29", "?tempo=261", "?tempo=80abc", "?tempo=-80", "?tempo=8e1", "?tempo=1000", "?tempo=%3Cscript%3E"]) {
    assert.equal(parseMetronomeTempo(s), null, s);
  }
});

test("phiên luyện tập: tổng thời gian chạy + BPM dùng lâu nhất", () => {
  let s = startSession(0, 80);
  s = changeSessionBpm(s, 400_000, 100);     // 80 BPM: 400s
  s = changeSessionBpm(s, 500_000, 80);      // 100 BPM: 100s
  const r = endSession(s, 700_000);          // 80 BPM: +200s
  assert.deepEqual(r, { seconds: 700, bpm: 80 });
  assert.equal(changeSessionBpm(s, 1, 80), s, "BPM không đổi → cùng phiên");
  assert.deepEqual(endSession(startSession(1000, 120), 1000 + 59_999), { seconds: 59, bpm: 120 });
});

test("card Feed: hiện công cụ + kết quả + CTA; không JSON / tool id / client_key", () => {
  const h = renderToStaticMarkup(<ToolShareBodyView view={describeToolShare(ok)} />);
  assert.match(h, /Metronome · Luyện tập/);
  assert.match(h, /80 BPM · 10 phút/);
  assert.match(h, /<a class="cs-btn cs-btn-soft cs-tool-share-cta" href="\/metronome\?tempo=80">Thử ở 80 BPM<\/a>/);
  assert.ok(!/client_key|practice_session|\{|"tool"/.test(h));
  assert.match(renderToStaticMarkup(<ToolShareBodyView view={null} />), /không còn hiển thị được/);
});

test("postModel: tool_share là loại bài hợp lệ, có nhãn", () => {
  const row = { id: "p1", type: "tool_share", body: "", media_type: null, media_provider: null, media_url: null, external_media_id: null,
    created_at: "2026-09-30T00:00:00Z", updated_at: "2026-09-30T00:00:00Z", author_user_id: "u1", author_name: "A", author_avatar_url: null,
    author_role: "student", author_ht_member: false, is_mine: false };
  assert.equal(toFeedPost(row)?.type, "tool_share");
  assert.equal(POST_TYPE_LABEL.tool_share, "Kết quả công cụ");
});

test("Metronome: nút chia sẻ chỉ khi có onShareSession; route chỉ truyền khi đã đăng nhập", () => {
  const m = readFileSync("src/Metronome.tsx", "utf8");
  assert.match(m, /onShareSession && result && !playing/);
  assert.match(m, /r\.seconds >= MIN_SHARE_SECONDS/);
  const r = readFileSync("src/AppRouter.tsx", "utf8");
  assert.match(r, /onShareSession=\{user && !embedded \?/);
  for (const f of ["src/MobileStudentPortal.tsx", "src/FlowPlayer.tsx"]) {
    assert.ok(!readFileSync(f, "utf8").includes("onShareSession"), `${f}: Metronome nhúng không có chia sẻ`);
  }
});
