/**
 * Class Membership Canonical V1 + Join Class by Code V1 + lối vào Học của lớp (phần giao diện / hợp đồng client).
 * Quyền + luật THẬT ở DB: scripts/test-class-membership-canonical-db.sh (dữ liệu giả).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import JoinClassByCode from "../../src/class-social/classes/JoinClassByCode";
import ClassesPage from "../../src/class-social/classes/ClassesPage";
import MyClassesBoard from "../../src/class-social/classes/MyClassesBoard";
import { scErrorText } from "../../src/class-social/classes/classModel";
void React;

const src = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const sql = (f: string) => readFileSync(new URL(`../../db/${f}`, import.meta.url), "utf8");

test("Nhập mã lớp: ô 'Nhập mã lớp của bạn' ở Khám phá các lớp khác (/me/classes); Lớp của tôi trống chỉ lối tới đó — chỉ gửi MÃ, không user/lớp/nhóm", () => {
  const empty = { loaded: true as const, mine: [], discover: [], error: null, reload: () => {} };
  const html = renderToStaticMarkup(<ClassesPage classes={empty} onOpenClass={() => {}} onOpenMyClasses={() => {}} />);
  assert.match(html, /Nhập mã lớp của bạn/);
  assert.match(html, /Xem lớp/);
  const board = renderToStaticMarkup(<MyClassesBoard classes={empty} isTeacher={false} onOpenClass={() => {}} onOpenSession={() => {}} onOpenThread={() => {}} onOpenDiscover={() => {}} />);
  assert.match(board, /Nhập mã lớp Thầy gửi/);
  assert.match(board, /Khám phá các lớp khác/);
  assert.match(renderToStaticMarkup(<JoinClassByCode onJoined={() => {}} />), /aria-label="Mã lớp"/);
  const api = src("class-social/classes/classesApi.ts");
  assert.match(api, /rpc\('class_join_preview', \{ p_code: code \}\)/);
  assert.match(api, /rpc\('class_join', \{ p_code: code \}\)/);
  assert.doesNotMatch(api, /p_user|user_id:|p_group/);
});

test("lỗi tham gia: thông điệp thân thiện cho mã sai / lớp đã đóng / bị chuyển khỏi lớp / chưa có hồ sơ", () => {
  assert.match(scErrorText("JOIN_INVALID"), /Mã lớp không đúng/);
  assert.match(scErrorText("JOIN_CLOSED"), /không còn nhận/);
  assert.match(scErrorText("JOIN_REMOVED"), /Liên hệ Thầy/);
  assert.match(scErrorText("JOIN_NO_PROFILE"), /hồ sơ học viên/);
});

test("vừa tham gia: nạp lại Lớp của tôi + sidebar, làm mới danh tính học tập, mở lớp", () => {
  const page = src("class-social/ClassSocialPage.tsx");
  assert.match(page, /onJoined=\{id => \{ classes\.reload\(\); refreshLearningIdentity\(me\.userId\); onOpenClass\(id\) \}\}/);
  assert.match(src("class-social/identity/identityStore.ts"), /export function refreshLearningIdentity/);
});

test("App 'Lớp đang học' + Admin dùng nguồn canonical (RPC), không tự join nhóm / cohort ở client", () => {
  const app = src("classLearning/api.ts");
  assert.match(app, /rpc\('my_class_memberships'\)/);
  assert.doesNotMatch(app, /edu_group_members|cohort_group_id/);
  const admin = src("admin/ClassCurriculumAdminView.tsx");
  assert.match(admin, /rpc\('class_roster'/);
  assert.match(admin, /rpc\('admin_class_member_summary'\)/);
  assert.doesNotMatch(admin, /from\('edu_group_members'\)/);
  assert.doesNotMatch(admin, /SOLO01\.TH01|HT2027\.TH01/, "không còn danh sách lớp cứng");
  const sched = src("ScheduleManager.tsx");
  assert.match(sched, /rpc\('admin_class_member_summary'\)/);
  assert.match(sched, /Chưa có nhóm thành viên/);
  assert.match(sched, /Nhóm thành viên 0 học sinh/);
  // Lớp ĐÃ có nhóm → không dò lại nhóm theo mã lớp khi lưu (lỗi cũ: HT2027.TH01 sẽ bị gắn nhóm rỗng mới)
  assert.match(sched, /if \(linkedGroup\) \{[\s\S]*\} else if \(code\) \{/);
});

test("trang lớp: khối Học trỏ route học SẴN CÓ (/course?id=), Giáo trình báo riêng, Trả/Hỏi bài trong bài học", () => {
  const entry = src("class-social/classes/ClassLearnEntry.tsx");
  assert.match(entry, /href=\{`\/course\?id=\$\{encodeURIComponent\(course\.id\)\}`\}/);
  assert.match(entry, /Giáo trình lớp chưa bật cho bạn/);
  assert.match(entry, /Trả bài \/ Hỏi bài/);
  assert.doesNotMatch(entry, /lt_submit|class_posts/);
  assert.match(src("class-social/classes/ClassPage.tsx"), /<ClassLearnEntry classId=\{classId\}/);
});

test("DB: một định nghĩa thành viên (view), consumer không còn luật trùng mã / group_id thứ hai", () => {
  const setup = sql("class_membership_canonical_v1_setup.sql");
  assert.match(setup, /create or replace view tva_private\.class_memberships as[\s\S]*gm\.group_id = cs\.cohort_group_id and gm\.status = 'active'/);
  const body = setup.slice(setup.indexOf("-- ── 4)"));
  assert.doesNotMatch(body, /upper\(g\.code\) = upper\(cs\.code\)|g\.id = cs\.group_id|'CLASS\.' \|\|/);
  assert.doesNotMatch(body, /ht_member\s*=|from public\.leads l/);
  assert.doesNotMatch(setup + sql("class_join_code_v1_setup.sql"), /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/, "không id production trong repo public");
  const join = sql("class_join_code_v1_setup.sql");
  assert.match(join, /values \(v_uid, r\.group_id, 'join_code', 'active'\)/);
  assert.match(join, /token ~ '\^\[A-HJ-KM-NP-Z2-9\]\{8\}\$'/);
});
