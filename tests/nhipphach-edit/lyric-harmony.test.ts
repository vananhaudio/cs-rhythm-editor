/**
 * Sửa LỜI và HỢP ÂM — Giai đoạn Nội dung 3C.
 *
 * Điều phải chứng minh trước hết là DANH TÍNH: bấm vào một chữ hát hay một ký
 * hiệu hợp âm trên bản khắc thì biết đích danh nó là `<lyric>`/`<harmony>` nào
 * trong MusicXML — không phải "cái gần nhất". Verovio KHÔNG giữ `id` của hai thẻ
 * này (đo được), nên danh tính được gắn ở MEI theo hai tương ứng cấu trúc, và
 * mỗi phép kiểm ở đây đi trọn vòng: nguồn → khắc → phần tử SVG → resolve → nguồn.
 *
 * Sau đó là SỬA: chỉ đúng chỗ đó đổi, `<syllabic>`/`<extend>` còn nguyên, và
 * ký hiệu hợp âm mà bộ khắc vẽ ra đúng bằng thứ panel hứa.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyCommand } from "../../src/nhipphach/edit/applyCommand.ts";
import type { MusicXmlEditCommand } from "../../src/nhipphach/edit/commands.ts";
import { describeCommands } from "../../src/nhipphach/edit/commands.ts";
import {
  applyToDraft,
  createDraft,
  rebuildDraft,
  redo,
  undo,
} from "../../src/nhipphach/edit/draftEngine.ts";
import { readNoteFields } from "../../src/nhipphach/edit/noteFields.ts";
import { readHarmonyFields } from "../../src/nhipphach/edit/harmonyFields.ts";
import { HARMONY_KINDS, harmonySymbol } from "../../src/nhipphach/edit/harmonyModel.ts";
import type { HarmonyValue } from "../../src/nhipphach/edit/harmonyModel.ts";
import {
  newRhythmIssues,
  rhythmIssues,
  structuralIssues,
} from "../../src/nhipphach/edit/validation.ts";
import { validateDraft } from "../../src/nhipphach/edit/validation.ts";
import { saveDraftAsVersion } from "../../src/nhipphach/edit/versionSave.ts";
import { EditError, parseStrict, resolveSourcePath } from "../../src/nhipphach/edit/xmlPatch.ts";
import { tagSourceIds } from "../../src/musicxml-beats/sourceTags.ts";
import { sha256Hex } from "../../src/nhipphach/scoreHash.ts";
import { applySourceIdentity } from "../../src/musicxml-beats/renderer/meiIdentity.ts";
import { applyAnchorLattice } from "../../src/musicxml-beats/renderer/anchorLattice.ts";
import { musicXMLToBeatMap } from "../../src/musicxml-beats/beatMap.ts";
import { scoreGeometry } from "../nhipphach-layout/geometry.ts";
import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
import {
  createAnnotatedScoreRenderer,
  layoutOptions,
} from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";
import type { AnnotatedScore, ScoreSettings } from "../../src/musicxml-beats/renderer/types.ts";
import {
  all,
  byId,
  parse,
  parse as parseXml,
  serialize as serializeXml,
} from "../../src/musicxml-beats/renderer/xml.ts";
import { resolveScoreElement } from "../../src/nhipphach/noteSelection.ts";
import type { SaveRequest, SaveResult } from "../../src/nhipphach/libraryRepository.ts";
import type { Element } from "@xmldom/xmldom";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const FX = read("./fixtures/lyric-harmony.musicxml");
/** `/part[p]/measure[m]/*[c]` — con thứ c tính cả `<attributes>`/`<harmony>`. */
const P = (m: number, c: number, part = 1) =>
  `/score-partwise/part[${part}]/measure[${m}]/*[${c}]`;
/* Bản đồ fixture: m1 c1=attributes c2=harmony(C) c3..c6=4 nốt (2 dòng lời mỗi nốt)
   m2 c1=harmony(Cm) c2=Sol trắng có <extend/> c3=harmony(C7) c4=La trắng
   m3 c1=harmony(CMaj7) c2=nốt “Đường” c3=harmony(C/E) c4=nốt “xưa” c5=harmony(F♯m7♭5/A♭) c6=nốt “em”
   m4 c1=harmony(Dm) c2=nốt tròn với HAI dòng lời KHÔNG ghi number
   m5 6/8 · m6 5/8 (hai hợp âm) · m7 7/8 */
const GROUPING = { byMeter: { "5/8": [2, 3], "7/8": [2, 2, 3] } };
const SETTINGS = { ...DEFAULT_SCORE_SETTINGS, grouping: GROUPING as never } as ScoreSettings;

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof EditError) return e.code;
    throw e;
  }
  return null;
};
const lyricsOf = (xml: string, path: string) => readNoteFields(xml, path)!.lyrics;
const harmonyOf = (xml: string, path: string) => readHarmonyFields(xml, path)!;
const elementText = (xml: string, path: string) => {
  const el = resolveSourcePath(parseStrict(xml), path)!;
  return el.toString();
};
const renderer = await createAnnotatedScoreRenderer();
const render = (xml: string): AnnotatedScore => renderer.render(xml, SETTINGS);
test.after(() => renderer.destroy());

/** Phần tử SVG mang id ấy, tìm trong mọi trang. */
function svgElement(score: AnnotatedScore, svgId: string): Element | null {
  for (const page of score.pages) {
    const el = byId(parse(page.svg), svgId);
    if (el) return el;
  }
  return null;
}
const selectionIndex = (score: AnnotatedScore) => ({
  notes: score.noteIndex,
  lyrics: score.lyricIndex,
  harmonies: score.harmonyIndex,
});
/** Phần tử con sâu nhất — mô phỏng cú bấm rơi đúng vào nét chữ, không vào nhóm. */
const sauNhat = (el: Element): Element => {
  const kids = all(el, "*").filter((x) => x !== el);
  return kids.length ? kids[kids.length - 1] : el;
};

// ── Danh tính: lời ───────────────────────────────────────────────────────────

test("mapping lời: mọi dòng lời nguồn → SVG → resolve → đúng dòng lời ấy", () => {
  const score = render(FX);
  assert.equal(score.lyricIndex.size, 20);
  assert.deepEqual([...score.unresolvedIdentity], []);
  for (const [svgId, lyric] of score.lyricIndex) {
    const el = svgElement(score, svgId);
    assert.ok(el, `${svgId} (“${lyric.text}”) không có mặt trong bản khắc`);
    const r = resolveScoreElement(sauNhat(el!), selectionIndex(score));
    assert.equal(r.kind, "lyric", `${svgId} resolve ra ${r.kind}`);
    if (r.kind !== "lyric") continue;
    assert.equal(r.lyric.svgId, svgId);
    assert.equal(r.lyric.notePath, lyric.notePath);
    assert.equal(r.lyric.lyricIndex, lyric.lyricIndex);
  }
});

