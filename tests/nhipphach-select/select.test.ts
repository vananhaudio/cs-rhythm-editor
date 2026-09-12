/**
 * Chọn nốt — bất biến mapping SVG ↔ MusicXML.
 *
 * Phép kiểm quan trọng nhất là ROUND-TRIP: nốt nguồn → khắc → phần tử SVG →
 * resolve từ chính phần tử đó → phải về đúng sourceId ban đầu, cho MỌI nốt của
 * MỌI fixture. Không có toạ độ ở đâu cả.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";
import type { AnnotatedScore } from "../../src/musicxml-beats/renderer/types.ts";
import { parseMusicXML } from "../../src/musicxml-beats/parser.ts";
import { tagSourceIds, parseSourceSvgId, sourceSvgId } from "../../src/musicxml-beats/sourceTags.ts";
import {
  resolveNoteElement,
  describeNote,
  NOTE_SOURCE_NOT_RESOLVED,
} from "../../src/nhipphach/noteSelection.ts";
import { all, byId, parse } from "../../src/musicxml-beats/renderer/xml.ts";
import type { Element } from "@xmldom/xmldom";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const B = "../musicxml-beats/fixtures/";
const FIXTURES: { name: string; xml: string; grouping?: unknown }[] = [
  { name: "một nốt", xml: read("../musicxml-subdivision/fixtures/whole-note.musicxml") },
  { name: "hợp âm 3 nốt · hoa mỹ · dấu nối · 2 bè", xml: read("./fixtures/chord-grace-tie-voices.musicxml") },
  { name: "dấu nối qua vạch nhịp", xml: read(B + "tie-across-barline.musicxml") },
  { name: "nốt hoa mỹ (forward)", xml: read(B + "forward-grace.musicxml") },
  { name: "hai bè", xml: read(B + "two-voices-backup.musicxml") },
  { name: "hai khuông", xml: read("../musicxml-mvp/fixtures/two-staves.musicxml") },
  { name: "guitar + TAB", xml: read("../nhipphach-layout/fixtures/guitar-tab.musicxml") },
  { name: "lời + hợp âm", xml: read(B + "lyrics-harmony.musicxml") },
  { name: "lấy đà", xml: read("../musicxml-subdivision/fixtures/pickup-quarter.musicxml") },
  { name: "6/8", xml: read("../musicxml-compound/fixtures/simple-6-8.musicxml") },
  { name: "5/8", xml: read("../musicxml-irregular/fixtures/five-plain.musicxml"), grouping: { byMeter: { "5/8": [2, 3] } } },
  { name: "7/8", xml: read("../musicxml-irregular/fixtures/seven-plain.musicxml"), grouping: { byMeter: { "7/8": [2, 2, 3] } } },
];

const renderer = await createAnnotatedScoreRenderer();
const render = (f: (typeof FIXTURES)[number]): AnnotatedScore =>
  renderer.render(f.xml, { ...DEFAULT_SCORE_SETTINGS, grouping: f.grouping as never });

/** Phần tử SVG của một nốt, tìm trong mọi trang. */
function svgElement(score: AnnotatedScore, svgId: string): Element | null {
  for (const page of score.pages) {
    const el = byId(parse(page.svg), svgId);
    if (el) return el;
  }
  return null;
}

