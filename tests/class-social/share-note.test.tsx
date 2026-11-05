/**
 * Share Note V1 ("Chia sẻ tức thì"): khoanh ô nhịp trên LessonScore → tham chiếu share_note qua Universal Share (Chat + Feed).
 * DB: db/share_note_v1_setup.sql (bash scripts/test-share-note-db.sh). Ở đây: lõi thuần + thẻ + deep link + slot.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hitTestBar, rectsForBars, toRange, rangeFits, barCount, type BoundsLike } from "../../src/lesson/scoreShare";
import { parseShareNoteOpen, barRangeText, sameScoreKey, scoreKeyId } from "../../src/share/shareNoteApi";
import { shareNoteCardView, REF_RESOLVERS } from "../../src/share/refCards";
import { SHARE_REF_TYPES, shareNoteRef, toShareRef } from "../../src/share/shareRef";
import { shareNoteHref, shareNoteIdFromSearch } from "../../src/share/shareNoteLink";
import { describeToolShare } from "../../src/class-social/toolshare/registry";
import { ShareCardView } from "../../src/class-social/chat/ShareMessageCard";
import LessonScore from "../../src/lesson/LessonScore";
import { ScoreShareSlot } from "../../src/lesson/scoreShareSlot";
void React;

const NOTE = "a1111111-0000-4000-8000-000000000001", CLS = "b1000000-0000-4000-8000-000000000001";
const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
// 2 dòng nhạc: dòng 0 = ô 0,1,2 · khe 20 px · dòng 1 = ô 3,4 (hình dạng như alphaTab 1.8.3 boundsLookup)
const R = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
const LK: BoundsLike = { staffSystems: [
  { index: 0, realBounds: R(10, 30, 600, 150), bars: [{ index: 0, realBounds: R(10, 30, 300, 150) }, { index: 1, realBounds: R(310, 30, 100, 150) }, { index: 2, realBounds: R(410, 30, 200, 150) }] },
  { index: 1, realBounds: R(10, 200, 600, 150), bars: [{ index: 3, realBounds: R(10, 200, 250, 150) }, { index: 4, realBounds: R(260, 200, 350, 150) }] },
] };

test("chạm → ô: đúng ô, biên trái thuộc ô phải; khe giữa dòng / lề / trên dòng đầu → null (không đoán)", () => {
  assert.equal(hitTestBar(LK, 15, 100), 0);
  assert.equal(hitTestBar(LK, 309.9, 100), 0);
  assert.equal(hitTestBar(LK, 310, 100), 1);
  assert.equal(hitTestBar(LK, 300, 250), 4);
  assert.equal(hitTestBar(LK, 300, 190), null);
  assert.equal(hitTestBar(LK, 5, 100), null);
  assert.equal(hitTestBar(LK, 300, 10), null);
  assert.equal(hitTestBar(null, 1, 1), null);
});

test("vùng tô: ô liên tiếp cùng dòng gộp một hình; dải qua 2 dòng → 2 hình; đếm ô", () => {
  assert.deepEqual(rectsForBars(LK, 1, 2), [{ x: 310, y: 30, w: 300, h: 150, first: 1, last: 2 }]);
  assert.deepEqual(rectsForBars(LK, 2, 3).map(r => [r.first, r.last]), [[2, 2], [3, 3]]);
  assert.equal(barCount(LK), 5);
});

test("dải chọn: đổi sang đánh số từ 1, kéo ngược vẫn đúng, tối đa 64 ô; kiểm dải còn nằm trong bản nhạc", () => {
  assert.deepEqual(toRange(4, 1), { from: 2, to: 5 });
  assert.deepEqual(toRange(0, 200), { from: 1, to: 64 });
  assert.equal(rangeFits(2, 3, 5), true);
  assert.equal(rangeFits(5, 6, 5), false);
  assert.equal(rangeFits(0, 1, 5), false);
  assert.equal(barRangeText({ from: 3, to: 3 }), "Ô 3");
  assert.equal(barRangeText({ from: 3, to: 5 }), "Ô 3–5");
});

test("khoá bản nhạc: so sánh theo khối + đường dẫn", () => {
  assert.equal(scoreKeyId({ section: 6, path: ["pieces", "1", "tex"] }), "6:pieces.1.tex");
  assert.equal(sameScoreKey({ section: 5, path: ["tex"] }, { section: 5, path: ["tex"] }), true);
  assert.equal(sameScoreKey({ section: 5, path: ["tex"] }, { section: 6, path: ["tex"] }), false);
  assert.equal(sameScoreKey(null, { section: 5, path: ["tex"] }), false);
});

test("mở: ok trả khối/đường dẫn/ô; stale & no_access KHÔNG có vị trí; dữ liệu lạ → không khả dụng", () => {
  const base = { note: "Thầy ơi", author_id: "x", is_author: false, class_id: CLS, session_no: 1, created_at: "t" };
  const ok = parseShareNoteOpen([{ ...base, status: "ok", section_idx: 5, score_path: ["tex"], bar_from: 2, bar_to: 3 }]);
  assert.equal(ok.status, "ok");
  assert.ok(ok.status === "ok" && ok.score.section === 5 && ok.bars.from === 2 && ok.bars.to === 3);
  const st = parseShareNoteOpen([{ ...base, status: "stale", section_idx: null, score_path: null, bar_from: null, bar_to: null }]);
  assert.equal(st.status, "stale");
  assert.equal("bars" in st, false);
  assert.equal(parseShareNoteOpen([{ ...base, status: "no_access" }]).status, "no_access");
  assert.equal(parseShareNoteOpen([]).status, "unavailable");
  assert.equal(parseShareNoteOpen([{ ...base, status: "ok", section_idx: 5, score_path: ["blocks", "0", "tex"], bar_from: 1, bar_to: 1 }]).status, "unavailable");
  assert.equal(parseShareNoteOpen([{ ...base, status: "weird" }]).status, "unavailable");
});

test("tham chiếu share_note: loại hợp lệ, chữ thường, có resolver Chat", () => {
  assert.ok((SHARE_REF_TYPES as readonly string[]).includes("share_note"));
  assert.deepEqual(toShareRef("share_note", NOTE.toUpperCase()), { type: "share_note", key: NOTE });
  assert.deepEqual(shareNoteRef(NOTE.toUpperCase()), { type: "share_note", key: NOTE });
  assert.equal(typeof REF_RESOLVERS.share_note, "function");
});

test("deep link: /me/classes/<lớp>/sessions/<buổi>?note=<id>; tham số lạ bị bỏ", () => {
  const href = shareNoteHref(CLS, 4, NOTE.toUpperCase());
  assert.equal(href, `/me/classes/${CLS}/sessions/4?note=${NOTE}`);
  assert.equal(shareNoteIdFromSearch(`?note=${NOTE}`), NOTE);
  assert.equal(shareNoteIdFromSearch("?note=1;drop"), null);
  assert.equal(shareNoteIdFromSearch(""), null);
});

test("thẻ Chat: lời nhắn + Buổi + Ô; mở đúng đoạn bằng deep link; dữ liệu hỏng → không khả dụng", () => {
  const v = shareNoteCardView({ id: NOTE, note: "Thầy ơi ô 2–3", class_id: CLS, session_no: 1, bar_from: 2, bar_to: 3 });
  assert.ok(v);
  assert.equal(v!.headline, "Thầy ơi ô 2–3");
  assert.equal(v!.detail, "Ô 2–3");
  assert.equal(v!.kindLabel, "Buổi 1");
  assert.equal(v!.action!.href, `/me/classes/${CLS}/sessions/1?note=${NOTE}`);
  const html = renderToStaticMarkup(<ShareCardView view={v} />);
  assert.match(html, /Mở trong giáo trình/);
  assert.doesNotMatch(html, /share_note/);
  assert.equal(shareNoteCardView({ id: NOTE, note: "  ", class_id: CLS, session_no: 1, bar_from: 1, bar_to: 1 }), null);
  assert.equal(shareNoteCardView({ id: NOTE, note: "x", class_id: CLS, session_no: 1, bar_from: 3, bar_to: 2 }), null);
  assert.equal(shareNoteCardView(null), null);
});

test("thẻ Feed (registry tool_share): payload chỉ tham chiếu; không chuyển tiếp; payload hỏng → null", () => {
  const raw = { v: 1, tool: "share_note", kind: "share_note", note_id: NOTE, class_id: CLS, note: "Ô này bấm sao?", session_no: 4, bar_from: 5, bar_to: 6 };
  const v = describeToolShare(raw);
  assert.ok(v);
  assert.equal(v!.action!.href, `/me/classes/${CLS}/sessions/4?note=${NOTE}`);
  assert.equal(v!.detail, "Ô 5–6");
  assert.equal(v!.shareRef, null);
  assert.equal(describeToolShare({ ...raw, note_id: "x" }), null);
  assert.equal(describeToolShare({ ...raw, note: "" }), null);
  assert.equal(describeToolShare({ ...raw, bar_from: 0 }), null);
  assert.equal(describeToolShare({ ...raw, class_id: "javascript:alert(1)" }), null);
});

test("LessonScore: KHÔNG có lớp khoanh khi trang không cấp slot (trang công khai / in / Admin); có slot → nút Khoanh để hỏi", () => {
  // LessonScore đọc location.pathname lúc render (khoá nhớ vị trí đọc của ZoomFrame) — Node không có location
  (globalThis as { location?: unknown }).location ??= { pathname: "/me/classes/x/sessions/1", search: "" };
  const plain = renderToStaticMarkup(<LessonScore tex={"\\ts 4 4\n:4 c4 c4 c4 c4"} shareKey={{ section: 0, path: ["tex"] }} />);
  assert.doesNotMatch(plain, /lsn-share/);
  const noKey = renderToStaticMarkup(<ScoreShareSlot.Provider value={{ onAsk: () => {}, focus: null }}><LessonScore tex={"\\ts 4 4\n:4 c4"} /></ScoreShareSlot.Provider>);
  assert.doesNotMatch(noKey, /lsn-share/);
  const withSlot = renderToStaticMarkup(<ScoreShareSlot.Provider value={{ onAsk: () => {}, focus: null }}><LessonScore tex={"\\ts 4 4\n:4 c4"} shareKey={{ section: 0, path: ["tex"] }} /></ScoreShareSlot.Provider>);
  assert.match(withSlot, /Khoanh để hỏi/);
  assert.match(withSlot, /lsn-share-overlay no-print/);
  assert.doesNotMatch(withSlot, /lsn-share-overlay no-print is-on/);   // mặc định TẮT: không chặn cuộn/chụm phóng
});

test("LessonDocument truyền vị trí bản nhạc ở đủ 3 chỗ dựng LessonScore; trang Buổi cấp slot; rls_setup giữ share_notes đóng", () => {
  const doc = read("src/lesson/LessonDocument.tsx");
  assert.match(doc, /shareKey=\{\{ section: i, path: \['tex'\] \}\}/);
  assert.match(doc, /shareKey=\{\{ section: i, path: \['layers', String\(k\), 'tex'\] \}\}/);
  assert.match(doc, /shareKey=\{\{ section: i, path: \['pieces', String\(k\), 'tex'\] \}\}/);
  assert.match(read("src/class-social/classes/ClassSessionPage.tsx"), /ScoreShareSlot\.Provider/);
  assert.match(read("db/rls_setup.sql"), /'share_notes'/);
});
