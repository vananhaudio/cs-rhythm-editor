// C1.5 — Thông báo kiểu Facebook: hàng gọn, phân biệt loại, popover desktop (đóng/mở), trang đầy đủ, Mobile toàn trang.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { noticeVariant, relativeTime, type SystemNotice } from "../../src/class-social/chat/chatModel";
import { Notice } from "../../src/class-social/chat/SystemNoticeItem";
import { isOutsidePopover, popoverEnabled, NOTICES_POPOVER_MIN_WIDTH } from "../../src/class-social/noticesPopoverLogic";

const code = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const TID = "11111111-2222-3333-4444-555555555555";
const mk = (kind: string, body: string, unread = true, at = "2026-10-17T10:00:00Z"): SystemNotice => ({ seq: 1, kind, body, threadId: TID, at, unread });

test("Phân biệt rõ: nộp bài · nộp lại (học viên) · nhận xét · ĐẠT · NỘP LẠI (Thầy yêu cầu) · đã chấm", () => {
  assert.deepEqual(noticeVariant("submission_received", "Học viên vừa nộp bài Buổi 02."), { tone: "submit", chip: "Nộp bài" });
  assert.deepEqual(noticeVariant("submission_received", "Học viên vừa nộp lại bài Buổi 02."), { tone: "resubmit", chip: "Nộp lại" });
  assert.deepEqual(noticeVariant("teacher_commented", "Thầy vừa nhận xét bài trả."), { tone: "comment", chip: "Nhận xét" });
  assert.deepEqual(noticeVariant("checkpoint_graded", "Bài trả Buổi 02 của bạn đã ĐẠT."), { tone: "pass", chip: "ĐẠT" });
  assert.deepEqual(noticeVariant("checkpoint_graded", "Thầy yêu cầu bạn nộp lại bài trả Buổi 02."), { tone: "redo", chip: "NỘP LẠI" });
  assert.equal(noticeVariant("checkpoint_graded", "Bài trả Buổi 02 của bạn đã được chấm.").tone, "graded");
  assert.equal(noticeVariant("kind_la", "x").tone, "other");
});

test("Hàng thông báo: chip loại + nội dung + thời gian + chấm chưa đọc; KHÔNG avatar/tên người gửi tự tạo", () => {
  const now = new Date();
  const html = renderToStaticMarkup(<Notice n={mk("checkpoint_graded", "Bài trả Buổi 02 của bạn đã ĐẠT.", true, new Date(now.getTime() - 5 * 60000).toISOString())} onOpen={() => {}} />);
  assert.match(html, /cs-nr is-pass is-unread/);
  assert.match(html, />ĐẠT</);
  assert.match(html, /5 phút/);
  assert.match(html, /cs-nr-dot/);
  assert.doesNotMatch(html, /<img|avatar/i);
  const read = renderToStaticMarkup(<Notice n={mk("teacher_commented", "Thầy vừa nhận xét.", false)} onOpen={() => {}} />);
  assert.doesNotMatch(read, /is-unread|cs-nr-dot/);
  assert.match(read, /cs-nr is-comment/);
});

test("relativeTime: gọn kiểu mạng xã hội, ngày lỗi → rỗng", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  assert.equal(relativeTime("2026-10-30T11:59:40Z", now), "Vừa xong");
  assert.equal(relativeTime("2026-10-30T11:30:00Z", now), "30 phút");
  assert.equal(relativeTime("2026-10-30T09:00:00Z", now), "3 giờ");
  assert.equal(relativeTime("2026-10-28T12:00:00Z", now), "2 ngày");
  assert.equal(relativeTime("không phải ngày", now), "");
  assert.equal(relativeTime("", now), "");
});

test("Popover: bấm trong popover hoặc chuông KHÔNG đóng; bấm ngoài đóng", () => {
  const node = (inside: boolean) => ({ contains: () => inside }) as unknown as Node;
  const t = {} as Node;
  assert.equal(isOutsidePopover(t, node(true), node(false)), false);
  assert.equal(isOutsidePopover(t, node(false), node(true)), false);
  assert.equal(isOutsidePopover(t, node(false), node(false)), true);
  assert.equal(isOutsidePopover(null, node(false), node(false)), false);
  assert.equal(isOutsidePopover(t, null, null), true);
});