test("mapping lời: chữ hát đọc được về đúng nốt mang nó, và ngược lại", () => {
  const score = render(FX);
  const l = [...score.lyricIndex.values()].find((x) => x.text === "Mưa")!;
  assert.equal(l.notePath, P(1, 3));
  assert.equal(l.lyricIndex, 2);
  assert.equal(l.number, "2");
  // Bấm vào chữ hát KHÔNG được resolve thành nốt, dù `g.verse` nằm trong `g.note`.
  const r = resolveScoreElement(sauNhat(svgElement(score, l.svgId)!), selectionIndex(score));
  assert.equal(r.kind, "lyric");
  // Còn bấm vào đầu nốt thì vẫn ra nốt.
  const note = score.noteIndex.get("tva-src-p1-m1-c3")!;
  const rn = resolveScoreElement(svgElement(score, note.svgId)!, selectionIndex(score));
  assert.equal(rn.kind, "note");
});

test("mapping lời: hai dòng lời KHÔNG ghi number vẫn là hai danh tính khác nhau", () => {
  // Đo được: Verovio cho cả hai thành <verse n="1">. Nếu khoá là `number` thì hai
  // dòng này lẫn vào nhau — đúng cái bẫy 3C phải chặn.
  const score = render(FX);
  const hai = [...score.lyricIndex.values()].filter((l) => l.notePath === P(4, 2));
  assert.deepEqual(hai.map((l) => [l.lyricIndex, l.number, l.text]), [
    [1, "", "một"],
    [2, "", "hai"],
  ]);
  const ids = hai.map((l) => resolveScoreElement(sauNhat(svgElement(score, l.svgId)!), selectionIndex(score)));
  assert.deepEqual(
    ids.map((r) => (r.kind === "lyric" ? r.lyric.lyricIndex : null)),
    [1, 2]
  );
});

// ── Danh tính: hợp âm ────────────────────────────────────────────────────────

test("mapping hợp âm: mọi hợp âm nguồn → SVG → resolve → đúng hợp âm ấy", () => {
  const score = render(FX);
  assert.equal(score.harmonyIndex.size, 11);
  for (const [svgId, h] of score.harmonyIndex) {
    const el = svgElement(score, svgId);
    assert.ok(el, `${svgId} không có mặt trong bản khắc`);
    const r = resolveScoreElement(sauNhat(el!), selectionIndex(score));
    assert.equal(r.kind, "harmony", `${svgId} resolve ra ${r.kind}`);
    if (r.kind !== "harmony") continue;
    assert.equal(r.harmony.path, h.path);
  }
});

test("mapping hợp âm: ba hợp âm trong cùng một ô không lẫn vào nhau", () => {
  const score = render(FX);
  const m3 = [...score.harmonyIndex.values()].filter((h) => h.measureIndex === 3);
  assert.deepEqual(
    m3.map((h) => [h.harmonyIndex, h.rootStep, h.rootAlter, h.kind, h.bassStep, h.bassAlter]),
    [
      [1, "C", 0, "major-seventh", null, 0],
      [2, "C", 0, "major", "E", 0],
      [3, "F", 1, "half-diminished", "A", -1],
    ]
  );
  for (const h of m3) {
    const r = resolveScoreElement(sauNhat(svgElement(score, h.svgId)!), selectionIndex(score));
    assert.equal(r.kind === "harmony" && r.harmony.harmonyIndex, h.harmonyIndex);
  }
});

test("mapping hợp âm: nhiều bè, part hai khuông, hai hợp âm cùng một phách", () => {
  // Bản nhạc cố tình khó: part 1 có hai khuông và một hợp âm nằm ở khuông dưới,
  // part 2 có hai hợp âm rơi đúng cùng một chỗ. Thứ tự tài liệu vẫn là danh tính.
  const xml = read("./fixtures/harmony-multipart.musicxml");
  const score = render(xml);
  assert.deepEqual([...score.unresolvedIdentity], []);
  assert.equal(score.harmonyIndex.size, 6);
  for (const [svgId, h] of score.harmonyIndex) {
    const r = resolveScoreElement(sauNhat(svgElement(score, svgId)!), selectionIndex(score));
    assert.equal(r.kind === "harmony" && r.harmony.path, h.path);
  }
  const tags = tagSourceIds(xml);
  assert.deepEqual(
    tags.harmonies.map((h) => `${h.partIndex}:${h.harmonyIndex}:${h.rootStep}${h.kind}`),
    ["1:1:Cmajor", "1:2:Dminor", "1:3:Eminor", "2:1:Fmajor", "2:2:Gsuspended-fourth", "2:3:Gdominant"]
  );
});

test("mapping: nguồn mà bản khắc không vẽ ra thì KHÔNG gắn đại", () => {
  // Lời đặt trên một `<note>` mà Verovio không giữ id (lặng cả ô nhịp): danh tính
  // phải báo thiếu chứ không được gán nhầm sang dòng lời khác.
  const xml = read("./fixtures/lyric-unresolvable.musicxml");
  const score = render(xml);
  assert.ok(score.unresolvedIdentity.size > 0, "phải có ít nhất một chỗ không gắn được");
  for (const svgId of score.unresolvedIdentity)
    assert.equal(svgElement(score, svgId), null, `${svgId} không được có mặt trong SVG`);
  assert.ok(
    score.diagnostics.some((d) => d.code === "SOURCE_IDENTITY_NOT_RESOLVED"),
    "phải có chẩn đoán nói rõ chỗ không gắn được"
  );
});

// ── Sửa lời ─────────────────────────────────────────────────────────────────

test("sửa lời: chỉ đúng dòng ấy đổi, các dòng khác của cùng nốt y nguyên", () => {
  const truoc = lyricsOf(FX, P(1, 3));
  assert.deepEqual(truoc.map((l) => l.text), ["Quê", "Mưa"]);
  const r = applyCommand(FX, { type: "ChangeLyricText", path: P(1, 3), lyricIndex: 2, text: "Nắng" });
  const sau = lyricsOf(r.xml, P(1, 3));
  assert.deepEqual(sau.map((l) => l.text), ["Quê", "Nắng"]);
  assert.deepEqual(sau[0], truoc[0], "dòng lời 1 không được đụng tới");
  assert.deepEqual(r.touched, [`${P(1, 3)}/lyric[2]/text`]);
});

test("sửa lời: sửa dòng 2 của nốt KHÔNG ghi number không chạm dòng 1", () => {
  const r = applyCommand(FX, { type: "ChangeLyricText", path: P(4, 2), lyricIndex: 2, text: "ba" });
  assert.deepEqual(lyricsOf(r.xml, P(4, 2)).map((l) => l.text), ["một", "ba"]);
  const r1 = applyCommand(FX, { type: "ChangeLyricText", path: P(4, 2), lyricIndex: 1, text: "bốn" });
  assert.deepEqual(lyricsOf(r1.xml, P(4, 2)).map((l) => l.text), ["bốn", "hai"]);
});

test("sửa lời: <syllabic> và <extend> còn nguyên; thuộc tính number không bị thêm", () => {
  const r = applyCommand(FX, { type: "ChangeLyricText", path: P(2, 2), lyricIndex: 1, text: "vang" });
  const l = lyricsOf(r.xml, P(2, 2))[0];
  assert.equal(l.text, "vang");
  assert.equal(l.syllabic, "single");
  assert.equal(l.extend, true, "<extend/> bị mất khi chỉ sửa chữ");
  assert.match(elementText(r.xml, P(2, 2)), /<extend\s*\/>/);
  // Dòng lời nối âm tiết: sửa chữ không được biến `begin` thành `single`.
  const r2 = applyCommand(FX, { type: "ChangeLyricText", path: P(1, 5), lyricIndex: 1, text: "Miền" });
  assert.equal(lyricsOf(r2.xml, P(1, 5))[0].syllabic, "begin");
  const r3 = applyCommand(FX, { type: "ChangeLyricText", path: P(4, 2), lyricIndex: 1, text: "bốn" });
  assert.doesNotMatch(elementText(r3.xml, P(4, 2)), /<lyric number=/);
});

