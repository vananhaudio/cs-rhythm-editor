/**
 * ĐƯỜNG HOÀN THÀNH (Curriculum Guard V1, 18/10/2026): bài tập bắt buộc phải làm được; buổi trong lớp chế độ bài trả phải có bài bắt buộc.
 * Lý do: lsp_try_complete không hoàn thành buổi không có bài bắt buộc → buổi kế không bao giờ mở; bài chỉ nhận image/audio/interaction
 * hiện "sẽ mở khi có công cụ" → học viên không nộp được. Lớp giáo trình chỉ đọc (HT2027) KHÔNG bị áp luật "phải có bài".
 */
import test from "node:test";
import assert from "node:assert/strict";
import { completionProblems, isActionableCheckpoint, requiredCheckpoints } from "../../src/lesson/checkpoint";
import { solo01Problems } from "../../src/lesson/curriculumStandard";
import { SOLO01_BUOI01 } from "../../src/data/solo01/buoi01";
import { SOLO01_BUOI02 } from "../../src/data/solo01/buoi02";
import { SOLO01_BUOI03 } from "../../src/data/solo01/buoi03";
import { SOLO01_BUOI04 } from "../../src/data/solo01/buoi04";
import { SOLO01_BUOI05 } from "../../src/data/solo01/buoi05";
import { HT2027_BUOI01 } from "../../src/data/ht2027/buoi01";
import { HT2027_BUOI02 } from "../../src/data/ht2027/buoi02";
import { HT2027_BUOI03 } from "../../src/data/ht2027/buoi03";
import type { LessonSection } from "../../src/lesson/lessonTypes";

const cp = (over: Record<string, unknown> = {}): LessonSection =>
  ({ kind: "checkpoint", id: "2.1", title: "Bài trả", accepts: ["text"], ...over }) as unknown as LessonSection;
const study = { kind: "note", title: "x", body: "y" } as unknown as LessonSection;
const quiz = { mode: "single", question: "Hỏi?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }] };
const run = (sections: LessonSection[], checkpointMode = true, sessionNo = 2) => completionProblems(sections, { checkpointMode, sessionNo });

test("5 buổi SOLO01 thật đạt đường hoàn thành (chế độ bài trả)", () => {
  for (const [i, d] of [SOLO01_BUOI01, SOLO01_BUOI02, SOLO01_BUOI03, SOLO01_BUOI04, SOLO01_BUOI05].entries()) {
    assert.deepEqual(run(d.sections, true, i + 1), [], `Buổi ${i + 1}`);
    assert.deepEqual(solo01Problems(d.sections, i + 1).filter(p => /hoàn thành/.test(p)), [], `Buổi ${i + 1} qua solo01Problems`);
  }
});

test("giáo trình chỉ đọc (HT2027, 0 bài trả): KHÔNG bị áp luật phải có bài, kể cả buổi ≥ 1", () => {
  for (const d of [HT2027_BUOI01, HT2027_BUOI02, HT2027_BUOI03]) assert.deepEqual(run(d.sections, false, d.meta.sessionNo), []);
});

test("lớp chế độ bài trả: buổi không có bài bắt buộc BỊ BẮT; Buổi 0 (nhập môn) được miễn", () => {
  assert.match(run([study]).join(" | "), /chưa có bài trả BẮT BUỘC/);
  assert.deepEqual(run([study], true, 0), []);
  assert.match(run([study, cp({ required: false })]).join(" | "), /chưa có bài trả BẮT BUỘC/, "chỉ có bài không bắt buộc = vẫn kẹt");
  assert.match(run([study, cp({ id: "!!sai" })]).join(" | "), /chưa có bài trả BẮT BUỘC/, "id sai bị server bỏ qua = không tính");
  assert.deepEqual(run([study, cp()]), []);
});

test("bài BẮT BUỘC dùng loại nộp chưa hỗ trợ BỊ BẮT; không bắt buộc hoặc có loại làm được thì qua", () => {
  for (const a of ["image", "audio", "interaction"]) {
    assert.match(run([cp({ accepts: [a] })], false).join(" | "), /chưa làm được trên giao diện/, a);
  }
  assert.deepEqual(run([cp({ accepts: ["image"], required: false }), cp({ id: "2.2" })], false), []);
  assert.deepEqual(run([cp({ accepts: ["image", "text"] })], false), [], "có chữ → làm được");
  assert.deepEqual(run([cp({ accepts: ["video_link"] })], false), []);
});

test("trắc nghiệm: hợp lệ làm được; câu hỏng (không hiện được) bị coi là không làm được", () => {
  assert.deepEqual(run([cp({ accepts: ["quiz"], quiz })]), []);
  assert.match(run([cp({ accepts: ["quiz"], quiz: { ...quiz, options: [quiz.options[0]] } })]).join(" | "), /chưa làm được/);
  assert.equal(isActionableCheckpoint({ accepts: ["quiz"], quiz: undefined }), false);
  assert.equal(requiredCheckpoints([cp(), cp({ id: "2.2", required: false }), study]).length, 1);
});
