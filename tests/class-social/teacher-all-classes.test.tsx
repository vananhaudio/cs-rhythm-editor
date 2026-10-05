/**
 * Teacher All Classes V1: Thầy/admin thấy MỌI lớp ở /me/classes bằng quyền server (social_all_classes / is_teacher()),
 * không bằng membership. Học sinh: y nguyên. Quyền thật: scripts/test-teacher-all-classes-db.sh; Chrome: run-teacher-all-classes.mjs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ClassNav from "../../src/class-social/classes/ClassNav";
import ClassesPage from "../../src/class-social/classes/ClassesPage";
import { toClassCards } from "../../src/class-social/classes/classModel";
void React;

const noop = () => {};
const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const code = (f: string) => read(f).replace(/\/\/.*$/gm, "");
const id = (n: number) => `c0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const row = (n: number, name: string, status = "active", is_member = false) =>
  ({ id: id(n), code: "L" + n, name, status, is_member, member_count: 5, activity_count: 0, schedule: null, course: { name: "Khoá " + n, code: "K" + n } });
const ALL = toClassCards([
  row(1, "Gen Z — Z2"), row(2, "Solo Guitar Căn Bản", "scheduled"), row(3, "Hành trình 2027", "upcoming"),
  row(4, "Tỉa nốt 3 — GL11", "completed"), row(5, "Khởi đầu đam mê khóa 17", "upcoming"), row(6, "Đệm hát căn bản", "upcoming"),
  row(7, "Hành trình 2026", "ending_soon"), row(8, "Lớp cũ", "completed"),
]);
const names = (h: string) => [...h.matchAll(/cs-classrow-name"[^>]*>([^<]+)</g)].map(m => m[1]);
const base = { loaded: true, mine: [], discover: [], error: null, mineFailed: false, reload: noop };

test("Thầy/admin: /me/classes = 'Tất cả lớp học' — mọi lớp (đang chạy trên, đã kết thúc dưới), mỗi lớp là link vào lớp", () => {
  const h = renderToStaticMarkup(<ClassesPage classes={{ ...base, all: ALL }} onOpenClass={noop} />);
  assert.match(h, /<h1 class="cs-page-title">Tất cả lớp học<\/h1>/);
  assert.doesNotMatch(h, /Lớp của tôi/);
  assert.match(h, /8 lớp · Thầy xem được mọi lớp, không cần tham gia\./);
  assert.deepEqual(names(h).sort(), ALL.map(c => c.name).sort(), "đủ 8 lớp — kể cả lớp Thầy không là thành viên");
  const pastAt = h.indexOf("Lớp đã kết thúc");
  assert.ok(pastAt > 0 && h.indexOf("Tỉa nốt 3 — GL11") > pastAt && h.indexOf("Lớp cũ") > pastAt && h.indexOf("Gen Z — Z2") < pastAt);
  for (const c of ALL) assert.match(h, new RegExp(`<a class="cs-classrow-name" href="/me/classes/${c.id}">`));
  assert.match(h, /aria-label="Tìm lớp"/, "nhiều lớp → có ô tìm");
  assert.doesNotMatch(h, /Nhập mã lớp/, "Thầy không tự tham gia lớp (không tạo membership)");
  assert.doesNotMatch(h, /Các lớp khác|Bạn chưa ở trong lớp nào/);
});

test("Thầy: đang tải / lỗi / chưa có lớp", () => {
  assert.match(renderToStaticMarkup(<ClassesPage classes={{ ...base, loaded: false, all: [] }} onOpenClass={noop} />), /Đang tải lớp học…/);
  assert.match(renderToStaticMarkup(<ClassesPage classes={{ ...base, all: [], error: "Chưa tải được." }} onOpenClass={noop} />), /role="alert">Chưa tải được\./);
  assert.match(renderToStaticMarkup(<ClassesPage classes={{ ...base, all: [] }} onOpenClass={noop} />), /Chưa có lớp nào\./);
});

test("Học sinh (all vắng/null): /me/classes y nguyên 'Lớp của tôi' + Nhập mã lớp + Các lớp khác", () => {
  const mine = toClassCards([row(1, "Gen Z — Z2", "active", true)]);
  const discover = toClassCards([row(9, "Lớp khác", "upcoming")]);
  for (const all of [undefined, null]) {
    const h = renderToStaticMarkup(<ClassesPage classes={{ ...base, mine, discover, all }} onOpenClass={noop} />);
    assert.match(h, /<h1 class="cs-page-title">Lớp của tôi<\/h1>/);
    assert.match(h, /Nhập mã lớp/);
    assert.match(h, /Các lớp khác/);
    assert.doesNotMatch(h, /Tất cả lớp học/);
  }
});

test("Sidebar: Thầy → mục 'Tất cả lớp học'; học sinh → 'Lớp của tôi'", () => {
  const nav = (allClasses?: boolean) => renderToStaticMarkup(<ClassNav mine={[]} loaded activeClassId={null} classesActive={false}
    collapsed={false} onOpenClass={noop} onOpenClasses={noop} allClasses={allClasses} />);
  assert.match(nav(true), /cs-nav-text">Tất cả lớp học</);
  assert.match(nav(), /cs-nav-text">Lớp của tôi</);
});

test("Nguồn: quyền = capability server (is_teacher), không email; chỉ Thầy mới gọi social_all_classes", () => {
  const hook = code("src/class-social/classes/useSocialClasses.ts");
  assert.match(hook, /isTeacher \? fetchAllClasses\(\) : Promise\.resolve\(null\)/);
  assert.match(hook, /isTeacher \? Promise\.resolve\(none\) : fetchDiscoverClasses\(\)/);
  assert.match(code("src/class-social/classes/classesApi.ts"), /rpc\('social_all_classes'\)/);
  assert.match(code("src/class-social/ClassSocialPage.tsx"), /useSocialClasses\(me\.isTeacher\)/);
  // Không special-case email Thầy trong bundle
  const walk = (d: string): string[] => readdirSync(new URL(`../../${d}`, import.meta.url)).flatMap(f => {
    const p = `${d}/${f}`; return statSync(new URL(`../../${p}`, import.meta.url)).isDirectory() ? walk(p) : [p];
  });
  for (const f of walk("src/class-social").filter(f => /\.(ts|tsx)$/.test(f))) assert.doesNotMatch(read(f), /vananhaudio@gmail\.com/i, f);
});

test("Migration: chỉ thêm MỘT RPC đọc, kiểm is_teacher() ở server, REVOKE public/anon; không đổi hàm/dữ liệu cũ", () => {
  const sql = read("db/teacher_all_classes_v1_setup.sql").replace(/^\s*--.*$/gm, "");
  assert.deepEqual([...sql.matchAll(/create or replace function public\.(\w+)/g)].map(m => m[1]), ["social_all_classes"]);
  assert.match(sql, /if not coalesce\(public\.is_teacher\(\), false\) then\s+raise exception 'SC_TEACHER_ONLY' using errcode = '42501'/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /revoke all on function public\.social_all_classes\(\) from public, anon;/);
  assert.match(sql, /grant execute on function public\.social_all_classes\(\) to authenticated;/);
  assert.match(sql, /not in \('cancelled', 'merged', 'draft'\)/, "cùng bộ lọc social_my_classes / social_class_detail → lớp nào cũng mở được");
  assert.equal(/\b(insert|update|delete)\s+(into\s+)?public\./i.test(sql), false, "không ghi dữ liệu");
  assert.equal(/edu_group_members|class_curriculum_access|learning_session_progress/.test(sql), false, "không đụng membership/quyền/tiến độ");
  assert.equal(/@|email/i.test(sql.replace(/'[^']*'/g, "")), false, "không email");
});