test("sửa lời: tiếng Việt nguyên văn, NFC và NFD giữ đúng byte", () => {
  const nfc = "Đường về";
  const nfd = nfc.normalize("NFD");
  assert.notEqual(nfc, nfd);
  const a = applyCommand(FX, { type: "ChangeLyricText", path: P(3, 2), lyricIndex: 1, text: nfd });
  assert.equal(lyricsOf(a.xml, P(3, 2))[0].text, nfd);
  assert.ok(a.xml.includes(nfd), "NFD bị chuẩn hoá mất");
  const b = applyCommand(FX, { type: "ChangeLyricText", path: P(3, 2), lyricIndex: 1, text: nfc });
  assert.equal(lyricsOf(b.xml, P(3, 2))[0].text, nfc);
  // Ký tự phải thoát đúng, và đọc lại ra đúng chữ ban đầu.
  const hiem = 'Ta & em < 2 > 1 "một"';
  const c = applyCommand(FX, { type: "ChangeLyricText", path: P(3, 2), lyricIndex: 1, text: hiem });
  assert.equal(lyricsOf(c.xml, P(3, 2))[0].text, hiem);
  assert.ok(c.xml.includes("&amp;") && c.xml.includes("&lt;") && c.xml.includes("&gt;"));
});

test("sửa lời: lệnh bị từ chối nói rõ lý do, không sửa bừa", () => {
  assert.equal(
    code(() => applyCommand(FX, { type: "ChangeLyricText", path: P(1, 3), lyricIndex: 3, text: "x" })),
    "EDIT_LYRIC_NOT_FOUND"
  );
  assert.equal(
    code(() => applyCommand(FX, { type: "ChangeLyricText", path: P(1, 3), lyricIndex: 0, text: "x" })),
    "EDIT_LYRIC_NOT_FOUND"
  );
  assert.equal(
    code(() => applyCommand(FX, { type: "ChangeLyricText", path: P(2, 4), lyricIndex: 1, text: "x" })),
    "EDIT_LYRIC_NOT_FOUND"
  );
  assert.equal(
    code(() => applyCommand(FX, { type: "ChangeLyricText", path: P(1, 3), lyricIndex: 1, text: "  " })),
    "EDIT_LYRIC_EMPTY"
  );
  // Lệnh trùng giá trị cũ là lệnh rỗng, không vào ngăn xếp.
  assert.equal(
    applyCommand(FX, { type: "ChangeLyricText", path: P(1, 3), lyricIndex: 1, text: "Quê" }).changed,
    false
  );
});

// ── Sửa hợp âm ──────────────────────────────────────────────────────────────

test("đọc hợp âm: bậc gốc, loại, bậc trầm và ký hiệu ĐANG hiện", () => {
  assert.deepEqual(harmonyOf(FX, P(1, 2)).value, {
    root: { step: "C", alter: 0 },
    kind: "major",
    bass: null,
  });
  assert.equal(harmonyOf(FX, P(1, 2)).symbol, "C");
  assert.equal(harmonyOf(FX, P(2, 3)).symbol, "C7");
  assert.equal(harmonyOf(FX, P(3, 1)).symbol, "CMaj7");
  assert.equal(harmonyOf(FX, P(3, 3)).symbol, "C/E");
  // Nguồn ghi sẵn `text="m7b5"` thì bản nhạc vẽ theo nó — panel phải nói y thế.
  const f = harmonyOf(FX, P(3, 5));
  assert.equal(f.kindText, "m7b5");
  assert.equal(f.symbol, "F♯m7b5/A♭");
  assert.deepEqual(f.value, {
    root: { step: "F", alter: 1 },
    kind: "half-diminished",
    bass: { step: "A", alter: -1 },
  });
  assert.equal(readHarmonyFields(FX, P(1, 3)), null, "nốt không phải hợp âm");
  assert.equal(readNoteFields(FX, P(1, 2)), null, "hợp âm không phải nốt");
});

test("sửa hợp âm: đổi loại C → Cm → C7 → CMaj7, mỗi bước chỉ đụng <kind>", () => {
  let xml = FX;
  for (const kind of ["minor", "dominant", "major-seventh"]) {
    const r = applyCommand(xml, {
      type: "ChangeHarmony",
      path: P(1, 2),
      value: { root: { step: "C", alter: 0 }, kind, bass: null },
    });
    assert.equal(harmonyOf(r.xml, P(1, 2)).value.kind, kind);
    assert.deepEqual(r.touched, [`${P(1, 2)}/harmony`]);
    xml = r.xml;
  }
  assert.equal(harmonyOf(xml, P(1, 2)).symbol, "CMaj7");
  // Bậc gốc không hề bị viết lại khi chỉ đổi loại.
  assert.match(elementText(xml, P(1, 2)), /<root-step>C<\/root-step>/);
});

test("sửa hợp âm: bậc trầm — thêm, đổi, bỏ hẳn", () => {
  const them = applyCommand(FX, {
    type: "ChangeHarmony",
    path: P(1, 2),
    value: { root: { step: "C", alter: 0 }, kind: "major", bass: { step: "E", alter: 0 } },
  });
  assert.equal(harmonyOf(them.xml, P(1, 2)).symbol, "C/E");
  assert.match(elementText(them.xml, P(1, 2)), /<bass>[\s\S]*<bass-step>E<\/bass-step>[\s\S]*<\/bass>/);
  const doi = applyCommand(them.xml, {
    type: "ChangeHarmony",
    path: P(1, 2),
    value: { root: { step: "C", alter: 0 }, kind: "major", bass: { step: "G", alter: -1 } },
  });
  assert.equal(harmonyOf(doi.xml, P(1, 2)).symbol, "C/G♭");
  const bo = applyCommand(doi.xml, {
    type: "ChangeHarmony",
    path: P(1, 2),
    value: { root: { step: "C", alter: 0 }, kind: "major", bass: null },
  });
  assert.equal(harmonyOf(bo.xml, P(1, 2)).symbol, "C");
  assert.doesNotMatch(elementText(bo.xml, P(1, 2)), /<bass>/);
  // Bỏ rồi thêm lại phải về đúng dạng cũ, không để lại dòng trống hay thụt lề lạ.
  const lai = applyCommand(bo.xml, {
    type: "ChangeHarmony",
    path: P(1, 2),
    value: { root: { step: "C", alter: 0 }, kind: "major", bass: { step: "E", alter: 0 } },
  });
  assert.equal(lai.xml, them.xml);
});

