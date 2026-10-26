/**
 * Class Mobile V1 — điều hướng thuần + chốt chặn cấu trúc (năm tab đã thống nhất, không phá App học cũ, không đụng backend).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import {
  MOBILE_TABS, initialNav, selectTab, push, pop, replace, backOr, canPop, currentView, tabOwning, readLastTab, LAST_TAB_KEY, ROOT, type MobileView,
} from "../../src/class-mobile/mobileNav.ts";
import { isTextEntry } from "../../src/class-mobile/useKeyboardOpen.ts";
import { barFor } from "../../src/class-mobile/shellBar.ts";
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

test("V1.2 bàn phím: chỉ ô nhập chữ mới ẩn thanh tab", () => {
  assert.equal(isTextEntry("TEXTAREA"), true);
  assert.equal(isTextEntry("input", "text"), true);
  assert.equal(isTextEntry("INPUT", null), true);
  assert.equal(isTextEntry("input", "email"), true);
  assert.equal(isTextEntry("input", "checkbox"), false);
  assert.equal(isTextEntry("input", "submit"), false);
  assert.equal(isTextEntry("button"), false);
  assert.equal(isTextEntry("div", null, true), true, "contenteditable");
  assert.equal(isTextEntry("div"), false);
  const css = read("src/class-mobile/classMobile.css");
  assert.match(css, /\.cm-root\.is-keyboard \.cm-tabbar \{ display: none; \}/);
  assert.match(read("src/class-mobile/MobileShell.tsx"), /useKeyboardOpen\(\)/);
});

// ── 1.6.0 S1: một khung — một tiêu đề — một nút Quay lại; không còn lối vào App học cũ toàn màn hình ──
test("S1-A: Đổi mật khẩu và Người đã chặn là màn của khung, Quay lại về đúng Tài khoản & cài đặt", () => {
  let s = selectTab(initialNav(), "me");
  s = push(s, { kind: "account" });
  s = push(s, { kind: "password" });
  assert.equal(currentView(s).kind, "password");
  s = pop(s);
  assert.equal(currentView(s).kind, "account", "Quay lại về Tài khoản & cài đặt, không về tab gốc");
  s = push(s, { kind: "blocked" });
  s = pop(s);
  assert.equal(currentView(s).kind, "account");
});

test("S1-A: khung không dẫn sang App học cũ (/learn) từ ▦ và Tài khoản", () => {
  for (const f of ["src/class-mobile/MoreSheet.tsx", "src/class-mobile/AccountPage.tsx"]) {
    assert.doesNotMatch(read(f), /["'`]\/learn[?"'`]/, f + " không còn liên kết /learn");
  }
  assert.match(read("src/class-mobile/ChangePasswordPage.tsx"), /supabase\.auth\.updateUser\(\{ password/);
});

test("S1-B: vào màn con của Khoá tự học → khung ẩn tiêu đề 'Lớp Học' + phân đoạn (một header duy nhất)", () => {
  const learn = read("src/class-mobile/LearnMeTabs.tsx");
  assert.match(learn, /embedDeep = deep && seg === 'courses'/);
  assert.match(learn, /!embedDeep && <h1 className="cm-title">Lớp Học<\/h1>/);
  assert.match(read("src/MobileStudentPortal.tsx"), /onDeepChange\?\.\(!!embed && tab === 'hoc' && screen !== 'home'\)/);
});

test("S1-C: 'Lớp của tôi' không lặp trong Class Mobile; web /me giữ tiêu đề", () => {
  const page = read("src/class-social/classes/ClassesPage.tsx");
  assert.match(page, /hideTitle = false/);
  assert.match(page, /!hideTitle && <h1 className="cs-page-title">Lớp của tôi<\/h1>/);
  assert.match(read("src/class-mobile/LearnMeTabs.tsx"), /<ClassesPage [^>]*hideTitle/);
  assert.doesNotMatch(read("src/class-social/ClassSocialPage.tsx"), /ClassesPage[^\n]*hideTitle/);
});

test("S1-D: Thông báo là màn riêng trong khung, không nhắc 'Class 2.0'", () => {
  const shell = read("src/class-mobile/MobileShell.tsx");
  assert.match(shell, /case 'notices':\n\s+return <NoticesPage/);
  const notices = read("src/class-mobile/NoticesPage.tsx");
  assert.match(notices, /<h1 className="cm-title">Thông báo<\/h1>/);
  assert.match(notices, /SystemNoticeView bare/);
  const view = read("src/class-social/chat/SystemNoticeView.tsx");
  assert.match(view, /!bare && <header/);
  assert.match(view, /!bare && <div className="cs-chat-locked"/);
});

test("S1-E (UI-shell): một thanh điều hướng duy nhất; nút riêng của màn con vẫn ẩn trong .cm-root", () => {
  const deep: MobileView[] = [{ kind: "account" }, { kind: "notices" }, { kind: "blocked" }, { kind: "password" }, { kind: "bands" }, { kind: "bandAdmin", slug: "x" }, { kind: "profile", userId: "u" }, { kind: "thread", threadId: "t" }, { kind: "queue" }, { kind: "session", classId: "c", sessionNo: 1 }, { kind: "section", section: "friends" }, { kind: "section", section: "tools" }];
  for (const v of deep) assert.equal(barFor(v, "me").back, true, v.kind + " có \"‹\" trên thanh của khung");
  const css = read("src/class-mobile/classMobile.css");
  assert.match(css, /\.cm-root \.cs-profile-back, \.cm-root \.cs-band-back, \.cm-root \.cs-back-btn \{ display: none; \}/);
  assert.doesNotMatch(read("src/class-social/classSocial.css"), /cm-root/, "không đổi CSS web /me");
  assert.doesNotMatch(read("src/class-mobile/MobileShell.tsx"), /<BackBar|BACKBAR_KINDS/, "không còn hàng Quay lại riêng dưới thanh trên");
});

// ── 1.6.0 S3: Ban Nhạc — Chat Band đúng phòng, một lối vào Quản lý Band, bỏ ghi chú "chưa nhúng" ──
import { bandRoomsOfTeam, toBandConversations, type ConversationItem } from "../../src/class-social/chat/chatModel.ts";

const rooms = toBandConversations([
  { band_id: "B1", band_name: "Lá Mùa Thu", cover_path: null, project_id: "AAAA-1", project_avatar_path: null, last_seq: 3, last_body: "hi", last_sender_name: "An", last_mine: false, last_at: "2026-10-01T00:00:00Z", unread: 2, member_count: 4, can_send: true },
  { band_id: "B2", band_name: "Infinity", cover_path: null, project_id: "bbbb-2", project_avatar_path: null, last_seq: 0, last_body: null, last_sender_name: null, last_mine: null, last_at: null, unread: 0, member_count: 3, can_send: false, support: true },
  { band_id: "B3", band_name: "Cùng Team", cover_path: null, project_id: "aaaa-1", project_avatar_path: null, last_seq: 0, last_body: null, last_sender_name: null, last_mine: null, last_at: null, unread: 0, member_count: 2, can_send: true },
]);

test("S3: phòng chat khớp Team qua project_id (không phân biệt hoa/thường), không đoán khi không khớp", () => {
  assert.deepEqual(bandRoomsOfTeam(rooms, "aaaa-1").map(r => r.id).sort(), ["band:b1", "band:b3"]);
  assert.deepEqual(bandRoomsOfTeam(rooms, "BBBB-2").map(r => r.id), ["band:b2"]);
  assert.deepEqual(bandRoomsOfTeam(rooms, "zzz"), []);
  assert.deepEqual(bandRoomsOfTeam(null, "aaaa-1"), []);
  assert.deepEqual(bandRoomsOfTeam(rooms, ""), []);
  const dm: ConversationItem = { ...rooms[0], kind: "dm", projectId: "aaaa-1" };
  assert.deepEqual(bandRoomsOfTeam([dm], "aaaa-1"), [], "hội thoại cá nhân không bao giờ là phòng Band");
});

test("S3: mở phòng Band giữ trong tab Ban Nhạc, Quay lại về đúng tab Ban Nhạc", () => {
  let s = selectTab(initialNav(), "band");
  s = push(s, { kind: "chatConversation", conversationId: "band:b1" }, "band");
  assert.equal(s.tab, "band", "không nhảy sang tab Trò chuyện");
  assert.equal(currentView(s).kind, "chatConversation");
  s = pop(s);
  assert.equal(s.tab, "band");
  assert.equal(currentView(s).kind, "tabRoot");
  const jumped = push(selectTab(initialNav(), "band"), { kind: "chatConversation", conversationId: "x" });
  assert.equal(jumped.tab, "chat", "đường cũ (không chỉ định tab) vẫn thuộc Trò chuyện");
});

test("S3: BandTab — Chat Band mở thẳng phòng, không còn ghi chú 'chưa nhúng', không tạo phòng", () => {
  const tab = read("src/class-mobile/BandTab.tsx");
  assert.doesNotMatch(tab, /chưa nhúng/);
  assert.match(tab, /chatRows\(b, rooms, onOpenBandChat, onOpenChat\)/);
  const rows = read("src/class-mobile/BandChatRows.tsx");
  assert.match(rows, /bandRoomsOfTeam\(rooms, b\.id\)/);
  assert.match(rows, /Band này chưa có nhóm chat/);
  assert.match(rows, /onOpenBandChat\(r\.id\)/);
  assert.match(read("src/class-mobile/MobileShell.tsx"), /onOpenBandChat=\{id => go\(\{ kind: 'chatConversation', conversationId: id \}, 'band'\)\}/);
  const api = read("src/class-social/chat/chatApi.ts");
  assert.match(api, /fetchBandRooms[\s\S]{0,200}bandchat_rooms/);
  assert.doesNotMatch(api.slice(api.indexOf("export async function fetchBandRooms"), api.indexOf("export async function fetchUnreadCount")), /bandchat_send|insert|upsert/);
});

test("S3: Quản lý Band chỉ còn MỘT lối vào (tab Ban Nhạc, chỉ Thầy); Trang chủ và ▦ không lặp", () => {
  const shell = read("src/class-mobile/MobileShell.tsx");
  assert.equal((shell.match(/onOpenBands=/g) ?? []).length, 1, "chỉ BandTab nhận onOpenBands");
  assert.doesNotMatch(read("src/class-mobile/MoreSheet.tsx"), /onOpenBands|Quản lý Band/);
  assert.match(read("src/class-mobile/BandTab.tsx"), /\{isTeacher && \(/);
  assert.match(read("src/class-social/sections/MeHome.tsx"), /me\.isTeacher && onOpenBands/, "web /me giữ nguyên");
  assert.match(read("src/class-mobile/classMobile.css"), /\.cm-root \.cs-band-admin \.cs-page-title/);
});

import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chatRows } from "../../src/class-mobile/BandChatRows.tsx";

test("S3: hàng Chat Band — dự phòng / khoá / một phòng / nhiều phòng", () => {
  const render = (r: ConversationItem[] | null, id: string) => renderToStaticMarkup(h("ul", null, chatRows({ id, name: "T" }, r, () => undefined, () => undefined)));
  const fallback = render(null, "aaaa-1");
  assert.match(fallback, /<button[^>]*>.*Chat Band.*Mở Trò chuyện/s, "chưa đọc được phòng → về danh sách Trò chuyện");
  const none = render(rooms, "zzz");
  assert.match(none, /aria-disabled="true"/);
  assert.doesNotMatch(none, /<button/);
  assert.match(none, /Band này chưa có nhóm chat/);
  const one = render(rooms, "bbbb-2");
  assert.match(one, /<button/);
  assert.match(one, /Chat Band/);
  assert.match(one, /Chỉ xem/, "Thầy/Admin xem hỗ trợ (support) → chỉ xem");
  const two = render(rooms, "aaaa-1");
  assert.equal((two.match(/<button/g) ?? []).length, 2);
  assert.match(two, /Chat Lá Mùa Thu/);
  assert.match(two, /Chat Cùng Team/);
  assert.match(two, /2 tin chưa đọc/);
});

// ── 1.6.0 S4: Studio TeamLab ngay trong app (iframe cùng origin), không Safari ──
import {
  studioSrc, parseStudioMessage, reduceStudio, showShellBack, backAction, INITIAL_STUDIO, FROM_STUDIO, STUDIO_READY_TIMEOUT_MS, type StudioState,
} from "../../src/class-mobile/studioBridge.ts";

const PID = "11111111-2222-4333-8444-555555555555";
const FRAME = { id: "iframe-window" };
const msg = (data: unknown, over: Record<string, unknown> = {}) => ({ origin: "https://localhost", source: FRAME, data, ...over });

test("S4: địa chỉ Studio cùng origin, id Team hợp lệ mới ghép vào hash", () => {
  assert.equal(studioSrc(PID), `/teamlab/index.html?classapp=1#/project/${PID}`);
  assert.equal(studioSrc(), "/teamlab/index.html?classapp=1");
  assert.equal(studioSrc("../../x?y=1#z"), "/teamlab/index.html?classapp=1", "id lạ không chui vào URL");
  assert.doesNotMatch(studioSrc(PID), /^https?:/, "không URL tuyệt đối → không ra ngoài app");
});

test("S4: chỉ nhận tin nhắn từ đúng iframe, cùng origin, đúng dạng", () => {
  assert.deepEqual(parseStudioMessage(msg({ source: FROM_STUDIO, type: "ready" }), FRAME, "https://localhost"), { type: "ready" });
  assert.deepEqual(parseStudioMessage(msg({ source: FROM_STUDIO, type: "state", ownBack: true }), FRAME, "https://localhost"), { type: "state", ownBack: true });
  assert.deepEqual(parseStudioMessage(msg({ source: FROM_STUDIO, type: "state" }), FRAME, "https://localhost"), { type: "state", ownBack: false });
  for (const bad of [
    msg({ source: FROM_STUDIO, type: "ready" }, { origin: "https://evil.example" }),
    msg({ source: FROM_STUDIO, type: "ready" }, { source: {} }),
    msg({ source: "other", type: "ready" }),
    msg({ source: FROM_STUDIO, type: "rm-rf" }),
    msg(null),
  ]) assert.equal(parseStudioMessage(bad, FRAME, "https://localhost"), null);
  assert.equal(parseStudioMessage(msg({ source: FROM_STUDIO, type: "ready" }), null, "https://localhost"), null, "chưa có iframe → bỏ");
});

test("S4: vòng đời Studio — tải → sẵn sàng; lỗi/hết hạn/mất mạng; Thử lại", () => {
  let s: StudioState = INITIAL_STUDIO;
  assert.equal(s.status, "loading");
  s = reduceStudio(s, { type: "ready" });
  assert.equal(s.status, "ready");
  assert.equal(reduceStudio(s, { type: "timeout" }).status, "ready", "đã sẵn sàng thì timeout muộn không phá");
  assert.equal(reduceStudio(INITIAL_STUDIO, { type: "timeout" }).status, "error");
  assert.equal(reduceStudio(INITIAL_STUDIO, { type: "offline" }).status, "offline");
  assert.equal(reduceStudio(INITIAL_STUDIO, { type: "auth-required" }).status, "auth", "không đủ quyền/phiên → báo, không chuyển trang");
  assert.deepEqual(reduceStudio({ status: "error", ownBack: false }, { type: "retry" }), INITIAL_STUDIO);
  assert.ok(STUDIO_READY_TIMEOUT_MS >= 10000 && STUDIO_READY_TIMEOUT_MS <= 60000);
});

test("S4: MỘT nút Quay lại — khung chỉ hiện khi Studio chưa có nút riêng; bấm: sẵn sàng → nhờ Studio lùi, còn lại → thoát", () => {
  const ready = (ownBack: boolean): StudioState => ({ status: "ready", ownBack });
  assert.equal(showShellBack(ready(false)), true);
  assert.equal(showShellBack(ready(true)), false, "Studio có nút riêng → khung ẩn, không hai nút");
  assert.equal(showShellBack(INITIAL_STUDIO), true, "đang tải vẫn thoát được");
  assert.equal(showShellBack({ status: "error", ownBack: true }), true);
  assert.equal(backAction(ready(false)), "ask-studio");
  assert.equal(backAction(INITIAL_STUDIO), "exit");
  assert.equal(backAction({ status: "error", ownBack: false }), "exit");
});

test("S4: Band → Studio → Band giữ trong tab Ban Nhạc; Quay lại về Ban Nhạc", () => {
  let s = selectTab(initialNav(), "band");
  s = push(s, { kind: "studio", projectId: PID }, "band");
  assert.equal(s.tab, "band");
  assert.equal(currentView(s).kind, "studio");
  s = pop(s);
  assert.equal(s.tab, "band");
  assert.equal(currentView(s).kind, "tabRoot");
});

test("S4: native mở Studio trong app (không target=_blank/Safari); web giữ liên kết; build đóng gói TeamLab", () => {
  const tab = read("src/class-mobile/BandTab.tsx");
  assert.match(tab, /IS_NATIVE_CAPACITOR \? \(\s+<button[\s\S]*?onClick=\{\(\) => onOpenStudio\(b\.id\)\}/);
  assert.match(tab, /studio\.external \? \{ target: '_blank'/, "web giữ liên kết như cũ");
  const more = read("src/class-mobile/MoreSheet.tsx");
  assert.match(more, /IS_NATIVE_CAPACITOR\s+\? <Row[\s\S]*?onClick=\{\(\) => \{ onClose\(\); onOpenStudio\(\) \}\}/);
  const page = read("src/class-mobile/StudioPage.tsx");
  assert.match(page, /allow="microphone; autoplay; fullscreen"/);
  assert.doesNotMatch(page, /window\.open|target=|https?:\/\//, "Studio không mở ngoài app");
  assert.match(read("src/class-mobile/MobileShell.tsx"), /case 'studio':\s+return <StudioPage/);
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts["build:native"], /build-teamlab-embed\.mjs/);
  assert.doesNotMatch(pkg.scripts.build, /teamlab/i, "build web KHÔNG đóng gói TeamLab (web vẫn proxy /teamlab)");
  assert.match(read("ios-embed/teamlab.ref"), /^[0-9a-f]{40}\s*$/);
  assert.match(read("scripts/build-teamlab-embed.mjs"), /classapp/);
});

// ── UI-shell: một ứng dụng — một thanh điều hướng — một vùng nội dung ──
test("UI-shell: tab gốc ghi tên màn trên thanh (Trang chủ giữ thương hiệu); tiêu đề lớn của trang không hiện lặp", () => {
  assert.deepEqual(barFor(ROOT, "home"), { title: null, back: false, hidePageTitle: false });
  for (const [tab, title] of [["class", "Lớp Học"], ["band", "Ban Nhạc"], ["chat", "Trò chuyện"], ["me", "Tôi"]] as const) {
    assert.equal(barFor(ROOT, tab).title, title);
    assert.equal(barFor(ROOT, tab).back, false);
  }
  assert.equal(barFor(ROOT, "class").hidePageTitle, true);
});

test("UI-shell: màn có tên NỘI DUNG (hồ sơ, buổi, trao đổi…) giữ tên nội dung trong trang; màn tĩnh nhường tên cho thanh", () => {
  for (const v of [{ kind: "profile", userId: "u" }, { kind: "thread", threadId: "t" }, { kind: "session", classId: "c", sessionNo: 1 }, { kind: "bandAdmin", slug: "s" }] as MobileView[]) {
    assert.equal(barFor(v, "me").hidePageTitle, false, v.kind + " giữ tên nội dung");
  }
  for (const v of [{ kind: "account" }, { kind: "notices" }, { kind: "blocked" }, { kind: "password" }] as MobileView[]) {
    assert.equal(barFor(v, "me").hidePageTitle, true, v.kind + " nhường tên cho thanh");
  }
  assert.deepEqual(barFor({ kind: "class", classId: "c" } as MobileView, "class"), { title: null, back: false, hidePageTitle: false }, "màn lớp giữ như cũ");
});

test("UI-shell: một hệ lề — main không lề, trang tự có 16px; Studio tràn mép; không khung desktop", () => {
  const css = read("src/class-mobile/classMobile.css");
  assert.match(css, /\.cm-root \.cs-main \{ padding: 8px 0 16px; \}/);
  assert.match(css, /\.cm-root \.cs-main > \.cs-col, \.cm-root \.cs-main > \.cs-col-wide \{ max-width: none; padding-left: 16px; padding-right: 16px; \}/);
  assert.match(css, /\.cm-studio-wrap \{[^}]*margin-top: -8px; margin-bottom: -16px;/);
  assert.match(css, /\.cm-root\[data-bar-title\] \.cm-content h1\.cm-title/);
  const shell = read("src/class-mobile/MobileShell.tsx");
  assert.match(shell, /data-bar-title=\{bar\.hidePageTitle \? '1' : undefined\}/);
  assert.match(shell, /view\.kind === 'studio' \? studioBack\?\.fn \?\? null/, "Studio báo nút \"‹\" lên thanh của khung");
  assert.doesNotMatch(read("src/class-mobile/StudioPage.tsx"), /BackBar/, "Studio không tự dựng thêm hàng Quay lại");
});

import { TopBar } from "../../src/class-mobile/chrome.tsx";

test("UI-shell: TopBar render — thương hiệu / tên tab / '‹' + tên màn; mỗi màn chỉ một nút quay lại", () => {
  const html = (title: string | null, onBack: (() => void) | null) => renderToStaticMarkup(h(TopBar, { noticeCount: 0, title, onBack, onHome: () => undefined, onNotices: () => undefined, onMore: () => undefined }));
  const home = html(null, null);
  assert.match(home, /Thầy Văn Anh Guitar/);
  assert.doesNotMatch(home, /Quay lại/);
  const root = html("Lớp Học", null);
  assert.match(root, /class="cm-brand"[\s\S]*Lớp Học/, "tab gốc: logo + tên tab trên thanh");
  assert.doesNotMatch(root, /Thầy Văn Anh Guitar<\/span>/);
  const deep = html("Đổi mật khẩu", () => undefined);
  assert.equal((deep.match(/aria-label="Quay lại"/g) ?? []).length, 1);
  assert.match(deep, /<h1 class="cm-top-title">Đổi mật khẩu<\/h1>/);
  assert.doesNotMatch(deep, /class="cm-brand"/, "màn sâu: không lặp thương hiệu");
  assert.match(deep, /aria-label="Thông báo"/);
  assert.match(deep, /Chức năng khác/);
});
