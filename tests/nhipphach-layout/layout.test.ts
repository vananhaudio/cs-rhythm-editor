/**
 * BẤT BIẾN BỐ CỤC — phép kiểm quan trọng nhất của công cụ.
 *
 * Cùng một MusicXML, bốn mức đếm (Không hiện · Phách · Chia đôi · Chia tư) phải cho
 * ĐÚNG MỘT bản khắc: cùng số trang, cùng số hệ, cùng hoành độ từng nốt, từng vạch
 * nhịp, cùng bề rộng từng ô. Số lượng nhãn được phép khác — bố cục thì không.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";
import type { ScoreSettings } from "../../src/musicxml-beats/renderer/types.ts";
import type { GroupingSelection } from "../../src/musicxml-beats/meterGrouping.ts";
import { scoreGeometry } from "./geometry.ts";

const renderer = await createAnnotatedScoreRenderer();
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const SUB = "../musicxml-subdivision/fixtures/";
const COMPOUND = "../musicxml-compound/fixtures/";
const IRREGULAR = "../musicxml-irregular/fixtures/";

const FIXTURES: {
  name: string;
  xml: string;
  grouping?: GroupingSelection;
}[] = [
  { name: "nốt tròn 4/4", xml: read(SUB + "whole-note.musicxml") },
  { name: "lặng cả ô", xml: read(SUB + "whole-measure-rest.musicxml") },
  { name: "đảo phách", xml: read(SUB + "syncopation.musicxml") },
  { name: "nốt chấm dôi", xml: read(SUB + "dotted.musicxml") },
  { name: "dấu nối", xml: read(SUB + "tie-across-beat.musicxml") },
  { name: "chùm ba", xml: read(SUB + "triplet.musicxml") },
  { name: "lấy đà", xml: read(SUB + "pickup-quarter.musicxml") },
  { name: "lời + hợp âm", xml: read(SUB + "lyrics-harmony.musicxml") },
  { name: "nhịp kép 6/8", xml: read(COMPOUND + "simple-6-8.musicxml") },
  {
    name: "nhịp lẻ 5/8",
    xml: read(IRREGULAR + "five-plain.musicxml"),
    grouping: { byMeter: { "5/8": [2, 3] } },
  },
  {
    name: "nhịp lẻ 7/8",
    xml: read(IRREGULAR + "seven-plain.musicxml"),
    grouping: { byMeter: { "7/8": [2, 2, 3] } },
  },
  { name: "guitar + TAB", xml: read("./fixtures/guitar-tab.musicxml") },
];

const MODES: { name: string; settings: Partial<ScoreSettings> }[] = [
  { name: "none", settings: { showBeats: false } },
  { name: "beats", settings: { countingLevel: "beats" } },
  { name: "eighths", settings: { countingLevel: "eighths" } },
  { name: "sixteenths", settings: { countingLevel: "sixteenths" } },
];

for (const fixture of FIXTURES)
  test(`bố cục không đổi theo mức đếm: ${fixture.name}`, () => {
    const rendered = MODES.map((mode) => ({
      mode: mode.name,
      score: renderer.render(fixture.xml, {
        ...DEFAULT_SCORE_SETTINGS,
        grouping: fixture.grouping,
        ...mode.settings,
      }),
    }));
    const geometries = rendered.map((r) => ({
      mode: r.mode,
      geometry: scoreGeometry(r.score.pages),
    }));
    const base = geometries[0];
    for (const other of geometries.slice(1)) {
      const where = `${fixture.name}: ${other.mode} khác ${base.mode}`;
      assert.equal(
        other.geometry.pageCount,
        base.geometry.pageCount,
        `${where} — số trang`
      );
      assert.equal(
        other.geometry.systemCount,
        base.geometry.systemCount,
        `${where} — số hệ`
      );
      base.geometry.pages.forEach((page, index) => {
        const compared = other.geometry.pages[index];
        assert.deepEqual(
          compared.notes.map((n) => n.x),
          page.notes.map((n) => n.x),
          `${where} — hoành độ nốt, trang ${index + 1}`
        );
        assert.deepEqual(
          compared.barlines,
          page.barlines,
          `${where} — hoành độ vạch nhịp, trang ${index + 1}`
        );
        assert.deepEqual(
          compared.measures,
          page.measures,
          `${where} — khung ô nhịp, trang ${index + 1}`
        );
        assert.deepEqual(
          compared.staffWidths,
          page.staffWidths,
          `${where} — bề rộng khuông, trang ${index + 1}`
        );
        assert.deepEqual(
          compared.staffYs,
          page.staffYs,
          `${where} — tung độ khuông (khoảng cách khuông nhạc ↔ TAB), trang ${
            index + 1
          }`
        );
      });
    }
  });

test("nhãn vẫn được gắn — bất biến không phải nhờ bỏ hết nhãn", () => {
  const counts = MODES.slice(1).map(
    (mode) =>
      renderer.render(read(SUB + "whole-note.musicxml"), {
        ...DEFAULT_SCORE_SETTINGS,
        ...mode.settings,
      }).anchors.length
  );
  assert.deepEqual(counts, [4, 8, 16]);
});

test("neo rỗng không sót lại trong SVG đã xuất", () => {
  for (const mode of MODES) {
    const score = renderer.render(read("./fixtures/guitar-tab.musicxml"), {
      ...DEFAULT_SCORE_SETTINGS,
      ...mode.settings,
    });
    for (const page of score.pages)
      assert.ok(
        !page.svg.includes("tva-anchor-"),
        `${mode.name}: còn neo rỗng trong SVG`
      );
  }
});

test("cỡ chữ tự thu nhỏ thay vì kéo giãn bản nhạc", () => {
  const xml = read(SUB + "whole-note.musicxml");
  const dense = renderer.render(xml, {
    ...DEFAULT_SCORE_SETTINGS,
    countingLevel: "sixteenths",
  });
  const sparse = renderer.render(xml, {
    ...DEFAULT_SCORE_SETTINGS,
    countingLevel: "beats",
  });
  const size = (svg: string) =>
    Number(
      /<g id="tva-beat-[^"]*"[\s\S]{0,300}?<text[^>]*font-size="([\d.]+)px"/.exec(
        svg
      )?.[1]
    );
  assert.ok(
    size(dense.pages[0].svg) < size(sparse.pages[0].svg),
    "Chia tư phải dùng cỡ chữ nhỏ hơn Phách"
  );
  assert.ok(
    dense.notices.some((n) => n.code === "ANNOTATION_FONT_REDUCED"),
    "và nói rõ đã giảm cỡ chữ"
  );
  assert.deepEqual(
    scoreGeometry(dense.pages).pages[0].notes.map((n) => n.x),
    scoreGeometry(sparse.pages).pages[0].notes.map((n) => n.x),
    "nhưng nốt không xê dịch"
  );
});

test.after(() => renderer.destroy());
