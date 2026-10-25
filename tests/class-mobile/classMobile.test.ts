/**
 * Class Mobile V1 — điều hướng thuần + chốt chặn cấu trúc (năm tab đã thống nhất, không phá App học cũ, không đụng backend).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import {
  MOBILE_TABS, initialNav, selectTab, push, pop, replace, backOr, canPop, currentView, tabOwning, readLastTab, LAST_TAB_KEY, ROOT, type MobileView,
} from "../../src/class-mobile/mobileNav.ts";
import { isClassMobilePath, nativeOpensClassMobile, proxiedHref, CLASS_MOBILE_NATIVE_DEFAULT, CLASS_WEB_ORIGIN } from "../../src/class-mobile/config.ts";

const profile = (userId: string): MobileView => ({ kind: "profile", userId });

test("đúng 5 tab, đúng tên và thứ tự đã thống nhất", () => {
  assert.deepEqual(MOBILE_TABS.map(t => t.label), ["Trang chủ", "Lớp Học", "Ban Nhạc", "Trò chuyện", "Tôi"]);
  assert.deepEqual(MOBILE_TABS.map(t => t.id), ["home", "class", "band", "chat", "me"]);
});

test("mở app: tab Trang chủ, mỗi tab có ngăn xếp riêng chỉ chứa màn gốc", () => {
  const s = initialNav();
  assert.equal(s.tab, "home");
  for (const t of MOBILE_TABS) assert.deepEqual(s.stacks[t.id], [ROOT]);
  assert.equal(canPop(s), false);
});

test("đổi tab không mất vị trí của tab cũ; bấm lại tab đang mở → về màn gốc", () => {
  let s = initialNav();
  s = push(s, profile("u1"));
  s = push(s, { kind: "thread", threadId: "t1" });
  assert.equal(s.stacks.home.length, 3);
  s = selectTab(s, "class");
  assert.equal(s.tab, "class");
  assert.equal(s.stacks.home.length, 3, "tab Trang chủ giữ nguyên ngăn xếp");
  s = selectTab(s, "home");
  assert.equal(currentView(s).kind, "thread", "quay lại đúng màn đang xem");
  s = selectTab(s, "home");
  assert.deepEqual(s.stacks.home, [ROOT], "bấm lại tab = về gốc");
  assert.equal(selectTab(s, "home"), s, "đã ở gốc → không đổi gì");
});

test("push/pop/replace chỉ tác động ngăn xếp của tab đang đứng; pop ở gốc không làm gì", () => {
  let s = initialNav("class");
  s = push(s, { kind: "class", classId: "c1" });
  s = push(s, { kind: "session", classId: "c1", sessionNo: 1 });
  s = replace(s, { kind: "session", classId: "c1", sessionNo: 2 });
  assert.equal(s.stacks.class.length, 3, "replace thay màn trên cùng, không chồng thêm");
  assert.deepEqual(currentView(s), { kind: "session", classId: "c1", sessionNo: 2 });
  assert.equal(s.stacks.home.length, 1);
  s = pop(pop(s));
  assert.deepEqual(s.stacks.class, [ROOT]);
  assert.equal(pop(s), s);
});

test("replace khi đang ở màn gốc → đẩy màn mới (không ghi đè màn gốc)", () => {
  const s = replace(initialNav(), profile("u1"));
  assert.deepEqual(s.stacks.home, [ROOT, profile("u1")]);
});

test("hội thoại luôn thuộc tab Trò chuyện (nhảy tab); màn khác mở ngay tại tab đang đứng", () => {
  assert.equal(tabOwning({ kind: "chatConversation", conversationId: "x" }), "chat");
  assert.equal(tabOwning({ kind: "chatWith", userId: "u" }), "chat");
  assert.equal(tabOwning(profile("u")), null);
  const s = push(initialNav("me"), { kind: "chatWith", userId: "u2" });
  assert.equal(s.tab, "chat");
  assert.equal(s.stacks.me.length, 1, "tab Tôi không bị chồng thêm");
  assert.equal(currentView(s).kind, "chatWith");
  const t = push(initialNav("home"), { kind: "notices" });
  assert.equal(t.tab, "home", "Thông báo mở tại tab đang đứng");
});

test("backOr: còn lịch sử → quay lại; hết (mở thẳng) → về màn cha hợp lý", () => {
  let s = push(initialNav(), profile("u1"));
  s = backOr(s, { kind: "classes" });
  assert.deepEqual(s.stacks.home, [ROOT]);
  s = backOr(s, { kind: "classes" });
  assert.deepEqual(currentView(s), { kind: "classes" });
});

test("lưu/khôi phục tab cuối: chỉ nhận id hợp lệ, lỗi bộ nhớ → Trang chủ", () => {
  const mem = (v: string | null) => ({ getItem: (k: string) => (k === LAST_TAB_KEY ? v : null) });
  assert.equal(readLastTab(mem("chat")), "chat");
  assert.equal(readLastTab(mem("hack")), "home");
  assert.equal(readLastTab(mem(null)), "home");
  assert.equal(readLastTab(null), "home");
  assert.equal(readLastTab({ getItem: () => { throw new Error("blocked"); } }), "home");
});

test("định tuyến: /classapp mọi nền tảng; native chỉ '/' và '/me…' khi bật cờ; web /me KHÔNG bị chiếm", () => {
  assert.ok(isClassMobilePath("/classapp") && isClassMobilePath("/classapp/x"));
  assert.ok(!isClassMobilePath("/app") && !isClassMobilePath("/classapps") && !isClassMobilePath("/me"));
  assert.equal(CLASS_MOBILE_NATIVE_DEFAULT, true);
  assert.ok(nativeOpensClassMobile("/", true) && nativeOpensClassMobile("/me", true) && nativeOpensClassMobile("/me/chat", true));
  assert.ok(!nativeOpensClassMobile("/learn", true), "App học cũ vẫn ở /learn");
  assert.ok(!nativeOpensClassMobile("/", false) && !nativeOpensClassMobile("/me", false), "web không đổi");
});

test("TeamLab / Kho bài giảng là proxy của host class.* → native dùng URL tuyệt đối mở ngoài app", () => {
  assert.deepEqual(proxiedHref("/teamlab", false), { href: "/teamlab", external: false });
  assert.deepEqual(proxiedHref("/teamlab/#/project/x", true), { href: CLASS_WEB_ORIGIN + "/teamlab/#/project/x", external: true });
});

// ── chốt chặn cấu trúc (không phá chức năng cũ, không đụng backend) ──
const read = (p: string) => readFileSync(new URL("../../" + p, import.meta.url), "utf8");

test("khung mới KHÔNG gọi ghi dữ liệu/RPC riêng: chỉ tái dùng trang Class Social", () => {
  const dir = new URL("../../src/class-mobile/", import.meta.url);
  const src = readdirSync(dir).filter(f => /\.tsx?$/.test(f)).map(f => readFileSync(new URL(f, dir), "utf8")).join("\n");
  assert.ok(!/\.insert\(|\.update\(|\.upsert\(|\.delete\(/.test(src), "khung không tự ghi bảng");
  assert.ok(!/supabase\.rpc\(|\.rpc\(/.test(src), "khung không tự gọi RPC mới");
  assert.ok(!/createClient|signUp\(|auth\.admin/.test(src), "không đổi kiến trúc đăng nhập");
  assert.ok(!/Tìm kiếm|type=["']search["']/.test(src.replace(/KHÔNG[^\n]*|Không[^\n]*|ghi nhận[^\n]*/g, "")), "chưa có nút tìm kiếm giả");
});