test("sửa hợp âm: bậc gốc có dấu hoá — thêm, đổi, bỏ", () => {
  const path = P(3, 5);
  const bo = applyCommand(FX, {
    type: "ChangeHarmony",
    path,
    value: { root: { step: "F", alter: 0 }, kind: "half-diminished", bass: { step: "A", alter: 0 } },
  });
  // Loại KHÔNG đổi nên `text="m7b5"` của nguồn còn nguyên, và ký hiệu vẽ theo nó.
  assert.equal(harmonyOf(bo.xml, path).symbol, "Fm7b5/A");
  assert.doesNotMatch(elementText(bo.xml, path), /<root-alter>|<bass-alter>/);
  const lai = applyCommand(bo.xml, {
    type: "ChangeHarmony",
    path,
    value: { root: { step: "F", alter: 1 }, kind: "half-diminished", bass: { step: "A", alter: -1 } },
  });
  // Đổi loại mới bỏ `text`; ở đây loại giữ nguyên nên `text` cũ vẫn còn.
  assert.equal(harmonyOf(lai.xml, path).kindText, "m7b5");
  assert.equal(lai.xml, FX);
});

test("sửa hợp âm: đổi LOẠI thì bỏ text cũ, để ký hiệu không nói dối", () => {
  const path = P(3, 5);
  const r = applyCommand(FX, {
    type: "ChangeHarmony",
    path,
    value: { root: { step: "F", alter: 1 }, kind: "minor-seventh", bass: null },
  });
  const f = harmonyOf(r.xml, path);
  assert.equal(f.kindText, null, "text=\"m7b5\" cũ còn lại sẽ vẽ ra ký hiệu sai");
  assert.equal(f.symbol, "F♯m7");
  assert.doesNotMatch(elementText(r.xml, path), /text="m7b5"/);
  // Các thuộc tính khác của cùng thẻ không bị cuốn theo.
  const giu = applyCommand(read("./fixtures/harmony-multipart.musicxml"), {
    type: "ChangeHarmony",
    path: P(1, 4),
    value: { root: { step: "D", alter: 0 }, kind: "major", bass: null },
  });
  const kind = /<kind[^>]*>/.exec(elementText(giu.xml, P(1, 4)))![0];
  assert.equal(kind, '<kind use-symbols="no">', "bỏ text không được cuốn theo thuộc tính khác");
});

test("sửa hợp âm: lệnh bị từ chối nói rõ lý do", () => {
  const V = (v: Partial<HarmonyValue>): HarmonyValue => ({
    root: { step: "C", alter: 0 },
    kind: "major",
    bass: null,
    ...v,
  });
  assert.equal(
    code(() => applyCommand(FX, { type: "ChangeHarmony", path: P(1, 3), value: V({}) })),
    "EDIT_TARGET_NOT_HARMONY"
  );
  assert.equal(
    code(() => applyCommand(FX, { type: "ChangeHarmony", path: P(1, 2), value: V({ kind: "other" }) })),
    "EDIT_HARMONY_KIND_UNSUPPORTED"
  );
  assert.equal(
    code(() => applyCommand(FX, { type: "ChangeHarmony", path: P(1, 2), value: V({ kind: "khong-co" }) })),
    "EDIT_HARMONY_KIND_UNSUPPORTED"
  );
  assert.equal(
    code(() =>
      applyCommand(FX, {
        type: "ChangeHarmony",
        path: P(1, 2),
        value: V({ root: { step: "H" as never, alter: 0 } }),
      })
    ),
    "EDIT_HARMONY_ROOT_INVALID"
  );
  assert.equal(
    code(() =>
      applyCommand(FX, { type: "ChangeHarmony", path: P(1, 2), value: V({ root: { step: "C", alter: 5 } }) })
    ),
    "EDIT_HARMONY_ROOT_INVALID"
  );
  // Hợp âm ghi bằng bậc công năng: nói thẳng là chưa sửa được, không viết đè.
  const congNang = read("./fixtures/harmony-function.musicxml");
  assert.equal(
    code(() => applyCommand(congNang, { type: "ChangeHarmony", path: P(1, 2), value: V({}) })),
    "EDIT_HARMONY_NOT_ROOT_BASED"
  );
  assert.match(readHarmonyFields(congNang, P(1, 2))!.duong!, /công năng/);
  assert.equal(
    applyCommand(FX, { type: "ChangeHarmony", path: P(1, 2), value: V({}) }).changed,
    false,
    "lệnh trùng giá trị cũ phải là lệnh rỗng"
  );
});

// ── Bản khắc phải vẽ đúng thứ panel hứa ─────────────────────────────────────

test("bộ khắc vẽ ra đúng ký hiệu mà panel hứa, cho MỌI loại hợp âm được mời chọn", () => {
  // Bảng ký hiệu trong `harmonyModel` không do ta nghĩ ra mà đo từ bộ khắc. Phép
  // kiểm này là chỗ giữ cho nó đúng khi Verovio đổi phiên bản.
  for (const k of HARMONY_KINDS) {
    const xml = applyCommand(FX, {
      type: "ChangeHarmony",
      path: P(1, 2),
      value: { root: { step: "C", alter: 0 }, kind: k.id, bass: null },
    }).xml;
    const mong = harmonySymbol({ root: { step: "C", alter: 0 }, kind: k.id, bass: null });
    const mei = render(xml).originalMEI;
    const harm = /<harm[^>]*>([\s\S]*?)<\/harm>/.exec(mei)![1];
    assert.equal(harm, mong, `loại ${k.id}: bản nhạc vẽ “${harm}”, panel hứa “${mong}”`);
  }
});

test("bộ khắc vẽ đúng cả hợp âm có gạch chéo và dấu hoá", () => {
  const xml = applyCommand(FX, {
    type: "ChangeHarmony",
    path: P(1, 2),
    value: { root: { step: "F", alter: 1 }, kind: "minor-seventh", bass: { step: "A", alter: -1 } },
  }).xml;
  const mei = render(xml).originalMEI;
  assert.match(mei, /<harm[^>]*>F♯m7\/A♭<\/harm>/);
  assert.equal(harmonyOf(xml, P(1, 2)).symbol, "F♯m7/A♭");
});

test("sửa lời rồi khắc lại: chữ mới hiện ra, danh tính vẫn dùng được", () => {
  const xml = applyCommand(FX, {
    type: "ChangeLyricText",
    path: P(1, 3),
    lyricIndex: 2,
    text: "Nắng",
  }).xml;
  const score = render(xml);
  assert.match(score.originalMEI, /<syl[^>]*>Nắng<\/syl>/);
  const l = [...score.lyricIndex.values()].find((x) => x.text === "Nắng")!;
  const r = resolveScoreElement(sauNhat(svgElement(score, l.svgId)!), selectionIndex(score));
  assert.equal(r.kind === "lyric" && r.lyric.lyricIndex, 2);
});

// ── Phạm vi thay đổi trên XML ───────────────────────────────────────────────

