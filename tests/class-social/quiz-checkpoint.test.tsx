/**
 * Quiz Checkpoint V1 — bài trả TRẮC NGHIỆM tự chấm: kiểm khối công khai (không đáp án), hiển thị tĩnh / tương tác,
 * trạng thái Đạt / Chưa trả trong mục lục, chuẩn ≤ 1 video / buổi, Buổi 02 đã chuẩn hoá.
 * Chấm THẬT, quyền, mở buổi nằm ở DB — xem scripts/test-learning-threads-db.sh (mục QUIZ V1).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LessonDocument, { QuizOptionsStatic } from "../../src/lesson/LessonDocument";
import { CheckpointSlot } from "../../src/lesson/checkpointSlot";
import type { CheckpointSection, LessonDoc } from "../../src/lesson/lessonTypes";
import { checkpointProblems, quizOf, quizProblems, submitModes } from "../../src/lesson/checkpoint";
import { solo01DocProblems, solo01Problems } from "../../src/lesson/curriculumStandard";
import { requiredProgress, toClassLearningState, type ClassLearningState } from "../../src/classLearning/progress";
import { cpStatus, sessionView } from "../../src/class-social/classes/classMapModel";
import QuizCheckpoint from "../../src/class-social/classes/QuizCheckpoint";
import { ltErrorText } from "../../src/learning-thread/ltModel";
import { SOLO01_BUOI01 } from "../../src/data/solo01/buoi01";
import { SOLO01_BUOI02 } from "../../src/data/solo01/buoi02";
import { SOLO01_BUOI03 } from "../../src/data/solo01/buoi03";
import { SOLO01_BUOI04 } from "../../src/data/solo01/buoi04";
void React;

const src = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8");
const Q = (over: Partial<CheckpointSection> = {}): CheckpointSection => ({
  kind: "checkpoint", id: "9.1", title: "Câu hỏi", required: true, accepts: ["quiz"],
  quiz: { mode: "single", question: "Cách nào đúng?", options: [{ id: "a", text: "Một" }, { id: "b", text: "Hai" }], hint: "Nhớ lại" },
  ...over,
});

test("khối trắc nghiệm công khai: câu hỏi · ≥ 2 lựa chọn · id hợp lệ, không trùng · mode · KHÔNG chứa đáp án", () => {
  assert.deepEqual(quizProblems(Q().quiz), []);
  assert.ok(quizOf(Q()));
  const bad = (quiz: unknown) => quizProblems(quiz).join(" | ");
  assert.match(bad(undefined), /thiếu câu hỏi/);
  assert.match(bad({ mode: "single", question: " ", options: [{ id: "a", text: "x" }, { id: "b", text: "y" }] }), /thiếu câu hỏi/);
  assert.match(bad({ mode: "single", question: "?", options: [{ id: "a", text: "x" }] }), /ít nhất 2 lựa chọn/);
  assert.match(bad({ mode: "single", question: "?", options: [{ id: "a", text: "x" }, { id: "a", text: "y" }] }), /bị trùng/);
  assert.match(bad({ mode: "single", question: "?", options: [{ id: "a b", text: "x" }, { id: "b", text: "y" }] }), /id không hợp lệ/);
  assert.match(bad({ mode: "single", question: "?", options: [{ id: "a", text: "" }, { id: "b", text: "y" }] }), /thiếu nội dung/);
  assert.match(bad({ mode: "essay", question: "?", options: [{ id: "a", text: "x" }, { id: "b", text: "y" }] }), /mode/);
  assert.match(bad({ mode: "single", question: "?", correct: "a", options: [{ id: "a", text: "x" }, { id: "b", text: "y" }] }), /ĐÁP ÁN/);
  assert.match(bad({ mode: "single", question: "?", options: [{ id: "a", text: "x", correct: true }, { id: "b", text: "y" }] }), /ĐÁP ÁN/);
  // checkpoint: trắc nghiệm không trộn loại nộp khác; quiz mà accepts thiếu 'quiz'
  assert.match(checkpointProblems([Q({ accepts: ["quiz", "text"] })]).join(" | "), /không trộn/);
  assert.match(checkpointProblems([Q({ accepts: ["text"] })]).join(" | "), /accepts thiếu 'quiz'/);
  assert.equal(quizOf(Q({ accepts: ["quiz", "text"] })), null);
  // checkpoint 'quiz' chưa có câu hỏi: vẫn là "chưa hỗ trợ" như trước (không giả chức năng)
  assert.equal(quizOf({ accepts: ["quiz"] }), null);
  assert.deepEqual(submitModes({ accepts: ["quiz"] }), { text: false, video: false, supported: false });
});

test("hiển thị TĨNH (trang công khai / in): câu hỏi + lựa chọn, không đánh dấu đúng/sai; /me: phần cắm thay lựa chọn", () => {
  const doc: LessonDoc = { meta: { programCode: "SOLO-01", programName: "X", sessionNo: 9, title: "T", stageLabel: "S", backHref: "/" }, sections: [Q()] };
  const pub = renderToStaticMarkup(<LessonDocument doc={doc} />);
  assert.match(pub, /class="lsn-cp-q">Cách nào đúng\?</);
  assert.match(pub, /class="lsn-quiz-opts is-single[\s\S]*Một[\s\S]*Hai/);
  assert.match(pub, /Trả bằng: trắc nghiệm/);
  assert.doesNotMatch(pub, /Nhớ lại/, "gợi ý chỉ hiện khi trả lời sai trong /me");
  const me = renderToStaticMarkup(<CheckpointSlot.Provider value={() => <i>PHẦN CẮM</i>}><LessonDocument doc={doc} /></CheckpointSlot.Provider>);
  assert.match(me, /lsn-cp-q">Cách nào đúng\?/);
  assert.doesNotMatch(me, /class="lsn-quiz-opts/, "trong /me lựa chọn do phần cắm lo (không in 2 lần)");
  assert.match(me, /PHẦN CẮM/);
  assert.match(renderToStaticMarkup(<QuizOptionsStatic quiz={{ ...Q().quiz!, mode: "multiple" }} />), /is-multiple[\s\S]*Chọn tất cả đáp án đúng/);
});

test("QuizCheckpoint: single = radio, multiple = checkbox, nút Kiểm tra; đã ĐẠT → ✓ Đạt (tải lại vẫn giữ)", () => {
  const answer = async () => ({ ok: true as const, value: { correct: false, passedAt: null } });
  const s = renderToStaticMarkup(<QuizCheckpoint cpId="2-2.1" quiz={Q().quiz!} passedAt={null} onAnswer={answer} onPassed={() => {}} />);
  assert.equal((s.match(/type="radio"/g) || []).length, 2);
  assert.match(s, /name="quiz-2-2\.1"/);
  assert.match(s, /<button type="button" class="lt-btn is-primary" disabled="">Kiểm tra<\/button>/, "chưa chọn → Kiểm tra bị khoá");
  assert.doesNotMatch(s, /Chưa đúng|Đạt/);
  const m = renderToStaticMarkup(<QuizCheckpoint cpId="2-2.2" quiz={{ ...Q().quiz!, mode: "multiple" }} passedAt={null} onAnswer={answer} onPassed={() => {}} />);
  assert.equal((m.match(/type="checkbox"/g) || []).length, 2);
  assert.match(m, /Chọn tất cả đáp án đúng/);
  const p = renderToStaticMarkup(<QuizCheckpoint cpId="2-2.1" quiz={Q().quiz!} passedAt="2026-10-03T10:00:00Z" onAnswer={answer} onPassed={() => {}} />);
  assert.match(p, /lt-chip is-ok[\s\S]*Đạt/);
  assert.doesNotMatch(p, /type="radio"|Kiểm tra/);
  // client không có đường nào để tự ĐẠT: chỉ đổi sang Đạt khi SERVER trả correct=true
  const c = src("class-social/classes/QuizCheckpoint.tsx");
  assert.match(c, /if \(r\.value\.correct\) \{ setResult\('right'\); onPassed\(\) \} else setResult\('wrong'\)/);
  assert.match(c, /Chưa đúng — thử lại\./);
  assert.match(ltErrorText({ message: "LT_QUIZ_NOT_READY" }), /chưa sẵn sàng chấm/);
});

test("mục lục / Bài trả của tôi: trắc nghiệm chỉ Đạt / Chưa trả (không Chờ Thầy); tổng kết buổi đếm trắc nghiệm ĐẠT", () => {
  const raw = { enabled: true, role: "learner", program_code: "SOLO01", class_code: "SOLO01.TH01", class_name: "Solo", server_now: "2026-10-03T12:00:00Z", pace_days: 7,
    sessions: [{ session_id: "s2", session_no: 2, title: "Buổi 2 · Ép ngón", published: true, opened_at: "2026-10-01T00:00:00Z", completed_at: null,
      checkpoints: [
        { id: "2.1", title: "Ép ngón", required: true, accepts: ["quiz"], thread: null, quiz_passed_at: "2026-10-03T10:00:00Z" },
        { id: "2.2", title: "Giai điệu + Bass", required: true, accepts: ["quiz"], thread: null, quiz_passed_at: null },
        { id: "2.3", title: "Diễm Xưa", required: true, accepts: ["video_link", "text"],
          thread: { id: "t", status: "waiting_teacher", visibility: "class", passed_at: null, last_event_at: null }, quiz_passed_at: null },
      ] }] };
  const st = toClassLearningState(raw, "c") as Extract<ClassLearningState, { enabled: true }>;
  const [a, b, c] = st.sessions[0].checkpoints;
  assert.equal(a.quizPassedAt, "2026-10-03T10:00:00Z");
  assert.deepEqual([cpStatus(a).label, cpStatus(b).label, cpStatus(c).label], ["Đạt", "Chưa trả", "Chờ Thầy"]);
  assert.deepEqual(requiredProgress(st.sessions[0]), { passed: 1, total: 3 });
  assert.deepEqual(sessionView(st.sessions[0], st).submissions, { passed: 1, total: 3 });
  // RPC cũ (chưa có quiz_passed_at) → null, không vỡ
  const old = toClassLearningState({ ...raw, sessions: [{ ...raw.sessions[0], checkpoints: [{ id: "1.1", title: "x", required: true, accepts: ["text"], thread: null }] }] }, "c") as Extract<ClassLearningState, { enabled: true }>;
  assert.equal(old.sessions[0].checkpoints[0].quizPassedAt, null);
  // Mục lục dùng trạng thái theo bài trả (cpStatus), bấm trắc nghiệm → Trang Buổi tại đúng bài trả (không thread)
  assert.match(src("class-social/classes/ClassMap.tsx"), /const st = cpStatus\(cp\)/);
});

test("chuẩn SOLO01: tối đa 1 bài trả có video / buổi; Buổi 01 + Buổi 02 đạt chuẩn", () => {
  const vid = (id: string) => ({ kind: "checkpoint" as const, id, title: "v", accepts: ["video_link" as const] });
  const sec = [{ kind: "objectives" as const, items: ["x"] }, vid("9.1"), vid("9.2"), { kind: "assignment" as const, items: [] },
    { kind: "checklist" as const, items: [] }, { kind: "studentNotes" as const }];
  assert.match(solo01Problems(sec, 9).join(" | "), /Tối đa 1 bài trả có video mỗi buổi \(đang có 2: 9\.1, 9\.2\)/);
  assert.deepEqual(solo01DocProblems(SOLO01_BUOI01), []);
  assert.deepEqual(solo01DocProblems(SOLO01_BUOI02), []);
});

test("Buổi 02 chuẩn hoá: 2.1 trắc nghiệm 1 đáp án · 2.2 trắc nghiệm nhiều đáp án · 2.3 video + chữ (video duy nhất); 3 nhịp giữ nguyên", () => {
  const cps = SOLO01_BUOI02.sections.filter((s): s is CheckpointSection => s.kind === "checkpoint");
  assert.deepEqual(cps.map(c => [c.id, c.required, (c.accepts ?? []).join("+"), c.quiz?.mode ?? "-"]),
    [["2.1", true, "quiz", "single"], ["2.2", true, "quiz", "multiple"], ["2.3", true, "video_link+text", "-"]]);
  assert.equal(cps[0].quiz!.question, "Khi luyện ép ngón i–m, cách nào đúng?");
  assert.equal(cps[0].quiz!.options.length, 4);
  assert.equal(cps[1].quiz!.question, "Khi chơi Melody + Bass trong Buổi 02, những điều nào đúng?");
  assert.equal(cps[1].quiz!.options.length, 5);
  assert.ok(cps.every(c => !c.quiz || c.quiz.hint), "mỗi câu có gợi ý khi sai");
  assert.deepEqual(SOLO01_BUOI02.sections.map(s => s.kind === "checkpoint" ? `cp:${s.id}` : s.kind === "note" && /^Nhịp/.test(s.title ?? "") ? `nhịp:${s.title}` : null).filter(Boolean),
    ["nhịp:Nhịp 1 · Ép ngón i – m", "cp:2.1", "nhịp:Nhịp 2 · Giai điệu + Bass", "cp:2.2", "nhịp:Nhịp 3 · Đưa Bass vào tác phẩm", "cp:2.3"]);
  assert.equal(SOLO01_BUOI02.sections.length, 16, "không thêm/bớt khối");
});

test("Buổi 03: 3 nhịp — GIỮ MELODY KHI THÊM BASS (3.1) → SLIDE LIỀN TIẾNG (3.2) → ĐƯA SLIDE VÀO ÂM NHẠC (3.3 video duy nhất)", () => {
  assert.deepEqual(solo01DocProblems(SOLO01_BUOI03), []);
  const cps = SOLO01_BUOI03.sections.filter((s): s is CheckpointSection => s.kind === "checkpoint");
  assert.deepEqual(cps.map(c => [c.id, c.required, (c.accepts ?? []).join("+"), c.quiz?.mode ?? "-", c.quiz?.options.length ?? 0]),
    [["3.1", true, "quiz", "single", 4], ["3.2", true, "quiz", "single", 4], ["3.3", true, "video_link+text", "-", 0]]);
  assert.equal(cps[0].quiz!.question, "Khi chơi Melody + Bass, phần nào cần được nghe rõ hơn?");
  assert.equal(cps[1].quiz!.question, "Khi thực hiện Slide, thao tác nào dưới đây là đúng?");
  assert.doesNotMatch(JSON.stringify(cps[1].quiz), /gảy lại/i, "3.2 không hỏi về gảy lại nốt đích");
  assert.match(cps[2].prompt ?? "", /^Chơi một đoạn Diễm Xưa đã nâng cấp với Melody \+ Bass \+ Slide\./);
  // vị trí: 3.1 sau Bài tập 01 · 3.2 ngay sau Bài tập 02 · 3.3 sau bài tập về nhà, trước checklist
  const seq = SOLO01_BUOI03.sections.map(s => s.kind === "checkpoint" ? `cp:${s.id}` : s.kind === "note" && /^Nhịp/.test(s.title ?? "") ? `nhịp:${s.title}`
    : s.kind === "score" ? `score:${s.title}` : s.kind);
  assert.deepEqual(seq, ["recap", "objectives", "nhịp:Nhịp 1 · Giữ Melody khi thêm Bass", "layers", "score:Bass + Melody luân phiên", "cp:3.1",
    "nhịp:Nhịp 2 · Slide liền tiếng", "score:Slide trong câu melody", "cp:3.2",
    "nhịp:Nhịp 3 · Đưa Slide vào âm nhạc", "score:Melody có Bass & Slide", "note", "repertoire", "assignment", "cp:3.3", "checklist", "studentNotes"]);
});

test("Buổi 04: 3 nhịp — BIẾT CĂN CỨ (4.1) → BIẾT XỬ LÝ (4.2) → TỰ QUYẾT ĐỊNH (4.3 video duy nhất); trắc nghiệm kiểm tư duy, không kiểm một cách xếp ngón", () => {
  assert.deepEqual(solo01DocProblems(SOLO01_BUOI04), []);
  const cps = SOLO01_BUOI04.sections.filter((s): s is CheckpointSection => s.kind === "checkpoint");
  assert.deepEqual(cps.map(c => [c.id, c.required, (c.accepts ?? []).join("+"), c.quiz?.mode ?? "-", c.quiz?.options.length ?? 0]),
    [["4.1", true, "quiz", "single", 4], ["4.2", true, "quiz", "single", 4], ["4.3", true, "video_link+text", "-", 0]]);
  assert.equal(cps[0].quiz!.question, "Khi tự xếp ngón cho một câu Melody, cách suy nghĩ nào đúng nhất?");
  assert.equal(cps[1].quiz!.question, "Bạn đã biết vị trí nốt Sol. Muốn tìm Sol♯ trên cùng dây, bạn làm thế nào?");
  assert.doesNotMatch(JSON.stringify(cps.map(c => c.quiz)), /ngón [1-4] |dây \d+ ngăn \d+|i – m – a/, "không quiz một cách xếp ngón / gảy cụ thể");
  assert.match(cps[2].prompt ?? "", /Tôi chọn cách này vì…/);
  const seq = SOLO01_BUOI04.sections.map(s => s.kind === "checkpoint" ? `cp:${s.id}` : s.kind === "note" && /^Nhịp/.test(s.title ?? "") ? `nhịp:${s.title}` : `${s.kind}`);
  assert.deepEqual(seq, ["recap", "objectives", "note", "nhịp:Nhịp 1 · Tự xếp ngón có căn cứ", "recap", "score", "layers", "cp:4.1",
    "nhịp:Nhịp 2 · Tự xử lý câu Melody trên đàn", "note", "layers", "note", "fretboard", "score", "cp:4.2",
    "nhịp:Nhịp 3 · Tự làm và giải thích", "repertoire", "assignment", "cp:4.3", "checklist", "studentNotes"]);
});

test("ĐÁP ÁN không bao giờ ở frontend: không có trong giáo trình TS, không trong bundle nguồn", () => {
  // Khối công khai không có khoá đáp án
  const b02 = JSON.stringify(SOLO01_BUOI02.sections);
  assert.doesNotMatch(b02, /"(correct|answer|answers|isCorrect|is_correct|key|right)"\s*:/);
  // Toàn bộ dữ liệu giáo trình SOLO01 (mọi buổi) không chứa khoá đáp án trong khối quiz
  for (const f of readdirSync(new URL("../../src/data/solo01/", import.meta.url)).filter(f => /^buoi\d+\.ts$/.test(f))) {
    assert.doesNotMatch(src(`data/solo01/${f}`), /\b(correct|answers?|isCorrect)\s*:/, `${f} không chứa đáp án`);
  }
  // Client chỉ gửi toạ độ + lựa chọn; không bảng đáp án / kết quả nào được đọc trực tiếp từ client
  const api = src("classLearning/progressApi.ts");
  assert.match(api, /rpc\('lt_answer_checkpoint', \{\s*p_class: input\.classId, p_session_no: input\.sessionNo, p_checkpoint_id: input\.checkpointId, p_choices: input\.choices,\s*\}\)/);
  for (const f of ["classLearning/progressApi.ts", "classLearning/api.ts", "class-social/classes/QuizCheckpoint.tsx", "class-social/classes/ClassSessionPage.tsx"]) {
    assert.doesNotMatch(src(f), /class_checkpoint_keys|learning_checkpoint_passes/, `${f} không chạm bảng đáp án / kết quả`);
  }
});
