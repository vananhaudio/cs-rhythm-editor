/**
 * Class Social P0 — ma trận route /me ↔ /learn, và các chốt chặn không đụng App học.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveMeRoute, isLearnPath, sectionFromPath, SECTION_PATHS,
} from "../../src/class-social/resolveMeRoute.ts";
import { levelLabel, monthYear } from "../../src/class-social/format.ts";

const r = (hostname: string, pathname: string, search = "", isNative = false) =>
  resolveMeRoute({ hostname, pathname, search, isNative });

test("class.* /me → Class Social, trang chủ (Tôi + Cộng đồng)", () => {
  assert.deepEqual(r("class.vananhaudio.com", "/me"), { kind: "social", section: "home" });
  assert.deepEqual(r("class.vananhaudio.com", "/me/"), { kind: "social", section: "home" });
});

test("class.* /me/<mục> → đúng mục; /me/<lạ> (kể cả /me/profile cũ) → trang chủ", () => {
  assert.deepEqual(r("class.vananhaudio.com", "/me/friends"), { kind: "social", section: "friends" });
  assert.deepEqual(r("class.vananhaudio.com", "/me/chat/"), { kind: "social", section: "chat" });
  assert.deepEqual(r("class.vananhaudio.com", "/me/profile"), { kind: "social", section: "home" });
  assert.deepEqual(r("class.vananhaudio.com", "/me/khong-co"), { kind: "social", section: "home" });
});

test("deep link cũ /me?tab=… → /learn?tab=… (giữ nguyên toàn bộ query)", () => {
  for (const tab of ["hoc", "tap", "teacher", "me", "home"]) {
    assert.deepEqual(r("class.vananhaudio.com", "/me", `?tab=${tab}`), { kind: "redirect", to: `/learn?tab=${tab}` });
  }
  assert.deepEqual(r("class.vananhaudio.com", "/me", "?tab=hoc&x=1"), { kind: "redirect", to: "/learn?tab=hoc&x=1" });
  assert.deepEqual(r("class.vananhaudio.com", "/me/", "?tab=tap"), { kind: "redirect", to: "/learn?tab=tap" });
  // query khác (không phải tab) KHÔNG bị chuyển
  assert.deepEqual(r("class.vananhaudio.com", "/me", "?utm_source=mail"), { kind: "social", section: "home" });
});

test("ngoài phạm vi: native, timming., localhost → null (giữ routing cũ: /me là App học)", () => {
  assert.equal(r("class.vananhaudio.com", "/me", "", true), null);   // app iOS/Android
  assert.equal(r("localhost", "/me", "", true), null);
  assert.equal(r("timming.vananhaudio.com", "/me"), null);
  assert.equal(r("localhost", "/me"), null);
  assert.equal(r("class2-site.netlify.app", "/me"), null);
});

test("class.* nhưng không phải /me → null (không cướp route khác)", () => {
  for (const p of ["/", "/start", "/learn", "/metronome", "/meta", "/member", "/tuner", "/nhipphach", "/khobaigiang"]) {
    assert.equal(r("class.vananhaudio.com", p), null, p);
  }
});

test("dev: class.localhost bật Social để xem trước", () => {
  assert.deepEqual(r("class.localhost", "/me"), { kind: "social", section: "home" });
});

test("isLearnPath chỉ khớp /learn và /learn/…", () => {
  assert.ok(isLearnPath("/learn"));
  assert.ok(isLearnPath("/learn/"));
  assert.ok(isLearnPath("/learn/x"));
  assert.equal(isLearnPath("/learning"), false);
  assert.equal(isLearnPath("/learnx"), false);
});

test("SECTION_PATHS ↔ sectionFromPath khứ hồi", () => {
  for (const [section, path] of Object.entries(SECTION_PATHS)) {
    assert.equal(sectionFromPath(path), section);
  }
});

test("định dạng: tháng/năm, trình độ", () => {
  assert.equal(monthYear("2026-09-05T00:00:00Z"), "tháng 9/2026");
  assert.equal(monthYear(null), null);
  assert.equal(monthYear("không phải ngày"), null);
  assert.equal(levelLabel("beginner"), "Mới bắt đầu");
  assert.equal(levelLabel("elementary"), "Cơ bản");
  assert.equal(levelLabel("la-la"), null);
});

const SOCIAL_FILES = [
  "ClassSocialPage.tsx", "ClassSocialLayout.tsx", "nav.ts", "ui.tsx", "useClassSession.ts",
  "sections/MeHome.tsx", "sections/IdentityHeader.tsx", "sections/TraBaiCta.tsx",
  "sections/CommunityFeed.tsx", "sections/Friends.tsx", "sections/Chat.tsx",
  "sections/AssignmentComposer.tsx", "sections/PostCard.tsx",
  "posts/postModel.ts", "posts/postsApi.ts", "posts/useCommunityFeed.ts",
  "media/parseExternalMedia.ts", "media/ExternalMediaView.tsx",
  "comments/commentModel.ts", "comments/commentsApi.ts", "comments/lazyApi.ts",
  "tools.ts", "sections/ToolsPage.tsx",
  "profile/imageFile.ts", "profile/profileApi.ts", "profile/useProfileMediaEditor.tsx", "media/safeImageUrl.ts", "comments/khoAdapter.ts", "comments/useFeedComments.ts",
  "sections/comments/CommentsSection.tsx", "sections/comments/CommentItem.tsx", "sections/comments/CommentComposer.tsx",
  "sections/comments/TagPicker.tsx", "sections/comments/KhoResourcePicker.tsx", "sections/comments/ResourceCard.tsx",
];
const read = (f: string) => readFileSync(new URL(`../../src/class-social/${f}`, import.meta.url), "utf8");

// ── Chốt chặn cấu trúc router ────────────────────────────────────────────────
const router = readFileSync(new URL("../../src/AppRouter.tsx", import.meta.url), "utf8");

test("router: nhánh Social đứng TRƯỚC nhánh App học, và App học nhận /learn", () => {
  const social = router.indexOf("resolveMeRoute({");
  const learn = router.indexOf("isLearnPath(path)");
  assert.ok(social > 0, "có nhánh Social");
  assert.ok(learn > social, "nhánh /learn nằm sau Social");
  const learnBranch = router.slice(learn - 200, router.indexOf("}", learn));
  assert.match(learnBranch, /path === '\/start'/, "/start vẫn vào App học");
  assert.match(router.slice(learn, learn + 300), /return <StudentOnboarding \/>/, "/learn render StudentOnboarding");
});

test("router: Social lazy-load, không import tĩnh", () => {
  assert.match(router, /const ClassSocialPage = lazy\(\(\) => import\('\.\/class-social\/ClassSocialPage'\)\)/);
  assert.equal(/^import ClassSocialPage/m.test(router), false);
});

test("module Social độc lập: không import MobileStudentPortal / StudentOnboarding", () => {
  const files = SOCIAL_FILES;
  for (const f of files) {
    const src = read(f);
    assert.equal(/MobileStudentPortal|StudentOnboarding/.test(src.replace(/\/\/.*$/gm, "")), false, f);
  }
});

test("không dùng chữ 'Sắp có' trong giao diện Social", () => {
  for (const f of SOCIAL_FILES) {
    const src = read(f);
    assert.equal(/sắp có/i.test(src), false, f);
  }
});

test("IA: menu KHÔNG có mục trỏ về chính trang đang đứng (Hoạt động học tập / Trang của tôi)", () => {
  const nav = read("nav.ts");
  assert.equal(/Hoạt động học tập|Trang của tôi/.test(nav), false);
  for (const label of ["Bạn bè", "Trò chuyện", "App học", "Kho bài giảng", "Kho giáo trình", "Thư viện bản nhạc", "Tất cả công cụ"]) {
    assert.ok(nav.includes(`'${label}'`), label);
  }
  const tools = read("tools.ts");
  for (const label of ["Nhịp & Phách", "Tune Lab"]) assert.ok(tools.includes(`'${label}'`), label);
  assert.match(nav, /title: 'Cộng đồng'/);
});

test("IA: logo đưa về /me (trang chủ)", () => {
  const layout = read("ClassSocialLayout.tsx");
  assert.match(layout, /className="cs-brand" href=\{SECTION_PATHS\.home\}/);
  assert.equal(SECTION_PATHS.home, "/me");
});

test("/me = identity → CTA Trả bài → feed cộng đồng, đúng thứ tự", () => {
  const home = read("sections/MeHome.tsx");
  const a = home.indexOf("<IdentityHeader"), b = home.indexOf("<TraBaiCta"), c = home.indexOf("<CommunityFeed");
  assert.ok(a > 0 && a < b && b < c);
});

test("V1: MỘT hành động duy nhất 'Trả bài' — không Hỏi bài / Chia sẻ luyện tập, không chuyển hướng ra ngoài", () => {
  const cta = read("sections/TraBaiCta.tsx").replace(/\/\/.*$/gm, "");
  assert.match(cta, /<span>Trả bài<\/span>/);
  assert.match(cta, /\{open && <AssignmentComposer/);
  assert.equal((cta.match(/<button/g) || []).length, 1, "đúng một nút");
  assert.equal(/href=|zalo|\/story|tab=teacher|location\./i.test(cta), false);
  for (const f of SOCIAL_FILES) {
    const src = read(f).replace(/\/\/.*$/gm, "");
    assert.equal(/Hỏi bài|Chia sẻ luyện tập|Hôm nay bạn cần làm gì|Bạn đang nghĩ gì|InfoDialog/.test(src.replace("question: 'Hỏi bài'", "")), false, f);
  }
});

test("feed cộng đồng không dựng từ dữ liệu tiến độ cá nhân — chỉ class_feed/class_posts", () => {
  for (const f of ["sections/CommunityFeed.tsx", "posts/postsApi.ts", "posts/useCommunityFeed.ts", "sections/MeHome.tsx"]) {
    const src = read(f).replace(/\/\/.*$/gm, "");
    assert.equal(/edu_lesson_progress|student_practice_log|student_songs|student_xp_log/.test(src), false, f);
  }
  const api = read("posts/postsApi.ts");
  assert.match(api, /rpc\('class_feed'/);
  assert.match(api, /from\('class_posts'\)\.insert\(insert\)/);
});

test("không dựng HTML từ dữ liệu người dùng (không dangerouslySetInnerHTML trong Social)", () => {
  for (const f of SOCIAL_FILES) assert.equal(/dangerouslySetInnerHTML|innerHTML\s*=/.test(read(f)), false, f);
});

test("client KHÔNG gửi tác giả / không dùng service role", () => {
  for (const f of ["posts/postsApi.ts", "sections/AssignmentComposer.tsx"]) {
    const src = read(f).replace(/\/\/.*$/gm, "");
    assert.equal(/author_user_id/.test(src), false, f);
  }
  // Kiểu dữ liệu GHI (AssignmentInsert) không có cột tác giả — FeedRow (dữ liệu ĐỌC) thì có
  const model = read("posts/postModel.ts");
  const insertType = model.slice(model.indexOf("export type AssignmentInsert"), model.indexOf("export type DraftCheck"));
  assert.ok(insertType.length > 0);
  assert.equal(/author/.test(insertType), false);
  for (const f of SOCIAL_FILES) assert.equal(/service_role|SERVICE_ROLE/.test(read(f)), false, f);
});


test("Trả bài composer: Video bài tập TRƯỚC, Ghi chú cho Thầy (không bắt buộc) SAU, nút 'Trả bài'", () => {
  const c = read("sections/AssignmentComposer.tsx").replace(/\/\/.*$/gm, "");
  const v = c.indexOf("Video bài tập"), n = c.indexOf("Ghi chú cho Thầy");
  assert.ok(v > 0 && n > v, "video trước ghi chú");
  assert.match(c, /Dán liên kết YouTube, TikTok hoặc Facebook/);
  assert.match(c, /\(không bắt buộc\)/);
  assert.match(c, /Ví dụ: Em gửi bài này Thầy xem giúp\. Đoạn 1:20 em chưa chắc nhịp, Thầy góp ý giúp em ạ\./);
  assert.match(c, /'Đang gửi…' : 'Trả bài'/);
  assert.equal(/Nội dung|Bạn đang nghĩ gì|Trạng thái|Chú thích/.test(c), false);   // chữ hiển thị — Trả bài không phải status
});

test("Adapter Kho CHỈ đọc qua API sẵn có của Kho — không đọc thẳng bảng kho_*, không dùng tìm kiếm AI", () => {
  const a = read("comments/khoAdapter.ts").replace(/\/\/.*$/gm, "");
  assert.match(a, /'\/api\/hocsinh\/catalog'/);
  assert.match(a, /\/api\/hocsinh\/khoa\//);
  assert.equal(/supabase|from\('kho_|\/api\/hocsinh\/tim/.test(a), false);
  assert.match(a, /credentials: 'same-origin'/);
});

test("Công cụ Thầy chỉ hiện khi me.isTeacher; client không tự gửi tag/đính kèm khi không phải Thầy", () => {
  const c = read("sections/comments/CommentComposer.tsx");
  assert.match(c, /tagIds: teacher \? tags\.map\(t => t\.id\) : \[\], resources: teacher \? resources : \[\]/);
  assert.match(c, /\{teacher && \(\s*<div className="cs-cmt-tools">/);
});

test("Công cụ âm nhạc: CHỈ công cụ thật — route có nhánh trong AppRouter, id khớp edu_tools, không thử nghiệm/chỉ-thầy", () => {
  const tools = read("tools.ts");
  const router = readFileSync(new URL("../../src/AppRouter.tsx", import.meta.url), "utf8");
  const entries = [...tools.matchAll(/\{ id: '([a-z-]+)', label: '([^']+)', hint: '[^']+', href: '([^']+)'/g)].map(m => ({ id: m[1], label: m[2], href: m[3] }));
  assert.equal(entries.length, 9, JSON.stringify(entries.map(e => e.id)));
  const EDU_TOOLS_ON = ["metronome", "nhipphach", "tap-beat", "song-builder", "tuner", "chord-seeing", "note-sheet", "guitar-board", "piano-journey"];
  assert.deepEqual(entries.map(e => e.id).sort(), [...EDU_TOOLS_ON].sort(), "id = edu_tools đang bật (audit 24/09/2026)");
  for (const e of entries) {
    assert.match(e.href, /^\/[a-z-]+$/, e.id);
    const p = e.href.replace(/\//g, "\\/");
    assert.ok(new RegExp(`path === ['"]${p}['"]|NHIPPHACH_PATHS: readonly string\\[\\] = \\['${p}'`).test(router), `AppRouter có route ${e.href}`);
  }
  for (const bad of ["/chord-trainer", "/chord-ame", "/piano-player", "/groove", "/gp-editor", "/editor", "/strum-builder", "/tempo", "'#'"]) {
    assert.equal(tools.includes(`href: '${bad}'`) || tools.includes(`href: ${bad}`), false, bad);
  }
  const featured = (tools.match(/featured: true/g) || []).length;
  assert.ok(featured >= 4 && featured <= 6, `sidebar gọn: ${featured} công cụ nổi bật + "Tất cả công cụ"`);
  assert.equal(/sắp có/i.test(tools), false);
});

test("Social chỉ điều hướng tới công cụ — không tự cấp quyền, không iframe lại", () => {
  for (const f of ["tools.ts", "sections/ToolsPage.tsx", "nav.ts"]) {
    const src = read(f).replace(/\/\/.*$/gm, "");
    assert.equal(/<iframe|my_tool_route_access|flags|entitlement|supabase/.test(src), false, f);
  }
  assert.match(read("sections/ToolsPage.tsx"), /<a className="cs-card cs-tool" href=\{t\.href\}>/);
});