/** Tài liệu khi BỎ đúng phần tử ấy đi phải giống hệt nhau giữa gốc và nháp. */
function assertScoped(truoc: string, sau: string, path: string) {
  const bo = (xml: string) => {
    const doc = parseStrict(xml);
    const el = resolveSourcePath(doc, path)!;
    el.parentNode!.removeChild(el);
    return doc.toString();
  };
  assert.equal(bo(sau), bo(truoc), `lệnh đụng ra ngoài ${path}`);
  const d = dongKhac(truoc, sau);
  assert.ok(d > 0 && d <= 8, `vùng dòng bị đổi rộng bất thường: ${d}`);
}
/** Bề rộng vùng dòng thật sự bị đổi (bỏ phần đầu và phần đuôi giống hệt nhau). */
const dongKhac = (a: string, b: string) => {
  const x = a.split("\n");
  const y = b.split("\n");
  let dau = 0;
  while (dau < x.length && dau < y.length && x[dau] === y[dau]) dau++;
  let duoi = 0;
  while (
    duoi < x.length - dau &&
    duoi < y.length - dau &&
    x[x.length - 1 - duoi] === y[y.length - 1 - duoi]
  )
    duoi++;
  return Math.max(x.length, y.length) - dau - duoi;
};

test("phạm vi: sửa lời chỉ đụng đúng vùng lời ấy; nốt, trường độ, hợp âm y nguyên", () => {
  const r = applyCommand(FX, { type: "ChangeLyricText", path: P(1, 3), lyricIndex: 2, text: "Nắng" });
  assertScoped(FX, r.xml, P(1, 3));
  // Mọi nốt và mọi hợp âm khác bằng nhau từng trường.
  const a = tagSourceIds(FX);
  const b = tagSourceIds(r.xml);
  assert.deepEqual(b.notes, a.notes);
  assert.deepEqual(b.harmonies, a.harmonies);
  assert.deepEqual(
    b.lyrics.filter((l) => l.svgId !== "tva-src-p1-m1-c3" && l.text !== "Nắng"),
    a.lyrics.filter((l) => l.text !== "Mưa")
  );
});

test("phạm vi: sửa hợp âm chỉ đụng đúng <harmony> ấy; nốt và lời y nguyên", () => {
  const r = applyCommand(FX, {
    type: "ChangeHarmony",
    path: P(3, 5),
    value: { root: { step: "B", alter: -1 }, kind: "minor-sixth", bass: { step: "D", alter: 0 } },
  });
  assertScoped(FX, r.xml, P(3, 5));
  const a = tagSourceIds(FX);
  const b = tagSourceIds(r.xml);
  assert.deepEqual(b.notes, a.notes);
  assert.deepEqual(b.lyrics, a.lyrics);
  assert.deepEqual(
    b.harmonies.filter((h) => h.path !== P(3, 5)),
    a.harmonies.filter((h) => h.path !== P(3, 5))
  );
});

test("phạm vi: giữ CRLF và thụt lề của file", () => {
  const crlf = FX.replace(/\n/g, "\r\n");
  const a = applyCommand(crlf, {
    type: "ChangeHarmony",
    path: P(1, 2),
    value: { root: { step: "C", alter: 0 }, kind: "major", bass: { step: "E", alter: 0 } },
  });
  assert.ok(!/[^\r]\n/.test(a.xml), "có dòng mất \\r");
  assert.equal(harmonyOf(a.xml, P(1, 2)).symbol, "C/E");
  const b = applyCommand(crlf, {
    type: "ChangeLyricText",
    path: P(1, 3),
    lyricIndex: 1,
    text: "Miền",
  });
  assert.ok(!/[^\r]\n/.test(b.xml), "có dòng mất \\r");
  // File viết liền một dòng: không có thụt lề để bắt chước, vẫn phải vá đúng.
  const motDong = FX.replace(/\n\s*/g, "");
  const c = applyCommand(motDong, {
    type: "ChangeHarmony",
    path: P(1, 2),
    value: { root: { step: "C", alter: 0 }, kind: "major", bass: { step: "E", alter: 0 } },
  });
  assert.equal(harmonyOf(c.xml, P(1, 2)).symbol, "C/E");
  assert.ok(!c.xml.includes("\n"));
});

// ── Cùng một ngăn xếp lệnh cho cả ba công cụ ────────────────────────────────

const NGAN_XEP: MusicXmlEditCommand[] = [
  { type: "ChangePitch", path: P(1, 3), pitch: { step: "E", alter: 0, octave: 4 }, accidental: "auto" },
  { type: "ChangeLyricText", path: P(1, 3), lyricIndex: 1, text: "Miền" },
  { type: "ChangeLyricText", path: P(1, 3), lyricIndex: 2, text: "Nắng" },
  { type: "ChangeHarmony", path: P(1, 2), value: { root: { step: "A", alter: 0 }, kind: "minor", bass: null } },
  { type: "ChangeDuration", path: P(1, 4), noteType: "half", dots: 0 },
];

test("hoàn tác / làm lại: nốt, lời và hợp âm dùng CHUNG một ngăn xếp", () => {
  let d = createDraft(FX);
  for (const c of NGAN_XEP) d = applyToDraft(d, c);
  assert.equal(d.commands.length, NGAN_XEP.length);
  const cuoi = d.xml;
  assert.equal(cuoi, rebuildDraft(FX, NGAN_XEP), "nháp phải bằng đúng dựng lại từ gốc");
  // Lùi hết rồi tiến hết: từng bước một phải trùng với bản dựng lại từ gốc.
  for (let i = NGAN_XEP.length; i > 0; i--) {
    d = undo(d);
    assert.equal(d.xml, rebuildDraft(FX, NGAN_XEP.slice(0, i - 1)), `hoàn tác bước ${i}`);
  }
  assert.equal(d.xml, FX);
  for (let i = 1; i <= NGAN_XEP.length; i++) {
    d = redo(d);
    assert.equal(d.xml, rebuildDraft(FX, NGAN_XEP.slice(0, i)), `làm lại bước ${i}`);
  }
  assert.equal(d.xml, cuoi);
  // Thứ tự khác nhau cho ra cùng một kết quả khi các lệnh chạm chỗ khác nhau.
  assert.equal(rebuildDraft(FX, [...NGAN_XEP].reverse()), cuoi);
});

test("ghi chú phiên bản tự sinh gọi tên cả ba loại việc", () => {
  assert.equal(
    describeCommands(NGAN_XEP),
    "Sửa cao độ 1 nốt · sửa trường độ 1 nốt · sửa lời 2 chỗ · sửa hợp âm 1 chỗ"
  );
  assert.equal(
    describeCommands([NGAN_XEP[1], NGAN_XEP[2]]),
    "Sửa lời 2 chỗ",
    "hai dòng lời trên CÙNG một nốt vẫn là hai chỗ"
  );
  assert.equal(describeCommands([NGAN_XEP[3]]), "Sửa hợp âm 1 chỗ");
});

// ── Cổng kiểm tra và lưu ────────────────────────────────────────────────────

test("cổng kiểm tra: sửa lời/hợp âm không bị chặn bởi lỗi nhịp vốn có của bài", async () => {
  const hong = read("./fixtures/lyric-harmony-broken-meter.musicxml");
  assert.ok(rhythmIssues(hong).size > 0, "fixture này phải vốn đã hỏng nhịp");
  const d = applyToDraft(createDraft(hong), {
    type: "ChangeLyricText",
    path: P(1, 3),
    lyricIndex: 1,
    text: "Mới",
  });
  assert.deepEqual(newRhythmIssues(hong, d.xml), [], "lỗi nhịp sẵn có không phải việc của lần sửa này");
  const report = await validateDraft(hong, d.xml, { render: (x) => render(x) });
  assert.equal(report.ok, true);
  assert.ok(
    report.stages.find((s) => s.id === "rhythm")!.messages.some((m) => m.includes("đã có sẵn")),
    "phải nói rõ lỗi cũ vẫn còn đó"
  );
});

