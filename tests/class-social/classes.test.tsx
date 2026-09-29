/**
 * Social UX + Lớp học V1: route /me/classes, sidebar (Trang chủ + LỚP HỌC), thẻ lớp / trang lớp / thành viên.
 * Quyền THẬT ở DB (scripts/test-learning-threads-db.sh, phần SOCIAL UX + LỚP HỌC V1).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CLASSES_PATH, classIdFromPath, classPath, keepsPathForGuest, resolveMeRoute, sameView, viewFromPath, viewPath,
} from "../../src/class-social/resolveMeRoute";
import { NAV_GROUPS } from "../../src/class-social/nav";
import ClassNav from "../../src/class-social/classes/ClassNav";
import { ClassHeader, MemberList } from "../../src/class-social/classes/ClassParts";
import { ClassTile } from "../../src/class-social/classes/ClassesPage";
import {
  classCodeNote, classFullTitle, classMetaLine, classShortName, classStatusLabel, filterClasses, memberRelationUi, scErrorText, toClassCard, toClassCards, toClassMembers,
} from "../../src/class-social/classes/classModel";
import { SHARE_PROMPTS } from "../../src/class-social/posts/sharePrompts";
void React;

const CID = "b0000000-0000-4000-8000-0000000000c1";
const src = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
const card = (o: Record<string, unknown> = {}) => ({
  id: CID, code: "DH2.KD18", name: "Đệm hát căn bản — KD18", status: "active", start_date: "2026-09-01", schedule: "Thứ 3 · 20:00",
  course: { code: "DH2", name: "Đệm hát 2", track: "dem_hat" }, member_count: 12, activity_count: 3,
  teachers: [{ user_id: "t1", name: "Thầy Minh", avatar_url: null }], is_member: true, can_view_members: true,
  zoom_url: "https://zoom.us/j/SECRET", price: "9.999.000đ", ...o,
});

// ── Route ────────────────────────────────────────────────────────────────────
test("route /me/classes + /me/classes/<uuid>; id lạ không phải lớp; giữ link qua đăng nhập", () => {
  assert.equal(classPath(CID), `/me/classes/${CID}`);
  assert.equal(classIdFromPath(`/me/classes/${CID.toUpperCase()}/`), CID);
  for (const p of ["/me/classes/", "/me/classes/abc", `/me/classes/${CID}/x`]) assert.equal(classIdFromPath(p), null, p);
  assert.deepEqual(viewFromPath(CLASSES_PATH), { kind: "classes" });
  assert.deepEqual(viewFromPath(`/me/classes/${CID}`), { kind: "class", classId: CID });
  for (const v of [{ kind: "classes" as const }, { kind: "class" as const, classId: CID }]) assert.ok(sameView(viewFromPath(viewPath(v)), v));
  assert.equal(keepsPathForGuest({ kind: "class", classId: CID }), true);
  assert.equal(keepsPathForGuest({ kind: "classes" }), true);
  assert.equal(keepsPathForGuest({ kind: "profile", userId: CID }), false, "hành vi cũ của trang cá nhân giữ nguyên");
  assert.equal(resolveMeRoute({ hostname: "class.vananhaudio.com", pathname: `/me/classes/${CID}`, search: "", isNative: false })?.kind, "social");
});

// ── Sidebar ──────────────────────────────────────────────────────────────────
test("menu: Trang chủ là mục ĐẦU TIÊN; CỘNG ĐỒNG (Trang chủ · Bạn bè · Trò chuyện) → HỌC TẬP → CÔNG CỤ", () => {
  assert.deepEqual(NAV_GROUPS.map(g => g.id), ["community", "learning", "tools"]);
  assert.deepEqual(NAV_GROUPS[0].items.map(i => i.label), ["Trang chủ", "Bạn bè", "Trò chuyện"]);
  const first = NAV_GROUPS[0].items[0];
  assert.ok(first.kind === "section" && first.id === "home");
  // LỚP HỌC chèn ngay sau CỘNG ĐỒNG
  assert.match(src("class-social/ClassSocialLayout.tsx"), /g\.id === 'community' && classNav\?\./);
});

test("ClassNav: lớp CỦA TÔI hiện trực tiếp (bấm được) · Khám phá tối đa 3 · Tất cả lớp · lớp đang mở sáng", () => {
  const mine = toClassCards([card(), card({ id: "b0000000-0000-4000-8000-0000000000c9", code: "HT2027.TH01", name: "Hành trình 2027" })]);
  const discover = toClassCards([1, 2, 3, 4].map(i => card({ id: `b0000000-0000-4000-8000-00000000000${i}`, code: `SOLO0${i}`, name: `Solo Guitar 0${i}`, is_member: false })));
  const h = renderToStaticMarkup(<ClassNav mine={mine} discover={discover} loaded activeClassId={CID} classesActive={false} collapsed={false}
    onOpenClass={() => {}} onOpenClasses={() => {}} />);
  assert.match(h, /Lớp học/);
  assert.match(h, /Đệm hát căn bản — KD18/);
  assert.match(h, /Hành trình 2027/);
  assert.match(h, /aria-current="page"[^>]*title="Đệm hát căn bản — KD18 · DH2\.KD18"/);
  assert.match(h, /Khám phá/);
  assert.equal((h.match(/cs-nav-text">Solo Guitar 0/g) || []).length, 3, "khám phá tối đa 3");
  assert.match(h, /Tất cả lớp/);
  assert.match(h, /cs-class-dot is-mine/);
  const none = renderToStaticMarkup(<ClassNav mine={[]} discover={[]} loaded activeClassId={null} classesActive collapsed={false} onOpenClass={() => {}} onOpenClasses={() => {}} />);
  assert.match(none, /Bạn chưa ở trong lớp nào\./);
});

test("tên lớp THÂN THIỆN cho menu (lấy từ tên thật production, không mã nội bộ, không hard-code)", () => {
  const cases: [string, string, string][] = [
    ["Hành trình 2027 — 40 buổi thực hành", "HT2027.TH01", "Hành trình 2027"],
    ["Khởi đầu đam mê khóa 17 - KD17", "DH1.KD17", "Khởi đầu đam mê khóa 17"],
    ["Hành trình 2026 — thực hành Chủ Nhật", "HT2026.TH01", "Hành trình 2026"],
    ["Tỉa nốt trình độ 3 - Cảm âm 1", "TN3.GL10", "Tỉa nốt trình độ 3"],
    ["Solo Guitar Căn Bản", "SOLO01.TH01", "Solo Guitar Căn Bản"],
    ["Đệm hát nâng cao", "DHNC.K01", "Đệm hát nâng cao"],
    ["KD18 — Đệm hát", "KD18", "KD18 — Đệm hát"],
    ["Guitar căn bản 1", "CB1.T3", "Guitar căn bản 1"],
  ];
  for (const [name, code, want] of cases) assert.equal(classShortName({ name, code }), want, name);
  assert.equal(classFullTitle({ name: "Hành trình 2027 — 40 buổi thực hành", code: "HT2027.TH01" }), "Hành trình 2027 — 40 buổi thực hành · HT2027.TH01");
  const h = renderToStaticMarkup(<ClassNav mine={toClassCards([card({ name: "Hành trình 2027 — 40 buổi thực hành", code: "HT2027.TH01" })])} discover={[]}
    loaded activeClassId={null} classesActive={false} collapsed={false} onOpenClass={() => {}} onOpenClasses={() => {}} />);
  assert.match(h, /cs-nav-text">Hành trình 2027</);
  assert.equal(/cs-nav-text">HT2027/.test(h), false, "menu không hiện mã nội bộ");
});

test("menu: đúng MỘT mục sáng (lớp đang mở, ở Của tôi hoặc Khám phá; hoặc Tất cả lớp)", () => {
  const mine = toClassCards([card()]);
  const discover = toClassCards([card({ id: "b0000000-0000-4000-8000-000000000001", code: "SOLO01", name: "Solo Guitar", is_member: false })]);
  const count = (h: string) => (h.match(/aria-current="page"/g) || []).length;
  const r = (active: string | null, all: boolean) => renderToStaticMarkup(<ClassNav mine={mine} discover={discover} loaded activeClassId={active}
    classesActive={all} collapsed={false} onOpenClass={() => {}} onOpenClasses={() => {}} />);
  assert.equal(count(r(CID, false)), 1);
  const disc = r("b0000000-0000-4000-8000-000000000001", false);
  assert.equal(count(disc), 1);
  assert.match(disc, /aria-current="page"[^>]*title="Solo Guitar · SOLO01"/);
  const all = r(null, true);
  assert.equal(count(all), 1);
  assert.match(all, /aria-current="page"[^>]*><svg[\s\S]*?Tất cả lớp/);
});

// ── Thẻ lớp / trang lớp ───────────────────────────────────────────────────────
test("model lớp: chỉ trường công khai (bỏ zoom/giá), nhãn trạng thái, tìm không dấu", () => {
  const c = toClassCard(card())!;
  assert.equal(JSON.stringify(c).includes("SECRET") || JSON.stringify(c).includes("9.999"), false);
  assert.equal(classStatusLabel("recruiting"), "Đang tuyển sinh");
  assert.equal(classStatusLabel("la_la"), null);
  assert.equal(classMetaLine(c), "Thứ 3 · 20:00 · Đệm hát 2", "dòng phụ cho người đọc: lịch · khoá (không mã)");
  assert.equal(classCodeNote(c), "DH2.KD18 · DH2", "mã lớp/mã khoá chỉ là metadata nhỏ");
  assert.equal(filterClasses([c], "dem hat")[0]?.id, CID);
  assert.equal(filterClasses([c], "solo").length, 0);
  assert.equal(scErrorText("SC_MEMBERS_ONLY"), "Danh sách thành viên chỉ hiện với thành viên của lớp.");
});

test("trang lớp: thành viên thấy 'Bạn là thành viên'; người ngoài thấy 'Bạn đang xem lớp … chưa tham gia' (không màn khoá)", () => {
  const member = renderToStaticMarkup(<ClassHeader c={toClassCard(card())!} />);
  assert.match(member, /Bạn là thành viên lớp này/);
  assert.match(member, /Thầy Minh/);
  assert.match(member, /12 học viên/);
  const outsider = renderToStaticMarkup(<ClassHeader c={toClassCard(card({ is_member: false, can_view_members: false }))!} />);
  assert.match(outsider, /Bạn đang xem lớp này — bạn chưa tham gia\./);
  assert.ok(outsider.indexOf("cs-class-name") < outsider.indexOf("cs-class-codes"), "tên lớp lên đầu; mã lớp nhỏ ở cuối");
  assert.equal(/0 học viên/.test(renderToStaticMarkup(<ClassHeader c={toClassCard(card({ member_count: 0 }))!} />)), false, "không nhấn '0 học viên'");
  assert.equal(/Mua|Đăng ký ngay|giá/i.test(outsider), false, "không biến trang lớp thành trang bán hàng");
  const disc = renderToStaticMarkup(<ClassTile c={toClassCard(card({ is_member: false }))!} onOpen={() => {}} />);
  assert.match(disc, /3 hoạt động/);
  assert.match(disc, /12 học viên/);
  assert.equal(/Bạn đang tham gia/.test(disc), false);
  const mineTile = renderToStaticMarkup(<ClassTile c={toClassCard(card())!} onOpen={() => {}} />);
  assert.match(mineTile, /cs-class-tile is-mine/);
  assert.match(mineTile, /Bạn đang tham gia/);
  assert.equal(/0 học viên/.test(renderToStaticMarkup(<ClassTile c={toClassCard(card({ is_member: false, member_count: 0 }))!} onOpen={() => {}} />)), false);
});

test("thành viên: bấm tên → trang cá nhân; nút theo quan hệ (Kết bạn / Chấp nhận / Đã gửi / Bạn bè / Bạn)", () => {
  assert.deepEqual(memberRelationUi("none"), { label: "Kết bạn", action: "send" });
  assert.deepEqual(memberRelationUi("incoming"), { label: "Chấp nhận", action: "accept" });
  assert.equal(memberRelationUi("outgoing").action, null);
  const members = toClassMembers([
    { user_id: "t1", name: "Thầy Minh", avatar_url: null, role: "teacher", relationship: "none" },
    { user_id: "u1", name: "An", avatar_url: "javascript:x", role: "student", relationship: "friends" },
    { user_id: "u2", name: "Bình", avatar_url: null, role: "student", relationship: "self" },
  ]);
  assert.equal(members[1].avatarUrl, null);
  const h = renderToStaticMarkup(<MemberList members={members} busyId={null} onAct={() => {}} onOpenProfile={() => {}} />);
  assert.match(h, /aria-label="Trang cá nhân của An"/);
  assert.match(h, /Giáo viên/);
  assert.match(h, /Kết bạn<\/button>/);
  assert.match(h, /Bạn bè<\/span>/);
  assert.equal(/@|email|phone/i.test(h), false, "không PII");
});

// ── Home ─────────────────────────────────────────────────────────────────────
test("ô chia sẻ Home: gợi ý nhỏ về âm nhạc, không 'Bạn đang nghĩ gì?'", () => {
  assert.deepEqual(SHARE_PROMPTS.map(p => p.label), ["Đang tập", "Vừa đàn", "Nhờ góp ý", "Chia sẻ"]);
  assert.equal(/Bạn đang nghĩ gì/.test(src("class-social/sections/HomeComposer.tsx")), false);
  const block = src("learning-thread/MeThreadsBlock.tsx");
  assert.match(block, /if \(!waiting\) return null/, "Thầy: 0 bài chờ → không dựng thẻ");
  assert.match(block, /bài đang chờ phản hồi/);
});

// ── Chốt chặn nguồn ──────────────────────────────────────────────────────────
test("lớp học CHỈ qua RPC đọc; không query thẳng membership/class_schedule; không hệ lớp thứ hai", () => {
  const api = src("class-social/classes/classesApi.ts");
  for (const fn of ["social_my_classes", "social_discover_classes", "social_class_detail", "social_class_activity", "social_class_members"]) {
    assert.ok(api.includes(`'${fn}'`), fn);
  }
  for (const f of ["class-social/classes/classesApi.ts", "class-social/classes/ClassPage.tsx", "class-social/classes/ClassesPage.tsx", "class-social/classes/useSocialClasses.ts"]) {
    assert.equal(/\.from\(/.test(src(f)), false, f);
  }
  assert.match(src("class-social/classes/ClassPage.tsx"), /!canViewMembers\s*\n?\s*\?/, "danh sách thành viên chỉ tải khi server cho phép");
  const db = readFileSync(new URL("../../db/social_classes_v1_setup.sql", import.meta.url), "utf8");
  assert.equal(/create table/i.test(db), false, "không bảng social_classes / membership mới");
  assert.equal(/zoom_url|price|metadata/.test(db.replace(/--.*$/gm, "")), false, "không trả zoom_url/giá/metadata");
});
