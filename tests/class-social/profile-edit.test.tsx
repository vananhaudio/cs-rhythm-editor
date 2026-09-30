// Chỉnh sửa trang cá nhân V1: kiểm tên hiển thị + nút chỉ ở trang của chính mình + ghi đúng nguồn chung với App học.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MAX_DISPLAY_NAME, checkDisplayName } from "../../src/class-social/profile/profileEdit";
import IdentityHeader from "../../src/class-social/sections/IdentityHeader";

void React;

test("tên hiển thị: gọn khoảng trắng, giữ hoa/thường + dấu tiếng Việt; rỗng / quá dài bị chặn", () => {
  assert.deepEqual(checkDisplayName("  Ánh   Dương  Lê  "), { ok: true, name: "Ánh Dương Lê" });
  assert.deepEqual(checkDisplayName("trần tiến HẢI"), { ok: true, name: "trần tiến HẢI" }, "không tự đổi hoa/thường");
  assert.deepEqual(checkDisplayName("Nguyễn Thị Ngọc Hà 🎸"), { ok: true, name: "Nguyễn Thị Ngọc Hà 🎸" });
  assert.equal(checkDisplayName("Tiến").ok && (checkDisplayName("Tiến") as { name: string }).name, "Tiến", "chuẩn hoá NFC (dấu tổ hợp từ bàn phím điện thoại)");
  assert.equal(checkDisplayName("   ").ok, false);
  assert.equal(checkDisplayName("").ok, false);
  assert.equal(checkDisplayName("a".repeat(MAX_DISPLAY_NAME)).ok, true);
  assert.equal(checkDisplayName("a".repeat(MAX_DISPLAY_NAME + 1)).ok, false);
});

const me = { role: "student", userId: "u1", studentId: "s1", name: "An", email: null, avatarUrl: null, coverUrl: null, level: null, enrolledAt: null, htMember: false, isTeacher: false } as never;

test("nút 'Chỉnh sửa trang cá nhân' chỉ khi có onEditProfile (trang của chính mình)", () => {
  assert.match(renderToStaticMarkup(<IdentityHeader me={me} onEditProfile={() => {}} />), /Chỉnh sửa trang cá nhân/);
  assert.equal(/Chỉnh sửa trang cá nhân/.test(renderToStaticMarkup(<IdentityHeader me={me} />)), false);
  const page = readFileSync("src/class-social/sections/ProfilePage.tsx", "utf8");
  assert.match(page, /isSelf\s*\?\s*<IdentityHeader [^>]*onEditProfile=\{onEditProfile\}/, "chỉ nhánh isSelf truyền onEditProfile");
  assert.equal(/<OtherHeader[^>]*onEditProfile/.test(page), false, "trang người khác không có nút");
  const shell = readFileSync("src/class-social/ClassSocialPage.tsx", "utf8");
  assert.match(shell, /onEditProfile=\{me\.studentId \? \(\) => setEditingProfile\(true\) : undefined\}/, "chỉ tài khoản có hồ sơ học sinh");
});

test("ghi CÙNG nguồn với App học: edu_students.display_name / avatar_url theo hồ sơ của chính mình — không bảng/cột Social riêng", () => {
  const api = readFileSync("src/class-social/profile/profileApi.ts", "utf8");
  assert.match(api, /from\('edu_students'\)\.update\(\{ display_name: name \}\)\.eq\('id', studentId\)/);
  assert.match(api, /from\('edu_students'\)\.update\(\{ avatar_url: up\.value \}\)\.eq\('id', studentId\)/);
  assert.equal(/social_display_name|user_metadata|auth\.updateUser/.test(api), false);
  const portal = readFileSync("src/MobileStudentPortal.tsx", "utf8");
  assert.match(portal, /from\('edu_students'\)\.update\(\{ display_name: v \}\)/, "App học sửa đúng cột này");
  const dlg = readFileSync("src/class-social/profile/ProfileEditDialog.tsx", "utf8");
  assert.match(dlg, /prepareImage\(file, 'avatar'\)/, "dùng lại pipeline ảnh (kiểm loại thật, thu nhỏ)");
  assert.equal(/error\.message|\.message\}/.test(dlg.replace(/r\.message/g, "")), false, "không hiện lỗi thô");
});