test("cổng kiểm tra: hợp âm hỏng thì tầng cấu trúc bắt được", () => {
  const hong = FX.replace("<kind>major</kind>", "<kind>khong-co-loai-nay</kind>");
  assert.ok(structuralIssues(parseStrict(hong)).some((m) => m.includes("khong-co-loai-nay")));
  const thieu = FX.replace(/<root>[\s\S]*?<\/root>\s*<kind>major<\/kind>/, "<kind>major</kind>");
  assert.ok(structuralIssues(parseStrict(thieu)).some((m) => m.includes("bậc gốc")));
});

test("lưu: bản nháp lời + hợp âm thành phiên bản mới, kiểm tra xong mới ghi", async () => {
  let d = createDraft(FX);
  d = applyToDraft(d, { type: "ChangeLyricText", path: P(1, 3), lyricIndex: 2, text: "Nắng" });
  d = applyToDraft(d, {
    type: "ChangeHarmony",
    path: P(1, 2),
    value: { root: { step: "A", alter: 0 }, kind: "minor", bass: null },
  });
  const goi: SaveRequest[] = [];
  const library = {
    async save(req: SaveRequest): Promise<SaveResult> {
      goi.push(req);
      return { scoreId: "s1", versionId: "v2", versionNumber: 2, createdScore: false };
    },
  };
  const ok = await saveDraftAsVersion({
    library,
    scoreId: "s1",
    sourceFilename: "3c.musicxml",
    original: d.original,
    draft: d.xml,
    changeNote: describeCommands(d.commands),
    pageCount: 1,
    render: (x) => render(x),
  });
  assert.equal(ok.report.ok, true);
  assert.equal(ok.result!.versionNumber, 2);
  assert.equal(goi.length, 1);
  assert.equal(goi[0].changeType, "edit");
  assert.equal(goi[0].changeNote, "Sửa lời 1 chỗ · sửa hợp âm 1 chỗ");
  assert.equal(goi[0].xml, d.xml);
  assert.notEqual(goi[0].xml, FX, "bản gốc không được đem đi lưu");
  // Nháp hỏng thì KHÔNG ghi gì: cổng đóng trước, `save` không được gọi lần nào.
  const veto = await saveDraftAsVersion({
    library,
    scoreId: "s1",
    sourceFilename: "3c.musicxml",
    original: FX,
    draft: FX.replace("</lyric>", ""),
    changeNote: "hỏng",
    pageCount: 1,
    render: (x) => render(x),
  });
  assert.equal(veto.report.ok, false);
  assert.equal(veto.result, null);
  assert.equal(goi.length, 1, "kiểm tra không qua mà vẫn ghi");
});

test("lưu: bản gốc trong tay người gọi không đổi một byte sau cả phiên sửa", () => {
  const truoc = FX;
  let d = createDraft(FX);
  for (const c of NGAN_XEP) d = applyToDraft(d, c);
  d = undo(d);
  d = redo(d);
  assert.equal(d.original, truoc);
  assert.equal(FX, truoc);
});

// ── Luật mã nguồn (tự thử ngược) ────────────────────────────────────────────