// ── ROUND-TRIP: nguồn → SVG → resolve → nguồn ─────────────────────────────
for (const f of FIXTURES)
  test(`round-trip sourceId: ${f.name}`, () => {
    const score = render(f);
    const parsed = parseMusicXML(f.xml);
    const events = parsed.parts.flatMap((p) => p.measures.flatMap((m) => m.events))
      .filter((e) => e.kind === "note" || e.kind === "rest");
    assert.equal(score.sourceNotes.length, events.length, "mỗi <note> nguồn có đúng một SourceNote");
    // Verovio không giữ id cho LẶNG CẢ Ô (mRest) — đó là giới hạn bộ khắc, được
    // báo tường minh bằng NOTE_SOURCE_NOT_RESOLVED chứ không đoán. NỐT thì không
    // bao giờ được phép rơi vào đây.
    const unresolved = score.diagnostics.filter((d) => d.code === NOTE_SOURCE_NOT_RESOLVED);
    const unresolvedNotes = unresolved.filter(
      (d) => score.sourceNotes.find((n) => n.path === d.sourceId)?.kind === "note"
    );
    assert.equal(unresolvedNotes.length, 0, `nốt bị bỏ: ${unresolvedNotes.map((d) => d.sourceId).join(", ")}`);
    const unresolvedPaths = new Set(unresolved.map((d) => d.sourceId));
    for (const ev of events) {
      const note = score.sourceNotes.find((n) => n.path === ev.source.path);
      assert.ok(note, `SourceNote cho ${ev.source.path}`);
      if (unresolvedPaths.has(ev.source.path)) {
        assert.equal(ev.kind, "rest", "chỉ lặng mới được phép không resolve");
        continue;
      }
      const el = svgElement(score, note!.svgId);
      assert.ok(el, `SVG có phần tử ${note!.svgId} (${ev.source.path})`);
      // Click vào con sâu nhất (đầu nốt) vẫn phải về đúng nốt.
      const deepest = all(el!, "*").pop() ?? el!;
      const r = resolveNoteElement(deepest as never, score.noteIndex);
      assert.equal(r.kind, "note", `resolve ${note!.svgId}`);
      if (r.kind === "note") {
        assert.equal(r.note.path, ev.source.path, "về đúng sourceId");
        assert.equal(r.note.voice, ev.voice);
        assert.equal(r.note.staff, ev.staff);
      }
    }
  });

// ── Hợp âm: từng đầu nốt là từng nốt nguồn riêng ──────────────────────────
test("hợp âm 3 nốt: ba phần tử SVG → ba nốt nguồn khác nhau, đúng từng cao độ", () => {
  const score = render(FIXTURES[1]);
  // Hợp âm trong MusicXML = nốt neo + các nốt kế tiếp mang <chord/>.
  const members = score.sourceNotes.filter((n) => n.chord && n.kind === "note");
  assert.ok(members.length >= 2, "fixture phải có <chord/>");
  const first = members[0];
  const anchor = score.sourceNotes.find(
    (n) => n.measureIndex === first.measureIndex && n.childIndex === first.childIndex - 1
  )!;
  const chord = [anchor, ...members.filter((n) => n.measureIndex === first.measureIndex)];
  assert.ok(chord.length >= 3, "hợp âm ≥ 3 nốt");
  const ids = new Set(chord.map((n) => n.svgId));
  assert.equal(ids.size, chord.length, "mỗi nốt trong hợp âm một id");
  assert.deepEqual(chord.map((n) => `${n.pitch?.step}${n.pitch?.octave}`), ["C4", "E4", "G4"], "đúng từng cao độ theo thứ tự nguồn");
  for (const n of chord) {
    const r = resolveNoteElement(svgElement(score, n.svgId) as never, score.noteIndex);
    assert.equal(r.kind === "note" && r.note.svgId, n.svgId);
  }
});

test("nốt hoa mỹ là một nốt nguồn riêng, chọn được", () => {
  const score = render(FIXTURES[1]);
  const grace = score.sourceNotes.find((n) => n.grace)!;
  assert.ok(grace, "fixture có <grace/>");
  const r = resolveNoteElement(svgElement(score, grace.svgId) as never, score.noteIndex);
  assert.equal(r.kind === "note" && r.note.svgId, grace.svgId);
  assert.match(describeNote(grace, score.beatMap, null).duration, /hoa mỹ/);
});

// ── Dấu nối: mỗi đoạn là một nốt nguồn riêng, không gộp ───────────────────
test("dấu nối qua vạch nhịp: hai đoạn → hai nốt nguồn riêng", () => {
  const score = render(FIXTURES[2]);
  const start = score.sourceNotes.find((n) => n.ties.includes("start"));
  const stop = score.sourceNotes.find((n) => n.ties.includes("stop"));
  assert.ok(start && stop, "fixture phải có tie start/stop");
  assert.notEqual(start!.svgId, stop!.svgId);
  assert.notEqual(start!.measureIndex, stop!.measureIndex, "qua vạch nhịp");
  for (const n of [start!, stop!])
    assert.equal(resolveNoteElement(svgElement(score, n.svgId) as never, score.noteIndex).kind, "note");
});

