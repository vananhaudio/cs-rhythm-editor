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
import ClassMap from "../../src/class-social/classes/ClassMap";
import { checkpointStatus, cpLabel, stageGroups } from "../../src/class-social/classes/classMapModel";
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

test("Mục lục sống (24 buổi / 3 chặng): chặng hiện tại mở; chặng sau thu gọn nhưng thấy TÊN + số buổi; không tự cuộn", () => {
  const st = ready(RAW)
  assert.deepEqual(stageGroups(st.sessions).map(x => [x.no, x.sessions.length]), [[1, 8], [2, 8], [3, 8]])
  const h = renderToStaticMarkup(<ClassMap state={st} current={1} onOpenSession={noop} onOpenThread={noop} />)
  assert.equal((h.match(/cs-map-stage-toggle/g) || []).length, 3)
  assert.match(h, /cs-map-stage-no">Chặng 1<\/span><span class="cs-map-stage-name">TỪ GIAI ĐIỆU ĐẾN SOLO GUITAR · 8 buổi/, "tiêu đề chặng hai cấp")
  assert.match(h, /cs-map-stage-no">Chặng 2<\/span><span class="cs-map-stage-name">PHÁT TRIỂN SOLO GUITAR &amp; BOLERO · 8 buổi/)
  assert.equal((h.match(/class="cs-map-row/g) || []).length, 8, "chỉ chặng đang học bung sẵn")
  // V3: cột số 01/02/… riêng; TÊN BUỔI là nút mở Trang Buổi; dòng phụ = bài trả của CHÍNH tôi
  assert.match(h, /aria-current="step"><span class="cs-map-no" aria-hidden="true">01<\/span><div class="cs-map-body"><button type="button" class="cs-map-title"><span class="cs-sr-only">Buổi 01: <\/span>Bản đồ nốt giản lược C–Am<\/button><div class="cs-map-meta"><button[^>]*>0\/3 bài trả Đạt/)
  assert.doesNotMatch(h, /Đang học|Chưa học|Bạn đang ở đây/, "không nhãn vị trí")
  // Buổi khoá: thấy tên, nhạt + ổ khoá; "Chưa mở" cho trình đọc màn hình; chỉ buổi khoá ĐẦU có một câu gợi ý
  assert.match(h, /<span class="cs-map-title"><span class="cs-sr-only">Buổi 02: <\/span>Bài 2<svg[^>]*cs-map-lock[\s\S]*?<span class="cs-sr-only"> — Chưa mở<\/span>/)
  assert.equal((h.match(/Hoàn thành Buổi 01 để mở/g) || []).length, 0, "danh sách không lặp gợi ý mở khoá — lý do ở panel/Trang Buổi")
  assert.equal((h.match(/class="cs-map-state">Chưa mở/g) || []).length, 0, "không lặp chữ Chưa mở từng dòng")
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
  assert.match(m, /aria-expanded=\{open\}/, "mobile: bung tại chỗ")
  assert.match(m, /aria-pressed=\{open\} aria-controls="cs-subs-panel"/, "desktop: chọn buổi cho panel phải")
})

test("V3 desktop master-detail: layout 'side' — bấm số bài trả CHỌN buổi (không bung), panel phải 'Bài trả của tôi' có buổi + tóm tắt + từng bài trả thật", async () => {
  const { default: SubmissionsPanel } = await import("../../src/class-social/classes/SubmissionsPanel")
  const raw = { ...RAW, sessions: RAW.sessions.map((x, i) => i === 0 ? { ...x, checkpoints: [
    { id: "1.1", title: "Bài trả 1.1 — Tìm nốt", required: true, accepts: ["text"], thread: { id: "t11", status: "passed", visibility: "class", passed_at: "x", last_event_at: null } },
    { id: "1.2", title: "Liên thông", required: true, accepts: ["text"], thread: { id: "t12", status: "teacher_responded", visibility: "class", passed_at: null, last_event_at: null } },
    { id: "1.3", title: "Chỗ vướng", required: true, accepts: ["text"], thread: null }] } : x) }
  const st = ready(raw)
  const map = renderToStaticMarkup(<ClassMap state={st} current={1} layout="side" selected={1} onSelect={noop} onOpenSession={noop} onOpenThread={noop} />)
  assert.match(map, /class="cs-map-row is-current is-selected"/)
  assert.match(map, /aria-pressed="true" aria-controls="cs-subs-panel"/)
  assert.doesNotMatch(map, /cs-map-cps/, "desktop: không bung trong mục lục")
  const panel = renderToStaticMarkup(<SubmissionsPanel state={st} sessionNo={1} onOpenSession={noop} onOpenThread={noop} />)
  const order = [/Bài trả của tôi/, /Buổi 01 · Bản đồ nốt giản lược C–Am<\/button>/, /✓<\/span>1\/3 Đạt/, /1\.1 · Tìm nốt/, /cs-map-cp-status is-ok">Đạt/, /1\.2 · Liên thông/, /Thầy đã phản hồi/, /Chưa trả/].map(re => pos(panel, re))
  assert.deepEqual([...order].sort((a, b) => a - b), order, "panel: buổi → tóm tắt → từng bài trả")
  assert.doesNotMatch(panel, /%|XP|progress|Tiếp tục/i)
  const locked = renderToStaticMarkup(<SubmissionsPanel state={st} sessionNo={2} onOpenSession={noop} onOpenThread={noop} />)
  assert.match(locked, /Chưa mở · Hoàn thành Buổi 01 để mở/)
  const p = src("class-social/classes/ClassPage.tsx")
  assert.match(p, /const side = wide && hasSubmissions/, "master-detail chỉ khi đủ rộng VÀ thật có bài trả (không master-detail giả)")
  assert.match(p, /learn\.mode === 'checkpoint'/)
})

test("Class Page V3: Tên lớp (+ lịch) → Mục lục ↔ Bài trả của tôi → cánh cửa Không gian lớp; KHÔNG feed/thành viên trên trang học", async () => {
  const p = src("class-social/classes/ClassPage.tsx")
  const order = [/<h1 className="cs-class-name">/, />Mục lục<\/h2>/, /<SubmissionsPanel /, /<ClassSpaceDoor /].map(re => pos(p, re))
  assert.deepEqual([...order].sort((a, b) => a - b), order, "thứ tự")
  assert.doesNotMatch(p, /Lớp mình đang học|ActivityLine|MemberList|fetchClassActivityPage|fetchClassMembers|Tiếp tục học|Hoạt động gần đây|lt-profile-tabs|Vào học/)
  assert.doesNotMatch(p, /classMetaLine|teacherNames/, "header không lặp tên khoá / Thầy")
  assert.match(p, /\{c\?\.schedule && <p className="cs-classv2-meta">\{c\.schedule\}<\/p>\}/)
  assert.match(p, /<NoMapNote entry=\{entry\} isMember=\{member\} \/>/)
  const { ClassSpaceDoor } = await import("../../src/class-social/classes/ClassParts")
  const door = renderToStaticMarkup(<ClassSpaceDoor onOpen={noop} />)
  assert.match(door, /Không gian lớp/); assert.match(door, /Bài trả · Hỏi bài · Trao đổi · Thành viên/)
  assert.equal((door.match(/<button/g) || []).length, 1, "một đích bấm duy nhất")
  // Không gian lớp: REUSE social_class_activity + ActivityLine + MemberList (không hệ Social mới), ← về đúng lớp
  const sp = src("class-social/classes/ClassSpacePage.tsx")
  assert.match(sp, /fetchClassActivityPage/); assert.match(sp, /<ActivityLine /); assert.match(sp, /<MemberList /); assert.match(sp, /fetchClassMembers/)
  assert.doesNotMatch(sp, /rpc\(|\.from\(/)
  assert.match(src("class-social/ClassSocialPage.tsx"), /onBackToClass=\{\(\) => onBack\(\{ kind: 'class', classId: view\.classId \}\)\} \/>/)
})

test("Lớp của tôi (/me/classes): bản đồ các lớp — tên lớp là lối vào; lớp đã kết thúc ở \"Lớp trước đây\"; lớp khác ở cuối; không Vào lớp / Hoạt động / Đang học", () => {
  const card = (id: string, name: string, member: boolean, status = "active") => ({ id, code: name, name, status, is_member: member, member_count: 3, activity_count: 1 })
  const mine = toClassCards([card(CLS, "Solo Guitar Căn Bản", true), card("b0000000-0000-4000-8000-0000000000c9", "Hành trình 2027", true),
    card("b0000000-0000-4000-8000-0000000000d1", "Tỉa nốt 3 — GL11", true, "completed")])
  const discover = toClassCards([card("b0000000-0000-4000-8000-000000000001", "Lớp người khác", false)])
  const h = renderToStaticMarkup(<ClassesPage classes={{ loaded: true, mine, discover, error: null, reload: noop }} onOpenClass={noop} />)
  const order = [/<h1 class="cs-page-title">Lớp của tôi/, /">Solo Guitar Căn Bản<\/a>/, /">Hành trình 2027<\/a>/, /Nhập mã lớp<\/button>/,
    /Lớp trước đây/, /">Tỉa nốt 3 — GL11<\/a>/, /Các lớp khác/, /">Lớp người khác<\/a>/].map(re => pos(h, re))
  assert.deepEqual([...order].sort((a, b) => a - b), order, "thứ tự cố định")
  assert.doesNotMatch(h, /Vào lớp|Tiếp tục học|Hoạt động mới|Đang học|cs-card cs-myclass/)
  assert.doesNotMatch(src("class-social/sections/MeHome.tsx"), /MyClassesBoard/, "tab Lớp trên Home không phải bảng lớp (dashboard)")
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

test("nguồn: hoạt động lớp = social_class_activity; tab \"Lớp\" trên Home = ghép social_class_activity các lớp của tôi (không social_feed_scoped('my_classes')); không DB/RLS mới", () => {
  assert.match(src("class-social/classes/ClassActivity.tsx"), /fetchClassActivityPage/)
  const feed = src("class-social/posts/useCommunityFeed.ts")
  assert.doesNotMatch(feed, /fetchScopedFeedPage\('my_classes'/)
  assert.match(feed, /fetchMyClassesActivityPage/)
  assert.match(src("class-social/classes/classesApi.ts"), /classIds\.map\(id => fetchClassActivityPage\(id, cursor\)\)/)
  for (const f of ["class-social/classes/ClassesPage.tsx", "class-social/classes/ClassActivity.tsx", "class-social/classes/ClassMap.tsx", "class-social/classes/ClassPage.tsx"]) {
    const s = src(f)
    assert.equal(/\.from\(['"]/.test(s), false, `${f}: không query thẳng bảng`)
    assert.equal(/rpc\(['"]/.test(s), false, `${f}: không RPC mới — dùng classesApi/progressApi có sẵn`)
  }
  // Lớp của tôi = /me/classes · ?feed=classes = tab hoạt động "Lớp"
  const page = src("class-social/ClassSocialPage.tsx")
  assert.match(page, /openClasses = \(\) => navigate\(\{ kind: 'classes' \}\)/)
  assert.doesNotMatch(page, /openMyClasses/)
})
