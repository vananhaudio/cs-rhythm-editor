// Chat Lớp: logo khóa học + lịch học (từ cột có cấu trúc), không tự tạo thông tin khi thiếu.
import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { classBadge, formatClassSchedule } from "../../src/class-social/classes/classModel";
import { buildClassDisplayMap } from "../../src/class-social/classes/useClassDisplay";
import ClassLogo from "../../src/class-social/classes/ClassLogo";
import ConversationList from "../../src/class-social/chat/ConversationList";
import { toClassConversations, toConversations } from "../../src/class-social/chat/chatModel";

test("formatClassSchedule: có giờ kết thúc, CN, thiếu dữ liệu", () => {
  assert.equal(formatClassSchedule(2, "20:30:00", 90), "Thứ 3 · 20:30–22:00");
  assert.equal(formatClassSchedule(0, "09:30:00", 120), "Chủ nhật · 09:30–11:30");
  assert.equal(formatClassSchedule(5, "19:00:00", null), "Thứ 6 · 19:00");
  assert.equal(formatClassSchedule(3, "23:30:00", 90), "Thứ 4 · 23:30–01:00");
  assert.equal(formatClassSchedule(null, "19:00:00", 90), null);
  assert.equal(formatClassSchedule(2, null, 90), null);
  assert.equal(formatClassSchedule(9, "19:00:00", 90), null);
});

test("buildClassDisplayMap: logo theo khóa (dùng chung), lớp thiếu khóa/logo → null", () => {
  const m = buildClassDisplayMap(
    [{ id: "A", main_course_id: "c1", weekday: 2, start_time: "20:30:00", duration_minutes: 90 },
     { id: "B", main_course_id: "c1", weekday: 4, start_time: "19:00:00", duration_minutes: 90 },
     { id: "C", main_course_id: "c2", weekday: null, start_time: null, duration_minutes: null },
     { id: "D", main_course_id: null, weekday: 1, start_time: "08:00:00", duration_minutes: 60 }],
    [{ id: "c1", code: "CB1", image_url: "https://x/a.png" }, { id: "c2", code: "CB2", image_url: null }, { id: "c3", image_url: "javascript:x" }]);
  assert.equal(m.get("a")!.logo, "https://x/a.png");
  assert.equal(m.get("b")!.logo, "https://x/a.png");
  assert.deepEqual(m.get("c"), { logo: null, code: "CB2", schedule: null });
  assert.equal(m.get("d")!.schedule, "Thứ 2 · 08:00–09:00");
});

test("ConversationList: hàng lớp dùng ô logo; hàng cá nhân vẫn là Avatar", () => {
  const cls = toClassConversations([{ class_id: "11111111-1111-1111-1111-111111111111", class_name: "Guitar căn bản 2", last_seq: 0, last_body: null, last_sender_name: null, last_mine: false, last_at: null, unread: 0, member_count: 3, can_send: true }] as never);
  const dm = toConversations([{ conversation_id: "dm_1", peer_id: "u1", peer_name: "Bình", peer_avatar_url: null, peer_role: null, last_seq: 1, last_body: "hi", last_mine: false, last_at: "2026-11-16T03:00:00Z", unread: 0, can_send: true }] as never);
  const h = renderToStaticMarkup(<ConversationList state={{ status: "ready", items: [...cls, ...dm], error: null } as never} selectedId={null} onSelect={() => {}} onRetry={() => {}} onOpenFriends={() => {}} />);
  assert.equal((h.match(/class="cs-classrow-logo"/g) ?? []).length, 1);
  assert.match(h, /Guitar căn bản 2/);
  assert.match(h, /Chưa có tin nhắn/);
});

test("classBadge: mã khóa, cùng mã → cùng màu; không khóa → viết tắt tên lớp", () => {
  assert.deepEqual(classBadge("cb1", "Lớp A"), classBadge("CB1", "Lớp B"));
  assert.equal(classBadge("cb1", "x").label, "CB1");
  assert.notEqual(classBadge("CB1", null).hue, classBadge("CB2", null).hue);
  assert.equal(classBadge(null, "Guitar căn bản 2").label, "GCB");
  assert.equal(classBadge(null, "Đệm hát — KD18").label, "ĐHK");
  assert.equal(classBadge(null, null).label, "?");
});
test("ClassLogo: không logo → chữ mã khóa; có logo → ảnh", () => {
  const a = renderToStaticMarkup(<ClassLogo url={null} courseCode="CB2" name="x" />);
  assert.match(a, />CB2</); assert.doesNotMatch(a, /<img/);
  assert.match(renderToStaticMarkup(<ClassLogo url="https://x/a.png" courseCode="CB2" />), /<img/);
});