// ── Hai bè, hai khuông, TAB ───────────────────────────────────────────────
test("hai bè: nốt bè 2 giữ voice=2 và resolve riêng", () => {
  const score = render(FIXTURES[4]);
  const v2 = score.sourceNotes.filter((n) => n.voice === "2");
  assert.ok(v2.length > 0);
  for (const n of v2) assert.equal(resolveNoteElement(svgElement(score, n.svgId) as never, score.noteIndex).kind, "note");
});

test("guitar + TAB: nốt khuông nhạc và nốt TAB là hai nốt nguồn RIÊNG, TAB mang dây/phím từ nguồn", () => {
  const score = render(FIXTURES[6]);
  const staff1 = score.sourceNotes.filter((n) => n.staff === "1" && n.kind === "note");
  const staff2 = score.sourceNotes.filter((n) => n.staff === "2" && n.kind === "note");
  assert.ok(staff1.length > 0 && staff2.length > 0, "cả hai khuông đều có nốt");
  assert.equal(staff2.filter((n) => n.tab).length, staff2.length, "mọi nốt TAB có <string>/<fret> thật");
  assert.equal(staff1.filter((n) => n.tab).length, 0, "nốt khuông nhạc không bịa dây/phím");
  for (const n of [...staff1.slice(0, 5), ...staff2.slice(0, 5)]) {
    const r = resolveNoteElement(svgElement(score, n.svgId) as never, score.noteIndex);
    assert.equal(r.kind === "note" && r.note.staff, n.staff);
  }
});

// ── Không resolve thì nói rõ, không chọn đại ───────────────────────────────
test("phần tử nốt không có gốc → NOTE_SOURCE_NOT_RESOLVED, không phải nốt gần nhất", () => {
  const doc = parse('<svg><g class="system"><g id="la" class="note"><use/></g></g></svg>');
  const use = all(doc, "use")[0];
  const r = resolveNoteElement(use as never, new Map());
  assert.equal(r.kind, "unresolved");
  assert.equal(r.kind === "unresolved" && r.code, NOTE_SOURCE_NOT_RESOLVED);
  // Click vào chỗ trống: không chọn gì.
  const blank = parse('<svg><g class="system"><g class="staff"><path/></g></g></svg>');
  assert.equal(resolveNoteElement(all(blank, "path")[0] as never, new Map()).kind, "none");
});

