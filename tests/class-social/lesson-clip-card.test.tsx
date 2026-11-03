import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  entryKey, isLessonClipEntry, isPostEntry, isPublicationEntry, isThreadEntry, toFeedEntries, toLessonClipEntry, type MixedRow,
} from "../../src/class-social/posts/postModel";
import FeedEntryCard from "../../src/class-social/sections/FeedEntryCard";
import LessonClipCard from "../../src/class-social/sections/LessonClipCard";
import { ClipPlayerView, clipSessionId, clipThumbUrl, pickClipVideo, type ClipState } from "../../src/class-social/sections/LessonClipPlayer";
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

test("thẻ: nút 'Xem clip' là NÚT mở trình phát tại Feed; liên kết phụ 'Xem bài học' → /me/classes/<lớp>/sessions/<buổi>; KHÔNG URL, KHÔNG video id, KHÔNG iframe trong thẻ", () => {
  const e = toLessonClipEntry(payload(), "2026-11-01T09:00:00Z", KEY)!;
  const html = renderToStaticMarkup(<FeedEntryCard entry={e} now={NOW} />);
  assert.match(html, /Ôn nhanh · 2:07/);
  assert.match(html, /Ôn nhanh · Bản độc tấu/);
  assert.match(html, /Solo Guitar Căn Bản/);
  assert.match(html, /<button[^>]*type="button"[^>]*cs-clip-open[^>]*>Xem clip<\/button>/, "Xem clip là nút, không chuyển trang");
  assert.doesNotMatch(html, /<a[^>]*>Xem clip</, "không còn liên kết điều hướng ở nút Xem clip");
  assert.match(html, new RegExp(`<a[^>]*href="/me/classes/${CLASS}/sessions/6"[^>]*>Xem bài học<`));
  assert.doesNotMatch(html, /youtu|https?:|iframe|<video|v=/i);
  assert.doesNotMatch(html, /role="dialog"/, "chưa bấm thì chưa có hộp phát");
  assert.match(html, /<button[^>]*class="cs-clip-thumb"[^>]*aria-hidden="true"/, "khung ảnh bìa 16:9 là nút mở hộp phát, ẩn khỏi trình đọc/Tab (đã có nút Xem clip)");
  assert.match(html, /cs-clip-play/, "có nút Play nổi bật");
  assert.match(html, /<span class="cs-clip-dur">2:07<\/span>/, "thời lượng trên ảnh bìa");
  assert.doesNotMatch(html, /<img|ytimg/, "ảnh bìa chỉ dựng SAU khi đọc giáo trình theo quyền người xem — không có trong thẻ ban đầu");
});

test("clipThumbUrl: dựng ảnh bìa từ mọi dạng link YouTube; link lạ/rỗng → null (thẻ dùng nền mặc định)", () => {
  assert.equal(clipThumbUrl("https://youtu.be/ZZfakeUT001"), "https://i.ytimg.com/vi/ZZfakeUT001/hqdefault.jpg");
  assert.equal(clipThumbUrl("https://www.youtube.com/watch?v=ZZfakeUT001&t=3"), "https://i.ytimg.com/vi/ZZfakeUT001/hqdefault.jpg");
  assert.equal(clipThumbUrl("https://example.com/x.mp4"), null);
  assert.equal(clipThumbUrl(""), null);
  assert.equal(clipThumbUrl(null), null);
});

const sec = (over: Record<string, unknown>) => ({ kind: "video", title: "Ôn nhanh · Bản độc tấu", url: "https://youtu.be/ZZfakeUT001", duration: "2:07", ...over }) as never;

test("pickClipVideo: khớp tiêu đề; trùng tiêu đề → ưu tiên cùng thời lượng; khác/thiếu → null; bỏ khối không phải video", () => {
  const study = { kind: "study", title: "Ôn nhanh · Bản độc tấu", blocks: [] } as never;
  assert.equal(pickClipVideo([study, sec({})], "Ôn nhanh · Bản độc tấu", "2:07")?.url, "https://youtu.be/ZZfakeUT001");
  assert.equal(pickClipVideo([sec({ url: "https://youtu.be/ZZfakeUT002", duration: "9:99" }), sec({})], "Ôn nhanh · Bản độc tấu", "2:07")?.url, "https://youtu.be/ZZfakeUT001");
  assert.equal(pickClipVideo([sec({ title: "  Ôn nhanh · Bản độc tấu " })], "Ôn nhanh · Bản độc tấu", null)?.url, "https://youtu.be/ZZfakeUT001", "cắt khoảng trắng như payload");
  assert.equal(pickClipVideo([sec({ title: "Khác" })], "Ôn nhanh · Bản độc tấu", "2:07"), null);
  assert.equal(pickClipVideo([sec({ url: "" })], "Ôn nhanh · Bản độc tấu", "2:07"), null, "khối thiếu url");
  assert.equal(pickClipVideo([], "x", null), null);
});

test("clipSessionId: lấy session_id từ id thẻ", () => {
  const e = toLessonClipEntry(payload(), "t", KEY)!;
  assert.equal(clipSessionId(e), "51000000-0000-4000-8000-000000000002");
});

test("ClipPlayerView: hộp thoại có nhãn, nút Đóng, liên kết 'Xem bài học'; mỗi trạng thái đúng nội dung; chỉ 'ready' mới có iframe", () => {
  const e = toLessonClipEntry(payload(), "2026-11-01T09:00:00Z", KEY)!;
  const v = (state: ClipState) => renderToStaticMarkup(<ClipPlayerView entry={e} state={state} onClose={() => {}} titleId="t1" />);
  const loading = v({ status: "loading" });
  assert.match(loading, /role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="t1"/);
  assert.match(loading, /Đang mở video/);
  assert.match(loading, />Đóng</);
  assert.match(loading, new RegExp(`href="/me/classes/${CLASS}/sessions/6"[^>]*>Xem bài học<`));
  assert.doesNotMatch(loading, /iframe/);
  const ready = v({ status: "ready", url: "https://youtu.be/ZZfakeUT001" });
  assert.match(ready, /<iframe[^>]*youtube\.com\/embed\/ZZfakeUT001/);
  assert.doesNotMatch(ready, /target="_blank"|<a[^>]*youtu/, "không mở YouTube bên ngoài");
  assert.match(v({ status: "missing" }), /không còn trong giáo trình hoặc bạn chưa có quyền/);
  assert.doesNotMatch(v({ status: "missing" }), /iframe/);
  assert.match(v({ status: "error" }), /role="alert"/);
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
