/**
 * Lớp của tôi V1 — checkpoint trong giáo trình + tiến độ buổi: model thuần, render bài trả (tĩnh / tương tác),
 * sơ đồ buổi, và chốt chặn nguồn. Quyền / mở buổi / hoàn thành THẬT nằm ở DB — xem scripts/test-learning-threads-db.sh.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LessonDocument from "../../src/lesson/LessonDocument";
import { CheckpointSlot } from "../../src/lesson/checkpointSlot";
import type { LessonDoc, LessonSection } from "../../src/lesson/lessonTypes";
import { checkpointProblems, submitModes, checkpointAcceptsLabel } from "../../src/lesson/checkpoint";
import {
  checkpointUi, currentSessionNo, lockedHint, requiredProgress, sessionBadge, sessionLabel, sessionPace, sessionPhase,
  toClassLearningState, type ClassLearningState,
} from "../../src/classLearning/progress";
import { CheckpointStatusView, SessionRowHead, SessionStatusLine } from "../../src/class-social/classes/LearnParts";
import { ltErrorText, otherVisibility, toThreadDetail, toVisibility, visibilityChoices } from "../../src/learning-thread/ltModel";
import StudentComposer from "../../src/learning-thread/StudentComposer";
void React;

const CLS = "c9828885-8593-4377-9196-19b43dae90bc";
const src = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8");
const noComments = (s: string) => s.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();
const NOW = new Date("2026-10-01T12:00:00Z");

// Hàng RPC class_learning_state giả: Buổi 1 xong, Buổi 2 đang học, Buổi 3 khoá, Buổi 4 chưa xuất bản
const RAW = {
  class_id: CLS, enabled: true, role: "learner", program_code: "SOLO01", class_code: "SOLO01.TH01", class_name: "Solo Guitar Căn Bản",
  server_now: NOW.toISOString(), pace_days: 7,
  sessions: [
    { session_id: "s1", session_no: 1, title: "Buổi 1 · Bản đồ nốt C–Am", stage_no: 1, stage_title: "TỪ GIAI ĐIỆU ĐẾN SOLO GUITAR", published: true,
      opened_at: iso(NOW.getTime() - 10 * DAY), completed_at: iso(NOW.getTime() - 6 * DAY),
      checkpoints: [{ id: "1.1", title: "Âm giai", required: true, accepts: ["text", "video_link"], thread: { id: "t11", status: "passed", visibility: "class", passed_at: iso(NOW.getTime() - 6 * DAY), last_event_at: null } }] },
    { session_id: "s2", session_no: 2, title: "Buổi 2 · Ép ngón & Bass", stage_no: 1, stage_title: "TỪ GIAI ĐIỆU ĐẾN SOLO GUITAR", published: true,
      opened_at: iso(NOW.getTime() - 6 * DAY), completed_at: null,
      checkpoints: [
        { id: "2.1", title: "Ép ngón", required: true, accepts: ["text", "video_link"], thread: { id: "t21", status: "needs_retry", visibility: "class", passed_at: null, last_event_at: null } },
        { id: "2.2", title: "Bass", required: true, accepts: ["video_link"], thread: null },
        { id: "2.3", title: "Tự chọn", required: false, accepts: ["text"], thread: null }] },
    { session_id: "s3", session_no: 3, title: "Buổi 3 · Slide", stage_no: 1, stage_title: "TỪ GIAI ĐIỆU ĐẾN SOLO GUITAR", published: true, opened_at: null, completed_at: null, checkpoints: [] },
    { session_id: "s4", session_no: 4, title: "Buổi 4 · Xếp ngón", stage_no: 1, stage_title: "TỪ GIAI ĐIỆU ĐẾN SOLO GUITAR", published: false, opened_at: null, completed_at: null, checkpoints: [] },
  ],
};
const ready = (v: unknown) => toClassLearningState(v, CLS) as Extract<ClassLearningState, { enabled: true }>;

test("model: dịch đúng class_learning_state; lớp chưa bật / dữ liệu lạ → enabled=false (giữ trang lớp cũ)", () => {
  const st = ready(RAW);
  assert.equal(st.enabled, true);
  assert.equal(st.sessions.length, 4);
  assert.equal(st.sessions[0].title, "Bản đồ nốt C–Am");
  assert.equal(sessionLabel(st.sessions[1]), "Buổi 02 · Ép ngón & Bass");
  assert.equal(st.sessions[1].checkpoints[0].thread?.visibility, "class");
  assert.deepEqual(toClassLearningState({ enabled: false }, CLS), { enabled: false, classId: CLS });
  assert.deepEqual(toClassLearningState(null, CLS), { enabled: false, classId: CLS });
  assert.deepEqual(toClassLearningState({ enabled: true }, CLS), { enabled: false, classId: CLS });
});

test("buổi hiện tại = buổi đã mở chưa xong nhỏ nhất; khoá theo BUỔI (không theo bài trả); copy khoá không trừng phạt", () => {
  const st = ready(RAW);
  assert.equal(currentSessionNo(st), 2);
  assert.deepEqual(st.sessions.map(s => sessionPhase(s, "learner")), ["done", "open", "locked", "locked"]);
  assert.equal(lockedHint(st.sessions, st.sessions[2]), "Hoàn thành Buổi 02 để mở");
  // xong hết → buổi đã mở cuối cùng
  const all = ready({ ...RAW, sessions: RAW.sessions.slice(0, 1) });
  assert.equal(currentSessionNo(all), 1);
  // Thầy: mọi buổi mở (xem trước), buổi đầu đã xuất bản tự mở
  const teacher = ready({ ...RAW, role: "teacher" });
  assert.equal(currentSessionNo(teacher), 1);
  assert.deepEqual(teacher.sessions.map(s => sessionPhase(s, "teacher")), ["open", "open", "open", "open"]);
  assert.deepEqual(requiredProgress(st.sessions[1]), { passed: 0, total: 2 });
});

test("nhịp tuần 7 ngày: 🟢 sớm · 🟡 đúng nhịp · 🔴 quá nhịp — chỉ trình bày, không khoá", () => {
  const o = NOW.getTime() - 20 * DAY;
  const at = (d: number) => iso(o + d * DAY);
  assert.equal(sessionPace({ openedAt: at(0), completedAt: at(3) }, NOW)?.tone, "early");
  assert.equal(sessionPace({ openedAt: at(0), completedAt: at(6) }, NOW)?.tone, "on_time");
  assert.equal(sessionPace({ openedAt: at(0), completedAt: at(7) }, NOW)?.tone, "on_time");
  assert.equal(sessionPace({ openedAt: at(0), completedAt: at(9) }, NOW)?.tone, "late");
  assert.equal(sessionPace({ openedAt: iso(NOW.getTime() - 2 * DAY), completedAt: null }, NOW)?.label, "Còn 5 ngày trong nhịp tuần");
  const over = sessionPace({ openedAt: iso(NOW.getTime() - 10 * DAY), completedAt: null }, NOW);
  assert.equal(over?.tone, "overdue");
  assert.match(over!.label, /Quá nhịp tuần 3 ngày · vẫn học tiếp/);
  assert.equal(sessionPace({ openedAt: null, completedAt: null }, NOW), null);
  const st = ready(RAW);
  assert.match(sessionBadge(st.sessions[0], "learner", NOW, 7), /^✓ 🟢 Xong sớm$/);
  assert.equal(sessionBadge(st.sessions[2], "learner", NOW, 7), "🔒");
});

test("trạng thái tại checkpoint: TRẢ BÀI · Chờ chấm · Cần làm lại + TRẢ LẠI · Đạt", () => {
  assert.deepEqual(checkpointUi(null), { chip: null, submit: "first", canView: false });
  const t = (status: string) => ({ id: "x", status: status as never, visibility: "class" as const, passedAt: null, lastEventAt: null });
  assert.equal(checkpointUi(t("waiting_teacher")).chip?.label, "Đã trả · Chờ chấm");
  assert.equal(checkpointUi(t("waiting_teacher")).submit, null);
  assert.equal(checkpointUi(t("needs_retry")).chip?.label, "Cần làm lại");
  assert.equal(checkpointUi(t("needs_retry")).submit, "again");
  assert.equal(checkpointUi(t("passed")).chip?.label, "Đạt");
  assert.equal(checkpointUi(t("passed")).submit, null);
  assert.equal(checkpointUi(t("archived")).submit, "first");
  const st = ready(RAW);
  const html = (cp: (typeof st.sessions)[number]["checkpoints"][number] | null) =>
    renderToStaticMarkup(<CheckpointStatusView cp={cp} supported onSubmit={() => {}} onView={() => {}} />);
  assert.match(html(st.sessions[1].checkpoints[1]), />TRẢ BÀI</);
  const retry = html(st.sessions[1].checkpoints[0]);
  assert.match(retry, /Cần làm lại/); assert.match(retry, />TRẢ LẠI</); assert.match(retry, /Xem cuộc trao đổi/);
  const passed = html(st.sessions[0].checkpoints[0]);
  assert.match(passed, /Đạt/); assert.doesNotMatch(passed, /TRẢ BÀI|TRẢ LẠI/);
  assert.match(renderToStaticMarkup(<CheckpointStatusView cp={st.sessions[1].checkpoints[1]} supported={false} onSubmit={() => {}} onView={() => {}} />), /sẽ mở khi có công cụ/);
});

test("checkpoint trong giáo trình: render TĨNH ở trang công khai/in; TƯƠNG TÁC chỉ khi /me cắm slot (no-print)", () => {
  const sections: LessonSection[] = [
    { kind: "note", text: "Phần học trước" },
    { kind: "checkpoint", id: "4.1", title: "Xếp ngón một câu", prompt: "Gửi video + lý do chọn ngón", required: true, accepts: ["text", "video_link"] },
    { kind: "checkpoint", id: "4.2", title: "Tự chọn", required: false },
    { kind: "note", text: "Phần học sau" },
  ];
  const doc: LessonDoc = { meta: { programCode: "SOLO01", programName: "SOLO GUITAR CĂN BẢN", sessionNo: 4, title: "Xếp ngón" }, sections };
  const pub = renderToStaticMarkup(<LessonDocument doc={doc} />);
  assert.match(pub, /Bài trả 4\.1/); assert.match(pub, /Bắt buộc để hoàn thành buổi/); assert.match(pub, /Không bắt buộc/);
  assert.match(pub, /Trả bằng: văn bản, link video/);
  assert.doesNotMatch(pub, /TRẢ BÀI|class="lsn-cp-slot/);
  // thứ tự: nội dung → checkpoint → nội dung tiếp (trả bài NGAY trong mạch học)
  assert.ok(pub.indexOf("Phần học trước") < pub.indexOf("Bài trả 4.1") && pub.indexOf("Bài trả 4.2") < pub.indexOf("Phần học sau"));
  const me = renderToStaticMarkup(
    <CheckpointSlot.Provider value={cp => <button type="button">TRẢ BÀI {cp.id}</button>}>
      <LessonDocument doc={doc} embedded />
    </CheckpointSlot.Provider>);
  assert.match(me, /class="lsn-cp-slot no-print"><button type="button">TRẢ BÀI 4\.1/);
  assert.match(me, /lsn is-embedded/);
  assert.doesNotMatch(me, /← SOLO GUITAR/);   // nhúng: không thanh quay lại
  // loại lạ / app cũ vẫn không vỡ trang
  assert.doesNotThrow(() => renderToStaticMarkup(<LessonDocument doc={{ ...doc, sections: [{ kind: "checkpoint", id: "9.9" } as never] }} />));
});

test("kiểm giáo trình: id checkpoint hợp lệ + không trùng trong buổi; accepts có schema; V1 chỉ nhận text/video", () => {
  const ok: LessonSection[] = [{ kind: "checkpoint", id: "4.1", title: "A" }, { kind: "checkpoint", id: "4.2", title: "B", required: false, accepts: ["video_link"] }];
  assert.deepEqual(checkpointProblems(ok), []);
  const bad = checkpointProblems([
    { kind: "checkpoint", id: "4.1", title: "A" }, { kind: "checkpoint", id: "4.1", title: "B" },
    { kind: "checkpoint", id: "bad id!", title: "C" }, { kind: "checkpoint", id: "4.3", title: "" },
    { kind: "checkpoint", id: "4.4", title: "D", required: "yes" as never }, { kind: "checkpoint", id: "4.5", title: "E", accepts: ["fax" as never] },
  ]);
  assert.equal(bad.length, 5);
  assert.deepEqual(submitModes({}), { text: true, video: true, supported: true });
  assert.deepEqual(submitModes({ accepts: ["quiz"] }), { text: false, video: false, supported: false });
  assert.equal(checkpointAcceptsLabel(["audio", "image"]), "âm thanh, hình ảnh");
});

test("visibility: bài trả = Các bạn cùng lớp | Chỉ Thầy; thread cũ giữ Cộng đồng | Chỉ Thầy", () => {
  assert.deepEqual(visibilityChoices(true), ["class", "private"]);
  assert.deepEqual(visibilityChoices(false), ["community", "private"]);
  assert.equal(otherVisibility("class", true), "private");
  assert.equal(otherVisibility("private", true), "class");
  assert.equal(otherVisibility("community", false), "private");
  assert.equal(otherVisibility("private", false), "community");
  assert.equal(toVisibility("class"), "class");
  const d = toThreadDetail({ id: "t", status: "waiting_teacher", visibility: "class", content_kind: "program_checkpoint", program_code: "SOLO01",
    session_no: 4, checkpoint_id: "4.1", class_schedule_id: CLS, identity: {}, events: [] });
  assert.deepEqual(d?.checkpoint, { classId: CLS, programCode: "SOLO01", sessionNo: 4, checkpointId: "4.1" });
  assert.equal(toThreadDetail({ id: "t", status: "passed", visibility: "community", identity: {}, events: [] })?.checkpoint, null);
  assert.match(ltErrorText({ message: "LT_SESSION_LOCKED" }), /Hoàn thành buổi trước/);
  const comp = renderToStaticMarkup(<StudentComposer lessonId="cp-1" kinds={["submission"]} initialKind="submission" isNewThread
    visibilities={["class", "private"]} requireMedia onSent={() => {}} />);
  assert.match(comp, /Các bạn cùng lớp/); assert.doesNotMatch(comp, /Cộng đồng học tập/); assert.match(comp, /\(bắt buộc\)/);
});

test("sơ đồ buổi: dòng thu gọn 'Buổi 0N · Tiêu đề'; buổi hiện tại đánh dấu; dòng trạng thái buổi", () => {
  const st = ready(RAW);
  const row = renderToStaticMarkup(<SessionRowHead s={st.sessions[1]} role="learner" now={NOW} paceDays={7} expanded current onToggle={() => {}} />);
  assert.match(row, /Buổi 02 · Ép ngón &amp; Bass/); assert.match(row, /is-current/); assert.match(row, /aria-current="step"/);
  const locked = renderToStaticMarkup(<SessionRowHead s={st.sessions[2]} role="learner" now={NOW} paceDays={7} expanded={false} current={false} onToggle={() => {}} />);
  assert.match(locked, /is-locked/);
  const lockedBtn = renderToStaticMarkup(<SessionRowHead s={st.sessions[2]} role="learner" now={NOW} paceDays={7} expanded={false} current={false} disabled onToggle={() => {}} />);
  assert.match(lockedBtn, /disabled=""/);   // buổi khoá: thấy trên bản đồ, không vào học
  const line = renderToStaticMarkup(<SessionStatusLine s={st.sessions[1]} now={NOW} paceDays={7} />);
  assert.match(line, /0\/2 bài trả bắt buộc đã Đạt/);
});

test("chốt chặn nguồn: client chỉ gửi TOẠ ĐỘ checkpoint; không learner/vai trò/danh tính; không đọc thẳng bảng tiến độ", () => {
  const api = noComments(src("classLearning/progressApi.ts"));
  assert.equal(/p_learner|learner_user_id|p_role|p_identity|p_student|p_opened|p_completed/.test(api), false);
  for (const f of ["classLearning/progressApi.ts", "classLearning/progress.ts", "class-social/classes/ClassMap.tsx", "class-social/classes/ClassPage.tsx"]) {
    const s = noComments(src(f));
    assert.equal(/from\(['"](learning_|class_curriculum_access)/.test(s), false, `${f}: không đọc/ghi thẳng bảng tiến độ/quyền`);
    assert.equal(/dangerouslySetInnerHTML|innerHTML\s*=/.test(s), false, f);
  }
  // Renderer chung KHÔNG biết /me: phần tương tác chỉ đi qua CheckpointSlot
  const doc = noComments(src("lesson/LessonDocument.tsx"));
  assert.equal(/\/me\b|learning-thread|supabase/.test(doc), false);
  // Không AI trong luồng chấm/trả bài V1
  for (const f of ["class-social/classes/ClassMap.tsx", "class-social/classes/LearnParts.tsx", "classLearning/progress.ts"]) {
    assert.equal(/\bAI\b|openai|gpt/i.test(noComments(src(f))), false, f);
  }
});

// ── Chế độ GIÁO TRÌNH (có giáo trình, CHƯA có bài trả) — giống SOLO01.TH01 production ──
import { curriculumState } from "../../src/classLearning/progress";
const day = (d: number) => new Date(Date.UTC(2026, 8, 17 + d, 12)).toISOString();
const SES = [
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(n => ({ id: `s${n}`, session_number: n, event_type: "lesson", status: "scheduled", start_at: day((n - 1) * 7), end_at: null, title: `Buổi ${n} · Bài ${n}`, stage_id: 64 })),
  { id: "b1", session_number: null, event_type: "break", status: "holiday", start_at: day(56), end_at: null, title: "Nghỉ giữa chặng – thời gian tự luyện", stage_id: null },
  { id: "b2", session_number: null, event_type: "break", status: "holiday", start_at: day(63), end_at: null, title: "Nghỉ giữa chặng – thời gian tự luyện", stage_id: null },
  { id: "s9", session_number: 9, event_type: "lesson", status: "scheduled", start_at: day(70), end_at: null, title: "Buổi 9 · Bass Bolero", stage_id: 66 },
];
const STG = [{ id: 64, class_id: CLS, stage_no: 1, public_title: "TỪ GIAI ĐIỆU ĐẾN SOLO GUITAR", summary: null, from_session: 1, to_session: 8, starts_on: null, ends_on: null },
             { id: 66, class_id: CLS, stage_no: 2, public_title: "PHÁT TRIỂN SOLO GUITAR & BOLERO", summary: null, from_session: 9, to_session: 16, starts_on: null, ends_on: null }];
const PUB = [1, 2, 3, 4, 5].map(n => ({ session_id: `s${n}`, status: "published" as const }));

test("chế độ giáo trình: dựng từ lớp thật — 9 buổi, dòng nghỉ không thành buổi, buổi 06+ chưa có giáo án", () => {
  const st = curriculumState({ classId: CLS, programCode: "SOLO01", classCode: "SOLO01.TH01", className: "Solo Guitar Căn Bản", role: "learner", stages: STG, sessions: SES, contents: PUB })!;
  assert.equal(st.mode, "curriculum");
  assert.deepEqual(st.sessions.map(s => s.no), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(st.breaks, [{ beforeNo: 9, title: "Nghỉ giữa chặng – thời gian tự luyện" }]);   // 2 dòng nghỉ liền → một vạch
  assert.deepEqual(st.sessions.map(s => s.published), [true, true, true, true, true, false, false, false, false]);
  assert.equal(st.sessions[8].stageTitle, "PHÁT TRIỂN SOLO GUITAR & BOLERO");
  // mọi buổi MỞ (không khoá chết khi chưa có bài trả), không huy hiệu/màu, không tiến độ giả
  assert.deepEqual(st.sessions.map(s => sessionPhase(s, "learner", "curriculum")), Array(9).fill("open"));
  assert.ok(st.sessions.every(s => sessionBadge(s, "learner", NOW, 7, "curriculum") === "" && !s.openedAt && !s.completedAt && s.checkpoints.length === 0));
  // buổi hiện tại theo LỊCH thật: 01/10 → Buổi 3 (17/9, 24/9, 1/10); trước khai giảng → Buổi 1; sau Buổi 5 → Buổi 5 (đã xuất bản gần nhất)
  assert.equal(currentSessionNo(st, new Date("2026-10-01T13:00:00Z")), 3);
  assert.equal(currentSessionNo(st, new Date("2026-09-30T18:00:00Z")), 3);   // 01:00 sáng 01/10 giờ VN: ngày có Buổi 3 → Buổi 3
  assert.equal(currentSessionNo(st, new Date("2026-09-30T16:00:00Z")), 2);   // 23:00 tối 30/9 giờ VN → vẫn Buổi 2
  assert.equal(currentSessionNo(st, new Date("2026-09-01T00:00:00Z")), 1);
  assert.equal(currentSessionNo(st, new Date("2026-12-01T00:00:00Z")), 5);
  // không đọc được buổi xuất bản nào (không quyền / chưa xuất bản) → null = giữ trang lớp cũ
  assert.equal(curriculumState({ classId: CLS, programCode: "SOLO01", classCode: "x", className: "x", role: "learner", stages: STG, sessions: SES, contents: [] }), null);
  assert.equal(curriculumState({ classId: CLS, programCode: null, classCode: "x", className: "x", role: "learner", stages: [], sessions: SES, contents: [{ session_id: "s1", status: "draft" }] }), null);
  const row = renderToStaticMarkup(<SessionRowHead s={st.sessions[5]} role="learner" mode="curriculum" now={NOW} paceDays={7} expanded={false} current={false} onToggle={() => {}} />);
  assert.match(row, /Buổi 06 · Bài 6/); assert.match(row, /is-pending/); assert.doesNotMatch(row, /🔒|cs-learn-row-badge/);
});

// ── Khung XEM TRƯỚC "Trả bài" (chỉ giáo viên, buổi chưa có bài trả) — không phải checkpoint thật ──
import { PREVIEW_CHECKPOINT, withTeacherPreview } from "../../src/lesson/checkpoint";
test("xem trước Trả bài: CHỈ giáo viên + buổi chưa có bài trả; cuối giáo án; không in; bài trả thật giữ đúng vị trí", () => {
  const plain: LessonSection[] = [{ kind: "objectives", items: ["x"] }, { kind: "note", text: "y" }];
  assert.deepEqual(withTeacherPreview(plain, "learner"), plain, "học viên: không bao giờ có khung giả");
  const t = withTeacherPreview(plain, "teacher");
  assert.equal(t.length, 3); assert.equal(t[2], PREVIEW_CHECKPOINT);
  assert.equal((PREVIEW_CHECKPOINT as { preview?: boolean }).preview, true);
  const real: LessonSection[] = [{ kind: "note", text: "a" }, { kind: "checkpoint", id: "1.1", title: "Thật" }, { kind: "note", text: "b" }];
  assert.deepEqual(withTeacherPreview(real, "teacher"), real, "đã có bài trả thật → không chèn khung xem trước");
  const doc: LessonDoc = { meta: { programCode: "SOLO01", programName: "X", sessionNo: 1, title: "T" }, sections: t };
  const html = renderToStaticMarkup(<LessonDocument doc={doc} embedded />);
  assert.match(html, /class="lsn-block lsn-cp is-preview no-print"/);
  assert.match(html, /Trả bài · Xem trước/);
  assert.doesNotMatch(html, /Bắt buộc để hoàn thành buổi/);
  assert.ok(html.indexOf("Trả bài · Xem trước") > html.indexOf(">y<"), "khung xem trước ở CUỐI giáo án");
});

// ── Trang BUỔI riêng: /me/classes/<id>/sessions/<n> (deep link / reload / giữ qua đăng nhập) ──
import { keepsPathForGuest, sessionFromPath, sessionPath, viewFromPath as vfp, viewPath as vp, sameView as sv } from "../../src/class-social/resolveMeRoute";
test("route Trang Buổi: phân tích · khứ hồi · giữ qua đăng nhập · không nhầm với trang lớp", () => {
  const P = `/me/classes/${CLS}/sessions/3`;
  assert.equal(sessionPath(CLS, 3), P);
  assert.deepEqual(sessionFromPath(P), { classId: CLS, sessionNo: 3 });
  assert.deepEqual(sessionFromPath(P + "/"), { classId: CLS, sessionNo: 3 });
  assert.deepEqual(vfp(P), { kind: "session", classId: CLS, sessionNo: 3 });
  assert.equal(vp({ kind: "session", classId: CLS, sessionNo: 24 }), `/me/classes/${CLS}/sessions/24`);
  assert.ok(sv(vfp(P), { kind: "session", classId: CLS, sessionNo: 3 }));
  assert.equal(sv(vfp(P), { kind: "session", classId: CLS, sessionNo: 4 }), false);
  assert.equal(sv(vfp(P), { kind: "class", classId: CLS }), false);
  assert.deepEqual(vfp(`/me/classes/${CLS}`), { kind: "class", classId: CLS });
  assert.ok(keepsPathForGuest(vfp(P)));
  assert.deepEqual(sessionFromPath(`/me/classes/${CLS}/sessions/0`), { classId: CLS, sessionNo: 0 });   // Buổi 00 · Nhập môn
  for (const bad of [`/me/classes/${CLS}/sessions/00`, `/me/classes/${CLS}/sessions/abc`, `/me/classes/${CLS}/sessions/-1`, `/me/classes/not-a-uuid/sessions/3`, `/me/classes/${CLS}/sessions/99999`]) {
    assert.equal(sessionFromPath(bad), null, bad);
  }
});