// ── Mô tả để hiện panel ───────────────────────────────────────────────────
test("panel: ô nhịp, phách, cao độ, trường độ đúng với nốt", () => {
  const f = FIXTURES[0];
  const score = render(f);
  const ev = parseMusicXML(f.xml).parts[0].measures[0].events.find((e) => e.kind === "note")!;
  const note = score.noteIndex.get(sourceSvgId(1, 1, Number(/\*\[(\d+)\]$/.exec(ev.source.path)![1])))!;
  const d = describeNote(note, score.beatMap, ev.onset);
  assert.equal(d.measure, "1");
  assert.equal(d.beat, "1");
  assert.match(d.pitch, /^[A-G](#|b)?\d$/);
  assert.equal(d.duration, "nốt tròn");
});

// ── Không khắc lại khi chọn ───────────────────────────────────────────────
test("resolve một nghìn lần không gọi Verovio thêm lần nào", () => {
  const r2 = renderer;
  const score = render(FIXTURES[6]);
  const before = r2.stats().engravings;
  const el = svgElement(score, score.sourceNotes[0].svgId)!;
  for (let i = 0; i < 1000; i++) resolveNoteElement(el as never, score.noteIndex);
  assert.equal(r2.stats().engravings, before);
});

// ── Chọn nốt KHÔNG đụng nguồn: SHA nguồn thô trước/sau 100 lần chọn ────────
test("bật chọn nốt và chọn 100 lần: MusicXML nguồn thô không đổi một byte", async () => {
  const { sha256Hex } = await import("../../src/nhipphach/scoreHash.ts");
  const f = FIXTURES[6];
  const truoc = await sha256Hex(f.xml);
  const score = render(f);
  // id chỉ tiêm vào bản đưa Verovio; bản đó KHÁC nguồn và nguồn không bị ghi đè.
  const tagged = tagSourceIds(f.xml);
  assert.notEqual(tagged.xml, f.xml, "bản render có id tiêm vào");
  assert.equal(f.xml.includes("tva-src-"), false, "nguồn thô không có id tiêm");
  for (let i = 0; i < 100; i++) {
    const n = score.sourceNotes[i % score.sourceNotes.length];
    const el = svgElement(score, n.svgId);
    if (el) { resolveNoteElement(el as never, score.noteIndex); describeNote(n, score.beatMap, null); }
  }
  assert.equal(await sha256Hex(f.xml), truoc, "SHA nguồn thô sau 100 lần chọn vẫn y nguyên");
  assert.equal(score.beatMap.measures.length > 0, true);
});

// ── Kiến trúc: khoá bằng đọc mã nguồn ─────────────────────────────────────
const src = (f: string) => readFileSync(new URL(`../../src/${f}`, import.meta.url), "utf8");
const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const RULES: { file: string; what: string; pattern: RegExp; mutation: string }[] = [
  { file: "nhipphach/noteSelection.ts", what: "chọn nốt gọi Supabase/Storage", pattern: /supabase|storage\.from|createClient/i, mutation: `import { supabase } from "../supabase";` },
  { file: "nhipphach/noteSelection.ts", what: "chọn nốt khắc lại nhạc", pattern: /verovio|VerovioToolkit|loadData|renderToSVG|createAnnotatedScoreRenderer/i, mutation: `import { VerovioToolkit } from "verovio/esm";` },
  { file: "nhipphach/noteSelection.ts", what: "chọn nốt ghi phiên bản", pattern: /libraryRepository|nhipphach_save_version|\.save\(/, mutation: `import { SupabaseScoreLibrary } from "./libraryRepository.ts";` },
  { file: "nhipphach/noteSelection.ts", what: "đoán nốt bằng toạ độ / nốt gần nhất", pattern: /getBoundingClientRect|getBBox|nearest|Math\.hypot|distance|closestNote|\bclientX\b/, mutation: `const nearest = Math.hypot(dx, dy);` },
  { file: "nhipphach/noteSelection.ts", what: "fallback ghép theo cao độ / thời điểm / cùng khuông", pattern: /sameOnset|samePitch|byPitch|byOnset|closestInStaff|fallbackNote/, mutation: `const fallbackNote = sameOnset(note);` },
  { file: "musicxml-beats/sourceTags.ts", what: "id nguồn dính cao độ", pattern: /tva-src-[^`"']*\$\{[^}]*(pitch|step|octave)/, mutation: "const svgId = `tva-src-${pitch.step}`;" },
];
test("kiến trúc chọn nốt được khoá bằng mã nguồn, mỗi luật tự thử ngược", () => {
  for (const r of RULES) {
    const t = src(r.file);
    assert.equal(r.pattern.test(code(t)), false, `${r.file} vi phạm: ${r.what}`);
    assert.equal(r.pattern.test(code(t + "\n" + r.mutation)), true, `luật "${r.what}" không bắt được đột biến`);
  }
  // id tiêm vào có mặt trong SVG cho mọi fixture, và id có thể đọc ngược.
  assert.deepEqual(parseSourceSvgId("tva-src-p1-m12-c4"), { partIndex: 1, measureIndex: 12, childIndex: 4 });
  assert.equal(parseSourceSvgId("c1kyp1ws"), null);
  assert.equal(tagSourceIds("<không phải xml").notes.length, 0);
});

test.after(() => renderer.destroy());
