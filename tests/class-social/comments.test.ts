/**
 * Bình luận / nhận xét của Thầy — model thuần + adapter Kho.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTagName, findTag, parseTimecode, formatTimecode, khoVideoHref, toComment, groupByPost, totalsByPost,
  toResourcePayload, checkCommentBody, MAX_COMMENT, type CommentRow,
} from "../../src/class-social/comments/commentModel.ts";
import { parseCatalog, parseCourseVideos, filterByTitle, foldVi } from "../../src/class-social/comments/khoAdapter.ts";

test("Tag: chuẩn hoá tên (bỏ #, CamelCase, tiếng Việt), rỗng/quá dài → null", () => {
  assert.equal(normalizeTagName("nhịp"), "Nhịp");
  assert.equal(normalizeTagName("  #Bass "), "Bass");
  assert.equal(normalizeTagName("chuyển hợp âm"), "ChuyểnHợpÂm");
  assert.equal(normalizeTagName("xếp ngón"), "XếpNgón");
  assert.equal(normalizeTagName("bolero"), "Bolero");
  assert.ok(!/[<>]/.test(normalizeTagName("<b>hòa âm</b>")!), "không còn ký tự HTML");
  assert.equal(normalizeTagName(""), null);
  assert.equal(normalizeTagName(" # , "), null);
  assert.equal(normalizeTagName("a".repeat(41)), null);
  assert.ok(!/[\s#,<>"'`]/.test(normalizeTagName('"cảm" <âm>')!));
});

test("Tag: tìm trùng không phân biệt hoa/thường (tránh tạo #nhịp khi đã có #Nhịp)", () => {
  const tags = [{ id: 1, name: "Nhịp" }, { id: 2, name: "Bass" }];
  assert.equal(findTag(tags, "nhịp")?.id, 1);
  assert.equal(findTag(tags, "NHỊP")?.id, 1);
  assert.equal(findTag(tags, "Bolero"), undefined);
});

test("Timecode: 03:42 / 3:42 / 1:02:03 / 222 → giây; sai → undefined; rỗng → null", () => {
  assert.equal(parseTimecode("03:42"), 222);
  assert.equal(parseTimecode("3:42"), 222);
  assert.equal(parseTimecode("1:02:03"), 3723);
  assert.equal(parseTimecode("222"), 222);
  assert.equal(parseTimecode(""), null);
  for (const bad of ["3:75", "abc", "1:2", "-5", "1:60:00"]) assert.equal(parseTimecode(bad), undefined, bad);
  assert.equal(formatTimecode(222), "03:42");
  assert.equal(formatTimecode(3723), "1:02:03");
});

test("Link Kho: đúng mẫu /khobaigiang/video/<id>?t=<giây> (Kho tự kiểm quyền), id lạ → null", () => {
  assert.equal(khoVideoHref({ resourceId: "wbgyiKG6big", startSeconds: 222 }), "/khobaigiang/video/wbgyiKG6big?t=222");
  assert.equal(khoVideoHref({ resourceId: "wbgyiKG6big", startSeconds: null }), "/khobaigiang/video/wbgyiKG6big");
  assert.equal(khoVideoHref({ resourceId: "../../admin", startSeconds: 1 }), null);
  assert.equal(khoVideoHref({ resourceId: "x?y=1", startSeconds: 1 }), null);
});

const row = (o: Partial<CommentRow>): CommentRow => ({
  id: "c1", post_id: "p1", parent_comment_id: null, body: "Hay quá", created_at: "2026-09-24T09:00:00Z", updated_at: "2026-09-24T09:00:00Z",
  author_user_id: "u1", author_name: "Lan Anh", author_avatar_url: null, author_role: "student", is_mine: false, is_hidden: false,
  tags: [], resources: [], post_comment_count: 1, ...o,
});

test("Bình luận: nhóm theo bài, thứ tự CŨ → MỚI; Thầy nhận diện theo author_role; tổng theo bài", () => {
  const m = groupByPost([
    row({ id: "b", created_at: "2026-09-24T09:05:00Z" }),
    row({ id: "a", created_at: "2026-09-24T09:00:00Z" }),
    row({ id: "t", created_at: "2026-09-24T09:10:00Z", author_role: "teacher", author_name: "Thầy Văn Anh" }),
    row({ id: "x", post_id: "p2" }),
  ]);
  assert.deepEqual(m.get("p1")!.map(c => c.id), ["a", "b", "t"]);
  assert.equal(m.get("p1")![2].author.isTeacher, true);
  assert.equal(m.get("p1")![0].author.isTeacher, false);
  assert.equal(totalsByPost([row({ post_comment_count: 7 }), row({ post_id: "p2", post_comment_count: 2 })]).get("p1"), 7);
});

test("Bình luận: chỉ nhận tài nguyên kho_video id hợp lệ; avatar không https bị bỏ; tên rỗng", () => {
  const c = toComment(row({
    author_name: " ", author_avatar_url: "javascript:x",
    resources: [
      { id: "r1", resource_type: "kho_video", resource_id: "wbgyiKG6big", title: "Bass Bolero", start_seconds: 222, excerpt: null },
      { id: "r2", resource_type: "evil", resource_id: "wbgyiKG6big", title: null, start_seconds: null, excerpt: null },
      { id: "r3", resource_type: "kho_video", resource_id: "../x", title: null, start_seconds: null, excerpt: null },
    ],
  }))!;
  assert.equal(c.author.name, "Thành viên Class");
  assert.equal(c.author.avatarUrl, null);
  assert.deepEqual(c.resources.map(r => r.id), ["r1"]);
});

test("Payload đính kèm: cắt tiêu đề/trích đoạn, không gửi gì ngoài tham chiếu", () => {
  const [p] = toResourcePayload([{ resourceType: "kho_video", resourceId: "wbgyiKG6big", title: "T".repeat(250), startSeconds: 222, excerpt: " " }]);
  assert.deepEqual(Object.keys(p).sort(), ["excerpt", "resource_id", "resource_type", "start_seconds", "title_snapshot"]);
  assert.equal(p.title_snapshot!.length, 200);
  assert.equal(p.excerpt, null);
});

test("Nội dung bình luận: rỗng/chỉ khoảng trắng → lỗi; quá dài → lỗi; giữ xuống dòng", () => {
  assert.equal(checkCommentBody("   ").ok, false);
  assert.equal(checkCommentBody("x".repeat(MAX_COMMENT + 1)).ok, false);
  const r = checkCommentBody("  Dòng 1\r\nDòng 2  ");
  assert.ok(r.ok && r.body === "Dòng 1\nDòng 2");
});

test("Adapter Kho: đọc catalog/khoá theo hợp đồng API, bỏ dòng hỏng; lọc không dấu", () => {
  const courses = parseCatalog({ ok: true, courses: [{ playlist_id: "PL123", title: " Đệm hát Bolero ", count: 12 }, { playlist_id: "../x", title: "hỏng" }, { title: "thiếu id" }] });
  assert.deepEqual(courses, [{ id: "PL123", title: "Đệm hát Bolero", count: 12 }]);
  const vids = parseCourseVideos({ ok: true, course: { videos: [
    { video_id: "wbgyiKG6big", title: "Cách giữ bass đúng phách trong Bolero", thumbnail_url: "https://i.ytimg.com/x.jpg", duration_sec: 600 },
    { video_id: "bad id", title: "x" },
    { video_id: "abcdefghijk", title: "Không ảnh", thumbnail_url: "http://insecure", duration_sec: "abc" },
  ] } });
  assert.deepEqual(vids.map(v => [v.id, v.thumbnailUrl, v.durationSec]), [["wbgyiKG6big", "https://i.ytimg.com/x.jpg", 600], ["abcdefghijk", null, null]]);
  assert.deepEqual(parseCatalog(null), []);
  assert.deepEqual(parseCourseVideos({ ok: false }), []);
  assert.equal(foldVi("Đệm Hát BOLERO"), "dem hat bolero");
  assert.deepEqual(filterByTitle(vids, "giu bass").map(v => v.id), ["wbgyiKG6big"]);
});
