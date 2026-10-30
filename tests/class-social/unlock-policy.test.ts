/**
 * CLASS_UNLOCK_POLICY_V1 — tách ĐIỂM NỘP BÀI (checkpoint) khỏi MỞ KHOÁ TUẦN TỰ (unlock): logic THUẦN phía giao diện
 * (dùng chung Class Web và Class Mobile). Quyền / mở buổi THẬT nằm ở DB — xem scripts/test-class-unlock-policy-db.sh.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  currentSessionNo, sessionBadge, sessionPace, sessionPhase, toClassLearningState, type ClassLearningState, type SessionState,
} from "../../src/classLearning/progress";
import { learnerVisibleState, sessionLearningLabel, sessionView } from "../../src/class-social/classes/classMapModel";
import { completionProblems } from "../../src/lesson/checkpoint";
import type { LessonSection } from "../../src/lesson/lessonTypes";

const CLS = "1f1f2398-efdd-4c6e-92d2-37a9ec20f446";
const NOW = new Date("2026-10-30T12:00:00Z");
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();
const src = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8");
type Ready = Extract<ClassLearningState, { enabled: true }>;

const row = (no: number, over: Record<string, unknown> = {}) => ({
  session_id: `s${no}`, session_no: no, title: `Buổi ${no} · x`, stage_no: 1, stage_title: "C1", published: true,
  opened_at: iso(NOW.getTime() - 3 * DAY), completed_at: null, start_at: iso(NOW.getTime() + (no - 6) * 7 * DAY), checkpoints: [], ...over,
});
const RAW_OPEN = {
  class_id: CLS, enabled: true, role: "learner", program_code: "HT2027", class_code: "HT2027.TH01", class_name: "Hành trình 2027",
  server_now: NOW.toISOString(), unlock_policy: "open", pace_days: 0,
  sessions: [
    row(1, { start_at: iso(NOW.getTime() - 40 * DAY) }),
    row(2, { start_at: iso(NOW.getTime() - 5 * DAY), checkpoints: [{ id: "2.1", title: "Nộp bài", required: true, accepts: ["text", "video_link"], thread: null, quiz_passed_at: null }] }),
    row(3, { start_at: iso(NOW.getTime() + 2 * DAY) }),
    row(4, { published: false, opened_at: null, start_at: iso(NOW.getTime() + 9 * DAY) }),
  ],
};
const open = (): Ready => toClassLearningState(RAW_OPEN, CLS) as Ready;
const sequential = (): Ready => toClassLearningState({ ...RAW_OPEN, unlock_policy: undefined, pace_days: 7 }, CLS) as Ready;

test("RPC: unlock_policy 'open' được đọc; thiếu/lạ → 'sequential' (an toàn, như trước)", () => {
  assert.equal(open().unlockPolicy, "open");
  assert.equal(open().paceDays, 0);
  assert.equal(sequential().unlockPolicy, "sequential");
  assert.equal((toClassLearningState({ ...RAW_OPEN, unlock_policy: "tuy_y" }, CLS) as Ready).unlockPolicy, "sequential");
  assert.equal(open().sessions[1].startAt, RAW_OPEN.sessions[1].start_at, "start_at từng buổi được đọc");
});

test("sessionPhase: 'open' không khoá buổi nào (kể cả buổi chưa xuất bản); 'sequential' giữ luật cũ", () => {
  const o = open(), q = sequential();
  const s4 = (st: Ready) => st.sessions[3];
  assert.equal(sessionPhase(s4(o), "learner", o.mode, o.unlockPolicy), "open", "buổi chưa xuất bản vẫn 'open' → trang buổi báo 'đang cập nhật', không '🔒 cần trả bài'");
  assert.equal(sessionPhase(s4(q), "learner", q.mode, q.unlockPolicy), "locked", "sequential: buổi chưa mở vẫn khoá (hành vi Solo KHÔNG đổi)");
  assert.equal(sessionPhase(s4(q), "learner"), "locked", "gọi kiểu cũ (không truyền policy) = sequential");
  const done: SessionState = { ...o.sessions[0], completedAt: iso(NOW.getTime() - DAY) };
  assert.equal(sessionPhase(done, "learner", o.mode, "open"), "done");
});

test("nhịp tuần: paceDays = 0 → không có nhịp (open); 7 → như cũ", () => {
  const s = { openedAt: iso(NOW.getTime() - 20 * DAY), completedAt: null };
  assert.equal(sessionPace(s, NOW, 0), null);
  assert.equal(sessionPace(s, NOW, 7)?.tone, "overdue", "sequential vẫn tính quá nhịp như cũ");
});

test("nhãn buổi: open = không 'Đang học'/không 🔒; chỉ 'Đang soạn' hoặc '✓ Hoàn thành'", () => {
  const o = open();
  assert.equal(sessionBadge(o.sessions[0], "learner", NOW, o.paceDays, o.mode, "open"), "");
  assert.equal(sessionBadge(o.sessions[3], "learner", NOW, o.paceDays, o.mode, "open"), "Đang soạn");
  assert.equal(sessionBadge({ ...o.sessions[0], completedAt: iso(NOW.getTime() - DAY) }, "learner", NOW, o.paceDays, o.mode, "open"), "✓ Hoàn thành");
  const q = sequential();
  assert.equal(sessionBadge(q.sessions[3], "learner", NOW, q.paceDays, q.mode), "🔒", "sequential: buổi khoá vẫn 🔒");
});

test("buổi hiện tại của lớp 'open' theo LỊCH thật (buổi đã xuất bản gần nhất đã tới ngày), không theo tiến độ mở khoá", () => {
  assert.equal(currentSessionNo(open(), NOW), 2);
  const t: Ready = { ...open(), role: "teacher" };
  assert.equal(currentSessionNo(t, NOW), 1, "Thầy: buổi đã xuất bản đầu tiên (như trước)");
});

test("bản đồ: lớp 'open' — buổi mở được, có đếm bài trả, buổi nháp ghi 'Đang soạn' (không 'Chưa mở')", () => {
  const o = open();
  const v2 = sessionView(o.sessions[1], o);
  assert.equal(v2.locked, false);
  assert.deepEqual(v2.submissions, { passed: 0, total: 1 });
  const v4 = sessionView(o.sessions[3], o);
  assert.equal(v4.locked, false);
  assert.equal(v4.state, "Đang soạn");
  assert.equal(sessionView(sequential().sessions[3], sequential()).state, "Chưa mở", "sequential: vẫn 'Chưa mở'");
  assert.equal(sessionLearningLabel(o.sessions[1], o)?.label, "Chưa trả", "buổi có bài trả bắt buộc: hiện 'Chưa trả'");
  assert.equal(sessionLearningLabel(o.sessions[0], o), null, "buổi chỉ có tài liệu: không nhãn");
  assert.equal(learnerVisibleState(o).sessions.length, 4);
});

test("Admin: lớp 'open' không bị ép 'buổi phải có bài trả bắt buộc'; lớp sequential vẫn bị", () => {
  const study: LessonSection[] = [{ kind: "study", title: "Ôn tập", blocks: [] } as LessonSection];
  assert.ok(completionProblems(study, { checkpointMode: true, sessionNo: 5 }).length > 0, "sequential + chế độ bài trả: thiếu bài bắt buộc bị báo (luật cũ)");
  assert.deepEqual(completionProblems(study, { checkpointMode: false, sessionNo: 5 }), [], "open: editor truyền checkpointMode=false → không ép");
  const ed = src("admin/ClassCurriculumEditor.tsx");
  assert.ok(/checkpointMode: checkpointMode && !openPolicy/.test(ed), "Admin áp luật chỉ khi lớp KHÔNG 'open'");
});

test("chốt nguồn: Web và Mobile dùng CHUNG một chỗ quyết mở khoá (không logic riêng)", () => {
  const mobile = src("class-mobile/MobileShell.tsx");
  assert.ok(/ClassSessionPage/.test(mobile) && /ClassPage/.test(mobile), "Mobile bọc đúng ClassPage/ClassSessionPage của web");
  for (const f of ["class-mobile/MobileShell.tsx", "class-mobile/LearnMeTabs.tsx"]) {
    assert.ok(!/sessionPhase|unlockPolicy|unlock_policy/.test(src(f)), `${f} không tự quyết mở khoá`);
  }
  const page = src("class-social/classes/ClassSessionPage.tsx");
  assert.ok(/sessionPhase\(s, learn\.role, learn\.mode, learn\.unlockPolicy\)/.test(page), "trang Buổi truyền unlockPolicy");
});
