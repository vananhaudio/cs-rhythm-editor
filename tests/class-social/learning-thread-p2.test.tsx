/**
 * Learning Thread P2 — Feed trộn (bài Social + câu chuyện học tập), Tường, Hành trình.
 * Quyền THẬT ở DB (scripts/test-learning-threads-db.sh, phần P2). Ở đây: model, câu mô tả, render, gom chặng/màu.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { entryKey, isThreadEntry, toFeedEntries, type MixedRow } from "../../src/class-social/posts/postModel";
import CommunityFeed from "../../src/class-social/sections/CommunityFeed";
import FeedEntryCard from "../../src/class-social/sections/FeedEntryCard";
import LearningThreadCard from "../../src/learning-thread/LearningThreadCard";
import JourneyTimeline from "../../src/learning-thread/JourneyTimeline";
import {
  TRACK_THEMES, eventSteps, groupJourney, originBadge, storyLine, toJourneyItem, toThreadCard, trackTheme, type JourneyRow,
} from "../../src/learning-thread/feedModel";
void React;

const NOW = new Date("2026-09-29T14:00:00Z");
const src = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
const identity = (over: Record<string, unknown> = {}) => ({
  lesson: { id: "l43", title: "Bài 4.3 — Bolero móc kiểu 1", order_index: 2 },
  module: { name: "Chương 4: Điệu Bolero & kỹ thuật móc", level: 2 },
  course: { code: "DH2", name: "Khởi Đầu Đam Mê – Đệm Hát Trình Độ 2", subject: "dem_hat", level: 2 },
  class: null, ...over,
});
const card = (over: Record<string, unknown> = {}) => ({
  id: "t1", status: "needs_retry", visibility: "community", identity: identity(), is_mine: false,
  created_at: "2026-09-29T10:00:00Z", last_event_at: "2026-09-29T13:50:00Z", first_kind: "question",
  learner: { user_id: "u-hs03", name: "HS03", avatar_url: null },
  last_event: { kind: "teacher_feedback", verdict: "retry", author_role: "teacher", has_resources: true, is_resubmission: false,
                author: { user_id: "u-t", name: "Thầy Minh", avatar_url: null } },
  ...over,
});
const post = { id: "p1", type: "assignment", body: "Trả bài cũ", media_type: null, media_provider: null, media_url: null, external_media_id: null,
  created_at: "2026-09-29T12:00:00Z", updated_at: "2026-09-29T12:00:00Z", author_user_id: "u2", author_name: "An", author_avatar_url: null,
  author_role: "student", author_ht_member: false, is_mine: false, is_hidden: false, comment_count: 0, audience: "class" };

// ── Feed trộn ────────────────────────────────────────────────────────────────
test("toFeedEntries: giữ thứ tự server, bài Social ↔ thẻ thread, khoá phân trang p:/t:, bỏ hàng hỏng", () => {
  const rows: MixedRow[] = [
    { kind: "learning_thread", sort_at: "2026-09-29T13:50:00Z", sort_key: "t:t1", post: null, thread: card() },
    { kind: "post", sort_at: "2026-09-29T12:00:00Z", sort_key: "p:p1", post, thread: null },
    { kind: "learning_thread", sort_at: "2026-09-29T11:00:00Z", sort_key: "t:bad", post: null, thread: { id: "bad", status: "hacked" } },
  ];
  const e = toFeedEntries(rows);
  assert.equal(e.length, 2);
  assert.ok(isThreadEntry(e[0]) && e[0].createdAt === "2026-09-29T13:50:00Z");
  assert.equal(entryKey(e[0]), "t:t1");
  assert.equal(entryKey(e[1]), "p:p1");
});

test("câu chuyện theo event mới nhất (Phần U) — tên Thầy lấy từ dữ liệu", () => {
  const s = (le: Record<string, unknown>) => {
    const c = toThreadCard(card({ last_event: { author_role: "teacher", author: { name: "Thầy Minh" }, ...le } }))!;
    const st = storyLine(c)!;
    return `${st.actor.name} ${st.text}`;
  };
  assert.equal(s({ kind: "teacher_feedback", verdict: "retry" }), "Thầy Minh vừa nhận xét · Cần làm lại");
  assert.equal(s({ kind: "teacher_feedback", verdict: "pass" }), "Thầy Minh vừa nhận xét · Đạt");
  assert.equal(s({ kind: "teacher_feedback", verdict: null }), "Thầy Minh vừa nhận xét");
  assert.equal(s({ kind: "teacher_answer" }), "Thầy Minh vừa trả lời");
  assert.equal(s({ kind: "question", author_role: "student" }), "HS03 vừa hỏi bài");
  assert.equal(s({ kind: "submission", author_role: "student" }), "HS03 vừa trả bài");
  assert.equal(s({ kind: "submission", author_role: "student", is_resubmission: true }), "HS03 vừa trả lại bài");
  assert.equal(storyLine(toThreadCard(card())!)!.resourceNote, "Thầy đã gửi bài giảng nên xem");
  assert.deepEqual(originBadge(toThreadCard(card())!), { icon: "❓", label: "Hỏi bài" });
  assert.deepEqual(originBadge(toThreadCard(card({ first_kind: "submission" }))!), { icon: "🎸", label: "Trả bài" });
});

test("thẻ Feed: AI · danh tính lịch sử · bài · chuyện vừa xảy ra · trạng thái · [Xem cuộc trao đổi]", () => {
  const h = renderToStaticMarkup(<LearningThreadCard card={toThreadCard(card())!} now={NOW} onOpenThread={() => {}} />);
  assert.match(h, /HS03/);
  assert.match(h, /Tự học · DH2/);
  assert.match(h, /❓<\/span> Hỏi bài/);
  assert.match(h, /lt-feed-lesson">Bài 4\.3 — Bolero móc kiểu 1</);
  assert.match(h, /lt-feed-module">Chương 4 · Điệu Bolero &amp; kỹ thuật móc</, "chương là metadata nhỏ dưới tên bài (trình bày, không đổi dữ liệu)");
  assert.equal(/Chương 4: Điệu/.test(h), false, "không lặp nguyên văn chương + bài trên Feed");
  const inClass = renderToStaticMarkup(<LearningThreadCard card={toThreadCard(card({ identity: identity({ class: { code: "DH2.KD18", stage_title: "Đệm hát 2" } }) }))!} inClass />);
  assert.equal(/lt-feed-identity/.test(inClass), false, "trong trang lớp không lặp nhãn lớp");
  assert.match(h, /lt-feed-actor">Thầy Minh<\/span> vừa nhận xét · Cần làm lại/);
  assert.match(h, /Chờ Thầy phản hồi|Cần làm lại/);
  // Lượt đầu của chính học sinh: tên + "❓ Hỏi bài" đã đủ — không kể lại "vừa hỏi bài"
  const own = renderToStaticMarkup(<LearningThreadCard card={toThreadCard(card({ status: "waiting_teacher", last_event: { kind: "question", author_role: "student", author: { name: "HS03" } } }))!} />);
  assert.equal(/vừa hỏi bài/.test(own), false);
  assert.match(own, /Chờ Thầy phản hồi/);
  assert.equal(/Đã gửi/.test(own), false, "người xem Feed không phải người gửi → không 'Đã gửi'");
  assert.match(h, /📘 Thầy đã gửi bài giảng nên xem/);
  assert.match(h, /Cần làm lại/);
  assert.match(h, /Xem cuộc trao đổi/);
  assert.equal(/Thầy Văn Anh/.test(h), false, "không hard-code tên Thầy");
  const pass = renderToStaticMarkup(<LearningThreadCard card={toThreadCard(card({ status: "passed", last_event: { kind: "teacher_feedback", verdict: "pass", author_role: "teacher", author: { name: "Thầy Minh" } } }))!} />);
  assert.match(pass, /Đã đạt/);
  assert.match(pass, /vừa nhận xét · Đạt/);
  // Không bung nội dung event
  assert.equal(/Tay phải móc chưa đều/.test(h), false);
});

test("Feed render cả 2 loại cùng dòng; bài Social vẫn là PostCard", () => {
  const entries = toFeedEntries([
    { kind: "learning_thread", sort_at: "2026-09-29T13:50:00Z", sort_key: "t:t1", post: null, thread: card() },
    { kind: "post", sort_at: "2026-09-29T12:00:00Z", sort_key: "p:p1", post, thread: null },
  ]);
  const h = renderToStaticMarkup(<CommunityFeed state={{ status: "ready", posts: entries, hasMore: false, loadingMore: false, moreError: null }} onRetry={() => {}} onLoadMore={() => {}} />);
  assert.ok(h.indexOf("lt-feed-card") > 0 && h.indexOf("lt-feed-card") < h.indexOf("Trả bài cũ"), "thread mới hơn đứng trước");
  assert.match(h, /cs-post-type is-assignment/);
  assert.match(renderToStaticMarkup(<FeedEntryCard entry={entries[1]} />), /Trả bài cũ/);
});

// ── Hành trình ───────────────────────────────────────────────────────────────
const jrow = (id: string, created: string, idn: Record<string, unknown>, events: unknown[] = [], over: Partial<JourneyRow> = {}): JourneyRow => ({
  id, status: "passed", visibility: "community", identity: idn, created_at: created, last_event_at: created, passed_at: null,
  is_hidden: false, archived: false, events, ...over,
});

test("gom CHẶNG theo danh tính LỊCH SỬ (lớp/Tự học × khoá), theo thời gian; không cần lớp", () => {
  const items = [
    jrow("a", "2026-03-01T00:00:00Z", identity({ class: { code: "DH1.KD18", stage: "co_ban", stage_title: "Đệm hát 1" }, course: { code: "DH1", name: "Đệm hát 1", subject: "dem_hat", level: 1 } })),
    jrow("b", "2026-09-29T00:00:00Z", identity()),
    jrow("c", "2026-04-01T00:00:00Z", identity({ class: { code: "DH1.KD18", stage: "co_ban", stage_title: "Đệm hát 1" }, course: { code: "DH1", name: "Đệm hát 1", subject: "dem_hat", level: 1 } })),
    jrow("d", "2027-02-01T00:00:00Z", identity({ course: { code: "SOLO", name: "Solo Guitar", subject: "solo", level: 5 } })),
  ].map(toJourneyItem).filter((x): x is NonNullable<typeof x> => !!x);
  const ph = groupJourney(items);
  assert.deepEqual(ph.map(p => p.title), ["DH1.KD18 · Đệm hát 1", "Tự học · DH2", "Tự học · SOLO"]);
  assert.deepEqual(ph[0].items.map(i => i.id), ["a", "c"], "cùng lớp × khoá → một chặng, theo thời gian");
  assert.equal(ph[0].subtitle, "Đệm hát 1 · Căn bản");
  assert.deepEqual(ph.map(p => p.year), [2026, 2026, 2027]);
});

test("màu chặng XÁC ĐỊNH theo môn (cùng bộ màu App học), không ngẫu nhiên", () => {
  assert.equal(trackTheme("dem_hat").from, "#4338CA");
  assert.equal(trackTheme("tia_not").from, "#15803D");
  assert.equal(trackTheme("solo").from, "#211C32");
  assert.equal(trackTheme("la_la"), TRACK_THEMES.khac);
  assert.deepEqual(trackTheme("dem_hat"), trackTheme("dem_hat"));
  const portal = readFileSync(new URL("../../src/MobileStudentPortal.tsx", import.meta.url), "utf8");
  for (const k of ["dem_hat", "tia_not", "solo", "nhac_ly"]) {
    const t = TRACK_THEMES[k];
    assert.ok(portal.includes(`${k}: 'linear-gradient(135deg, ${t.from}, ${t.to})'`), `màu ${k} khớp App học`);
  }
});

test("tóm tắt mốc: Hỏi bài → Cần làm lại (+bài giảng) → Trả bài → Đạt", () => {
  const steps = eventSteps([
    { kind: "question", verdict: null, authorRole: "student", hasResources: false, createdAt: "" },
    { kind: "teacher_feedback", verdict: "retry", authorRole: "teacher", hasResources: true, createdAt: "" },
    { kind: "submission", verdict: null, authorRole: "student", hasResources: false, createdAt: "" },
    { kind: "submission", verdict: null, authorRole: "student", hasResources: false, createdAt: "" },
    { kind: "teacher_feedback", verdict: "pass", authorRole: "teacher", hasResources: false, createdAt: "" },
  ]);
  assert.deepEqual(steps.map(s => s.label), ["Hỏi bài", "Cần làm lại", "Bài giảng nên xem", "Trả bài", "Trả lại", "Đạt"]);
});

test("tóm tắt mốc: nhiều vòng Cần làm lại → Trả lại liên tiếp gộp thành một cặp ×n", () => {
  const ev = (kind: string, verdict: string | null = null) => ({ kind, verdict, authorRole: kind.startsWith("teacher") ? "teacher" : "student", hasResources: false, createdAt: "" }) as never;
  const steps = eventSteps([ev("question"), ...Array.from({ length: 6 }, () => [ev("teacher_feedback", "retry"), ev("submission")]).flat(), ev("teacher_feedback", "pass")]);
  assert.deepEqual(steps.map(s => s.label + (s.times ? " ×" + s.times : "")), ["Hỏi bài", "Cần làm lại", "Trả bài", "Cần làm lại", "Trả lại ×5", "Đạt"]);
  const h = renderToStaticMarkup(<JourneyTimeline items={[toJourneyItem(jrow("x", "2026-09-29T00:00:00Z", identity(), [{ kind: "submission", author_role: "student" }, { kind: "teacher_feedback", verdict: "retry", author_role: "teacher" }, { kind: "submission", author_role: "student" }, { kind: "teacher_feedback", verdict: "retry", author_role: "teacher" }, { kind: "submission", author_role: "student" }]))!]} ownerName="HS03" />);
  assert.match(h, /lt-ms-times" aria-label="2 lần"> ×2/);
});

test("JourneyTimeline render: năm · chặng có màu · mốc bấm được · private có nhãn; rỗng → lời nhắn", () => {
  const items = [
    jrow("b", "2026-09-29T00:00:00Z", identity(), [{ kind: "question", author_role: "student" }, { kind: "teacher_feedback", verdict: "pass", author_role: "teacher" }]),
    jrow("p", "2026-09-29T01:00:00Z", identity({ lesson: { title: "Bài 4.4 — Bolero móc kiểu 2" } }), [], { visibility: "private", status: "waiting_teacher" }),
  ].map(toJourneyItem).filter((x): x is NonNullable<typeof x> => !!x);
  const h = renderToStaticMarkup(<JourneyTimeline items={items} ownerName="HS03" onOpenThread={() => {}} />);
  assert.match(h, /Hành trình âm nhạc của HS03/);
  assert.match(h, /lt-year">2026/);
  assert.match(h, /Tự học · DH2/);
  assert.match(h, /--lt-phase-from:#4338CA/);
  assert.match(h, /❓ Hỏi bài/);
  assert.match(h, /✅ Đạt/);
  assert.match(h, /Chỉ Thầy/);
  assert.equal((h.match(/class="lt-ms-btn"/g) || []).length, 2);
  const empty = renderToStaticMarkup(<JourneyTimeline items={[]} ownerName="An" />);
  assert.match(empty, /Chưa có dấu mốc học tập\./);
  assert.match(empty, /Những lần Trả bài, Hỏi bài của An sẽ dần tạo nên Hành trình tại đây\./);
  assert.equal(/lt-card/.test(empty), false, "trống → không dựng khung");
});

// ── Chốt chặn nguồn ──────────────────────────────────────────────────────────
test("Feed/Tường/Hành trình đọc qua RPC; KHÔNG copy thread sang class_posts; không bảng journey", () => {
  assert.match(src("class-social/posts/postsApi.ts"), /rpc\('social_feed'/);
  assert.match(src("class-social/friends/friendsApi.ts"), /'user_wall'/);
  assert.match(src("learning-thread/ltApi.ts"), /rpc\('learning_journey'/);
  assert.match(src("class-social/posts/useCommunityFeed.ts"), /usePostsFeed\(fetchSocialFeedPage\)/);
  for (const f of ["learning-thread/feedModel.ts", "learning-thread/LearningThreadCard.tsx", "learning-thread/JourneyTimeline.tsx", "learning-thread/JourneyView.tsx", "class-social/sections/FeedEntryCard.tsx"]) {
    const s = src(f);
    assert.equal(/from\(['"](class_posts|learning_threads|journey)/.test(s) || /insert\(/.test(s), false, f);
  }
  const profile = src("class-social/sections/ProfilePage.tsx");
  assert.match(profile, /\{p\.canViewWall\s*\?\s*<Wall /);
  assert.match(profile, /<JourneyView userId=\{userId\}/);
  const db = readFileSync(new URL("../../db/learning_threads_p2_setup.sql", import.meta.url), "utf8");
  assert.equal(/create table/i.test(db), false, "P2 không tạo bảng");
  assert.equal(/insert into public\.class_posts/i.test(db), false);
});
