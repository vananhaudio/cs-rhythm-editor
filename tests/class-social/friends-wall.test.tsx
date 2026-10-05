/**
 * Bạn bè + Tường (Social V1): route /me/u/<id>, model quan hệ, bài viết trên tường, render,
 * và các chốt chặn nguồn (quyền thật nằm ở DB — xem scripts/test-friends-wall-db.sh).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// Như tests/tuner: file test nằm ngoài tsconfig.app.json → JSX classic, cần React trong scope
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  profilePath, profileUserIdFromPath, resolveMeRoute, sameView, viewFromPath, viewPath,
} from "../../src/class-social/resolveMeRoute";
import {
  lockedWallText, relationshipUi, toPeople, toProfile, toRelationship,
} from "../../src/class-social/friends/friendModel";
import { POST_TYPE_LABEL, checkWallDraft, toFeedPost, type FeedRow } from "../../src/class-social/posts/postModel";
import PostCard from "../../src/class-social/sections/PostCard";
import { PersonLink } from "../../src/class-social/ui";
void React;

const ID = "0b6f7c1e-5d2a-4c3b-9a8e-1f2d3c4b5a69";
const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const code = (f: string) => read(f).replace(/\/\/.*$/gm, "");

// ── Route ────────────────────────────────────────────────────────────────────
test("/me/u/<uuid> ↔ trang cá nhân; id lạ không phải trang cá nhân", () => {
  assert.equal(profilePath(ID), `/me/u/${ID}`);
  assert.equal(profileUserIdFromPath(`/me/u/${ID}`), ID);
  assert.equal(profileUserIdFromPath(`/me/u/${ID.toUpperCase()}/`), ID);
  for (const p of ["/me/u/", "/me/u/abc", "/me/u/1; drop table", `/me/u/${ID}/x`, "/me/friends", "/me"]) {
    assert.equal(profileUserIdFromPath(p), null, p);
  }
  assert.deepEqual(viewFromPath(`/me/u/${ID}`), { kind: "profile", userId: ID });
  assert.deepEqual(viewFromPath("/me/friends"), { kind: "section", section: "friends" });
  for (const v of [{ kind: "profile" as const, userId: ID }, { kind: "section" as const, section: "chat" as const }]) {
    assert.ok(sameView(viewFromPath(viewPath(v)), v));
  }
  assert.equal(sameView({ kind: "profile", userId: ID }, { kind: "section", section: "home" }), false);
  // Router vẫn đưa /me/u/… vào Class Social (ClassSocialPage tự đọc id từ URL)
  assert.equal(resolveMeRoute({ hostname: "class.vananhaudio.com", pathname: `/me/u/${ID}`, search: "", isNative: false })?.kind, "social");
});

// ── Model quan hệ ────────────────────────────────────────────────────────────
test("Nút theo quan hệ kiểu Facebook (chi tiết V2: tests/class-social/friends-ux-v2.test.tsx)", () => {
  assert.equal(relationshipUi("none")?.direct, "send");
  assert.equal(relationshipUi("outgoing")?.label, "Đã gửi lời mời");
  assert.deepEqual(relationshipUi("incoming")?.menu.map(a => a.label), ["Xác nhận", "Xóa lời mời"]);
  assert.equal(relationshipUi("friends")?.label, "Bạn bè");
  assert.deepEqual(relationshipUi("friends")?.menu.map(a => a.label), ["Huỷ kết bạn"]);
  assert.equal(relationshipUi("self"), null);
  assert.equal(toRelationship("declined"), "none");   // giá trị lạ → không suy ra quan hệ
  assert.match(lockedWallText("outgoing", "Bình"), /Khi Bình chấp nhận/);
  assert.match(lockedWallText("none", "Bình"), /Kết bạn với Bình/);
});

test("Hồ sơ công khai: URL ảnh độc hại bị bỏ; can_view_wall chỉ true khi DB nói true", () => {
  const p = toProfile({ user_id: ID, name: "  ", avatar_url: "javascript:alert(1)", cover_url: "http://evil.test/c.jpg",
    role: "teacher", relationship: "friends", can_view_wall: null });
  assert.ok(p);
  assert.equal(p.name, "Thành viên Class");
  assert.equal(p.avatarUrl, null);
  assert.equal(p.coverUrl, null);
  assert.equal(p.isTeacher, true);
  assert.equal(p.canViewWall, false);
  assert.equal(toProfile(undefined), null);
  assert.deepEqual(toPeople([{ user_id: ID, name: "An", avatar_url: null, role: "student" }, null as never]).map(x => x.name), ["An"]);
});

// ── Bài viết trên tường ─────────────────────────────────────────────────────
test("Soạn bài tường: luôn type=status + audience=friends; chữ hoặc link hợp lệ", () => {
  assert.equal(checkWallDraft({ body: "  ", url: "" }).ok, false);
  const text = checkWallDraft({ body: "Hôm nay tập được bài mới", url: "" });
  assert.ok(text.ok);
  assert.deepEqual({ type: text.insert.type, audience: text.insert.audience, media: text.insert.media_url },
    { type: "status", audience: "friends", media: null });
  const bad = checkWallDraft({ body: "x", url: "không phải link" });
  assert.ok(!bad.ok && bad.videoError);
  const vid = checkWallDraft({ body: "", url: "https://youtu.be/dQw4w9WgXcQ" });
  assert.ok(vid.ok && vid.insert.media_type === "external_video" && vid.insert.media_provider === "youtube");
  assert.equal(checkWallDraft({ body: "a".repeat(2001), url: "" }).ok, false);
});

const row = (o: Partial<FeedRow> = {}): FeedRow => ({
  id: "p1", type: "status", body: "Xin chào", media_type: null, media_provider: null, media_url: null, external_media_id: null,
  created_at: "2026-09-28T10:00:00Z", updated_at: "2026-09-28T10:00:00Z", author_user_id: ID, author_name: "Bình",
  author_avatar_url: null, author_role: "student", author_ht_member: null, is_mine: false, audience: "friends", ...o,
});

test("Bài tường hiện nhãn 'Bài viết' + 'Bạn bè'; tên/avatar mở trang cá nhân", () => {
  const post = toFeedPost(row());
  assert.ok(post && post.friendsOnly && POST_TYPE_LABEL[post.type] === "Bài viết");
  const html = renderToStaticMarkup(<PostCard post={post} social={{
    me: null, comments: {}, onRefreshComments: async () => {}, onExpandComments: async () => {}, onModeratePost: () => {},
    onOpenProfile: () => {},
  }} />);
  assert.match(html, /Bài viết/);
  assert.match(html, /title="Chỉ bạn bè xem được"/);
  assert.equal((html.match(/aria-label="Trang cá nhân của Bình"/g) ?? []).length, 2, "avatar + tên");
  // Trả bài (class) không có nhãn Bạn bè
  const assignment = toFeedPost(row({ type: "assignment", audience: "class", media_type: "external_video", media_provider: "youtube", media_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }));
  assert.ok(assignment && !assignment.friendsOnly);
});

test("PersonLink: không có onOpen → chữ thường (không nút)", () => {
  assert.equal(renderToStaticMarkup(<PersonLink userId={ID} label="x">An</PersonLink>), "<span>An</span>");
  assert.match(renderToStaticMarkup(<PersonLink userId={ID} label="Trang của An" onOpen={() => {}}>An</PersonLink>), /<button type="button" class="cs-person-link" aria-label="Trang của An">/);
});

// ── Chốt chặn nguồn: quyền ở DB, client không tự mở ──────────────────────────
test("Client: bạn bè/tường CHỈ qua RPC; không đọc thẳng friendships / edu_students của người khác", () => {
  const api = code("src/class-social/friends/friendsApi.ts");
  for (const fn of ["my_friends", "incoming_friend_requests", "outgoing_friend_requests", "get_user_profile", "get_user_wall", "send_friend_request", "respond_friend_request", "unfriend"]) {
    assert.ok(api.includes(`'${fn}'`), fn);
  }
  for (const f of ["src/class-social/friends/friendsApi.ts", "src/class-social/sections/ProfilePage.tsx", "src/class-social/sections/Friends.tsx", "src/class-social/sections/WallComposer.tsx"]) {
    assert.equal(/\.from\(\s*['"](friendships|edu_students)['"]/.test(code(f)), false, f);
  }
  // Danh sách bài chỉ được mount khi DB báo can_view_wall
  assert.match(code("src/class-social/sections/ProfilePage.tsx"), /\{p\.canViewWall\s*\?\s*<Wall /);
});

test("Migration: mọi hàm mới đều REVOKE khỏi public/anon; friendships không cấp quyền bảng; edu_students khoá", () => {
  const sql = read("db/class_social_friends_wall_setup.sql");
  const fns = [...sql.matchAll(/create or replace function public\.(\w+)\(/g)].map(m => m[1]);
  assert.ok(fns.length >= 12, `có ${fns.length} hàm`);
  for (const fn of new Set(fns)) {
    if (fn === "class_posts_before_update") continue;   // hàm trigger
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon`), fn);
  }
  assert.match(sql, /revoke all on public\.friendships from public, anon, authenticated;/);
  assert.equal(/grant [^;]* on public\.friendships/.test(sql), false, "không grant bảng friendships");
  assert.match(sql, /create policy edu_students_own_or_teacher_read on public\.edu_students\s+for select to authenticated using \(user_id = auth\.uid\(\) or public\.is_teacher\(\)\)/);
  assert.match(sql, /and p\.audience = 'class'/, "feed Cộng đồng chỉ bài class");
  const rls = read("db/rls_setup.sql");
  assert.match(rls, /'friendships', 'edu_students',/, "rls_setup không áp lại policy rộng");
});

// ── Badge lời mời kết bạn + khối lời mời ─────────────────────────────────────
import ClassSocialLayout from "../../src/class-social/ClassSocialLayout";
import FriendRequestList from "../../src/class-social/sections/FriendRequestList";
import type { ClassIdentity } from "../../src/class-social/useClassSession";

const meB: ClassIdentity = {
  role: "student", userId: ID, studentId: "s", name: "Bình", email: null, avatarUrl: null, level: null,
  enrolledAt: null, htMember: false, isTeacher: false, coverUrl: null,
};
const shell = (badges?: { friends?: number }) => renderToStaticMarkup(
  <ClassSocialLayout me={meB} section="home" onSection={() => {}} badges={badges}><p>x</p></ClassSocialLayout>,
);

test("Badge 'Bạn bè' = số lời mời đến; 0 → không hiện; hiện cả trên nút ☰ (mobile)", () => {
  const one = shell({ friends: 1 });
  assert.match(one, /Bạn bè<\/span><span class="cs-nav-badge" aria-label="1 lời mời kết bạn">1<\/span>/);
  assert.match(one, /aria-label="Mở menu — 1 lời mời kết bạn"/);
  assert.match(one, /class="cs-nav-badge is-corner" aria-hidden="true">1</);
  for (const html of [shell({ friends: 0 }), shell()]) {
    assert.equal(html.includes("cs-nav-badge"), false);
    assert.match(html, /aria-label="Mở menu"/);
  }
  assert.match(shell({ friends: 120 }), />99\+</);
});

test("Danh sách lời mời: avatar + tên (mở trang cá nhân) + Xác nhận / Xóa; đang xử lý → khoá nút", () => {
  const items = [{ userId: ID, name: "An", avatarUrl: null, isTeacher: false }];
  const html = renderToStaticMarkup(<FriendRequestList items={items} busyId={null} onRespond={() => {}} onOpenProfile={() => {}} />);
  assert.match(html, /aria-label="Trang cá nhân của An"/);
  assert.match(html, />Xác nhận<\/button>/);
  assert.match(html, />Xóa<\/button>/);
  const busy = renderToStaticMarkup(<FriendRequestList items={items} busyId={ID} onRespond={() => {}} onOpenProfile={() => {}} />);
  assert.equal((busy.match(/disabled=""/g) ?? []).length, 2);
});

test("Badge chỉ đếm lời mời ĐẾN (incoming_friend_requests), một nguồn cho menu + Home + Bạn bè", () => {
  const hook = code("src/class-social/friends/useFriendRequests.ts");
  assert.match(hook, /fetchIncomingRequests\(\)/);
  assert.equal(/my_friends|fetchFriends|outgoing/.test(hook), false, "không tính bạn bè / lời mời đã gửi");
  assert.match(hook, /count: items\.length/);
  const page = code("src/class-social/ClassSocialPage.tsx");
  assert.match(page, /const requests = useFriendRequests\(\)/);
  assert.match(page, /badges=\{\{ friends: requests\.count \}\}/);
  assert.match(page, /<Friends requests=\{requests\}/);
  assert.match(page, /requests=\{requests\}/);
  // DB: incoming_friend_requests chỉ lấy pending gửi ĐẾN mình
  assert.match(read("db/class_social_friends_wall_setup.sql"), /f\.addressee_id = auth\.uid\(\) and f\.status = 'pending'/);
});

// ── Safety patch: giao dịch, cổng drift, rollback an toàn, preflight/recovery chỉ đọc ──────────
const stripComments = (sql: string) => sql.replace(/^\s*--.*$/gm, "");   // chỉ dòng comment riêng (chuỗi có thể chứa "--")
const stripStrings = (sql: string) => sql.replace(/'(?:[^']|'')*'/g, "''").replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, "$$");

test("Migration tự chứa MỘT giao dịch + lock/statement timeout; cổng drift trước mọi thay đổi", () => {
  const sql = stripComments(read("db/class_social_friends_wall_setup.sql")).trim();
  assert.match(sql, /^begin;\s*set local lock_timeout = '5s';\s*set local statement_timeout = '60s';/);
  assert.match(sql, /commit;$/);
  assert.equal((sql.match(/^\s*(begin|commit|rollback);/gim) ?? []).length, 2, "không có begin/commit lồng");
  const gate = sql.indexOf("do $gate$"), firstDdl = sql.search(/create table if not exists public\.friendships/);
  assert.ok(gate > 0 && gate < firstDdl, "cổng drift chạy trước DDL đầu tiên");
  assert.match(sql, /raise exception 'DỪNG — production khác repo/);
  assert.match(sql, /student_package_identity_guard/, "bắt buộc trigger guard");
});

test("Hằng kỳ vọng của cổng drift GIỐNG HỆT giữa migration và preflight", () => {
  const m = read("db/class_social_friends_wall_setup.sql"), p = read("db/class_social_friends_wall_preflight.sql");
  const fn = m.match(/fn_expected constant jsonb := '(.*?)';/)?.[1], pol = m.match(/pol_expected constant jsonb := '(.*?)';/)?.[1];
  assert.ok(fn && pol);
  assert.ok(p.includes(`'${fn}'::jsonb`), "fn_expected");
  assert.ok(p.includes(`'${pol}'::jsonb`), "pol_expected");
  for (const k of ["class_feed", "class_comments_for_posts", "class_post_visible", "class_posts_before_update", "guard_student_package_identity"]) {
    assert.ok(k in JSON.parse(fn), k);
  }
  assert.deepEqual(Object.keys(JSON.parse(pol)).sort(),
    ["class_comment_resources", "class_comment_tags", "class_post_comments", "class_posts", "edu_students", "friendships"]);
});

test("edu_students: INSERT chính chủ (tương thích app cũ) — không còn policy INSERT chỉ-thầy", () => {
  const sql = read("db/class_social_friends_wall_setup.sql");
  assert.match(sql, /create policy edu_students_own_or_teacher_insert on public\.edu_students\s+for insert to authenticated with check \(user_id = auth\.uid\(\) or public\.is_teacher\(\)\);/);
  assert.equal(/edu_students_teacher_insert/.test(stripComments(sql)), false);
});

test("Rollback tính năng: một giao dịch, idempotent, KHÔNG đụng edu_students, nêu rõ dữ liệu mất", () => {
  const raw = read("db/class_social_friends_wall_rollback.sql");
  const sql = stripComments(raw).trim();
  assert.match(sql, /^begin;\s*set local lock_timeout = '5s';/);
  assert.match(sql, /commit;$/);
  assert.equal(/on public\.edu_students/.test(sql), false, "không tạo/xoá policy edu_students");
  assert.equal(/using \(true\)/i.test(sql), false, "không mở policy rộng");
  assert.match(raw, /DỮ LIỆU MẤT VĨNH VIỄN/);
  assert.match(sql, /if exists \(select 1 from information_schema\.columns[\s\S]*column_name = 'audience'\)/, "chạy lại khi cột đã gỡ");
});

test("Preflight + generator khôi phục: CHỈ ĐỌC (một câu SELECT, không DDL/DML ngoài chuỗi)", () => {
  for (const f of ["db/class_social_friends_wall_preflight.sql", "db/class_social_friends_wall_edu_students_recovery.sql"]) {
    const sql = stripStrings(stripComments(read(f).replace(/\/\*[\s\S]*?\*\//g, ""))).trim();
    assert.match(sql, /^(with|select)\b/i, f);
    assert.equal(/\b(insert|update|delete|create|drop|alter|grant|revoke|truncate|begin|commit)\b/i.test(sql), false, f);
    assert.equal(sql.replace(/;\s*$/, "").includes(";"), false, `${f}: một câu lệnh`);
  }
  const gen = read("db/class_social_friends_wall_edu_students_recovery.sql");
  assert.equal(/using \(true\)/i.test(stripComments(gen.replace(/\/\*[\s\S]*?\*\//g, ""))), false, "không hard-code policy cũ");
  // Owner dán vào SQL Editor: copy có thể MẤT xuống dòng → không được có comment '--' ngoài chuỗi
  for (const f of ["db/class_social_friends_wall_preflight.sql", "db/class_social_friends_wall_edu_students_recovery.sql", "db/tests/class_social_friends_wall_prod_smoke.sql"]) {
    assert.equal(stripStrings(read(f).replace(/\/\*[\s\S]*?\*\//g, "")).includes("--"), false, `${f}: không có '--' ngoài chuỗi`);
  }
  assert.match(gen, /from pg_policies pp where pp\.schemaname = 'public' and pp\.tablename = 'edu_students'/);
});

test("Smoke production tự huỷ: một khối DO, MỌI nhánh kết thúc bằng RAISE EXCEPTION (rollback bắt buộc)", () => {
  const sql = read("db/tests/class_social_friends_wall_prod_smoke.sql").replace(/\/\*[\s\S]*?\*\//g, "").trim();
  assert.match(sql, /^do \$smoke\$[\s\S]*end \$smoke\$;$/);
  const tail = sql.slice(sql.lastIndexOf("if cardinality(bad) = 0 then"));
  assert.match(tail, /then\s+raise exception 'SMOKE PASS[\s\S]*else\s+raise exception 'SMOKE FAIL[\s\S]*end if;\s*end \$smoke\$;$/);
  assert.equal(/\bcommit\b/i.test(sql), false);
});