const src = (p: string) => readFileSync(new URL(`../../src/${p}`, import.meta.url), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

test("kiến trúc: không đoán hợp âm từ nốt, không đọc tên hợp âm bằng chuỗi", () => {
  const model = stripComments(src("nhipphach/edit/harmonyModel.ts"));
  const fields = stripComments(src("nhipphach/edit/harmonyFields.ts"));
  const panel = stripComments(src("nhipphach/EditPanel.tsx"));
  for (const [ten, text] of [
    ["harmonyModel", model],
    ["harmonyFields", fields],
  ] as const) {
    assert.doesNotMatch(text, /parseChord|chordFromName|guess|đoán/i, `${ten} có bộ đoán tên hợp âm`);
    assert.doesNotMatch(text, /parseMusicXML|beatMap|pitchModel/, `${ten} suy ra hợp âm từ nốt`);
  }
  // Panel chỉ có ô CHỌN loại, không có ô gõ tên hợp âm.
  assert.match(panel, /aria-label="Loại hợp âm"/);
  assert.doesNotMatch(panel, /aria-label="Tên hợp âm"/);
  // Thử ngược: luật phải bắt được chính đột biến của nó.
  assert.match(model + "\nfunction parseChord() {}\n", /parseChord/);
});

test("kiến trúc: danh tính lời/hợp âm gắn ở MEI, không sửa MusicXML nguồn", () => {
  const identity = stripComments(src("musicxml-beats/renderer/meiIdentity.ts"));
  assert.doesNotMatch(identity, /nearest|closest|getBBox|\bx:\s|distance/i, "có dấu vết chọn theo hình học");
  // Bộ khắc phải gắn danh tính TRƯỚC khi khắc, và chỉ trên chuỗi MEI.
  const adapter = stripComments(src("musicxml-beats/renderer/verovioAdapter.ts"));
  assert.match(adapter, /applySourceIdentity\(toolkit\.getMEI\(\), tagged\)/);
  // `tagSourceIds` chỉ được ghi id vào `<note>`; lời và hợp âm chỉ được ĐỌC.
  const tags = stripComments(src("musicxml-beats/sourceTags.ts"));
  const setAttr = [...tags.matchAll(/\.setAttribute\((.*?)\)/g)].map((m) => m[1]);
  assert.deepEqual(setAttr, ['"id", svgId'], "sourceTags ghi vào nguồn nhiều hơn một chỗ");
});

test("chọn: không có toạ độ, và lời KHÔNG được nuốt mất cú bấm vào nốt", () => {
  const sel = stripComments(src("nhipphach/noteSelection.ts"));
  assert.doesNotMatch(sel, /getBBox|clientX|clientY|Math\.(abs|min|hypot)/, "chọn theo toạ độ");
  // Bấm vào chỗ trống ngoài khuông vẫn là bỏ chọn, không phải chọn đại.
  const score = render(FX);
  const trong = { getAttribute: () => null, nodeType: 1, parentNode: null };
  assert.equal(resolveScoreElement(trong, selectionIndex(score)).kind, "none");
  assert.equal(resolveScoreElement(null, selectionIndex(score)).kind, "none");
  // `g.harm` lạ (không phải id của ta) phải báo rõ, không leo lên chọn ô nhịp.
  const la = {
    getAttribute: (n: string) => (n === "class" ? "harm" : "la-hoac-khong-co"),
    nodeType: 1,
    parentNode: null,
  };
  const r = resolveScoreElement(la, selectionIndex(score));
  assert.equal(r.kind, "unresolved");
  assert.equal(r.kind === "unresolved" && r.what, "harmony");
});

test("kiến trúc: panel chỉ hiện công cụ của thứ đang chọn", () => {
  const panel = stripComments(src("nhipphach/EditPanel.tsx"));
  // Mỗi nhánh của ScoreTools trả về đúng một bộ công cụ; không có nhánh nào dựng
  // cả PitchEditor lẫn HarmonyEditor.
  const tools = panel.slice(panel.indexOf("function ScoreTools"), panel.indexOf("export function EditPanel"));
  assert.ok(tools.includes("<HarmonyEditor") && tools.includes("<LyricEditor") && tools.includes("<PitchEditor"));
  for (const nhanh of tools.split(/\n\s*(?:if \(selection\.kind|const \{ note, fields \})/)) {
    const co = ["<HarmonyEditor", "<LyricEditor", "<PitchEditor"].filter((t) => nhanh.includes(t));
    assert.ok(co.length <= 1, `một nhánh hiện cùng lúc ${co.join(" + ")}`);
  }
});

test("kiến trúc: cổng quyền score.edit vẫn khoá mọi cửa vào, kể cả cửa mới của 3C", () => {
  const page = stripComments(src("pages/MusicXmlBeatsPage.tsx"));
  assert.match(page, /const\s+choChonNot\s*=\s*nangCao\s*&&\s*can\(caps,\s*"score\.edit"\)/);
  // Hai cửa xử lý (không phải cửa vẽ) phải TỰ hỏi lại quyền trong thân hàm.
  for (const ten of ["onClickBanNhac", "apLenh", "luuNhap"]) {
    const i = page.indexOf(`function ${ten}`);
    assert.ok(i > 0, `không tìm thấy ${ten}`);
    const than = page.slice(i, i + 500);
    assert.match(than, /choChonNot/, `${ten} không tự hỏi lại quyền score.edit`);
  }
  // Không có quyền mới nào được lén thêm cho 3C.
  const caps = stripComments(src("nhipphach/capabilities.ts"));
  assert.doesNotMatch(caps, /score\.(lyric|harmony)/, "3C tạo thêm capability mới");
  assert.match(caps, /"score\.edit"/);
});

// ══ BA BẤT BIẾN KHOÁ TRƯỚC KHI ĐẨY LÊN ══════════════════════════════════════

/**
 * A — Danh tính của lời và hợp âm CHỈ sống ở bản khắc.
 *
 * MusicXML nguồn là thứ đi vào thư viện và thành phiên bản; nếu chọn được lời
 * hay hợp âm mà phải thêm id vào nguồn thì mỗi lần mở bài lại sinh ra một bản
 * khác, lịch sử phiên bản hết nghĩa. Nên: nguồn không đổi một byte, và chuỗi
 * đưa cho Verovio cũng KHÔNG mang id lời/hợp âm — chúng chỉ có ở MEI.
 */
test("bất biến A: khắc và chọn lời/hợp âm không đụng một byte nào của MusicXML nguồn", async () => {
  const truoc = read("./fixtures/lyric-harmony.musicxml");
  const sha = await sha256Hex(truoc);

  // Chuỗi đưa cho Verovio: có id NỐT (Verovio giữ được), KHÔNG có id lời/hợp âm.
  const tagged = tagSourceIds(truoc);
  assert.ok(tagged.xml.includes("tva-src-p1-m1-c3"), "id nốt phải có trong nguồn đưa đi khắc");
  assert.doesNotMatch(tagged.xml, /tva-lyr-|tva-harm-/, "id lời/hợp âm lọt vào MusicXML");
  assert.ok(tagged.lyrics.length && tagged.harmonies.length, "fixture phải có cả lời lẫn hợp âm");

  // Khắc rồi chọn mọi thứ chọn được, nhiều lượt.
  for (let i = 0; i < 3; i++) {
    const score = render(truoc);
    assert.match(score.originalMEI, /tva-lyr-/, "MEI phải mang danh tính lời");
    assert.match(score.originalMEI, /tva-harm-/, "MEI phải mang danh tính hợp âm");
    for (const svgId of [...score.lyricIndex.keys(), ...score.harmonyIndex.keys()])
      resolveScoreElement(sauNhat(svgElement(score, svgId)!), selectionIndex(score));
  }

  assert.equal(await sha256Hex(truoc), sha);
  assert.equal(read("./fixtures/lyric-harmony.musicxml"), truoc, "file nguồn trên đĩa đã đổi");
});

/**
 * B — Không heuristic.
 *
 * Danh tính đi từ ĐẾM và THỨ TỰ, không từ toạ độ, chữ giống nhau, cao độ hay
 * `tstamp`. Khi số phần tử nguồn và số phần tử bản khắc không khớp thì cả cụm
 * đó mất danh tính — chứ không phải "lệch một bậc rồi gán tiếp".
 */
const boIdCuaTa = (mei: string) => mei.replace(/\s+xml:id="tva-(?:lyr|harm)-[^"]*"/g, "");
/** Bỏ `xml:id` khỏi `<verse>`/`<harm>` — đúng hai chỗ danh tính được ghi đè. */
const boIdVerseHarm = (mei: string) =>
  mei.replace(/<(verse|harm)\b([^>]*)>/g, (_, ten, attrs) =>
    `<${ten}${attrs.replace(/\s+xml:id="[^"]*"/, "")}>`
  );

test("bất biến B: đếm không khớp thì KHÔNG gắn danh tính cho cả cụm ấy", () => {
  const score = render(FX);
  const meiGoc = boIdCuaTa(score.originalMEI);
  const tagged = tagSourceIds(FX);
  assert.doesNotMatch(meiGoc, /tva-(lyr|harm)-/);
  // Chưa hỏng gì: gắn đủ, không sót.
  const lanh = applySourceIdentity(meiGoc, tagged);
  assert.deepEqual(lanh.unresolved, []);

  // Bớt MỘT <verse> của nốt có hai dòng lời → CẢ HAI dòng của nốt ấy mất danh tính.
  const thieuVerse = meiGoc.replace(/\s*<verse\b[\s\S]*?<\/verse>/, "");
  const rV = applySourceIdentity(thieuVerse, tagged);
  const loiCuaNot = tagged.lyrics
    .filter((l) => l.noteSvgId === "tva-src-p1-m1-c3")
    .map((l) => l.svgId);
  assert.deepEqual(rV.unresolved.sort(), loiCuaNot.sort());
  assert.match(rV.diagnostics[0].message, /nguồn có 2 dòng lời, bản khắc vẽ 1/);
  for (const l of tagged.lyrics.filter((x) => !loiCuaNot.includes(x.svgId)))
    assert.ok(rV.mei.includes(l.svgId), `${l.svgId} (“${l.text}”) phải vẫn được gắn`);

  // Bớt MỘT <harm> của ô có ba hợp âm → cả ba hợp âm của ô ấy mất danh tính.
  const thieuHarm = meiGoc.replace(/\s*<harm\b[^>]*>CMaj7<\/harm>/, "");
  const rH = applySourceIdentity(thieuHarm, tagged);
  const hopAmO3 = tagged.harmonies.filter((h) => h.measureIndex === 3).map((h) => h.svgId);
  assert.deepEqual(rH.unresolved.sort(), hopAmO3.sort());
  assert.match(rH.diagnostics[0].message, /nguồn có 3 hợp âm, bản khắc vẽ 2/);
  for (const h of tagged.harmonies.filter((x) => x.measureIndex !== 3))
    assert.ok(rH.mei.includes(h.svgId), `${h.svgId} phải vẫn được gắn`);

  // Mất danh tính là KHÔNG chọn được: không có phần tử nào trong SVG mang id ấy.
  const hong = render(read("./fixtures/lyric-unresolvable.musicxml"));
  assert.ok(hong.unresolvedIdentity.size > 0);
  for (const svgId of hong.unresolvedIdentity) {
    assert.equal(svgElement(hong, svgId), null);
    assert.equal(hong.lyricIndex.has(svgId) || hong.harmonyIndex.has(svgId), true);
  }
  // Và chỗ bản khắc vẽ ra mà không lần được về nguồn thì báo thẳng, không leo lên chọn thứ khác.
  for (const cls of ["verse", "harm"]) {
    const r = resolveScoreElement(
      { getAttribute: (n: string) => (n === "class" ? cls : "id-la"), nodeType: 1, parentNode: null },
      selectionIndex(hong)
    );
    assert.equal(r.kind, "unresolved");
  }
});

test("bất biến B: mã nguồn không có đường nào đoán theo toạ độ, chữ, cao độ hay tstamp", () => {
  const CAM: { ten: string; mau: RegExp; dotBien: string }[] = [
    { ten: "toạ độ / gần nhất", mau: /nearest|closest|getBBox|clientX|clientY|Math\.hypot/i, dotBien: "const el = nearest(x, y);" },
    { ten: "so chữ để tìm phần tử", mau: /textContent\s*===|\.text\s*===\s*\w+\.text/, dotBien: "if (a.textContent === b.text) return a;" },
    { ten: "so cao độ để tìm phần tử", mau: /\bpname\b|\boct\b\s*===|pitch\s*===/, dotBien: "if (el.getAttribute('pname') === p) return el;" },
    { ten: "đoán theo tstamp", mau: /tstamp/i, dotBien: 'const t = el.getAttribute("tstamp");' },
  ];
  for (const file of ["musicxml-beats/renderer/meiIdentity.ts", "nhipphach/noteSelection.ts"]) {
    const text = stripComments(src(file));
    for (const luat of CAM) {
      assert.doesNotMatch(text, luat.mau, `${file}: ${luat.ten}`);
      // Thử ngược: luật phải bắt được chính đột biến của nó.
      assert.match(text + "\n" + luat.dotBien + "\n", luat.mau, `luật “${luat.ten}” không bắt được đột biến`);
    }
  }
});

/**
 * C — Gắn danh tính KHÔNG đổi bản khắc.
 *
 * Dựng lại ĐÚNG lượt khắc của sản phẩm (cùng `layoutOptions`, cùng lưới neo),
 * một lần với MEI thô của Verovio và một lần với MEI đã gắn danh tính, rồi đối
 * chiếu từng toạ độ. Hai bản chỉ khác nhau ở các thuộc tính `xml:id`.
 */
const GEO_FIXTURES: { ten: string; xml: string; settings: ScoreSettings }[] = [
  { ten: "lời + hợp âm 3C", xml: FX, settings: SETTINGS },
  { ten: "nhiều bè, part hai khuông", xml: read("./fixtures/harmony-multipart.musicxml"), settings: SETTINGS },
  { ten: "lời trên lặng cả ô", xml: read("./fixtures/lyric-unresolvable.musicxml"), settings: SETTINGS },
  {
    ten: "guitar + TAB",
    xml: read("../nhipphach-layout/fixtures/guitar-tab.musicxml"),
    settings: DEFAULT_SCORE_SETTINGS,
  },
  {
    ten: "lời + hợp âm (bản gốc bộ khắc)",
    xml: read("../musicxml-beats/fixtures/lyrics-harmony.musicxml"),
    settings: DEFAULT_SCORE_SETTINGS,
  },
];

/** Khắc đúng như sản phẩm, nhưng cho phép chọn có gắn danh tính hay không. */
function khac(tk: VerovioToolkit, xml: string, settings: ScoreSettings, gan: boolean) {
  tk.resetOptions();
  tk.setOptions(layoutOptions(settings));
  const tagged = tagSourceIds(xml);
  tk.resetXmlIdSeed(1);
  if (!tk.loadData(tagged.xml)) throw new Error("Verovio không đọc được bản nhạc.");
  const mei = gan ? applySourceIdentity(tk.getMEI(), tagged).mei : tk.getMEI();
  const lattice = applyAnchorLattice(mei, musicXMLToBeatMap(xml, settings.grouping), settings);
  tk.resetXmlIdSeed(1);
  if (!tk.loadData(lattice.mei)) throw new Error("Không khắc được bản đã đánh dấu phách.");
  const pages: { svg: string }[] = [];
  for (let n = 1; n <= tk.getPageCount(); n++) pages.push({ svg: tk.renderToSVG(n) });
  return pages;
}

test("bất biến C: gắn danh tính lời/hợp âm không đổi một toạ độ nào của bản khắc", async () => {
  const tk = new VerovioToolkit(await createVerovioModule());
  try {
    for (const f of GEO_FIXTURES) {
      const khong = scoreGeometry(khac(tk, f.xml, f.settings, false));
      const co = scoreGeometry(khac(tk, f.xml, f.settings, true));
      assert.equal(co.pageCount, khong.pageCount, `${f.ten}: số trang`);
      assert.equal(co.systemCount, khong.systemCount, `${f.ten}: số hệ`);
      co.pages.forEach((p, i) => {
        const g = khong.pages[i];
        const where = `${f.ten}, trang ${i + 1}`;
        assert.equal(p.systems, g.systems, `${where}: số hệ`);
        assert.deepEqual(p.notes, g.notes, `${where}: hoành độ nốt`);
        assert.deepEqual(p.barlines, g.barlines, `${where}: vạch nhịp`);
        assert.deepEqual(p.staffWidths, g.staffWidths, `${where}: bề rộng khuông`);
        assert.deepEqual(p.staffYs, g.staffYs, `${where}: tung độ khuông`);
        // id của <measure> do Verovio tự sinh nên khác nhau là bình thường —
        // thứ phải giống hệt là KHUNG của ô nhịp.
        assert.deepEqual(
          p.measures.map((m) => [m.x, m.width]),
          g.measures.map((m) => [m.x, m.width]),
          `${where}: khung ô nhịp`
        );
      });
      // Và hai bản MEI chỉ khác nhau đúng ở các thuộc tính xml:id của ta. So ở
      // dạng chuẩn (cùng bộ đọc, cùng bộ ghi): `<x/>` và `<x />` là một, cái ta
      // cần chứng minh là KHÔNG có nút hay thuộc tính nào khác bị thêm bớt.
      const tagged = tagSourceIds(f.xml);
      tk.resetOptions();
      tk.setOptions(layoutOptions(f.settings));
      tk.resetXmlIdSeed(1);
      tk.loadData(tagged.xml);
      const tho = tk.getMEI();
      // `<verse>`/`<harm>` là đúng hai chỗ danh tính GHI ĐÈ id sinh sẵn của
      // Verovio, nên bỏ id của cả hai bên rồi so; mọi nút, thuộc tính và chữ
      // khác — kể cả id của `<note>` và `<syl>` — phải giống hệt.
      const chuan = (mei: string) => serializeXml(parseXml(boIdVerseHarm(mei)));
      assert.equal(
        chuan(applySourceIdentity(tho, tagged).mei),
        chuan(tho),
        `${f.ten}: MEI đổi hơn là thay id của verse/harm`
      );
    }
  } finally {
    tk.destroy();
  }
});