test("AppRouter: /classapp và native chỉ thêm đường vào; App học cũ (/learn, /start) không bị chiếm", () => {
  const r = read("src/AppRouter.tsx");
  assert.match(r, /isClassMobilePath\(path\) \|\| nativeOpensClassMobile\(path, IS_NATIVE_CAPACITOR\)/);
  assert.match(r, /isLearnPath\(path\)/, "nhánh App học cũ vẫn còn");
  assert.ok(r.indexOf("nativeOpensClassMobile(path") < r.indexOf("path === '/start'"), "đặt trước nhánh cũ để native vào khung mới");
});

test("MobileStudentPortal/StudentOnboarding: embed là prop tùy chọn, mặc định giữ hành vi cũ", () => {
  const p = read("src/MobileStudentPortal.tsx");
  assert.match(p, /embed\?: 'hoc' \| 'tap'/);
  assert.match(p, /height: embed \? '100%' : '100dvh'/);
  assert.match(p, /\{!embed && <div style=\{\{/, "thanh tab cũ chỉ ẩn khi embed");
  const o = read("src/StudentOnboarding.tsx");
  assert.match(o, /!embed && !IS_NATIVE_CAPACITOR/);
});

test("khung 5 tab: thanh tab dưới có Safe Area, vùng chạm ≥ 44, hỗ trợ chế độ tối và giảm chuyển động", () => {
  const css = read("src/class-mobile/classMobile.css");
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /prefers-color-scheme: dark/);
  assert.match(css, /prefers-reduced-motion/);
});

test("file bàn giao tồn tại", () => {
  for (const f of ["config.ts", "mobileNav.ts", "MobileShell.tsx", "ClassMobilePage.tsx", "chrome.tsx", "MoreSheet.tsx", "BandTab.tsx", "LearnMeTabs.tsx", "AccountPage.tsx", "classMobile.css"])
    assert.ok(existsSync(new URL("../../src/class-mobile/" + f, import.meta.url)), f);
});
