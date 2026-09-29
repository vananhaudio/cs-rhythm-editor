/**
 * Learning Thread P1 — model, render App (khu vực trong bài) + Social (/me/t/<id>, hàng đợi), route,
 * và chốt chặn nguồn. Quyền THẬT nằm ở DB — xem scripts/test-learning-threads-db.sh (93 kiểm tra).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  canAsk, canSubmit, ctaTitle, eventLabels, identityLine, isEnabled, lessonLine, ltErrorText, moduleLabel, studentActions,
  teacherKind, toLessonState, toQueueItem, toThreadDetail, checkBody,
  type LessonStateRow, type LessonThreadState,
} from "../../src/learning-thread/ltModel";
import { LessonThreadPanelView } from "../../src/learning-thread/LessonThreadPanelView";
import ThreadView from "../../src/learning-thread/ThreadView";
import { QueueList } from "../../src/learning-thread/QueueList";
import StudentComposer from "../../src/learning-thread/StudentComposer";
import TeacherComposer from "../../src/learning-thread/TeacherComposer";
import { mediaParams } from "../../src/learning-thread/ltApi";
import {
  QUEUE_PATH, resolveMeRoute, sameView, threadIdFromPath, threadPath, viewFromPath, viewPath,
} from "../../src/class-social/resolveMeRoute";
void React;

const LID = "5f7acacd-9214-48f3-9349-93cc382649fb";
const TID = "0b6f7c1e-5d2a-4c3b-9a8e-1f2d3c4b5a69";
const src = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8");
const noComments = (s: string) => s.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const row = (p: Partial<LessonStateRow>): LessonStateRow => ({
  lesson_id: LID, submission_mode: "off", question_mode: "off", prompt: null, thread_id: null, status: null,
  visibility: null, passed_at: null, last_event_at: null, event_count: null, ...p,
});
const html = (s: LessonThreadState) => renderToStaticMarkup(<LessonThreadPanelView state={s} onAction={() => {}} />);
const labels = (s: LessonThreadState) => studentActions(s).map(a => a.label);

// ── Cấu hình ở tầng bài → CTA ─────────────────────────────────────────────────
test("off/off → KHÔNG có CTA (không mặc định bài nào cũng Trả bài)", () => {
  const s = toLessonState(row({}));
  assert.equal(isEnabled(s), false);
  assert.deepEqual(studentActions(s), []);
  assert.equal(html(s), "");
});

test("allowed/off → chỉ Trả bài · off/allowed → chỉ Hỏi bài · allowed/allowed → cả hai", () => {
  const sub = toLessonState(row({ submission_mode: "allowed" }));
  assert.deepEqual(labels(sub), ["Trả bài"]);
  assert.equal(ctaTitle(sub), "Trả bài");
  const ask = toLessonState(row({ question_mode: "allowed" }));
  assert.deepEqual(labels(ask), ["Hỏi bài"]);
  assert.equal(ctaTitle(ask), "Hỏi bài");
  assert.equal(studentActions(ask)[0].primary, true);
  const both = toLessonState(row({ submission_mode: "allowed", question_mode: "allowed", prompt: "Bạn có thể gửi phần thực hành" }));
  assert.deepEqual(labels(both), ["Trả bài", "Hỏi bài"]);
  const h = html(both);
  assert.match(h, /Trả bài \/ Hỏi bài/);
  assert.match(h, /Bạn có thể gửi phần thực hành/);
});

test("required: hiển thị 'Bài này cần Trả bài' nhưng KHÔNG khoá bài (chỉ là nhãn)", () => {
  const s = toLessonState(row({ submission_mode: "required" }));
  assert.equal(canSubmit(s), true);
  assert.equal(canAsk(s), false);
  assert.match(html(s), /Bài này cần Trả bài/);
  // Không có cơ chế khoá: App không đọc submission_mode để chặn bài (chỉ khu vực LT dùng)
  const portal = noComments(src("MobileStudentPortal.tsx"));
  assert.equal(/submission_mode|submissionMode|required.*isUnlocked/.test(portal), false);
});

test("giá trị lạ từ server → an toàn (coi như tắt)", () => {
  const s = toLessonState(row({ submission_mode: "bat_buoc", question_mode: "yes", status: "hacked", thread_id: TID }));
  assert.equal(s.submission, "off");
  assert.equal(s.question, "off");
  assert.equal(s.thread, null);
});

// ── Trạng thái → chip + hành động ─────────────────────────────────────────────
test("chip trạng thái + hành động theo workflow (retry → Trả lại, pass → Xem/Hỏi tiếp)", () => {
  const st = (status: string) => toLessonState(row({ submission_mode: "allowed", question_mode: "allowed", thread_id: TID, status, visibility: "community", event_count: 2 }));
  assert.match(html(st("waiting_teacher")), /Đã gửi · Chờ Thầy phản hồi/);
  assert.deepEqual(labels(st("waiting_teacher")), ["Xem cuộc trao đổi", "Hỏi tiếp"]);
  assert.match(html(st("teacher_responded")), /Thầy đã phản hồi/);
  assert.deepEqual(labels(st("teacher_responded")), ["Xem cuộc trao đổi", "Trả lại", "Hỏi tiếp"]);
  assert.match(html(st("needs_retry")), /Cần làm lại/);
  assert.deepEqual(labels(st("needs_retry")), ["Trả lại", "Xem cuộc trao đổi", "Hỏi tiếp"]);
  assert.equal(studentActions(st("needs_retry"))[0].primary, true);
  assert.match(html(st("passed")), /Đã đạt/);
  assert.deepEqual(labels(st("passed")), ["Xem cuộc trao đổi", "Hỏi tiếp"]);
  // chỉ Hỏi bài: không bao giờ hiện Trả lại
  const askOnly = toLessonState(row({ question_mode: "allowed", thread_id: TID, status: "needs_retry" }));
  assert.equal(labels(askOnly).includes("Trả lại"), false);
});

// ── Chi tiết thread + danh tính lịch sử ──────────────────────────────────────
const detail = (over: Record<string, unknown> = {}) => ({
  id: TID, lesson_id: LID, status: "passed", visibility: "community", is_mine: true, can_respond: false,
  created_at: "2026-09-29T10:00:00Z", passed_at: "2026-09-29T12:00:00Z",
  learner: { user_id: "aaaaaaaa-0000-4000-8000-00000000000a", name: "Bình", avatar_url: "javascript:alert(1)" },
  passed_by: { user_id: "dddddddd-0000-4000-8000-00000000000d", name: "Thầy Minh" },
  identity: {
    lesson: { id: LID, title: "Bài 4.3 — Bolero móc kiểu 1", order_index: 2 },
    module: { name: "Chương 4: Điệu Bolero & kỹ thuật móc", level: 2 },
    course: { code: "DH2", name: "Khởi Đầu Đam Mê – Đệm Hát Trình Độ 2", subject: "dem_hat" },
    class: { code: "DH2.KD18", stage: "co_ban", stage_title: "Đệm hát 2" },
  },
  events: [
    { id: "e1", seq: 1, kind: "submission", author_role: "student", author: { user_id: "a", name: "Bình" }, body: "<script>alert(1)</script> Em nộp bài", media_url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", created_at: "2026-09-29T10:00:00Z" },
    { id: "e2", seq: 2, kind: "teacher_feedback", verdict: "retry", author_role: "teacher", author: { user_id: "t", name: "Thầy Minh" }, body: "Tay phải chưa đều", tags: [{ id: 1, name: "tay_phai" }], resources: [{ resource_type: "kho_video", resource_id: "kho123", title_snapshot: "Bolero móc", start_seconds: 80 }], created_at: "2026-09-29T10:30:00Z" },
    { id: "e3", seq: 3, kind: "question", author_role: "student", author: { name: "Bình" }, body: "Phách 3 móc thế nào ạ?", created_at: "2026-09-29T11:00:00Z" },
    { id: "e4", seq: 4, kind: "teacher_answer", author_role: "teacher", author: { name: "Thầy Minh" }, body: "Móc vào phách 3 nhẹ", created_at: "2026-09-29T11:10:00Z" },
    { id: "e5", seq: 5, kind: "submission", author_role: "student", author: { name: "Bình" }, body: "Lần 2", created_at: "2026-09-29T11:30:00Z" },
    { id: "e6", seq: 6, kind: "teacher_feedback", verdict: "pass", author_role: "teacher", author: { name: "Thầy Minh" }, body: "Đạt!", created_at: "2026-09-29T12:00:00Z" },
    { id: "bad", seq: 7, kind: "status", body: "loại lạ bị bỏ" },
  ],
  ...over,
});

test("thread: timeline đầy đủ theo thứ tự, nhãn đúng (Trả bài → … → Trả lại → ĐẠT), bỏ event lạ", () => {
  const t = toThreadDetail(detail())!;
  assert.equal(t.events.length, 6);
  assert.deepEqual(eventLabels(t.events), [
    "Trả bài", "Thầy nhận xét · Cần làm lại", "Hỏi bài", "Thầy trả lời", "Trả lại", "Thầy nhận xét · Đạt",
  ]);
  assert.equal(t.learner.avatarUrl, null, "avatar javascript: bị loại");
});

test("danh tính LỊCH SỬ: KD18 · chặng; tự học → 'Tự học'", () => {
  const t = toThreadDetail(detail())!;
  assert.equal(identityLine(t.identity), "DH2.KD18 · Đệm hát 2");
  assert.equal(lessonLine(t.identity), "Chương 4: Điệu Bolero & kỹ thuật móc · Bài 4.3 — Bolero móc kiểu 1");
  assert.equal(moduleLabel("Chương 4: Điệu Bolero & kỹ thuật móc"), "Chương 4 · Điệu Bolero & kỹ thuật móc");
  assert.equal(moduleLabel("Phần 2.1: Nhạc lý"), "Phần 2.1 · Nhạc lý");
  assert.equal(moduleLabel("Điệu Slow Rock"), "Điệu Slow Rock", "không có tiền tố chương → giữ nguyên");
  assert.equal(moduleLabel(null), null);
  const self = toThreadDetail(detail({ identity: { ...detail().identity, class: null } }))!;
  assert.equal(identityLine(self.identity), "Tự học · DH2");
});

test("ThreadView render: tên Thầy THẬT (không hard-code), kết luận, video, tag, bài giảng; nội dung được escape", () => {
  const h = renderToStaticMarkup(<ThreadView thread={toThreadDetail(detail())!} now={new Date("2026-09-29T13:00:00Z")} />);
  assert.match(h, /Thầy Minh/);
  assert.equal(/Thầy Văn Anh/.test(h), false);
  assert.match(h, /DH2\.KD18 · Đệm hát 2/);
  assert.match(h, /Đã đạt/);
  assert.match(h, /Cộng đồng học tập/);
  assert.match(h, /youtube-nocookie\.com\/embed\/aaaaaaaaaaa/);
  assert.match(h, /#tay_phai/);
  assert.match(h, /Bài giảng nên xem/);
  assert.equal(h.includes("<script>"), false);
  assert.match(h, /&lt;script&gt;/);
  const priv = renderToStaticMarkup(<ThreadView thread={toThreadDetail(detail({ visibility: "private" }))!} />);
  assert.match(priv, /Chỉ Thầy/);
});

test("ThreadView: chỉ hiện nút kiểm duyệt khi canModerate", () => {
  const t = toThreadDetail(detail())!;
  assert.equal(/Ẩn lượt này/.test(renderToStaticMarkup(<ThreadView thread={t} />)), false);
  assert.match(renderToStaticMarkup(<ThreadView thread={t} canModerate onModerate={() => {}} />), /Ẩn lượt này/);
});

// ── Ô soạn ───────────────────────────────────────────────────────────────────
test("StudentComposer: lần đầu có chọn 'Cộng đồng học tập' (mặc định) / 'Chỉ Thầy'; lần sau không", () => {
  const first = renderToStaticMarkup(<StudentComposer lessonId={LID} kinds={["submission", "question"]} initialKind="submission" isNewThread onSent={() => {}} />);
  assert.match(first, /Cộng đồng học tập/);
  assert.match(first, /Chỉ Thầy/);
  assert.match(first, /checked="" value="community"/);
  assert.match(first, /aria-pressed="true"[^>]*>Trả bài/);
  const later = renderToStaticMarkup(<StudentComposer lessonId={LID} kinds={["question"]} initialKind="submission" isNewThread={false} onSent={() => {}} />);
  assert.equal(/Chỉ Thầy/.test(later), false);
  assert.match(later, /Gửi câu hỏi/, "kind không được phép → rơi về kind hợp lệ");
  // Không có ô chọn khoá/bài/lớp: context đã biết
  assert.equal(/Chọn khoá|Chọn bài|Mã lớp|KD\d/.test(first), false);
});

test("TeacherComposer: Gửi phản hồi / Cần làm lại / Đạt; Kho + thẻ chỉ khi allowKho", () => {
  const withKho = renderToStaticMarkup(<TeacherComposer threadId={TID} events={[]} allowKho onSent={() => {}} />);
  for (const l of ["Gửi phản hồi", "Cần làm lại", "Đạt", "Gắn thẻ", "Đính kèm bài giảng"]) assert.match(withKho, new RegExp(l));
  assert.match(withKho, /chưa tự hoàn thành bài/);
  const noKho = renderToStaticMarkup(<TeacherComposer threadId={TID} events={[]} allowKho={false} onSent={() => {}} />);
  assert.equal(/Đính kèm bài giảng/.test(noKho), false);
});

test("teacherKind: có kết luận → feedback; học sinh vừa hỏi → answer", () => {
  assert.equal(teacherKind("pass", [{ authorRole: "student", kind: "question" }]), "teacher_feedback");
  assert.equal(teacherKind(null, [{ authorRole: "student", kind: "submission" }, { authorRole: "student", kind: "question" }]), "teacher_answer");
  assert.equal(teacherKind(null, [{ authorRole: "student", kind: "question" }, { authorRole: "student", kind: "submission" }]), "teacher_feedback");
});

test("checkBody + media: rỗng cả hai bị chặn; link chuẩn hoá bằng parseExternalMedia; link sai không gửi", () => {
  assert.equal(checkBody("  ", false).ok, false);
  assert.equal(checkBody("", true).ok, true);
  assert.equal(checkBody("x".repeat(4001), false).ok, false);
  const m = mediaParams("youtu.be/aaaaaaaaaaa");
  assert.ok(m.ok && m.value.p_media_provider === "youtube" && m.value.p_external_media_id === "aaaaaaaaaaa");
  assert.equal(mediaParams("javascript:alert(1)").ok, false);
  const none = mediaParams("");
  assert.ok(none.ok && none.value.p_media_url === null);
});

test("lỗi server LT_* → câu tiếng Việt, không lộ lỗi thô", () => {
  assert.equal(ltErrorText({ message: "LT_SUBMISSION_NOT_ENABLED" }), "Bài này chưa mở Trả bài.");
  assert.match(ltErrorText({ message: "LT_NOT_FOUND" }), /không có quyền xem/);
  assert.match(ltErrorText({ message: "new row violates check constraint \"lte_content_check\"" }), /chưa hợp lệ/);
  assert.equal(ltErrorText({ message: "boom" }), "Chưa thực hiện được. Hãy thử lại.");
});

// ── Hàng đợi Thầy ────────────────────────────────────────────────────────────
test("hàng đợi: học sinh + danh tính lịch sử + bài + diễn biến cuối + mở thread", () => {
  const it = toQueueItem({
    id: TID, status: "waiting_teacher", visibility: "private", identity: detail().identity, learner_user_id: "a",
    learner_name: "Bình", learner_avatar_url: null, last_student_event_at: "2026-09-29T10:00:00Z", last_event_at: null,
    event_count: 1, last_event_kind: "submission", last_event_excerpt: "Em nộp bài", is_hidden: false,
  })!;
  const h = renderToStaticMarkup(<QueueList items={[it]} onOpen={() => {}} empty="trống" now={new Date("2026-09-29T11:00:00Z")} />);
  assert.match(h, /Bình · DH2\.KD18 · Đệm hát 2/);
  assert.match(h, /Bài 4\.3 — Bolero móc kiểu 1/);
  assert.match(h, /Trả bài: Em nộp bài/);
  assert.match(h, /Chờ Thầy phản hồi/);
  assert.match(h, /Chỉ Thầy/);
  assert.match(renderToStaticMarkup(<QueueList items={[]} onOpen={() => {}} empty="Không có bài nào đang chờ Thầy." />), /Không có bài nào/);
});

// ── Route /me/t/<id> + /me/queue ─────────────────────────────────────────────
test("route /me/t/<uuid> + /me/queue; id lạ không phải thread", () => {
  assert.equal(threadPath(TID), `/me/t/${TID}`);
  assert.equal(threadIdFromPath(`/me/t/${TID.toUpperCase()}/`), TID);
  for (const p of ["/me/t/", "/me/t/abc", `/me/t/${TID}/x`, "/me/t/1;drop"]) assert.equal(threadIdFromPath(p), null, p);
  assert.deepEqual(viewFromPath(`/me/t/${TID}`), { kind: "thread", threadId: TID });
  assert.deepEqual(viewFromPath(QUEUE_PATH), { kind: "queue" });
  for (const v of [{ kind: "thread" as const, threadId: TID }, { kind: "queue" as const }]) assert.ok(sameView(viewFromPath(viewPath(v)), v));
  assert.equal(sameView({ kind: "thread", threadId: TID }, { kind: "queue" }), false);
  assert.equal(resolveMeRoute({ hostname: "class.vananhaudio.com", pathname: `/me/t/${TID}`, search: "", isNative: false })?.kind, "social");
  // native / timming vẫn giữ /me = App học
  assert.equal(resolveMeRoute({ hostname: "class.vananhaudio.com", pathname: `/me/t/${TID}`, search: "", isNative: true }), null);
});

// ── Chốt chặn nguồn (quyền thật ở server) ────────────────────────────────────
test("client KHÔNG gửi learner / vai trò / danh tính — server tự lấy auth.uid() và tự đóng dấu", () => {
  const api = noComments(src("learning-thread/ltApi.ts"));
  assert.equal(/p_learner|learner_user_id|p_role|p_identity|p_class|p_course|p_student/.test(api), false);
  for (const f of ["ltApi.ts", "ThreadPage.tsx", "LearningThreadSheet.tsx", "TeacherQueue.tsx", "MeThreadsBlock.tsx", "useLessonThreadState.ts"]) {
    const s = noComments(src("learning-thread/" + f));
    assert.equal(/from\(['"]learning_/.test(s), false, `${f}: không đọc/ghi thẳng bảng learning_*`);
    assert.equal(/dangerouslySetInnerHTML|innerHTML\s*=/.test(s), false, f);
  }
});

test("P1 KHÔNG ghi tiến độ / XP / mở khoá, KHÔNG đẩy lên Feed Social", () => {
  for (const f of ["ltApi.ts", "LessonThreadPanel.tsx", "LearningThreadSheet.tsx", "ThreadPage.tsx", "TeacherComposer.tsx", "StudentComposer.tsx"]) {
    const s = noComments(src("learning-thread/" + f));
    assert.equal(/edu_lesson_progress|student_xp_log|student_action_logs|markComplete|class_posts|class_feed/.test(s), false, f);
  }
});

test("App: khu vực LT đứng CẠNH (không thay) nút 'Tôi đã gửi bài cho thầy' (+50 XP giữ nguyên); ẩn khi xem thử/khách", () => {
  const portal = src("MobileStudentPortal.tsx");
  const lt = portal.indexOf("<LessonThreadPanel lessonId={activeLesson.id}");
  const legacy = portal.indexOf("'Tôi đã gửi bài cho thầy', xp: 50");
  assert.ok(lt > 0 && legacy > lt, "panel ngay trước khối Ghi nhận thực hành");
  assert.match(portal, /submitted_video_self_report: 50/);
  assert.match(portal, /<LessonThreadPanel lessonId=\{activeLesson\.id\} lessonTitle=\{activeLesson\.title\} disabled=\{preview \|\| guest\} \/>/);
  assert.match(portal, /<LessonThreadPanel key=\{selected\.id\} compact lessonId=\{selected\.id\}/);
  assert.equal(/Trả bài cho Thầy · sắp có/.test(portal), false);
});

test("/me: link thread giữ nguyên khi chưa đăng nhập (đăng nhập xong xem đúng thread)", () => {
  const page = noComments(src("class-social/ClassSocialPage.tsx"));
  assert.match(page, /if \(guest && !keepsPathForGuest\(view\)\)/);
  assert.match(page, /<ThreadPage key=\{view\.threadId\}/);
  assert.match(page, /me\.isTeacher\s*\n?\s*\? <TeacherQueue/);
});
