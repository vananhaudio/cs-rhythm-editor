/**
 * /me — CLASS ENTRY UX V2: tab "Lớp" = LỚP CỦA TÔI (tên lớp → vào lớp, + Nhập mã lớp) → HOẠT ĐỘNG TỪ CÁC LỚP.
 * Cùng nguồn (useSocialClasses → currentClasses, thứ tự server) với sidebar và /me/classes; khác cách trình bày.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HomeClasses from "../../src/class-social/classes/HomeClasses";
import ClassNav from "../../src/class-social/classes/ClassNav";
import ClassesPage from "../../src/class-social/classes/ClassesPage";
import { currentClasses, toClassCards } from "../../src/class-social/classes/classModel";
import { FEED_SCOPES, scopeFromSearch } from "../../src/class-social/posts/feedScope";
void React;

const noop = () => {};
const src = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
const id = (n: number) => `c0000000-0000-4000-8000-00000000000${n}`;
const row = (n: number, name: string, status = "active", schedule: string | null = null) =>
  ({ id: id(n), code: "Z" + n, name, status, is_member: true, member_count: 7, activity_count: 3, schedule, course: { name: "Khoá " + n, code: "K" + n } });
// Thứ tự server (KHÔNG theo tên/hoạt động): Gen Z — Z2 · Solo · Hành trình 2027 · Khởi đầu đam mê khoá 17 (+ một lớp đã kết thúc)
const MINE = toClassCards([
  row(1, "Gen Z — Z2", "active", "Chủ nhật · 14:00–15:00"),
  row(2, "Solo Guitar Căn Bản", "active", "Thứ 5 · 19:00"),
  row(3, "Tỉa nốt 3 — GL11", "completed"),
  row(4, "Hành trình 2027"),
  row(5, "Khởi đầu đam mê khóa 17", "scheduled"),
]);
const CURRENT = ["Gen Z — Z2", "Solo Guitar Căn Bản", "Hành trình 2027", "Khởi đầu đam mê khóa 17"];
const cls = (over: Record<string, unknown> = {}) => ({ loaded: true, mine: MINE, discover: [], error: null, mineFailed: false, reload: noop, ...over });
const names = (h: string, scope = /cs-classrow-name"[^>]*>([^<]+)</g) => [...h.matchAll(scope)].map(m => m[1]);

test("tab Lớp: heading 'Lớp của tôi' → đủ lớp hiện tại đúng thứ tự server → '+ Nhập mã lớp'; không trạng thái/tiến độ/nút Vào lớp", () => {
  const h = renderToStaticMarkup(<HomeClasses classes={cls()} onOpenClass={noop} />);
  assert.match(h, /<h2 id="cs-home-classes-title" class="cs-subtle-title">Lớp của tôi<\/h2>/);
  assert.deepEqual(names(h), CURRENT, "cùng tập + thứ tự; lớp đã kết thúc để /me/classes lo");
  assert.ok(h.indexOf("Khởi đầu đam mê khóa 17") < h.indexOf("Nhập mã lớp"), "+ Nhập mã lớp ngay sau danh sách");
  assert.match(h, /<button type="button" class="cs-linkbtn cs-join-open">.*Nhập mã lớp<\/button>/, "hành động thật = nút nhẹ, không hero");
  for (const c of MINE.slice(0, 2)) assert.match(h, new RegExp(`<a class="cs-classrow-name" href="/me/classes/${c.id}">`), "dòng lớp = link tới Class Page");
  assert.match(h, /Chủ nhật · 14:00–15:00/); assert.match(h, /Thứ 5 · 19:00/);
  assert.doesNotMatch(h, /Khoá \d|Z\d·|K\d|thành viên|học viên|Buổi|bài trả|Hoạt động mới/, "chỉ tên + lịch: không khoá/mã/sĩ số/buổi/tiến độ");
  assert.doesNotMatch(h, /Đang học|Tiếp tục học|Vào lớp|Xem lớp|Mở lớp|cs-card|cs-btn-primary/);
  assert.equal((h.match(/<button/g) || []).length, 1, "nút duy nhất = Nhập mã lớp");
});

test("tab Lớp: chưa có lớp → 'Bạn chưa có lớp nào.' + Nhập mã lớp (không card/CTA lớn); đang tải → không nháy 'chưa có lớp'; lỗi → câu nhẹ", () => {
  const empty = renderToStaticMarkup(<HomeClasses classes={cls({ mine: [] })} onOpenClass={noop} />);
  assert.match(empty, /Bạn chưa có lớp nào\./); assert.match(empty, /Nhập mã lớp<\/button>/);
  assert.doesNotMatch(empty, /cs-card|cs-btn-primary|<img|<svg[^>]*width="(4\d|[5-9]\d)/);
  const loading = renderToStaticMarkup(<HomeClasses classes={cls({ loaded: false, mine: [] })} onOpenClass={noop} />);
  assert.match(loading, /Đang tải lớp học…/); assert.match(loading, /aria-busy="true"/);
  assert.doesNotMatch(loading, /Bạn chưa có lớp nào|Nhập mã lớp/);
  const failed = renderToStaticMarkup(<HomeClasses classes={cls({ mine: [], mineFailed: true, error: "permission denied for function" })} onOpenClass={noop} />);
  assert.match(failed, /Chưa tải được danh sách lớp\./);
  assert.doesNotMatch(failed, /permission denied|Bạn chưa có lớp nào/, "không lỗi thô, không nói sai 'chưa có lớp'");
  const one = renderToStaticMarkup(<HomeClasses classes={cls({ mine: MINE.slice(1, 2) })} onOpenClass={noop} />);
  assert.deepEqual(names(one), ["Solo Guitar Căn Bản"], "1 lớp: cùng cấu trúc, không onboarding riêng");
});

test("cùng nguồn: sidebar = tab Lớp = phần chính /me/classes (tập + thứ tự)", () => {
  assert.deepEqual(currentClasses(MINE).map(c => c.name), CURRENT);
  const nav = renderToStaticMarkup(<ClassNav mine={MINE} loaded activeClassId={null} classesActive={false} collapsed={false} onOpenClass={noop} onOpenClasses={noop} />);
  assert.deepEqual([...nav.matchAll(/cs-nav-text">([^<]+)</g)].map(m => m[1]).filter(t => t !== "Lớp của tôi"), CURRENT);
  const page = renderToStaticMarkup(<ClassesPage classes={cls()} onOpenClass={noop} />);
  const main = page.slice(0, page.indexOf("Lớp trước đây"));
  assert.deepEqual(names(main), CURRENT);
  assert.match(page, /Lớp trước đây/); assert.match(page, /Tỉa nốt 3 — GL11/, "/me/classes vẫn là bản đồ đầy đủ");
  // Home không tự suy membership: chỉ nhận classes (useSocialClasses) từ ClassSocialPage
  const home = src("class-social/classes/HomeClasses.tsx");
  assert.doesNotMatch(home, /fetch|rpc\(|supabase|ht_member|programCode|group_id/);
  assert.match(src("class-social/ClassSocialPage.tsx"), /const classes = useSocialClasses\(me\.isTeacher\)/);
  assert.equal((src("class-social/ClassSocialPage.tsx").match(/useSocialClasses\(/g) || []).length, 1, "MỘT lần tải cho cả 3 nơi");
});

test("Home: tab Lớp = Lớp của tôi → 'Hoạt động từ các lớp' → feed (một cột); Dành cho bạn/Bạn bè không đổi; tab vẫn tên 'Lớp'", () => {
  const h = src("class-social/sections/MeHome.tsx");
  const a = h.indexOf("<FeedTabs"), b = h.indexOf("<HomeClasses"), c = h.indexOf("Hoạt động từ các lớp"), d = h.indexOf("<CommunityFeed");
  assert.ok(a > 0 && a < b && b < c && c < d, "thứ tự: tabs → lớp của tôi → heading hoạt động → feed");
  assert.match(h, /scope === 'my_classes' && classes && onOpenClass && <>/, "chỉ tab Lớp có danh sách lớp");
  assert.deepEqual(FEED_SCOPES.map(s => s.label), ["Dành cho bạn", "Lớp", "Bạn bè"]);
  assert.equal(scopeFromSearch("?feed=classes"), "my_classes"); assert.equal(scopeFromSearch(""), "for_you");
  assert.match(src("class-social/ClassSocialPage.tsx"), /onJoinedClass=\{\(\) => \{ classes\.reload\(\); refreshLearningIdentity\(me\.userId\) \}\}/,
    "tham gia bằng mã trên tab Lớp: nạp lại danh sách (sidebar · tab · /me/classes) + danh tính, ở lại tab");
  assert.match(src("class-social/classes/HomeClasses.tsx"), /<JoinClassByCode onOpen=\{onOpenClass\}/, "dùng lại đúng ô Join Code sẵn có");
  // Sidebar: chấm trước tên lớp không mang nghĩa → chỉ còn khi sidebar thu gọn (thay chữ)
  assert.match(readFileSync(new URL("../../src/class-social/classSocial.css", import.meta.url), "utf8"), /\.cs-sidebar:not\(\.is-collapsed\) \.cs-class-dot \{ display: none; \}/);
});
