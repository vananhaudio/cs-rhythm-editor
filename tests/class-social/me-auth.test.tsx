/**
 * /me là cổng độc lập: khách đăng nhập / đăng xuất NGAY TẠI /me, không bị đá sang /start hay /learn;
 * có link "Trang Class" (/) cùng tab; phiên Supabase dùng chung với trang Class.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// Như tests/tuner: file test nằm ngoài tsconfig.app.json → JSX classic, cần React trong scope
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MeGuestGate, MeNoProfile } from "../../src/class-social/MeGuest";
import { ClassHomeLink } from "../../src/class-social/ui";
import ClassSocialLayout from "../../src/class-social/ClassSocialLayout";
import { CLASS_HOME_PATH, resolveMeRoute } from "../../src/class-social/resolveMeRoute";
import type { ClassIdentity } from "../../src/class-social/useClassSession";
void React;

const read = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8");
const code = (f: string) => read(f).replace(/\/\/.*$/gm, "");   // bỏ comment
const me: ClassIdentity = {
  role: "student", userId: "u1", studentId: "s1", name: "Minh Anh", email: null, avatarUrl: null, level: null,
  enrolledAt: null, htMember: false, isTeacher: false, coverUrl: null,
};

test("Trang Class = '/' và link mở cùng tab", () => {
  assert.equal(CLASS_HOME_PATH, "/");
  const html = renderToStaticMarkup(<ClassHomeLink />);
  assert.match(html, /<a class="cs-classhome" href="\/"/);
  assert.match(html, /Trang Class/);
  assert.equal(/target=/.test(html), false, "không mở tab mới");
});

test("Khách ở /me: form đăng nhập email + mật khẩu, nút Trang Class, không trỏ /start", () => {
  const html = renderToStaticMarkup(<MeGuestGate signIn={async () => null} />);
  assert.match(html, /<form class="cs-guest-form"/);
  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
  assert.match(html, /<button type="submit"[^>]*>Đăng nhập<\/button>/);
  assert.match(html, /href="\/" aria-label="Về Trang Class"/);
  assert.equal(/\/start|\/learn/.test(html), false);
});

test("Đã đăng nhập nhưng chưa có hồ sơ học sinh: có Đăng xuất + App học (bấm mới đi), không tự chuyển", () => {
  const html = renderToStaticMarkup(<MeNoProfile email="a@b.vn" onSignOut={() => {}} />);
  assert.match(html, /a@b\.vn/);
  assert.match(html, />Đăng xuất<\/button>/);
  assert.match(html, /href="\/learn"/);
  assert.match(html, /Trang Class/);
});

test("Top bar khi đã đăng nhập có nút Trang Class", () => {
  const html = renderToStaticMarkup(
    <ClassSocialLayout me={me} section="home" onSection={() => {}} onSignOut={() => {}}><p>x</p></ClassSocialLayout>,
  );
  assert.match(html, /class="cs-classhome" href="\/"/);
});

test("ClassSocialPage KHÔNG còn chuyển khách sang /learn hay /start; đăng xuất ở lại /me", () => {
  const page = code("class-social/ClassSocialPage.tsx");
  assert.equal(/location\.(replace|assign|href)/.test(page), false, "không đổi trang bằng location");
  assert.equal(/LEARN_PATH|'\/start'|'\/learn'/.test(page), false);
  assert.match(page, /session\.status === 'signed-out'\) return <MeGuestGate signIn=\{signInWithPassword\} \/>/);
  assert.match(page, /session\.status === 'no-profile'\) return <MeNoProfile/);
});

test("useClassSession: nghe SIGNED_IN (đăng nhập tại /me) và SIGNED_OUT (đăng xuất → khách)", () => {
  const src = code("class-social/useClassSession.ts");
  assert.match(src, /event === 'SIGNED_OUT'/);
  assert.match(src, /event === 'SIGNED_IN' && session\?\.user\?\.id && session\.user\.id !== loadedUser\.current/);
  assert.match(src, /setTimeout\(load, 0\)/, "không gọi supabase ngay trong callback");
});

test("Một hệ auth duy nhất: /me dùng client supabase chung, không tạo client mới", () => {
  for (const f of ["class-social/useClassSession.ts", "class-social/profile/profileApi.ts", "class-social/MeGuest.tsx"]) {
    const src = code(f);
    assert.equal(/createClient\s*\(/.test(src), false, f);
  }
  assert.match(code("class-social/profile/profileApi.ts"), /supabase\.auth\.signInWithPassword\(/);
  assert.match(code("class-social/profile/profileApi.ts"), /supabase\.auth\.signOut\(\)/);
});

test("Route: class./me vẫn là Social (không redirect), native/timming giữ App học", () => {
  const r = (hostname: string, pathname: string, isNative = false) => resolveMeRoute({ hostname, pathname, search: "", isNative });
  assert.deepEqual(r("class.vananhaudio.com", "/me"), { kind: "social", section: "home" });
  assert.equal(r("timming.vananhaudio.com", "/me"), null);
  assert.equal(r("class.vananhaudio.com", "/me", true), null);
});

test("Router: trang Class (/) vẫn là ClassLandingPage và nút 'Hành trình của tôi' → /me", () => {
  const router = read("AppRouter.tsx");
  assert.match(router, /onClass && \(path === '\/' \|\| path === '\/class' \|\| path\.startsWith\('\/class'\)\)\) \{\s*return <ClassLandingPage \/>/);
  const landing = read("ClassLandingPage.tsx");
  assert.match(landing, /window\.location\.href = '\/me' \}\}>🎸 Hành trình của tôi/);
});
