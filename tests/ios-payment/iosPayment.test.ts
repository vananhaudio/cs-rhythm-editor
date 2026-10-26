/**
 * Chốt chặn thanh toán iOS (Guideline 3.1.1) — logic thuần + kiểm cấu trúc các trang tuyển sinh.
 * Web / Android KHÔNG đổi; iOS native không được thấy giá VND / QR / Đăng ký qua Zalo / "Tôi đã chuyển khoản".
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isIosNativeStorefrontFor, isIosNativeStorefront } from "../../src/iosPaymentPolicy.ts";

const src = (p: string) => readFileSync(new URL(`../../src/${p}`, import.meta.url), "utf8");

test("chốt chặn: chỉ native + iOS mới là true (mọi tổ hợp)", () => {
  for (const isNative of [true, false]) {
    for (const platform of ["ios", "android", "web"]) {
      assert.equal(isIosNativeStorefrontFor({ isNative, platform }), isNative && platform === "ios", `${isNative}/${platform}`);
    }
  }
});

test("môi trường test (không phải app iOS) → false, nhánh web giữ nguyên", () => {
  assert.equal(isIosNativeStorefront(), false);
});

test("ClassLandingPage: vỏ chốt chặn đứng trước thân; QR/chuyển khoản/Zalo/Mira shop chỉ nằm trong thân web", () => {
  const s = src("ClassLandingPage.tsx");
  const wrap = s.indexOf("export default function ClassLandingPage()");
  const body = s.indexOf("function ClassLandingPageWeb()");
  assert.ok(wrap > 0 && body > wrap, "có vỏ + thân");
  const shell = s.slice(wrap, body);
  assert.match(shell, /isIosNativeStorefront\(\)\) return <IosProgramInfoPage \/>/);
  assert.match(shell, /return <ClassLandingPageWeb \/>/);
  const before = s.slice(0, body);
  for (const bad of ["payment_qr", "Tôi đã chuyển khoản", "Đăng ký qua Zalo", "mira-vananhaudio.netlify.app/shop"]) {
    assert.ok(!before.slice(0, wrap).includes(bad) && !shell.includes(bad), `${bad} không render ngoài thân web`);
    assert.ok(s.includes(bad), `${bad} vẫn có ở nhánh web (không đổi)`);
  }
  assert.equal((s.match(/<ClassLandingPageWeb/g) ?? []).length, 1, "thân web chỉ được dựng qua vỏ");
});

test("trang trung tính iOS: không giá/QR/Zalo đăng ký; Shop (hàng vật lý) mở ngoài app bằng openExternalUrl", () => {
  const s = src("components/IosProgramInfoPage.tsx");
  for (const bad of ["payment_qr", "chuyển khoản", "Đăng ký qua Zalo", "zalo.me", "price", "mira-vananhaudio", /\d{3}\.000/ ]) {
    assert.ok(typeof bad === "string" ? !s.includes(bad) : !bad.test(s), String(bad));
  }
  assert.match(s, /openExternalUrl\(SHOP_URL\)/);
  assert.ok(!/href=\{SHOP_URL\}/.test(s), "không điều hướng WebView tới Shop");
});

test("Solo01Page: giá, nút/CTA Zalo, số Zalo đều qua iosStore", () => {
  const s = src("Solo01Page.tsx");
  assert.match(s, /const iosStore = isIosNativeStorefront\(\)/);
  assert.match(s, /\{!iosStore && <section id="hocphi"/);
  assert.match(s, /\{!iosStore && <a className="solo01-btn primary" href=\{ZALO_LINK\}[^>]*>ĐĂNG KÝ HỌC/);
  assert.match(s, /\{!iosStore && <a className="solo01-btn primary" href=\{ZALO_LINK\}[^>]*>ĐĂNG KÝ SOLO-01/);
  assert.match(s, /\{!iosStore && <span className="solo01-foot-right">Zalo/);
  assert.match(s, /iosStore \? \['24 buổi', '3 chặng'[^\]]*\] : \[[^\]]*499k/);
  assert.match(s, /\{!iosStore && <a href="#hocphi"/);
});

test("Hanhtrinh2027Page: bảng giá, CTA đăng ký Zalo, số Zalo đều qua iosStore", () => {
  const s = src("Hanhtrinh2027Page.tsx");
  assert.match(s, /const iosStore = isIosNativeStorefront\(\)/);
  assert.match(s, /cta !== 'member' && !iosStore && \(\s*<section id="pricing"/);
  for (const k of ["anon", "eligible", "other"]) assert.ok(s.includes(`cta === '${k}' && !iosStore`), k);
  assert.match(s, /\{!iosStore && <span className="ht2027-foot-right">Zalo/);
  assert.ok(!/cta === 'member' && !iosStore/.test(s), "thẻ 'đã có quyền' giữ nguyên trên iOS");
});

test("giáo trình: link 'Về chương trình' đích là /solo01 và /hanhtrinh2027 — hai trang này đã qua chốt chặn", () => {
  assert.match(src("lesson/Solo01LessonPage.tsx"), /href="\/solo01"/);
  assert.match(src("lesson/Ht2027LessonPage.tsx"), /const BACK = '\/hanhtrinh2027'/);
  assert.match(src("lesson/LessonDocument.tsx"), /m\.backHref \?\? '\/solo01'/);
});

test("giữ nguyên: /subscribe (IAP), Gói của tôi, class-mobile không dẫn tới trang tuyển sinh/thanh toán ngoài", () => {
  const sub = src("SubscriptionPage.tsx");
  assert.ok(!sub.includes("iosPaymentPolicy"), "SubscriptionPage không bị chốt chặn");
  assert.match(sub, /Quản lý đăng ký/);
  assert.match(sub, /[Kk]hôi phục/);
  for (const f of ["class-mobile/AccountPage.tsx", "class-mobile/LearnMeTabs.tsx", "class-mobile/MoreSheet.tsx"]) {
    const s = src(f);
    for (const bad of ["payment_qr", "chuyển khoản", "Đăng ký qua Zalo", "/solo01", "/hanhtrinh2027", "href=\"/class\""]) assert.ok(!s.includes(bad), `${f}: ${bad}`);
  }
  assert.match(src("class-mobile/AccountPage.tsx"), /href="\/subscribe"/);
});
