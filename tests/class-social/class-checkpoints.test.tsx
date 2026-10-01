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
  assert.match(row, /Buổi 02 · Ép ngón &amp; Bass/); assert.match(row, /is-current/); assert.match(row, /aria-expanded="true"/);
  const locked = renderToStaticMarkup(<SessionRowHead s={st.sessions[2]} role="learner" now={NOW} paceDays={7} expanded={false} current={false} onToggle={() => {}} />);
  assert.match(locked, /is-locked/);
  const line = renderToStaticMarkup(<SessionStatusLine s={st.sessions[1]} now={NOW} paceDays={7} />);
  assert.match(line, /0\/2 bài trả bắt buộc đã Đạt/);
});

test("chốt chặn nguồn: client chỉ gửi TOẠ ĐỘ checkpoint; không learner/vai trò/danh tính; không đọc thẳng bảng tiến độ", () => {
  const api = noComments(src("classLearning/progressApi.ts"));
  assert.equal(/p_learner|learner_user_id|p_role|p_identity|p_student|p_opened|p_completed/.test(api), false);
  for (const f of ["classLearning/progressApi.ts", "classLearning/progress.ts", "class-social/classes/ClassLearnView.tsx", "class-social/classes/ClassPage.tsx"]) {
    const s = noComments(src(f));
    assert.equal(/from\(['"](learning_|class_curriculum_access)/.test(s), false, `${f}: không đọc/ghi thẳng bảng tiến độ/quyền`);
    assert.equal(/dangerouslySetInnerHTML|innerHTML\s*=/.test(s), false, f);
  }
  // Renderer chung KHÔNG biết /me: phần tương tác chỉ đi qua CheckpointSlot
  const doc = noComments(src("lesson/LessonDocument.tsx"));
  assert.equal(/\/me\b|learning-thread|supabase/.test(doc), false);
  // Không AI trong luồng chấm/trả bài V1
  for (const f of ["class-social/classes/ClassLearnView.tsx", "class-social/classes/LearnParts.tsx", "classLearning/progress.ts"]) {
    assert.equal(/\bAI\b|openai|gpt/i.test(noComments(src(f))), false, f);
  }
});
