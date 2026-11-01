import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  entryKey, isLessonClipEntry, isPostEntry, isPublicationEntry, isThreadEntry, toFeedEntries, toLessonClipEntry, type MixedRow,
} from "../../src/class-social/posts/postModel";
import FeedEntryCard from "../../src/class-social/sections/FeedEntryCard";
import LessonClipCard from "../../src/class-social/sections/LessonClipCard";
void React;

// ID giả — KHÔNG phải video / lớp thật.
const CLASS = "b1000000-0000-4000-8000-000000000001";
const KEY = "c:51000000-0000-4000-8000-000000000002:0a5af6d47d";
const NOW = new Date("2026-11-01T10:00:00Z");
const payload = (over: Record<string, unknown> = {}) => ({
  session_id: "51000000-0000-4000-8000-000000000002", class_id: CLASS, class_code: "SOLO01.TH01", class_name: "Solo Guitar Căn Bản",
  session_no: 6, title: "Ôn nhanh · Bản độc tấu", duration: "2:07", added_at: "2026-11-01T09:00:00.000Z", ...over,
});
const row = (post: unknown, over: Partial<MixedRow> = {}): MixedRow => ({ kind: "lesson_clip", sort_at: "2026-11-01T09:00:00Z", sort_key: KEY, post, thread: null, ...over });

test("toFeedEntries: lesson_clip → một thẻ; khoá keyset khớp sort_key; không bị coi là bài Social / thread / publication", () => {
  const e = toFeedEntries([row(payload())]);
  assert.equal(e.length, 1);
  const c = e[0];
  assert.ok(isLessonClipEntry(c));
  assert.equal(isPostEntry(c), false, "không nạp bình luận bài Social");
  assert.equal(isThreadEntry(c), false);
  assert.equal(isPublicationEntry(c), false);
  assert.equal(entryKey(c), KEY, "phân trang tiếp bằng đúng sort_key của server");
  assert.equal(c.createdAt, "2026-11-01T09:00:00Z", "mốc phân trang = sort_at của server");
});

test("giữ thứ tự server khi trộn với loại khác; loại lạ vẫn bị bỏ", () => {
  const rows: MixedRow[] = [
    { kind: "khac", sort_at: "2026-11-01T11:00:00Z", sort_key: "x:1", post: payload(), thread: null },
    row(payload({ title: "Một" })),
    row(payload({ title: "Hai" }), { sort_key: "c:51000000-0000-4000-8000-000000000002:ffffffffff", sort_at: "2026-10-31T09:00:00Z" }),
  ];
  const e = toFeedEntries(rows);
  assert.deepEqual(e.map(x => isLessonClipEntry(x) ? x.title : "?"), ["Một", "Hai"]);
});

test("toLessonClipEntry: payload hoặc khoá hỏng → null (không vỡ Feed)", () => {
  assert.equal(toLessonClipEntry(null, "t", KEY), null);
  assert.equal(toLessonClipEntry("x", "t", KEY), null);
  assert.equal(toLessonClipEntry(payload(), "t", "p:" + KEY.slice(2)), null, "sai tiền tố");
  assert.equal(toLessonClipEntry(payload(), "t", "c:not-a-key"), null, "khoá sai dạng");
  assert.equal(toLessonClipEntry(payload(), "t", KEY + "x"), null);
  assert.equal(toLessonClipEntry(payload({ class_id: "zz" }), "t", KEY), null);
  assert.equal(toLessonClipEntry(payload({ session_no: 0 }), "t", KEY), null);
  assert.equal(toLessonClipEntry(payload({ session_no: 1.5 }), "t", KEY), null);
  assert.equal(toLessonClipEntry(payload({ session_no: "6" }), "t", KEY), null);
  assert.equal(toLessonClipEntry(payload({ title: "  " }), "t", KEY), null);
  assert.equal(toLessonClipEntry(payload({ title: 5 }), "t", KEY), null);
  const ok = toLessonClipEntry(payload({ duration: "", class_name: "", class_code: "" }), "t", KEY)!;
  assert.equal(ok.duration, null);
  assert.equal(ok.className, "Lớp học", "thiếu tên lớp → nhãn mặc định");
});

test("thẻ: chỉ tham chiếu buổi học — liên kết /me/classes/<lớp>/sessions/<buổi>; KHÔNG URL, KHÔNG video id, KHÔNG iframe", () => {
  const e = toLessonClipEntry(payload(), "2026-11-01T09:00:00Z", KEY)!;
  const html = renderToStaticMarkup(<FeedEntryCard entry={e} now={NOW} />);
  assert.match(html, /Ôn nhanh · 2:07/);
  assert.match(html, /Ôn nhanh · Bản độc tấu/);
  assert.match(html, /Solo Guitar Căn Bản/);
  assert.match(html, new RegExp(`href="/me/classes/${CLASS}/sessions/6"[^>]*>Xem clip<`));
  assert.doesNotMatch(html, /youtu|https?:|iframe|<video|v=/i);
});

test("thẻ KHÔNG hiển thị gì ngoài trường tham chiếu: payload cố nhét url/note/video_id vẫn không lọt ra HTML", () => {
  const hostile = payload({ url: "https://youtu.be/ZZfakeVID01", note: "NOTE_SENTINEL", video_id: "ZZfakeVID01", blocks: [{ kind: "video", url: "https://youtu.be/ZZfakeVID01" }] });
  const e = toLessonClipEntry(hostile, "2026-11-01T09:00:00Z", KEY)!;
  assert.deepEqual(Object.keys(e).sort(), ["className", "classCode", "classId", "createdAt", "duration", "entry", "id", "sessionNo", "title"].sort(),
    "thẻ chỉ giữ trường tham chiếu đã chọn");
  const html = renderToStaticMarkup(<LessonClipCard entry={e} now={NOW} />);
  assert.doesNotMatch(html, /ZZfake|NOTE_SENTINEL|youtu|https?:/i);
});

test("thẻ: không có Thích / Bình luận / Báo cáo (nội dung của Thầy, không UGC)", () => {
  const e = toLessonClipEntry(payload(), "2026-11-01T09:00:00Z", KEY)!;
  const html = renderToStaticMarkup(<FeedEntryCard entry={e} now={NOW} />);
  assert.doesNotMatch(html, /Thích|Bình luận|Báo cáo|like|comment/i);
});

test("thẻ: tiêu đề chứa HTML bị escape (không chèn mã)", () => {
  const e = toLessonClipEntry(payload({ title: "<img src=x onerror=alert(1)>" }), "2026-11-01T09:00:00Z", KEY)!;
  const html = renderToStaticMarkup(<LessonClipCard entry={e} now={NOW} />);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});
