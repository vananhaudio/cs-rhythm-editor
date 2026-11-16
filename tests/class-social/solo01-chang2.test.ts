/** SOLO01 Chặng 2 (Solo Bolero): đạt chuẩn giáo trình + mọi alphaTex parse được và đủ nhịp. */
import test from "node:test";
import assert from "node:assert/strict";
import * as alphaTab from "@coderline/alphatab";
import { SOLO01_CHANG2 } from "../../src/data/solo01/chang2";
import { solo01DocProblems } from "../../src/lesson/curriculumStandard";
import { CDX_BARS } from "../../src/data/solo01/chang2/works";

test("Chặng 2: 8 buổi đúng thứ tự 9–16 và đạt chuẩn Golden Reference", () => {
  assert.equal(SOLO01_CHANG2.length, 8);
  SOLO01_CHANG2.forEach((doc, i) => {
    assert.equal(doc.meta.sessionNo, 9 + i);
    assert.match(doc.meta.title, new RegExp(`^Chặng 2 – Buổi ${i + 1}/8`));
    assert.deepEqual(solo01DocProblems(doc), [], `Buổi ${doc.meta.sessionNo}`);
  });
});

test("Chặng 2: mỗi buổi 3 bài trả bắt buộc, đúng 1 video, 2 trắc nghiệm, KHÔNG chứa đáp án", () => {
  for (const doc of SOLO01_CHANG2) {
    const cps = doc.sections.filter(s => s.kind === "checkpoint") as { id: string; accepts?: string[]; quiz?: Record<string, unknown> }[];
    assert.equal(cps.length, 3, `Buổi ${doc.meta.sessionNo}`);
    assert.equal(cps.filter(c => c.accepts?.includes("video_link")).length, 1);
    assert.equal(cps.filter(c => c.accepts?.includes("quiz")).length, 2);
    for (const c of cps) if (c.quiz) assert.ok(!("correct" in c.quiz) && !("answer" in c.quiz));
  }
});

const TICKS_4_4 = 3840;
function texOf(doc: (typeof SOLO01_CHANG2)[number]): string[] {
  const out: string[] = [];
  for (const s of doc.sections) {
    if (s.kind === "score") out.push(s.tex);
    if (s.kind === "layers") s.layers.forEach(l => out.push(l.tex));
    if (s.kind === "repertoire") (s.pieces ?? []).forEach(p => out.push(p.tex));
  }
  return out;
}

test("Chặng 2: mọi alphaTex parse được; ô nhịp 4/4 của MỌI bè đủ 4 phách", () => {
  let n = 0;
  for (const doc of SOLO01_CHANG2) for (const tex of texOf(doc)) {
    const imp = new alphaTab.importer.AlphaTexImporter();
    imp.initFromString(tex, new alphaTab.Settings());
    const score = imp.readScore();
    n++;
    for (const [bi, bar] of score.tracks[0].staves[0].bars.entries()) for (const v of bar.voices) {
      if (v.isEmpty) continue;
      const ticks = v.beats.reduce((a, b) => a + b.playbackDuration, 0);
      assert.equal(ticks, TICKS_4_4, `Buổi ${doc.meta.sessionNo} · ô ${bi + 1} · ${tex.slice(0, 60)}`);
    }
  }
  assert.ok(n >= 40, `chỉ kiểm ${n} bản nhạc`);
});

test("Chặng 2: nguồn MusicXML — 41 ô, mọi nốt ở ngăn 0–3", () => {
  assert.equal(CDX_BARS.length, 41);
  for (const b of CDX_BARS) for (const m of b.matchAll(/(\d+)\.\d(?:\{[^}]*\})?\.\d+/g)) assert.ok(Number(m[1]) <= 3, b);
});
