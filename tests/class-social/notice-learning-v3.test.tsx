// Lát 2 — thông báo học tập: nhận xét / ĐẠT / NỘP LẠI tách bạch, điều hướng đúng (Web ?focus= · Mobile prop focus), tương thích thông báo cũ.
// Phần nghiệp vụ DB (dedupe, người nhận, retry, lỗi thông báo) chạy THẬT trên PostgreSQL tạm: scripts/test-class-system-chat-db.sh.
// Ở đây: hàm thuần chạy thật + rào chắn mã nguồn (ghi rõ) cho phần UI/điều hướng.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { NOTICE_TARGET_SEARCH, NOTICE_TARGET_SEARCH_STUDENT, focusFromSearch, noticeAction, toSystemNotices } from "../../src/class-social/chat/chatModel";

const code = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const TID = "11111111-1111-4111-8111-111111111111";

test("noticeAction: mỗi loại có nhãn + đích đúng; loại mới (nhận xét) mở phản hồi của Thầy; loại lạ vẫn mở được trang", () => {
  assert.deepEqual(noticeAction("teacher_commented"), { label: "Xem nhận xét", search: NOTICE_TARGET_SEARCH });
  assert.deepEqual(noticeAction("checkpoint_graded"), { label: "Xem kết quả", search: NOTICE_TARGET_SEARCH }, "ĐẠT / NỘP LẠI giữ kind cũ → app cũ vẫn mở đúng chỗ");
  assert.deepEqual(noticeAction("question_answered"), { label: "Xem trả lời", search: NOTICE_TARGET_SEARCH });
  assert.deepEqual(noticeAction("submission_received"), { label: "Xem bài", search: NOTICE_TARGET_SEARCH_STUDENT });
  assert.deepEqual(noticeAction("question_received"), { label: "Xem câu hỏi", search: NOTICE_TARGET_SEARCH_STUDENT });
  assert.deepEqual(noticeAction("loai_tuong_lai"), { label: "Xem chi tiết", search: "" });
});

test("focusFromSearch: chỉ nhận ket-qua / bai-moi; rỗng, lạ, thiếu → undefined (không đoán)", () => {
  assert.equal(focusFromSearch("?focus=ket-qua"), "ket-qua");
  assert.equal(focusFromSearch("?focus=bai-moi"), "bai-moi");
  assert.equal(focusFromSearch(NOTICE_TARGET_SEARCH), "ket-qua");
  assert.equal(focusFromSearch(NOTICE_TARGET_SEARCH_STUDENT), "bai-moi");
  for (const bad of ["", "?focus=", "?focus=<script>", "?x=1", undefined, null]) assert.equal(focusFromSearch(bad as string | undefined), undefined);
});

test("toSystemNotices: thông báo cũ (V1/V2) và mới (V3) cùng đọc được; thứ tự theo seq; ref hỏng bị loại", () => {
  const rows = [
    { seq: 3, kind: "teacher_commented", body: "Thầy vừa nhận xét bài trả Buổi 02 của bạn.", ref_type: "thread", ref_key: TID, created_at: "2026-10-27T03:00:00Z", unread: true },
    { seq: 1, kind: "checkpoint_graded", body: "Bài trả Buổi 01 của bạn đã được chấm.", ref_type: "thread", ref_key: TID, created_at: "2026-10-12T00:00:00Z", unread: false },
    { seq: 2, kind: "checkpoint_graded", body: "Bài trả Buổi 02 của bạn đã ĐẠT.", ref_type: "thread", ref_key: TID.toUpperCase(), created_at: "2026-10-26T00:00:00Z", unread: false },
    { seq: 4, kind: "checkpoint_graded", body: "x", ref_type: "thread", ref_key: "khong-phai-uuid", created_at: "", unread: true },
  ];
  const out = toSystemNotices(rows);
  assert.deepEqual(out.map(n => n.seq), [1, 2, 3]);
  assert.equal(out[1].threadId, TID, "ref_key chuẩn hoá chữ thường để điều hướng");
  assert.equal(out[2].unread, true);
});

