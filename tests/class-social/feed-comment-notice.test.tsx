/**
 * Feed Comment Notify V2 (frontend): thông báo bình luận trên bài Social / bài TeamLab / bài trả có nhãn "Bình luận" + nút "Xem bình luận",
 * ref_type mới được nhận, điều hướng đúng (thread → bài trả; post/teamlab_publication → Feed), thông báo cũ không đổi.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { noticeAction, noticeVariant, toSystemNotices, type SystemNotice, type SystemNoticeRow } from "../../src/class-social/chat/chatModel";
import { Notice } from "../../src/class-social/chat/SystemNoticeItem";

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const ID = (n: number) => `0000000${n}-0000-4000-8000-000000000000`;
const row = (seq: number, ref_type: string | null, ref_key: string | null, kind = "feed_comment"): SystemNoticeRow =>
  ({ seq, kind, body: "Có bình luận mới trên bài của bạn.", ref_type, ref_key, created_at: "2026-10-30T10:00:00Z", unread: true });

test("toSystemNotices: nhận thread, post, teamlab_publication; bỏ ref lạ / key sai dạng", () => {
  const out = toSystemNotices([row(1, "thread", ID(1)), row(2, "post", ID(2)), row(3, "teamlab_publication", ID(3)), row(4, "bogus", ID(4)), row(5, "post", "not-a-uuid"), row(6, null, null), row(7, "post", ID(7), "checkpoint_graded")]);
  assert.deepEqual(out.map(n => [n.seq, n.refType]), [[1, "thread"], [2, "post"], [3, "teamlab_publication"]]);
  assert.equal(out[1].threadId, ID(2));
});

test("Nhãn + nút: feed_comment = Bình luận / Xem bình luận; loại cũ không đổi", () => {
  assert.deepEqual(noticeVariant("feed_comment", "x"), { tone: "comment", chip: "Bình luận" });
  assert.equal(noticeAction("feed_comment").label, "Xem bình luận");
  assert.deepEqual(noticeVariant("teacher_commented", "x"), { tone: "comment", chip: "Nhận xét" });
  assert.equal(noticeAction("teacher_commented").label, "Xem nhận xét");
  assert.equal(noticeVariant("checkpoint_graded", "ĐẠT").chip, "ĐẠT");
  assert.equal(noticeVariant("submission_received", "nộp lại").chip, "Nộp lại");
});

test("Hiển thị: hàng thông báo bình luận bài Social/TeamLab có nhãn và nút", () => {
  for (const refType of ["post", "teamlab_publication"] as const) {
    const n: SystemNotice = { seq: 9, kind: "feed_comment", body: "Có bình luận mới trên bài của bạn.", threadId: ID(9), refType, at: "2026-10-30T10:00:00Z", unread: true };
    const html = renderToStaticMarkup(<Notice n={n} onOpen={() => undefined} />);
    assert.match(html, /Bình luận/);
    assert.match(html, /Xem bình luận/);
    assert.match(html, /Chưa đọc/);
  }
});

test("Điều hướng: thread → onOpenThread; post/teamlab_publication → onOpenFeed (không mở trang bài trả); đánh dấu đã đọc trước", () => {
  const src = read("src/class-social/chat/SystemNoticeView.tsx");
  assert.match(src, /s\.markRead\(n\.seq\); if \(\(n\.refType \?\? 'thread'\) === 'thread'\) onOpenThread\(n\.threadId, noticeAction\(n\.kind\)\.search\); else onOpenFeed\?\.\(\)/);
  assert.match(read("src/class-mobile/MobileShell.tsx"), /<NoticesPage.*onOpenFeed=\{\(\) => selectTabAndScroll\('home'\)\}/);
  assert.match(read("src/class-social/sections/Notices.tsx"), /onOpenFeed=\{onClose\}/);
  assert.match(read("src/class-social/ClassSocialLayout.tsx"), /onOpenFeed=\{\(\) => onSection\('home'\)\}/);
});

test("Phạm vi: không RPC/mạng/bảng mới ở frontend; không Push", () => {
  const model = read("src/class-social/chat/chatModel.ts") + read("src/class-social/chat/SystemNoticeView.tsx");
  assert.doesNotMatch(model, /Notification\.requestPermission|serviceWorker|PushManager|WebSocket/);
  assert.doesNotMatch(read("src/class-social/chat/SystemNoticeView.tsx"), /\.rpc\(|supabase/);
});
