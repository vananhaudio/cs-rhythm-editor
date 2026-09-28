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
test("Nút theo quan hệ kiểu Facebook", () => {
  assert.deepEqual(relationshipUi("none").actions.map(a => a.label), ["Kết bạn"]);
  assert.equal(relationshipUi("outgoing").status, "Đã gửi lời mời");
  assert.deepEqual(relationshipUi("incoming").actions.map(a => a.label), ["Chấp nhận", "Từ chối"]);
  assert.equal(relationshipUi("friends").status, "Bạn bè");
  assert.deepEqual(relationshipUi("friends").actions.map(a => a.label), ["Huỷ kết bạn"]);
  assert.deepEqual(relationshipUi("self").actions, []);
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
  for (const fn of ["my_friends", "incoming_friend_requests", "get_user_profile", "get_user_wall", "send_friend_request", "respond_friend_request", "unfriend"]) {
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
