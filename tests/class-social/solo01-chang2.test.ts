/** SOLO01 Chặng 2 (Solo Bolero): đạt chuẩn giáo trình + mọi alphaTex parse được và đủ nhịp. */
import test from "node:test";
import assert from "node:assert/strict";
import * as alphaTab from "@coderline/alphatab";
import { SOLO01_CHANG2 } from "../../src/data/solo01/chang2";
import { solo01DocProblems } from "../../src/lesson/curriculumStandard";
import { CDX_BARS, CDX_SRC_BARS, cdxFingered, TRIAD, DYAD, BASS, type ChordShape } from "../../src/data/solo01/chang2/works";

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

const NOTE_RE = /(\d+)\.(\d)(\{[^}]*\})?\.(\d+)/g;
const OPEN = [0, 64, 59, 55, 50, 45, 40];
const pitchOf = (fret: number, str: number): number => OPEN[str] + fret;

test("Chặng 2: nguồn MusicXML (CDX_SRC_BARS) — 41 ô, mọi nốt ở ngăn 0–3, KHÔNG bị sửa", () => {
  assert.equal(CDX_SRC_BARS.length, 41);
  for (const b of CDX_SRC_BARS) for (const m of b.matchAll(NOTE_RE)) assert.ok(Number(m[1]) <= 3, b);
});

test("Chặng 2: bản phối nâng đúng MỘT QUÃNG 8 — nhịp điệu giữ nguyên, ưu tiên dây 1, dây 2 khi cần", () => {
  assert.equal(CDX_BARS.length, 41);
  const shape = (b: string) => b.replace(NOTE_RE, (_m, _f, _s, br: string | undefined, d: string) => `N${br ?? ""}.${d}`);
  let s3 = 0;
  CDX_BARS.forEach((b, i) => {
    assert.equal(shape(b), shape(CDX_SRC_BARS[i]), `ô ${i + 1}: nhịp điệu/trường độ/ký hiệu phải giữ nguyên`);
    const src = [...CDX_SRC_BARS[i].matchAll(NOTE_RE)];
    const out = [...b.matchAll(NOTE_RE)];
    out.forEach((m, k) => {
      const ps = pitchOf(Number(src[k][1]), Number(src[k][2]));
      const po = pitchOf(Number(m[1]), Number(m[2]));
      assert.equal(po, ps + 12, `ô ${i + 1} nốt ${k + 1}: đúng một quãng 8`);
      const str = Number(m[2]);
      if (po >= 64) assert.equal(str, 1, `ô ${i + 1}: nốt từ Mi4 trở lên phải ở dây 1`);
      else if (po >= 59) assert.equal(str, 2, `ô ${i + 1}: Si3–Rê♯4 ở dây 2`);
      else { assert.equal(str, 3); assert.equal(po, 57, "dây 3 chỉ dành cho La3"); s3++; }
      assert.ok(Number(m[1]) <= 12, `ô ${i + 1}: không quá ngăn 12`);
    });
  });
  assert.equal(s3, 4 + 0, "La3 xuất hiện đúng ở 4 ô (5, 13, 25, 38)");
});

test("Chặng 2: xếp ngón — mỗi nốt có bấm đúng ngón 1–4 và đúng Vị trí I·III·V·VII·IX", () => {
  const tex = cdxFingered(1, 41);
  let n = 0;
  for (const m of tex.matchAll(/(\d+)\.(\d)\{([^}]*)\}\.(\d+)/g)) {
    const lf = /lf (\d)/.exec(m[3]);
    if (!lf) continue;
    const finger = Number(lf[1]) - 1;
    assert.ok(finger >= 1 && finger <= 4, `ngón ${finger}`);
    assert.ok([1, 3, 5, 7, 9].includes(Number(m[1]) - finger + 1), `vị trí của ngăn ${m[1]} ngón ${finger}`);
    n++;
  }
  assert.ok(n > 100, `chỉ ${n} nốt có ngón`);
  // nốt dây buông không ghi ngón
  for (const m of tex.matchAll(/(?<![\d.])0\.\d(\{[^}]*\})?\.\d+/g)) assert.ok(!/lf/.test(m[1] ?? ""), m[0]);
});

// ── Thế hợp âm và Bass ────────────────────────────────────────────────────────────────────────────
const PC_NAME = ["Đô", "Đô♯", "Rê", "Rê♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"];
const CHORD_PCS: Record<string, number[]> = { Am: [9, 0, 4], Dm: [2, 5, 9], E: [4, 8, 11], E7: [4, 8, 11, 2], F: [5, 9, 0], G: [7, 11, 2], C: [0, 4, 7] };
const ROOT: Record<string, number> = { Am: 9, Dm: 2, E: 4, E7: 4, F: 5, G: 7, C: 0 };
const parseShape = (sh: ChordShape): { str: number; fret: number; pitch: number }[] =>
  sh.tex.split(" ").map(t => { const [f, s] = t.split(".").map(Number); return { str: s, fret: f, pitch: pitchOf(f, s) }; }).sort((a, b) => a.pitch - b.pitch);

