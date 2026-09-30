// Lớp Gen Z — Z2 (lớp ngoài hệ năng lực, dài hạn): nhãn danh tính từ tên lớp (không hard-code), lịch không số buổi.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildIdentities, programOf } from "../../src/class-social/identity/learningIdentity";
import { isOpenEnded, scheduleRangeText, generateSessions } from "../../src/journey/sessions";

const T = "2026-09-30";
const z2 = { class_code: "Z2", class_name: "Gen Z — Z2", status: "active", start_date: null, end_date: null, program_code: null, course_code: null };

test("Gen Z — Z2 → nhãn 'Gen Z' (đơn sắc thường, không Hành trình, không mã Z2); Z3/Z4 gộp cùng chương trình", () => {
  const p = programOf(z2);
  assert.equal(p.label, "Gen Z"); assert.equal(p.tier, "base");
  assert.equal(programOf({ ...z2, class_code: "Z3", class_name: "Gen Z — Z3" }).key, p.key, "Z3 cùng chương trình Gen Z");
  const ids = buildIdentities([z2], T);
  assert.deepEqual(ids.current.map(i => i.label), ["Gen Z"]);
  assert.deepEqual([ids.upcoming.length, ids.graduated.length], [0, 0], "active, không end_date → Đang học (không Sắp học / Tốt nghiệp)");
  assert.equal(JSON.stringify(ids).includes("Hành trình"), false);
  assert.match(ids.current[0].title, /Gen Z — Z2/);
});

test("vừa Gen Z vừa lớp khác → cả hai nhãn", () => {
  const ids = buildIdentities([z2, { class_code: "DH2.KD0826", course_code: "DH2", status: "upcoming", start_date: "2026-08-14" }], T);
  assert.deepEqual(ids.current.map(i => i.label).sort(), ["Gen Z", "Đệm hát 2"].sort());
});

test("lớp dài hạn: total_sessions = 0; lịch 'Chủ nhật · 14:00–15:00'; không sinh buổi / end_date", () => {
  assert.equal(isOpenEnded(0), true); assert.equal(isOpenEnded(8), false); assert.equal(isOpenEnded(null), false);
  assert.equal(scheduleRangeText(0, "14:00", 60), "Chủ nhật · 14:00–15:00");
  assert.equal(scheduleRangeText(3, "19:30", 90), "Thứ 4 · 19:30–21:00");
  assert.equal(scheduleRangeText(0, "14:00", null), "Chủ nhật · 14:00");
  assert.equal(scheduleRangeText(null, "14:00", 60), "");
  assert.equal(generateSessions("2026-10-04", 0, "14:00", 60, 0).length, 0, "0 buổi → không sinh buổi");
  const admin = readFileSync("src/ScheduleManager.tsx", "utf8");
  assert.match(admin, /const sessions = openEnded \? \[\] : generateSessions/, "Admin: lớp dài hạn không sinh buổi");
  assert.match(admin, /end_date: openEnded \? null : realEndDate\(sessions\)/, "Admin: không end_date giả");
  assert.match(admin, /total_sessions: openEnded \? 0 :/);
  assert.match(admin, /Lớp dài hạn · không giới hạn số buổi/);
});
