/**
 * Render phần đầu /me: ảnh bìa (có ảnh / mặc định), nút đổi ảnh, avatar an toàn.
 */
import test from "node:test";
import assert from "node:assert/strict";
// Như tests/tuner: file test nằm ngoài tsconfig.app.json → JSX classic, cần React trong scope
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import IdentityHeader from "../../src/class-social/sections/IdentityHeader";
import type { ClassIdentity } from "../../src/class-social/useClassSession";
void React;

const me = (o: Partial<ClassIdentity> = {}): ClassIdentity => ({
  role: "student", userId: "u1", studentId: "s1", name: "Minh Anh", email: null, avatarUrl: null, level: "elementary",
  enrolledAt: "2026-03-02T00:00:00Z", htMember: true, isTeacher: false, coverUrl: null, ...o,
});
const COVER = "https://x.supabase.co/storage/v1/object/public/avatars/cover-u1-1.jpg";

test("Chưa có ảnh bìa → bìa mặc định tím (không thẻ img); có ảnh → img object-fit cover", () => {
  const none = renderToStaticMarkup(<IdentityHeader me={me()} />);
  assert.ok(!none.includes("cs-cover-img") && !none.includes("has-image"));
  const withCover = renderToStaticMarkup(<IdentityHeader me={me({ coverUrl: COVER })} />);
  assert.match(withCover, /class="cs-cover has-image"/);
  assert.match(withCover, new RegExp(`<img class="cs-cover-img" src="${COVER.replace(/[.?]/g, "\\$&")}"`));
});

test("URL ảnh độc hại trong dữ liệu → không render (về ảnh mặc định / chữ cái đầu)", () => {
  const html = renderToStaticMarkup(<IdentityHeader me={me({ coverUrl: "javascript:alert(1)", avatarUrl: "http://evil.test/a.jpg" })} />);
  assert.ok(!html.includes("javascript:") && !html.includes("evil.test"));
  assert.match(html, /cs-identity-avatar[^>]*>M</);
});

test("Nút đổi ảnh: chỉ khi có onEdit; avatar chỉ khi có hồ sơ học sinh (canEditAvatar)", () => {
  const view = renderToStaticMarkup(<IdentityHeader me={me()} />);
  assert.ok(!view.includes("Đổi ảnh bìa") && !view.includes("Đổi ảnh đại diện"));
  const edit = renderToStaticMarkup(<IdentityHeader me={me()} canEditAvatar onEdit={() => {}} />);
  assert.match(edit, /aria-label="Đổi ảnh bìa"/);
  assert.match(edit, /aria-label="Đổi ảnh đại diện"/);
  const teacher = renderToStaticMarkup(<IdentityHeader me={me({ studentId: null, isTeacher: true, role: "teacher" })} canEditAvatar={false} onEdit={() => {}} />);
  assert.match(teacher, /aria-label="Đổi ảnh bìa"/);
  assert.ok(!teacher.includes("Đổi ảnh đại diện"));
});

test("Metadata chỉ hiện khi có dữ liệu thật", () => {
  const bare = renderToStaticMarkup(<IdentityHeader me={me({ htMember: false, level: null, enrolledAt: null })} />);
  assert.ok(!bare.includes("cs-identity-facts"));
  const full = renderToStaticMarkup(<IdentityHeader me={me()} />);
  assert.match(full, /Lớp Hành trình/); assert.match(full, /Cơ bản/); assert.match(full, /Tham gia tháng 3\/2026/);
});
