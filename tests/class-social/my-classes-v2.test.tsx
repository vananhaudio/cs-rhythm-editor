/**
 * "Lớp của tôi" = tổng quan các lớp ĐANG THAM GIA (buổi hiện tại MỘT dòng, không "Tiếp tục học" + hoạt động mới + Vào lớp).
 * CLASS PAGE V2 = "bản đồ sống của lớp": Tên lớp → MỤC LỤC SỐNG (học + bài trả của tôi) → LỚP MÌNH ĐANG HỌC → Thành viên.
 * Hoạt động lớp: MỘT nguồn social_class_activity (gồm bài trả checkpoint visibility 'class').
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { toClassLearningState, curriculumState, type ClassLearningState } from "../../src/classLearning/progress";
import { CurrentSessionLine } from "../../src/class-social/classes/LearnParts";
import ClassMap from "../../src/class-social/classes/ClassMap";
import { checkpointStatus, cpLabel, stageGroups } from "../../src/class-social/classes/classMapModel";
import MyClassesBoard from "../../src/class-social/classes/MyClassesBoard";
import ClassesPage from "../../src/class-social/classes/ClassesPage";
import { ActivityLine, lessonLabel } from "../../src/class-social/classes/ClassActivity";
import { toClassCards } from "../../src/class-social/classes/classModel";
import { toThreadCard } from "../../src/learning-thread/feedModel";
void React;

// Môi trường Node: lịch sử trình duyệt tối thiểu cho useHistoryTab (trạng thái bung/thu giáo trình nhớ theo mục lịch sử)
const hist = { state: null as Record<string, unknown> | null, replaceState() {} };
(globalThis as { window?: unknown }).window = { history: hist };

const CLS = "c9828885-8593-4377-9196-19b43dae90bc";
const NOW = new Date("2026-10-02T12:00:00Z");
const src = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
const ses = (n: number, stage: number, over: Record<string, unknown> = {}) => ({
  session_id: `s${n}`, session_no: n, title: `Buổi ${n} · Bài ${n}`, stage_no: stage,
  stage_title: stage === 1 ? "TỪ GIAI ĐIỆU ĐẾN SOLO GUITAR" : stage === 2 ? "PHÁT TRIỂN SOLO GUITAR & BOLERO" : "TỰ DỰNG BÀI SOLO GUITAR",
  published: n <= 5, opened_at: null, completed_at: null, checkpoints: [], ...over,
});
// Đúng case pilot: SOLO01.TH01, HS03 đang học Buổi 01 (3 bài trả bắt buộc, 1.1 chờ Thầy), Buổi 02+ khoá
const RAW = {
  class_id: CLS, enabled: true, role: "learner", program_code: "SOLO01", class_code: "SOLO01.TH01", class_name: "Solo Guitar Căn Bản",
  server_now: NOW.toISOString(), pace_days: 7,
  sessions: Array.from({ length: 24 }, (_, i) => {
    const n = i + 1
    return n === 1
      ? ses(1, 1, { title: "Buổi 1 · Bản đồ nốt giản lược C–Am", opened_at: "2026-10-02T11:38:20Z", checkpoints: [
          { id: "1.1", title: "Bài trả 1.1 — Tìm nốt trên cần đàn", required: true, accepts: ["text"], thread: { id: "t11", status: "waiting_teacher", visibility: "class", passed_at: null, last_event_at: null } },
          { id: "1.2", title: "Bài trả 1.2 — Liên thông 3 vùng", required: true, accepts: ["video_link"], thread: null },
          { id: "1.3", title: "Bài trả 1.3 — 3 chỗ đang vướng", required: true, accepts: ["text"], thread: null }] })
      : ses(n, n <= 8 ? 1 : n <= 16 ? 2 : 3)
  }),
};
const ready = (v: unknown) => toClassLearningState(v, CLS) as Extract<ClassLearningState, { enabled: true }>;
const noop = () => {};
const pos = (h: string, re: RegExp) => { const m = re.exec(h); assert.ok(m, String(re)); return m.index };

test("Lớp của tôi: buổi hiện tại là MỘT dòng trạng thái — không nút Tiếp tục học (không nhảy qua mục lục)", () => {
  const h = renderToStaticMarkup(<CurrentSessionLine state={ready(RAW)} now={NOW} />)
  assert.match(h, /Buổi 01 · Bản đồ nốt giản lược C–Am/)
  assert.match(h, /0\/3 bài trả Đạt/)
  assert.doesNotMatch(h, /<button|Tiếp tục học|Học tiếp/)
  const t = renderToStaticMarkup(<CurrentSessionLine state={ready({ ...RAW, role: "teacher" })} now={NOW} />)
  assert.doesNotMatch(t, /bài trả Đạt/)
})

test("Mục lục sống (24 buổi / 3 chặng): chặng hiện tại mở; chặng sau thu gọn nhưng thấy TÊN + số buổi; không tự cuộn", () => {
  const st = ready(RAW)
  assert.deepEqual(stageGroups(st.sessions).map(x => [x.no, x.sessions.length]), [[1, 8], [2, 8], [3, 8]])
  const h = renderToStaticMarkup(<ClassMap state={st} current={1} onOpenSession={noop} onOpenThread={noop} />)
  assert.equal((h.match(/cs-map-stage-toggle/g) || []).length, 3)
  assert.match(h, /Chặng 1 · TỪ GIAI ĐIỆU ĐẾN SOLO GUITAR[\s\S]*8 buổi/)
  assert.match(h, /Chặng 2 · PHÁT TRIỂN SOLO GUITAR &amp; BOLERO[\s\S]*8 buổi/)
  assert.equal((h.match(/class="cs-map-row/g) || []).length, 8, "chỉ chặng đang học bung sẵn")
  // Buổi 01: TÊN là nút mở Trang Buổi; dòng phụ = trạng thái + bài trả của CHÍNH tôi
  assert.match(h, /<button type="button" class="cs-map-title">01 · Bản đồ nốt giản lược C–Am<\/button>/)
  assert.match(h, /Đang học<\/span>[\s\S]*?0\/3 bài trả Đạt/)
  assert.match(h, /aria-current="step"/)
  // Buổi khoá: vẫn thấy tên + chữ "Chưa mở" (không chỉ icon), không phải nút
  assert.match(h, /<span class="cs-map-title">02 · Bài 2<\/span>[\s\S]*?Chưa mở/)
  assert.doesNotMatch(h, /Tiếp tục học|Xem toàn bộ giáo trình|Hoạt động gần đây|Vào học/)
  assert.doesNotMatch(src("class-social/classes/ClassMap.tsx") + src("class-social/classes/ClassPage.tsx"), /scrollIntoView|scrollTo\(/, "vào lớp không tự cuộn")
})

test("bài trả: Đạt · Cần làm lại · Chờ Thầy · Chưa trả — từ Learning Thread thật, bung nhẹ tại chỗ", () => {
  const raw = { ...RAW, sessions: RAW.sessions.map((x, i) => i === 0 ? { ...x, checkpoints: [
    { id: "1.1", title: "Bài trả 1.1 — Tìm nốt", required: true, accepts: ["text"], thread: { id: "t11", status: "passed", visibility: "class", passed_at: "2026-10-02T12:00:00Z", last_event_at: null } },
    { id: "1.2", title: "Liên thông 3 vùng", required: true, accepts: ["video_link"], thread: { id: "t12", status: "needs_retry", visibility: "class", passed_at: null, last_event_at: null } },
    { id: "1.3", title: "Bài trả 1.3 — Chỗ vướng", required: true, accepts: ["text"], thread: { id: "t13", status: "waiting_teacher", visibility: "private", passed_at: null, last_event_at: null } },
    { id: "1.4", title: "Bài trả 1.4 — Ghi âm", required: false, accepts: ["text"], thread: null }] } : x) }
  const st = ready(raw)
  const closed = renderToStaticMarkup(<ClassMap state={st} current={1} onOpenSession={noop} onOpenThread={noop} />)
  assert.match(closed, /aria-expanded="false"[^>]*><span aria-hidden="true">✓ <\/span>1\/4 bài trả Đạt/)
  assert.doesNotMatch(closed, /cs-map-cps/, "mặc định thu gọn — tên bài là chính")
  // bung: dùng lại component với trạng thái đã bung (useState khởi tạo) — kiểm qua model + nhãn
  assert.deepEqual(st.sessions[0].checkpoints.map(c => checkpointStatus(c.thread).label), ["Đạt", "Cần làm lại", "Chờ Thầy", "Chưa trả"])
  assert.equal(cpLabel({ id: "1.2", title: "Liên thông 3 vùng" }), "Bài trả 1.2 · Liên thông 3 vùng")
  assert.equal(cpLabel({ id: "1.1", title: "Bài trả 1.1 — Tìm nốt" }), "Bài trả 1.1 — Tìm nốt")
  // bấm bài có thread → đúng thread; bài chưa trả → Trang Buổi tại đúng bài trả
  const m = src("class-social/classes/ClassMap.tsx")
  assert.match(m, /thread \? onOpenThread\(thread\.id\) : onOpenSession\(s\.no, cp\.id\)/)
  assert.match(m, /aria-expanded=\{expanded\}/)
})

test("Class Page V2: Tên lớp → Mục lục → Lớp mình đang học → Thành viên; không tab, không Tiếp tục học, không card Đang học", () => {
  const p = src("class-social/classes/ClassPage.tsx")
  const order = [/<h1 className="cs-class-name">/, />Mục lục<\/h2>/, />Lớp mình đang học<\/h2>/, /Lớp mình · \{c\.memberCount\} thành viên/].map(re => pos(p, re))
  assert.deepEqual([...order].sort((a, b) => a - b), order, "thứ tự")
  assert.doesNotMatch(p, /Tiếp tục học|Hoạt động gần đây|lt-profile-tabs|CurrentSession|Xem toàn bộ giáo trình|Vào học/)
  assert.match(p, /fetchClassActivityPage/); assert.match(p, /<ActivityLine /)
  assert.match(p, /<NoMapNote entry=\{entry\} isMember=\{member\} \/>/)
  assert.match(src("class-social/classes/ClassMap.tsx"), /Chưa có giáo trình được gắn với lớp này\./)
  assert.match(p, /aria-expanded=\{showMembers\}/)
})

test("Lớp của tôi: CHỈ lớp đang tham gia, mỗi lớp có Vào lớp + Hoạt động mới; lớp khác chỉ qua Khám phá các lớp khác", () => {
  const card = (id: string, name: string, member: boolean) => ({ id, code: name, name, status: "active", is_member: member, member_count: 3, activity_count: 1 })
  const mine = toClassCards([card(CLS, "Solo Guitar Căn Bản", true), card("b0000000-0000-4000-8000-0000000000c9", "Hành trình 2027", true)])
  const discover = toClassCards([card("b0000000-0000-4000-8000-000000000001", "Lớp người khác", false)])
  const classes = { loaded: true, mine, discover, error: null, reload: noop }
  const h = renderToStaticMarkup(<MyClassesBoard classes={classes} isTeacher={false} onOpenClass={noop} onOpenSession={noop} onOpenThread={noop} onOpenDiscover={noop} />)
  assert.equal((h.match(/class="cs-card cs-myclass"/g) || []).length, 2)
  assert.match(h, /Solo Guitar Căn Bản/); assert.match(h, /Hành trình 2027/)
  assert.equal((h.match(/Vào lớp/g) || []).length, 2); assert.equal((h.match(/cs-myclass-sub">Hoạt động mới</g) || []).length, 2)
  assert.doesNotMatch(h, /Lớp người khác/)
  assert.match(h, /Khám phá các lớp khác/)
  const d = renderToStaticMarkup(<ClassesPage classes={classes} onOpenClass={noop} onOpenMyClasses={noop} />)
  assert.match(d, /Khám phá các lớp khác/); assert.match(d, /Lớp người khác/)
  assert.doesNotMatch(d, /Solo Guitar Căn Bản|Hành trình 2027/, "trang Khám phá không trộn lớp của mình")
  const empty = renderToStaticMarkup(<MyClassesBoard classes={{ ...classes, mine: [] }} isTeacher={false} onOpenClass={noop} onOpenSession={noop} onOpenThread={noop} onOpenDiscover={noop} />)
  assert.match(empty, /Bạn chưa ở trong lớp nào/); assert.match(empty, /Khám phá các lớp khác/)
})

test("dòng hoạt động gọn: HS03 vừa trả bài · Bài trả 1.1 · Chờ Thầy phản hồi", () => {
  const c = toThreadCard({
    id: "t11", status: "waiting_teacher", visibility: "class", is_mine: false, created_at: "2026-10-02T11:40:00Z", last_event_at: "2026-10-02T11:40:00Z",
    first_kind: "submission", learner: { user_id: "u3", name: "HS03", avatar_url: null },
    identity: { lesson: { id: null, title: "Bài trả 1.1 — Tìm nốt trên cần đàn", order_index: null }, module: {}, course: {}, class: null },
    last_event: { kind: "submission", verdict: null, author_role: "student", has_resources: false, is_resubmission: false, author: { user_id: "u3", name: "HS03", avatar_url: null } },
  })!
  const h = renderToStaticMarkup(<ul><ActivityLine card={c} now={NOW} onOpenThread={noop} /></ul>)
  assert.equal(lessonLabel("Bài trả 1.1 · Bài trả 1.1 — Tìm nốt trên cần đàn"), "Bài trả 1.1 — Tìm nốt trên cần đàn", "bỏ phần lặp do server ghép")
  assert.equal(lessonLabel("Bài trả 1.1 · Âm giai C–Am"), "Bài trả 1.1 · Âm giai C–Am")
  assert.equal(lessonLabel("Bài trả 1.1 · Bài trả 2.1 — X"), "Bài trả 1.1 · Bài trả 2.1 — X", "khác id → giữ nguyên")
  assert.match(h, /<b>HS03<\/b> vừa trả bài/); assert.match(h, /Bài trả 1\.1 — Tìm nốt trên cần đàn/); assert.match(h, /Chờ Thầy phản hồi/)
})

test("nguồn: hoạt động lớp = social_class_activity (một nguồn); tab Lớp của tôi KHÔNG gọi social_feed_scoped('my_classes'); không DB/RLS mới", () => {
  assert.match(src("class-social/classes/ClassActivity.tsx"), /fetchClassActivityPage/)
  const feed = src("class-social/posts/useCommunityFeed.ts")
  assert.doesNotMatch(feed, /fetchScopedFeedPage\('my_classes'/)
  assert.match(src("class-social/sections/MeHome.tsx"), /scope === 'my_classes'[\s\S]*MyClassesBoard/)
  for (const f of ["class-social/classes/MyClassesBoard.tsx", "class-social/classes/ClassActivity.tsx", "class-social/classes/ClassMap.tsx", "class-social/classes/ClassPage.tsx"]) {
    const s = src(f)
    assert.equal(/\.from\(['"]/.test(s), false, `${f}: không query thẳng bảng`)
    assert.equal(/rpc\(['"]/.test(s), false, `${f}: không RPC mới — dùng classesApi/progressApi có sẵn`)
  }
  // Lớp của tôi = /me?feed=classes · Khám phá = /me/classes
  const page = src("class-social/ClassSocialPage.tsx")
  assert.match(page, /openMyClasses = \(\) => navigate\(HOME, \{ search: '\?feed=classes' \}\)/)
})
