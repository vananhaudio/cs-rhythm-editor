/**
 * UX V2 — "Lớp của tôi" = trung tâm sinh hoạt: bảng các lớp ĐANG THAM GIA (buổi hiện tại + Tiếp tục học + hoạt động),
 * Trang Lớp: Đang học → Hoạt động gần đây → Giáo trình tóm tắt (bung toàn bộ khi bấm), Khám phá tách riêng.
 * Hoạt động lớp: MỘT nguồn social_class_activity (gồm bài trả checkpoint visibility 'class').
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { toClassLearningState, curriculumState, type ClassLearningState } from "../../src/classLearning/progress";
import { CurrentSessionBlock } from "../../src/class-social/classes/LearnParts";
import ClassLearnView, { stageGroups } from "../../src/class-social/classes/ClassLearnView";
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

test("Đang học: buổi hiện tại + trạng thái + Tiếp tục học (học viên) · Mở buổi hiện tại (giáo viên)", () => {
  let opened = 0
  const st = ready(RAW)
  const h = renderToStaticMarkup(<CurrentSessionBlock state={st} now={NOW} onOpenSession={n => { opened = n }} />)
  assert.match(h, /Buổi 01 · Bản đồ nốt giản lược C–Am/)
  assert.match(h, /Đang học · 0\/3 bài trả bắt buộc đã Đạt/)
  assert.match(h, /Tiếp tục học/)
  void opened
  const t = renderToStaticMarkup(<CurrentSessionBlock state={ready({ ...RAW, role: "teacher" })} now={NOW} onOpenSession={noop} />)
  assert.match(t, /Mở buổi hiện tại/); assert.match(t, /Giáo viên xem trước/); assert.doesNotMatch(t, /bài trả bắt buộc/)
})

test("Trang Lớp: Tên lớp → Đang học → Hoạt động gần đây → Giáo trình TÓM TẮT (không bung 24 buổi)", () => {
  hist.state = null
  const h = renderToStaticMarkup(<ClassLearnView state={ready(RAW)} onOpenSession={noop} onOpenThread={noop} onOpenClasses={noop} onOpenCommunity={noop} />)
  const order = [/<h1 class="cs-class-name">Solo Guitar Căn Bản/, /Tiếp tục học/, /Hoạt động gần đây/, /Giáo trình<\/h2>/].map(re => pos(h, re))
  assert.deepEqual([...order].sort((a, b) => a - b), order, "thứ tự ưu tiên")
  assert.equal((h.match(/class="cs-learn-row /g) || []).length, 2, "tóm tắt: buổi hiện tại + buổi kế")
  assert.match(h, /Chặng 1 · TỪ GIAI ĐIỆU ĐẾN SOLO GUITAR · 8 buổi/)
  assert.match(h, /Buổi 02 · Bài 2[\s\S]*?🔒/)
  assert.match(h, /Xem toàn bộ giáo trình/); assert.match(h, /Xem tất cả hoạt động/); assert.match(h, /Lớp của tôi/)
})

test("Xem toàn bộ giáo trình: đủ 3 chặng / 24 buổi, gom theo chặng (chặng hiện tại mở sẵn, chặng khác bấm để mở)", () => {
  const st = ready(RAW)
  const g = stageGroups(st.sessions)
  assert.deepEqual(g.map(x => [x.no, x.sessions.length]), [[1, 8], [2, 8], [3, 8]])
  hist.state = { csClassMap: "full" }
  const h = renderToStaticMarkup(<ClassLearnView state={st} onOpenSession={noop} onOpenThread={noop} onOpenClasses={noop} onOpenCommunity={noop} />)
  hist.state = null
  assert.equal((h.match(/cs-learn-stage-toggle/g) || []).length, 3)
  assert.equal((h.match(/aria-expanded="true"/g) || []).length, 2, "chặng 1 mở + nút Thu gọn")
  assert.equal((h.match(/class="cs-learn-row /g) || []).length, 8, "chỉ chặng đang học bung sẵn")
  assert.match(h, /Thu gọn giáo trình/)
  // giáo trình chế độ xem (chưa checkpoint) vẫn gom đúng + có vạch nghỉ giữa chặng
  const day = (d: number) => new Date(Date.UTC(2026, 8, 17 + d, 12)).toISOString()
  const cur = curriculumState({ classId: CLS, programCode: "SOLO01", classCode: "SOLO01.TH01", className: "Solo Guitar Căn Bản", role: "learner",
    stages: [{ id: 64, class_id: CLS, stage_no: 1, public_title: "A", summary: null, from_session: 1, to_session: 2, starts_on: null, ends_on: null },
             { id: 66, class_id: CLS, stage_no: 2, public_title: "B", summary: null, from_session: 3, to_session: 3, starts_on: null, ends_on: null }],
    sessions: [
      { id: "s1", session_number: 1, event_type: "lesson", status: "scheduled", start_at: day(0), end_at: null, title: "Buổi 1 · X", stage_id: 64 },
      { id: "s2", session_number: 2, event_type: "lesson", status: "scheduled", start_at: day(7), end_at: null, title: "Buổi 2 · Y", stage_id: 64 },
      { id: "b1", session_number: null, event_type: "break", status: "holiday", start_at: day(14), end_at: null, title: "Nghỉ giữa chặng", stage_id: null },
      { id: "s3", session_number: 3, event_type: "lesson", status: "scheduled", start_at: day(21), end_at: null, title: "Buổi 3 · Z", stage_id: 66 }],
    contents: [{ session_id: "s1", status: "published" }] })!
  hist.state = { csClassMap: "full" }
  const c = renderToStaticMarkup(<ClassLearnView state={cur} onOpenSession={noop} onOpenThread={noop} onOpenClasses={noop} onOpenCommunity={noop} />)
  hist.state = null
  assert.match(c, /Nghỉ giữa chặng/)
  assert.equal((c.match(/cs-learn-stage-toggle/g) || []).length, 2)
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
  for (const f of ["class-social/classes/MyClassesBoard.tsx", "class-social/classes/ClassActivity.tsx", "class-social/classes/ClassLearnView.tsx"]) {
    const s = src(f)
    assert.equal(/\.from\(['"]/.test(s), false, `${f}: không query thẳng bảng`)
    assert.equal(/rpc\(['"]/.test(s), false, `${f}: không RPC mới — dùng classesApi/progressApi có sẵn`)
  }
  // Lớp của tôi = /me?feed=classes · Khám phá = /me/classes
  const page = src("class-social/ClassSocialPage.tsx")
  assert.match(page, /openMyClasses = \(\) => navigate\(HOME, \{ search: '\?feed=classes' \}\)/)
})
