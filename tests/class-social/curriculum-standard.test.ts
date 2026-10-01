/**
 * GIÁO TRÌNH CHUẨN — SOLO01 là Golden Reference (docs/GIAO-TRINH-CHUAN.md).
 * Mọi buổi SOLO01 (kể cả Buổi 06+ soạn sau) phải qua bộ kiểm này: đúng loại khối, đúng mạch, bài trả đúng luật.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { SOLO01_BUOI01 } from "../../src/data/solo01/buoi01";
import { SOLO01_BUOI02 } from "../../src/data/solo01/buoi02";
import { SOLO01_BUOI03 } from "../../src/data/solo01/buoi03";
import { SOLO01_BUOI04 } from "../../src/data/solo01/buoi04";
import { SOLO01_BUOI05 } from "../../src/data/solo01/buoi05";
import { HT2027_BUOI01 } from "../../src/data/ht2027/buoi01";
import { HT2027_BUOI02 } from "../../src/data/ht2027/buoi02";
import { HT2027_BUOI03 } from "../../src/data/ht2027/buoi03";
import { KNOWN_SECTION_KINDS, solo01DocProblems, solo01Problems } from "../../src/lesson/curriculumStandard";
import type { LessonSection } from "../../src/lesson/lessonTypes";

const SOLO = [SOLO01_BUOI01, SOLO01_BUOI02, SOLO01_BUOI03, SOLO01_BUOI04, SOLO01_BUOI05];

test("mọi buổi SOLO01 đã soạn đạt chuẩn Golden Reference (khối · mạch · bài trả)", () => {
  SOLO.forEach((doc, i) => {
    assert.equal(doc.meta.sessionNo, i + 1, `Buổi ${i + 1}: sessionNo`);
    assert.deepEqual(solo01DocProblems(doc), [], `Buổi ${i + 1}`);
  });
});

test("Hành trình 2027 dùng chung renderer: chỉ khối LessonDocument hiểu", () => {
  for (const doc of [HT2027_BUOI01, HT2027_BUOI02, HT2027_BUOI03]) {
    assert.deepEqual(doc.sections.filter(s => !KNOWN_SECTION_KINDS.includes(s.kind)), []);
  }
});

test("bộ kiểm BẮT được lệch mạch: loại khối lạ · thiếu objectives · đảo đuôi buổi · bài trả sai id / ngoài mạch", () => {
  const base = SOLO01_BUOI05.sections;
  assert.ok(solo01Problems([{ kind: "hero", title: "x" } as unknown as LessonSection, ...base], 5).some(p => /loại "hero"/.test(p)));
  assert.ok(solo01Problems(base.filter(s => s.kind !== "objectives"), 5).some(p => /objectives/.test(p)));
  const swapped = [...base.slice(0, -2), base[base.length - 1], base[base.length - 2]];
  assert.ok(solo01Problems(swapped, 5).some(p => /Đuôi buổi/.test(p)));
  const cp = (id: string): LessonSection => ({ kind: "checkpoint", id, title: "Bài trả" });
  const inFlow = [...base.slice(0, 3), cp("5.1"), ...base.slice(3)];
  assert.deepEqual(solo01Problems(inFlow, 5), []);
  assert.ok(solo01Problems([...base.slice(0, 3), cp("4.1"), ...base.slice(3)], 5).some(p => /bắt đầu bằng "5\."/.test(p)));
  assert.ok(solo01Problems([...base.slice(0, 3), cp("5.1"), cp("5.1"), ...base.slice(3)], 5).some(p => /trùng/.test(p)));
  assert.ok(solo01Problems([...base, cp("5.9")], 5).some(p => /TRONG mạch học/.test(p)));
});