test("Chặng 2: thế hợp âm — nốt thật thuộc hợp âm, ký hiệu 6→1 khớp, bấm được, gọi đúng tên (Triad/Dyad/Partial)", () => {
  for (const [table, size] of [[TRIAD, 3], [DYAD, 2]] as const) {
    for (const chord of Object.keys(CHORD_PCS)) {
      const sh = table[chord];
      const ns = parseShape(sh);
      assert.equal(ns.length, size, `${chord} ${sh.code}`);
      // ký hiệu sáu ký tự dây 6 → 1
      const expect = [6, 5, 4, 3, 2, 1].map(str => { const n = ns.find(x => x.str === str); return n ? String(n.fret) : "x"; }).join("");
      assert.equal(sh.code, expect, `${chord}: code ≠ tex`);
      // tên nốt từ thấp lên cao
      assert.deepEqual(ns.map(n => PC_NAME[n.pitch % 12]), sh.notes, `${chord} ${sh.code}: tên nốt`);
      // mọi nốt thuộc hợp âm; không nốt trùng tên
      for (const n of ns) assert.ok(CHORD_PCS[chord].includes(n.pitch % 12), `${chord} ${sh.code}: ${PC_NAME[n.pitch % 12]} không thuộc hợp âm`);
      assert.equal(new Set(ns.map(n => n.pitch % 12)).size, size);
      // bấm được: dây liền nhau, độ giãn ≤ 4 ngăn (nốt có bấm), ngăn 1 chữ số, ở dây 4–2
      const fr = ns.map(n => n.fret).filter(f => f > 0);
      assert.ok(Math.max(...fr) - Math.min(...fr) <= 3, `${chord} ${sh.code}: giãn quá 4 ngăn`);
      assert.ok(ns.every(n => n.fret <= 9 && n.str >= 2 && n.str <= 4), `${chord} ${sh.code}: ngoài dây 4–2/ngăn ≤ 9`);
      // phân loại: chỉ gọi Triad khi đủ Root–3rd–5th
      const pcs = new Set(ns.map(n => n.pitch % 12));
      const full = CHORD_PCS[chord].slice(0, 3).every(pc => pcs.has(pc));
      if (/^Triad/.test(sh.kind)) assert.ok(size === 3 && full, `${chord}: gọi Triad nhưng thiếu nốt`);
      else assert.ok(!(size === 3 && full), `${chord}: thế đủ nốt nhưng không gọi Triad`);
      if (chord === "E7") assert.ok(!/^Triad/.test(sh.kind));
      if (table === DYAD) assert.ok(/^Dyad/.test(sh.kind));
    }
  }
});

test("Chặng 2: Bass — ở dây 6–5, đúng nốt gốc/quãng 5 của hợp âm, thấp hơn mọi nốt hợp âm và melody", () => {
  const lowestMelody = Math.min(...CDX_BARS.flatMap(b => [...b.matchAll(NOTE_RE)].map(m => pitchOf(Number(m[1]), Number(m[2])))));
  for (const chord of Object.keys(BASS)) {
    const r = BASS[chord];
    const [rf, rs] = r.root.split(".").map(Number);
    const [ff, fs] = r.fifth.split(".").map(Number);
    assert.ok(rs >= 5 && fs >= 5, `${chord}: Bass phải ở dây 6–5`);
    assert.equal(pitchOf(rf, rs) % 12, ROOT[chord], `${chord}: Bass gốc`);
    assert.equal((pitchOf(ff, fs) - ROOT[chord] + 120) % 12, 7, `${chord}: Bass đổi là quãng 5`);
    const lowest = Math.min(...parseShape(TRIAD[chord]).map(n => n.pitch));
    assert.ok(pitchOf(rf, rs) < lowest && pitchOf(ff, fs) < lowest, `${chord}: Bass thấp hơn hợp âm`);
    assert.ok(pitchOf(rf, rs) < lowestMelody && pitchOf(ff, fs) < lowestMelody);
  }
});

test("Chặng 2: bản phác 2 bè — mọi nốt Bass/hợp âm THẤP HƠN nốt melody đang vang", () => {
  let pairs = 0;
  for (const doc of SOLO01_CHANG2) for (const tex of texOf(doc)) {
    if (!tex.includes("\\voice")) continue;
    const imp = new alphaTab.importer.AlphaTexImporter();
    imp.initFromString(tex, new alphaTab.Settings());
    const score = imp.readScore();
    for (const [bi, bar] of score.tracks[0].staves[0].bars.entries()) {
      if (bar.voices.length < 2) continue;
      const [mel, acc] = bar.voices;
      for (const b2 of acc.beats) {
        if (b2.isRest || b2.notes.length === 0) continue;
        const top = Math.max(...b2.notes.map(n => n.realValue));
        const sounding = mel.beats.find(b1 => !b1.isRest && b1.notes.length > 0 && b1.playbackStart <= b2.playbackStart && b2.playbackStart < b1.playbackStart + b1.playbackDuration);
        if (!sounding) continue;
        const low = Math.min(...sounding.notes.map(n => n.realValue));
        assert.ok(top < low, `Buổi ${doc.meta.sessionNo} · ô ${bi + 1}: nốt bè 2 (${top}) phải thấp hơn melody (${low})`);
        pairs++;
      }
    }
  }
  assert.ok(pairs >= 12, `chỉ kiểm ${pairs} cặp`);
});