test("Popover chỉ cho desktop ≥1024px; không có matchMedia → trang đầy đủ", () => {
  assert.equal(NOTICES_POPOVER_MIN_WIDTH, 1024);
  assert.equal(popoverEnabled(undefined), false);
  assert.equal(popoverEnabled({ matchMedia: (q: string) => ({ matches: q.includes("1024px") }) } as unknown as Window), true);
  assert.equal(popoverEnabled({ matchMedia: () => ({ matches: false }) } as unknown as Window), false);
  assert.equal(popoverEnabled({ matchMedia: () => { throw new Error("x"); } } as unknown as Window), false);
});

test("Popover: Escape + bấm ngoài đóng; Escape trả focus về chuông; 'Xem tất cả' → trang đầy đủ; mở thread đóng popover", () => {
  const p = code("src/class-social/NoticesPopover.tsx");
  assert.match(p, /addEventListener\('pointerdown'/);
  assert.match(p, /e\.key === 'Escape'/);
  assert.match(p, /bellRef\.current\?\.focus\(\)/);
  assert.match(p, /removeEventListener\('pointerdown'/);
  assert.match(p, /removeEventListener\('keydown'/);
  assert.match(p, /Xem tất cả/);
  assert.match(p, /onClose\(\); onViewAll\(\)/);
  assert.match(p, /onClose\(\); onOpenThread\(id, search\)/);
  assert.match(p, /role="dialog"/);
});

test("Chuông: desktop bật/tắt popover; đang ở trang Thông báo hoặc màn hẹp → điều hướng trang (Back/chuông nhất quán)", () => {
  const l = code("src/class-social/ClassSocialLayout.tsx");
  assert.match(l, /if \(notices\.active \|\| !canPopover\) \{ setPopOpen\(false\); notices\.onOpen\(\); return \}/);
  assert.match(l, /setPopOpen\(o => !o\)/);
  assert.match(l, /aria-expanded=\{canPopover \? popOpen : undefined\}/);
  const page = code("src/class-social/ClassSocialPage.tsx");
  assert.match(page, /onOpen: view\.kind === 'notices' \? \(\) => onBack\(HOME\) : onOpenNotices, onActivity: \(\) => void chatUnread\.refresh\(\), onOpenThread/);
  const css = code("src/class-social/classSocial.css");
  assert.match(css, /\.cs-notif-pop \{[^}]*width: 400px/);
});

test("Giữ nguyên nghiệp vụ: popover dùng cùng SystemNoticeView (cùng RPC/đọc/focus/deep-link); không API mới; không đụng DB", () => {
  assert.match(code("src/class-social/NoticesPopover.tsx"), /SystemNoticeView bare/);
  const view = code("src/class-social/chat/SystemNoticeView.tsx");
  assert.match(view, /onOpenThread\(n\.threadId, noticeAction\(n\.kind\)\.search\)/);
  assert.match(view, /reverse\(\)/, "mới nhất ở trên");
  assert.doesNotMatch(code("src/class-social/NoticesPopover.tsx"), /supabase|\.rpc\(|markSystemRead|fetchSystemNotices/);
  assert.match(code("src/class-social/sections/Notices.tsx"), /cs-notices-page/);
});

test("Mobile: màn Thông báo toàn trang vẫn dùng SystemNoticeView (hàng gọn), có Back của khung; không popover trong app", () => {
  const m = code("src/class-mobile/NoticesPage.tsx");
  assert.match(m, /SystemNoticeView bare/);
  assert.doesNotMatch(m, /Popover/);
  assert.doesNotMatch(code("src/class-mobile/MobileShell.tsx"), /NoticesPopover/);
  assert.match(code("src/class-mobile/classMobile.css"), /\.cm-notices \{[^}]*safe-area-inset-bottom/);
});
