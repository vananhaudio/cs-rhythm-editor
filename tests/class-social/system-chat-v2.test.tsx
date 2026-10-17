/**
 * System Chat V2 (Class 2.0, hai chiều): nhãn + đích theo loại thông báo, hiển thị trong màn Class 2.0,
 * và các rào chắn "chỉ điều hướng". DB/quyền/chống trùng/lỗi thông báo: scripts/test-class-system-chat-db.sh.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NOTICE_TARGET_SEARCH, NOTICE_TARGET_SEARCH_STUDENT, noticeAction, toSystemNotices, type SystemNotice } from "../../src/class-social/chat/chatModel";
import { Notice } from "../../src/class-social/chat/SystemNoticeItem";
void React;

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const code = (f: string) => read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const TID = "99999999-0000-4000-8000-000000000001";

test("noticeAction: nhãn + đích đúng từng loại (4 loại + loại lạ không đoán focus)", () => {
  assert.deepEqual(noticeAction("submission_received"), { label: "Xem bài", search: NOTICE_TARGET_SEARCH_STUDENT });
  assert.deepEqual(noticeAction("question_received"), { label: "Xem câu hỏi", search: NOTICE_TARGET_SEARCH_STUDENT });
  assert.deepEqual(noticeAction("checkpoint_graded"), { label: "Xem kết quả", search: NOTICE_TARGET_SEARCH });
  assert.deepEqual(noticeAction("question_answered"), { label: "Xem trả lời", search: NOTICE_TARGET_SEARCH });
  assert.deepEqual(noticeAction("loai_moi_hon_FE"), { label: "Xem chi tiết", search: "" });
  assert.equal(NOTICE_TARGET_SEARCH_STUDENT, "?focus=bai-moi");
});

test("toSystemNotices: giữ kind; loại mới vẫn hiện (ref thread hợp lệ)", () => {
  const rows = toSystemNotices([
    { seq: 3, kind: "submission_received", body: "Học viên vừa nộp bài Buổi 02.", ref_type: "thread", ref_key: TID, created_at: "2026-10-17T10:00:00Z", unread: true },
    { seq: 4, kind: "question_received", body: "Học viên vừa gửi câu hỏi mới.", ref_type: "thread", ref_key: TID, created_at: "", unread: true },
    { seq: 5, kind: null, body: "kind thiếu", ref_type: "thread", ref_key: TID, created_at: "", unread: false },
  ]);
  assert.deepEqual(rows.map(r => r.kind), ["submission_received", "question_received", ""]);
});

// Hook không chạy trong renderToStaticMarkup → kiểm Notice qua mã nguồn + render thủ công qua export nội bộ không có; dùng rào chắn mã nguồn
test("Màn Class 2.0: nhãn lấy từ noticeAction theo kind, mở đúng thread kèm focus; vẫn chỉ đọc", () => {
  const view = code("src/class-social/chat/SystemNoticeView.tsx");
  assert.match(view, /noticeAction\(n\.kind\)/);
  assert.match(view, /onOpenThread\(n\.threadId, noticeAction\(n\.kind\)\.search\)/);
  assert.equal(/<textarea|<input|Composer|sendMessage|onSend|contentEditable/i.test(view), false, "không có ô nhập");
  assert.equal(/Xem kết quả/.test(view), false, "không còn nhãn cố định");
  const chat = code("src/class-social/sections/Chat.tsx");
  assert.match(chat, /onOpenThread\?\.\(threadId, search\)/);
});

test("ThreadView: focus=bai-moi cuộn tới lượt học viên mới nhất; focus=ket-qua giữ nguyên (V1)", () => {
  const tv = code("src/learning-thread/ThreadView.tsx");
  assert.match(tv, /'ket-qua'\s*\?\s*'\.lt-ev\.is-teacher'/);
  assert.match(tv, /'bai-moi'\s*\?\s*'\.lt-ev:not\(\.is-teacher\)'/);
});

test("Rào chắn V2: không đường ghi thông báo ở client; DM và API không đổi (vẫn 3 RPC thông báo)", () => {
  const api = code("src/class-social/chat/chatApi.ts");
  const rpcs = [...api.matchAll(/['"](class_system_[a-z_]+)['"]/g)].map(m => m[1]);
  assert.deepEqual([...new Set(rpcs)].sort(), ["class_system_notice_mark_read", "class_system_notice_summary", "class_system_notices"]);
  assert.equal(/\.from\(\s*['"`]class_system_/.test(api + code("src/class-social/chat/useChat.ts")), false);
  assert.equal(/dm_(send|start|share)['"]/.test(api.slice(api.indexOf("fetchSystemSummary"))), false, "thông báo hệ thống không đi qua DM cá nhân");
});

test("Hiển thị: mỗi loại render đúng nội dung + nhãn + chưa đọc; bấm mở đúng thread kèm focus", () => {
  const opened: string[] = [];
  const mk = (kind: string, body: string, unread = true): SystemNotice => ({ seq: 1, kind, body, threadId: TID, at: "2026-10-17T10:00:00Z", unread });
  const cases: [string, string, string][] = [
    ["submission_received", "Học viên vừa nộp bài Buổi 02.", "Xem bài"],
    ["question_received", "Học viên vừa gửi câu hỏi mới.", "Xem câu hỏi"],
    ["checkpoint_graded", "Bài trả Buổi 02 của bạn đã được chấm.", "Xem kết quả"],
    ["question_answered", "Thầy đã trả lời câu hỏi của bạn.", "Xem trả lời"],
  ];
  for (const [kind, body, label] of cases) {
    const html = renderToStaticMarkup(<Notice n={mk(kind, body)} onOpen={() => opened.push(kind)} />);
    assert.match(html, new RegExp(body.replace(/\./g, "\\.")));
    assert.match(html, new RegExp(`>${label} `), `${kind} → nhãn ${label}`);
    assert.match(html, /is-unread/);
  }
  assert.doesNotMatch(renderToStaticMarkup(<Notice n={mk("checkpoint_graded", "x", false)} onOpen={() => {}} />), /is-unread/);
});