test("Điều hướng Web: thông báo mở /me/t/<id>?focus=… (đường sẵn có), không sang Trò chuyện", () => {
  const web = code("src/class-social/ClassSocialPage.tsx");
  assert.match(web, /const openThread = \(threadId: string, search\?: string\) => navigate\(\{ kind: 'thread', threadId \}, search \? \{ search \} : undefined\)/);
  assert.match(code("src/class-social/sections/Notices.tsx"), /onOpenThread=\{\(id, search\) => onOpenThread\(id, search\)\}/);
  assert.match(code("src/class-social/chat/SystemNoticeView.tsx"), /onOpenThread\(n\.threadId, noticeAction\(n\.kind\)\.search\)/);
  assert.match(code("src/learning-thread/ThreadView.tsx"), /focusProp \?\? new URLSearchParams\(window\.location\.search\)\.get\('focus'\)/, "Web vẫn đọc ?focus= từ URL");
});

test("Điều hướng Mobile: focus đi theo view (không có URL thật) → ThreadPage → ThreadTimeline; quay lại giữ navigation stack", () => {
  const shell = code("src/class-mobile/MobileShell.tsx");
  assert.match(shell, /const openThread = \(threadId: string, search\?: string\) => go\(\{ kind: 'thread', threadId, focus: focusFromSearch\(search\) \}\)/);
  assert.match(shell, /<NoticesPage[\s\S]*?onOpenThread=\{openThread\}/, "chuông → thông báo → thread mang theo focus (trước đây bị bỏ)");
  assert.match(shell, /<ThreadPage key=\{view\.threadId\} threadId=\{view\.threadId\} focus=\{view\.focus\}/);
  assert.match(code("src/learning-thread/ThreadPage.tsx"), /<ThreadView[\s\S]*?focus=\{focus\}/);
  assert.match(code("src/class-social/resolveMeRoute.ts"), /kind: 'thread'; threadId: string; focus\?:/);
  // đường quay lại không đổi: nút Quay lại của thread vẫn là back() của ngăn xếp
  assert.match(shell, /<ThreadPage[\s\S]*?onBack=\{\(\) => backToOr\(HOME_VIEW\)\}/);
});

test("Migration V3 (bản nháp): additive, không bảng mới, không begin/commit, không đụng lt_*/RLS/quyền; khoá chống trùng theo vòng đời", () => {
  const raw = code("db/class_system_chat_v3_setup.sql");
  const sql = raw.replace(/--.*$/gm, "");   // bỏ chú thích: chỉ kiểm câu lệnh thật
  assert.equal(/^\s*(begin|commit)\s*;/im.test(sql), false, "chạy bằng prod-db.py: không tự điều khiển transaction");
  assert.equal(/create\s+table|drop\s+table|create\s+policy|enable row level|grant\s/i.test(sql), false, "không bảng/policy/grant mới");
  assert.equal(/create or replace function public\.lt_|alter table public\.learning_thread/i.test(sql), false, "không sửa RPC học tập / bảng Learning Thread");
  assert.match(sql, /'checkpoint_graded', 'submission_received', 'question_received', 'question_answered', 'teacher_commented'/, "kind cũ giữ nguyên + 1 kind mới");
  assert.match(sql, /'grade:' \|\| v_t\.id::text \|\| ':' \|\| v_cycle::text \|\| ':' \|\| new\.verdict/);
  assert.match(sql, /'comment:' \|\| v_t\.id::text \|\| ':' \|\| new\.seq::text/);
  assert.match(sql, /exception when others then/, "lỗi thông báo không phá nghiệp vụ");
  assert.match(sql, /revoke all on function public\.class_system_notice_on_event\(\) from public, anon, authenticated/);
  assert.equal(/học viên\s+\w*\s*tên|v_t\.learner_name|app_users\.name/i.test(sql), false, "không đưa tên học viên vào thông báo");
  const rb = code("db/class_system_chat_v3_rollback.sql");
  const rbSql = rb.replace(/--.*$/gm, "");
  assert.equal(/\bdelete\b|\btruncate\b|\bdrop\s+table\b|\bnot\s+valid\b/i.test(rbSql), false, "rollback bảo toàn dữ liệu: không xoá, không NOT VALID");
  assert.equal(/class_system_notices_kind_check/.test(rbSql), false, "rollback giữ CHECK kind mở rộng của V3 (không đụng ràng buộc)");
  assert.equal(/\b(policy|grant|alter\s+table)\b/i.test(rbSql), false, "rollback không đổi quyền / RLS / schema bảng");
  assert.match(rbSql, /create or replace function public\.class_system_notice_on_event\(\)/);
});
