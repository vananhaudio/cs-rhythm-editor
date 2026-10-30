/**
 * Hành Trình 2027 — Trả bài ĐỀ XUẤT (lớp phủ tuỳ chọn, CHỜ THẦY DUYỆT): hợp lệ theo luật checkpoint, đặt đúng chỗ,
 * KHÔNG đổi giáo án đã duyệt, dùng nguyên văn "NHIỆM VỤ CUỐI TUẦN" của Thầy.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { HT2027_TRA_BAI, withTraBai } from "../../src/data/ht2027/traBai";
import { HT2027_BUOI01 } from "../../src/data/ht2027/buoi01";
import { HT2027_BUOI02 } from "../../src/data/ht2027/buoi02";
import { HT2027_BUOI03 } from "../../src/data/ht2027/buoi03";
import { HT2027_BUOI04 } from "../../src/data/ht2027/buoi04";
import { HT2027_BUOI05 } from "../../src/data/ht2027/buoi05";
import { HT2027_BUOI06 } from "../../src/data/ht2027/buoi06";
import { HT2027_BUOI07 } from "../../src/data/ht2027/buoi07";
import { HT2027_BUOI08 } from "../../src/data/ht2027/buoi08";
import { checkpointProblems, completionProblems, isActionableCheckpoint, requiredCheckpoints } from "../../src/lesson/checkpoint";
import type { LessonDoc, LessonSection } from "../../src/lesson/lessonTypes";

const DOCS: LessonDoc[] = [HT2027_BUOI01, HT2027_BUOI02, HT2027_BUOI03, HT2027_BUOI04, HT2027_BUOI05, HT2027_BUOI06, HT2027_BUOI07, HT2027_BUOI08];
const isCp = (s: LessonSection) => s.kind === "checkpoint";

test("giáo án Hành Trình đã duyệt KHÔNG bị đổi: vẫn 0 khối checkpoint (lớp phủ nằm ngoài)", () => {
  for (const d of DOCS) assert.equal(d.sections.filter(isCp).length, 0, `Buổi ${d.meta.sessionNo}`);
});

test("mỗi buổi 01–08 có đúng một bài trả đề xuất, id duyệt luật, nộp được trên giao diện V1", () => {
  assert.deepEqual(Object.keys(HT2027_TRA_BAI).map(Number), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const d of DOCS) {
    const n = d.meta.sessionNo;
    const out = withTraBai(d, n);
    const cps = out.sections.filter(isCp);
    assert.equal(cps.length, 1, `Buổi ${n}: đúng 1 bài trả`);
    assert.deepEqual(checkpointProblems(out.sections), [], `Buổi ${n}: checkpointProblems`);
    assert.ok(isActionableCheckpoint(cps[0] as never), `Buổi ${n}: nộp được (chữ / link video)`);
    assert.equal(requiredCheckpoints(out.sections).length, 1);
    assert.equal((cps[0] as { id: string }).id, `${n}.1`);
  }
});

test("đặt NGAY SAU mục 'Ngày 7' (nơi giáo án đang yêu cầu nộp bài); bản gốc không bị sửa", () => {
  for (const d of DOCS) {
    const before = JSON.stringify(d.sections);
    const out = withTraBai(d, d.meta.sessionNo);
    assert.equal(JSON.stringify(d.sections), before, "không đột biến bản gốc");
    const i = out.sections.findIndex(isCp);
    assert.equal((out.sections[i - 1] as { tag?: string }).tag, "Ngày 7", `Buổi ${d.meta.sessionNo}: ngay sau Ngày 7`);
    assert.equal(out.sections.length, d.sections.length + 1);
  }
});

test("lời nhắc dùng NGUYÊN VĂN 'NHIỆM VỤ CUỐI TUẦN/CUỐI CHẶNG' của Thầy trong chính buổi đó", () => {
  for (const d of DOCS) {
    const txt = JSON.stringify(d.sections);
    const prompt = (HT2027_TRA_BAI[d.meta.sessionNo] as { prompt: string }).prompt;
    assert.ok(txt.includes(JSON.stringify(prompt).slice(1, -1)), `Buổi ${d.meta.sessionNo}: prompt khớp nguyên văn giáo án`);
  }
});

test("lớp 'open': thêm bài trả không bị ép luật Admin; lớp 'sequential' bị ép (đúng lý do không dùng lớp phủ cho Solo)", () => {
  const out = withTraBai(HT2027_BUOI05, 5);
  assert.deepEqual(completionProblems(out.sections, { checkpointMode: false, sessionNo: 5 }), []);
  assert.deepEqual(completionProblems(out.sections, { checkpointMode: true, sessionNo: 5 }), [], "có bài bắt buộc → không báo thiếu");
  assert.ok(completionProblems(HT2027_BUOI05.sections, { checkpointMode: true, sessionNo: 5 }).length > 0, "buổi không bài trả trong lớp sequential bị báo");
});

test("buổi ngoài 1–8 không bị đụng", () => {
  assert.equal(withTraBai(HT2027_BUOI05, 9), HT2027_BUOI05);
});
