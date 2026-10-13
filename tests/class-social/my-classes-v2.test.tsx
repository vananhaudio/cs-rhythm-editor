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
import { toClassLearningState, curriculumState, currentSessionNo, type ClassLearningState } from "../../src/classLearning/progress";
import ClassMap from "../../src/class-social/classes/ClassMap";
import { checkpointStatus, cpLabel, learnerVisibleState, sessionLearningLabel, stageGroups } from "../../src/class-social/classes/classMapModel";
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
  assert.match(h, /cs-map-stage-text">Chặng 1 · 8 buổi · TỪ GIAI ĐIỆU ĐẾN SOLO GUITAR<\/span>/, "tiêu đề chặng MỘT dòng nhẹ: Chặng N · X buổi · tên chặng")
  assert.match(h, /cs-map-stage-text">Chặng 2 · 8 buổi · PHÁT TRIỂN SOLO GUITAR &amp; BOLERO<\/span>/)
  assert.equal((h.match(/class="cs-map-row/g) || []).length, 8, "chỉ chặng đang học bung sẵn")
  // V3: cột số 01/02/… riêng; TÊN BUỔI là nút mở Trang Buổi; dòng phụ = bài trả của CHÍNH tôi
  assert.match(h, /aria-current="step"><span class="cs-map-no" aria-hidden="true">01<\/span><div class="cs-map-body"><button type="button" class="cs-map-title"><span class="cs-sr-only">Buổi 01: <\/span>Bản đồ nốt giản lược C–Am<\/button><\/div><span class="cs-map-learn is-wait">/)
  assert.doesNotMatch(h, /Đang học|Chưa học|Bạn đang ở đây/, "không nhãn vị trí")
  // Buổi khoá: thấy tên, nhạt + ổ khoá; "Chưa mở" cho trình đọc màn hình; chỉ buổi khoá ĐẦU có một câu gợi ý
  assert.match(h, /<span class="cs-map-title"><span class="cs-sr-only">Buổi 02: <\/span>Bài 2<svg[^>]*cs-map-lock[\s\S]*?<span class="cs-sr-only"> — Chưa mở<\/span>/)
  assert.equal((h.match(/Hoàn thành Buổi 01 để mở/g) || []).length, 0, "danh sách không lặp gợi ý mở khoá — lý do ở panel/Trang Buổi")
  assert.equal((h.match(/class="cs-map-state">Chưa mở/g) || []).length, 0, "không lặp chữ Chưa mở từng dòng")
  assert.doesNotMatch(h, /Tiếp tục học|Xem toàn bộ giáo trình|Hoạt động gần đây|Vào học/)
  assert.doesNotMatch(src("class-social/classes/ClassMap.tsx") + src("class-social/classes/ClassPage.tsx"), /scrollIntoView|scrollTo\(/, "vào lớp không tự cuộn")
})

test("bài trả: Đạt · Cần làm lại · Chờ thầy chấm · Chưa trả — từ Learning Thread thật, bung nhẹ tại chỗ", () => {
  const raw = { ...RAW, sessions: RAW.sessions.map((x, i) => i === 0 ? { ...x, checkpoints: [
    { id: "1.1", title: "Bài trả 1.1 — Tìm nốt", required: true, accepts: ["text"], thread: { id: "t11", status: "passed", visibility: "class", passed_at: "2026-10-02T12:00:00Z", last_event_at: null } },
    { id: "1.2", title: "Liên thông 3 vùng", required: true, accepts: ["video_link"], thread: { id: "t12", status: "needs_retry", visibility: "class", passed_at: null, last_event_at: null } },
    { id: "1.3", title: "Bài trả 1.3 — Chỗ vướng", required: true, accepts: ["text"], thread: { id: "t13", status: "waiting_teacher", visibility: "private", passed_at: null, last_event_at: null } },
    { id: "1.4", title: "Bài trả 1.4 — Ghi âm", required: false, accepts: ["text"], thread: null }] } : x) }
  const st = ready(raw)
  const closed = renderToStaticMarkup(<ClassMap state={st} current={1} onOpenSession={noop} onOpenThread={noop} />)
  assert.doesNotMatch(closed, /cs-map-subs|bài trả Đạt/, "học viên: không dòng phụ 'x/y bài trả Đạt ›' — chi tiết bài trả ở Trang Buổi")
  const teacherView = renderToStaticMarkup(<ClassMap state={{ ...st, role: "teacher" }} current={1} onOpenSession={noop} onOpenThread={noop} />)
  assert.match(teacherView, /aria-expanded="false"[^>]*>4 bài trả/, "Thầy: giữ lối xem nhanh bài trả (bung tại chỗ)")
  assert.doesNotMatch(closed, /cs-map-cps/, "mặc định thu gọn — tên bài là chính")
  assert.match(closed, /class="cs-map-learn is-warn"><span class="cs-map-learn-mark" aria-hidden="true">↻<\/span><span class="cs-sr-only">Trả bài: <\/span>Cần làm lại/, "nhãn cấp buổi bên phải tên buổi")
  // bung: dùng lại component với trạng thái đã bung (useState khởi tạo) — kiểm qua model + nhãn
  assert.deepEqual(st.sessions[0].checkpoints.map(c => checkpointStatus(c.thread).label), ["Đạt", "Cần làm lại", "Chờ thầy chấm", "Chưa trả"])
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
  const map = renderToStaticMarkup(<ClassMap state={{ ...st, role: "teacher" }} current={1} layout="side" selected={1} onSelect={noop} onOpenSession={noop} onOpenThread={noop} />)
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
  const order = [/<ClassHead /, /<ClassMap /, /<SubmissionsPanel /].map(re => pos(p, re))
  assert.deepEqual([...order].sort((a, b) => a - b), order, "thứ tự: phần đầu dùng chung (Tên lớp → Giáo trình | Không gian lớp) → mục lục ↔ bài trả")
  assert.doesNotMatch(p, />Mục lục<\/h2>|ClassSpaceDoor/, "Class Reading UI V1: không tiêu đề 'Mục lục' lớn, không khối cánh cửa riêng")
  assert.doesNotMatch(p, /Lớp mình đang học|ActivityLine|MemberList|fetchClassActivityPage|fetchClassMembers|Tiếp tục học|Hoạt động gần đây|lt-profile-tabs|Vào học/)
  assert.doesNotMatch(p, /classMetaLine|teacherNames/, "header không lặp tên khoá / Thầy")
  const hd = src("class-social/classes/ClassHead.tsx")
  assert.match(hd, /<h1 className="cs-class-name">/)
  assert.match(hd, /\{schedule && <p className="cs-classv2-meta">\{schedule\}<\/p>\}/)
  assert.match(hd, /<ClassSectionNav /)
  assert.match(p, /<NoMapNote entry=\{entry\} isMember=\{member\} \/>/)
  const { ClassSectionNav } = await import("../../src/class-social/classes/ClassParts")
  const cid = "11111111-2222-3333-4444-555555555555"
  const nav = renderToStaticMarkup(<ClassSectionNav classId={cid} active="syllabus" onOpenSyllabus={noop} onOpenSpace={noop} onOpenMembers={noop} />)
  assert.match(nav, new RegExp(`href="/me/classes/${cid}"[^>]*aria-current="page"[^>]*>Giáo trình<`), "Giáo trình = route trang lớp, đang ở đây")
  assert.match(nav, new RegExp(`href="/me/classes/${cid}/space"[^>]*>Không gian lớp<`), "Không gian lớp = route sẵn có")
  assert.match(nav, new RegExp(`href="/me/classes/${cid}/members"[^>]*>Thành viên<`), "Thành viên = tab thứ ba, route riêng")
  assert.deepEqual([...nav.matchAll(/>(Giáo trình|Không gian lớp|Thành viên)</g)].map(m => m[1]), ["Giáo trình", "Không gian lớp", "Thành viên"], "đúng 3 tab, đúng thứ tự")
  assert.equal((nav.match(/<a /g) || []).length, 3, "ba khu vực ngang hàng, không hệ tab mới")
  const navM = renderToStaticMarkup(<ClassSectionNav classId={cid} active="members" onOpenSyllabus={noop} onOpenSpace={noop} onOpenMembers={noop} />)
  assert.match(navM, new RegExp(`href="/me/classes/${cid}/members"[^>]*aria-current="page"`), "tab Thành viên đang chọn")
  assert.doesNotMatch(navM, new RegExp(`href="/me/classes/${cid}/space"[^>]*aria-current`))
  // Không gian lớp: REUSE social_class_activity + LearningThreadCard (thẻ Feed) + MemberList (không hệ Social mới), ← về đúng lớp
  const sp = src("class-social/classes/ClassSpacePage.tsx")
  assert.match(sp, /fetchClassActivityPage/); assert.match(sp, /<LearningThreadCard /); assert.doesNotMatch(sp, /<ActivityLine /); assert.match(sp, /<MemberList /); assert.match(sp, /fetchClassMembers/)
  assert.doesNotMatch(sp, /rpc\(|\.from\(/)
  assert.match(sp, /\{tab === 'space' && <section[\s\S]*cs-space-feed/, "Không gian lớp = bảng hoạt động trực tiếp")
  assert.match(sp, /\{tab === 'members' && <section[\s\S]*cs-space-members/, "Thành viên = tab riêng, không nằm trên/dưới feed")
  assert.match(sp, /tab = 'space'/, "mặc định /space vẫn là Không gian lớp (deep link cũ)")
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

test("Class Reading UI V1 — nhãn trả bài CẤP BUỔI: chỉ từ bài BẮT BUỘC, theo thứ tự Đạt > Cần làm lại > Chờ thầy chấm > Chưa trả", () => {
  const T = (status: string, passed_at: string | null = null) => ({ id: "t" + status, status, visibility: "class", passed_at, last_event_at: null })
  const mk = (cps: unknown[], extra: Record<string, unknown> = {}, role = "learner") => {
    const raw = { ...RAW, role, sessions: RAW.sessions.map((x, i) => i === 0 ? { ...x, ...extra, checkpoints: cps } : x) }
    const st = ready(raw)
    return sessionLearningLabel(st.sessions[0], st)?.label ?? null
  }
  const cp = (id: string, thread: unknown, required = true, accepts = ["text"], quiz_passed_at: string | null = null) => ({ id, title: id, required, accepts, thread, quiz_passed_at })
  assert.equal(mk([cp("1.1", T("passed", "x")), cp("1.2", T("passed", "x"))]), "Đạt")
  assert.equal(mk([cp("1.1", T("passed", "x")), cp("1.2", T("needs_retry")), cp("1.3", T("waiting_teacher"))]), "Cần làm lại", "retry ưu tiên hơn chờ chấm")
  assert.equal(mk([cp("1.1", T("passed", "x")), cp("1.2", T("waiting_teacher")), cp("1.3", null)]), "Chờ thầy chấm", "chờ chấm ưu tiên hơn chưa nộp")
  assert.equal(mk([cp("1.1", null), cp("1.2", null)]), "Chưa trả")
  assert.equal(mk([cp("1.1", T("passed", "x")), cp("1.2", null)]), "Chưa trả", "còn bài bắt buộc chưa nộp")
  // đã Đạt rồi nộp lại (server: status về waiting_teacher, passed_at giữ) → vẫn Đạt
  assert.equal(mk([cp("1.1", T("waiting_teacher", "2026-10-02T12:00:00Z"))]), "Đạt")
  // bài KHÔNG bắt buộc không ảnh hưởng
  assert.equal(mk([cp("1.1", T("passed", "x")), cp("1.2", T("needs_retry"), false)]), "Đạt")
  assert.equal(mk([cp("1.1", null, false)]), null, "không có bài bắt buộc → không nhãn")
  // trắc nghiệm: Đạt / Chưa trả
  assert.equal(mk([cp("2.1", null, true, ["quiz"], "2026-10-05T00:00:00Z"), cp("2.2", T("passed", "x"), true, ["video_link"])]), "Đạt")
  assert.equal(mk([cp("2.1", null, true, ["quiz"]), cp("2.2", T("passed", "x"), true, ["video_link"])]), "Chưa trả")
  // không đủ dữ liệu / không chắc → không đoán
  assert.equal(mk([cp("1.1", T("teacher_responded"))]), null, "Thầy phản hồi chưa chấm: quy tắc chưa nêu → không nhãn")
  assert.equal(mk([cp("1.1", null), cp("1.2", T("passed", "x"))], { completed_at: "2026-10-03T00:00:00Z" }), null, "server đã hoàn thành buổi mà còn bài bắt buộc chưa Đạt → không suy diễn")
  assert.equal(mk([cp("1.1", T("passed", "x"))], {}, "teacher"), null, "Thầy: không có trạng thái theo học viên")
  // buổi khoá (chưa mở) → không nhãn
  const st = ready(RAW)
  assert.equal(st.sessions[1].openedAt, null)
  assert.equal(sessionLearningLabel(st.sessions[1], st), null)
  // chế độ giáo trình → không nhãn
  const cur = { ...ready({ ...RAW, sessions: RAW.sessions.map((x, i) => i === 0 ? { ...x, checkpoints: [cp("1.1", null)] } : x) }), mode: "curriculum" as const }
  assert.equal(sessionLearningLabel(cur.sessions[0], cur), null)
})

test("Class Reading UI V1 (nghiệm thu): học viên không thấy 44 buổi xoay vòng nội bộ; Thầy thấy đủ; lớp không chặng giữ nguyên", () => {
  const cb2 = (role: string, over: Record<string, unknown> = {}) => ready({ ...RAW, role, class_name: "Guitar căn bản 2", sessions: Array.from({ length: 48 }, (_, i) => {
    const n = i + 1
    return { session_id: `s${n}`, session_no: n, title: `Buổi ${n} · Bài ${n}`, stage_no: n <= 4 ? 1 : null, stage_title: n <= 4 ? "Guitar căn bản 2" : null,
      published: n <= 4, opened_at: n <= 2 ? "2026-10-06T13:00:00Z" : null, completed_at: null, checkpoints: [], ...(n <= 4 ? over : {}) }
  }) })
  const learner = cb2("learner"), teacher = cb2("teacher")
  assert.equal(learner.sessions.length, 48, "dữ liệu server không đổi")
  assert.deepEqual(learnerVisibleState(learner).sessions.map(x => x.no), [1, 2, 3, 4], "học viên: chỉ 4 buổi được giao")
  assert.equal(learnerVisibleState(teacher).sessions.length, 48, "Thầy: đủ 48 buổi")
  const h = renderToStaticMarkup(<ClassMap state={learnerVisibleState(learner)} current={1} onOpenSession={noop} onOpenThread={noop} />)
  assert.match(h, /cs-map-stage-text">Chặng 1 · 4 buổi<\/span>/, "không lặp tên lớp (tên chặng = tên lớp) trong tiêu đề chặng")
  assert.doesNotMatch(h, /44 buổi|Giáo trình ·/)
  assert.equal((h.match(/class="cs-map-row/g) || []).length, 4)
  const t = renderToStaticMarkup(<ClassMap state={learnerVisibleState(teacher)} current={1} onOpenSession={noop} onOpenThread={noop} />)
  assert.match(t, /Giáo trình · 44 buổi/, "Thầy vẫn thấy nhóm 44 buổi")
  // lớp KHÔNG có chặng nào (curriculum thuần): giữ nguyên, không làm trống danh sách
  const flat = ready({ ...RAW, sessions: RAW.sessions.map(x => ({ ...x, stage_no: null, stage_title: null })) })
  assert.equal(learnerVisibleState(flat).sessions.length, 24)
  // buổi không chặng nhưng ĐÃ xuất bản / đã mở: vẫn hiện (không giấu thứ học viên đang dùng)
  const mixed = ready({ ...RAW, sessions: RAW.sessions.map((x, i) => i === 0 ? { ...x, stage_no: null, stage_title: null } : x) })
  assert.ok(learnerVisibleState(mixed).sessions.some(x => x.no === 1))
  // quyền / mở khoá không đụng: trạng thái hiện tại tính từ dữ liệu gốc
  assert.equal(currentSessionNo(learner, NOW), 1)
  const p = src("class-social/classes/ClassPage.tsx")
  assert.match(p, /const side = wide && hasSubmissions && isTeacher && learn\?\.role === 'teacher'/, "học viên không có panel phải")
})

test("Class Reading UI V1 (nghiệm thu): Không gian lớp không còn nút '← Về lớp' riêng — 'Giáo trình' trên thanh phân đoạn là đường quay lại", () => {
  const sp = src("class-social/classes/ClassSpacePage.tsx")
  assert.doesNotMatch(sp, /cs-classspace-back|ArrowLeft/)
  assert.match(sp, /<ClassHead classId=\{classId\} card=\{c\} canShare=\{[^}]+\} active=\{tab\}/)
  assert.match(sp, /onOpenSyllabus=\{onBackToClass\}/)
  // Một phần đầu + một khung cho cả hai khu vực → tên lớp/thanh điều hướng không đổi toạ độ khi chuyển
  const cp = src("class-social/classes/ClassPage.tsx")
  assert.match(cp, /<ClassHead classId=\{classId\} card=\{c\} fallbackName=\{learn\?\.className\} canShare=\{member\} active="syllabus"/)
  for (const f of [sp, cp]) assert.match(f, /cs-classframe/)
})
