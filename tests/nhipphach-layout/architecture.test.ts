/**
 * KHOÁ KIẾN TRÚC BA TẦNG — test đọc thẳng mã nguồn.
 *
 *   Bản khắc nền cố định  →  Lưới neo theo temporal truth  →  Lớp phủ nhãn SVG
 *
 * Bất biến bố cục ở layout.test.ts chứng minh hôm nay đúng. Bộ này chặn ngày mai:
 * mỗi luật được thử ngược bằng một đột biến thật, nên một luật hỏng cũng lộ ra
 * ngay chứ không âm thầm cho qua.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";

const source = (file: string) =>
  readFileSync(
    new URL(`../../src/musicxml-beats/${file}`, import.meta.url),
    "utf8"
  );

interface Rule {
  /** Điều bị cấm, nói bằng tiếng người. */
  what: string;
  pattern: RegExp;
  /** Một dòng mã thật sự vi phạm — dùng để thử ngược chính luật này. */
  mutation: string;
}

/** Bỏ chú thích trước khi soi: một chữ trong lời giải thích không phải là vi phạm. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const breaks = (rule: Rule, text: string) => rule.pattern.test(code(text));

function enforce(file: string, rules: Rule[]) {
  const text = source(file);
  for (const rule of rules) {
    assert.equal(
      breaks(rule, text),
      false,
      `${file} vi phạm: ${rule.what}`
    );
    // Thử ngược: luật phải bắt được đúng thứ nó nói là cấm.
    assert.equal(
      breaks(rule, text + "\n" + rule.mutation + "\n"),
      true,
      `luật "${rule.what}" không bắt được đột biến của chính nó`
    );
  }
}

// ── Tầng 2: lưới neo không được biết thầy đang chọn mức đếm nào ───────────────
const LATTICE_RULES: Rule[] = [
  {
    what: "lưới neo đọc mức đếm đang chọn",
    pattern: /\bcountingLevel\b|\bCountingLevel\b/,
    mutation: `if (settings.countingLevel === "sixteenths") skip();`,
  },
  {
    what: "lưới neo viết thẳng tên một mức đếm",
    pattern: /["'](beats|eighths|sixteenths)["']/,
    mutation: `const only = ["sixteenths"];`,
  },
  {
    what: "lưới neo phụ thuộc công tắc hiện/ẩn nhãn",
    pattern: /\bshowBeats\b/,
    mutation: `if (!settings.showBeats) return;`,
  },
  {
    what: "lưới neo phụ thuộc màu nhãn",
    pattern: /\bcolor\b/,
    mutation: `dir.setAttribute("color", settings.color);`,
  },
  {
    what: "lưới neo phụ thuộc cỡ chữ nhãn",
    pattern: /\bsizePt\b/,
    mutation: `rend.setAttribute("fontsize", settings.sizePt + "pt");`,
  },
  {
    what: "neo mang chữ (chữ có bề rộng, bề rộng nới ô nhịp)",
    pattern: /createTextNode|\.label\b|\bfontsize\b/,
    mutation: `dir.appendChild(doc.createTextNode(a.label));`,
  },
];
test("lưới neo độc lập với mọi lựa chọn hiển thị", () =>
  enforce("renderer/anchorLattice.ts", LATTICE_RULES));

// ── Tầng 3: lớp phủ chỉ được vẽ chữ, tuyệt đối không khắc lại bản nhạc ────────
const OVERLAY_RULES: Rule[] = [
  {
    what: "lớp phủ gọi tới Verovio",
    pattern: /verovio|VerovioToolkit/i,
    mutation: `import { VerovioToolkit } from "verovio/esm";`,
  },
  {
    what: "lớp phủ cầm toolkit khắc nhạc",
    pattern: /\btoolkit\b|\bloadData\b|\brenderToSVG\b|\bgetMEI\b/,
    mutation: `const svg = toolkit.renderToSVG(1);`,
  },
  {
    what: "lớp phủ tự đọc MusicXML hoặc chạy Beat Engine",
    pattern: /musicXMLToBeatMap|parseMusicXML|createAnnotations|beatEngine/i,
    mutation: `const map = musicXMLToBeatMap(xml);`,
  },
  {
    what: "lớp phủ tự dựng lại lưới neo",
    pattern: /applyAnchorLattice|\bstampOf\b/,
    mutation: `const lattice = applyAnchorLattice(mei, map, settings);`,
  },
];
test("lớp phủ nhãn không khắc lại bản nhạc", () =>
  enforce("renderer/labelOverlay.ts", OVERLAY_RULES));

// ── Tầng 1: option khắc nhạc không được nhìn thấy mức đếm ─────────────────────
const ENGRAVING_RULES: Rule[] = [
  {
    what: "quay lại nới bản nhạc để lấy chỗ cho chữ",
    pattern: /spacingLinear|spacingNonLinear|measureMinWidth/,
    mutation: `spacingNonLinear: 0.6 + settings.sizePt * 0.015,`,
  },
  {
    what: "option khắc nhạc rẽ nhánh theo mật độ nhãn",
    pattern: /hasSubbeats|\bsubbeat\b/,
    mutation: `const hasSubbeats = annotations.some((a) => a.kind === "subbeat");`,
  },
  {
    what: "option khắc nhạc đọc mức đếm đang chọn",
    pattern: /\bcountingLevel\b/,
    mutation: `pageWidth: settings.countingLevel === "sixteenths" ? 2970 : 2100,`,
  },
];
test("bản khắc nền không phụ thuộc mức đếm", () =>
  enforce("renderer/verovioAdapter.ts", ENGRAVING_RULES));

// ── Khoá cache: đổi cách hiển thị không được làm mất bản khắc nền ─────────────
test("khoá cache bản khắc nền chỉ gồm thứ thật sự đổi bản nhạc", () => {
  const text = source("renderer/verovioAdapter.ts");
  const key = /const layoutKey = JSON\.stringify\(\{[\s\S]*?\}\);/.exec(
    code(text)
  )?.[0];
  assert.ok(key, "không tìm thấy khoá cache bản khắc nền");
  for (const forbidden of ["countingLevel", "color", "sizePt", "showBeats"])
    assert.equal(
      key!.includes(forbidden),
      false,
      `khoá cache chứa ${forbidden} — đổi cách hiển thị sẽ khắc lại bản nhạc`
    );
  for (const required of ["grouping", "orientation"])
    assert.ok(
      key!.includes(required),
      `khoá cache thiếu ${required} — thứ thật sự đổi bản khắc`
    );
});

// ── Đếm thật: đổi mức đếm không gọi Verovio lần nào ───────────────────────────
const fixture = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

test("đổi mức đếm, màu và cỡ chữ: khắc nhạc đúng MỘT lần", async () => {
  const renderer = await createAnnotatedScoreRenderer();
  const xml = fixture("./fixtures/guitar-tab.musicxml");
  const base = { ...DEFAULT_SCORE_SETTINGS };
  renderer.render(xml, base);
  assert.deepEqual(renderer.stats(), { engravings: 1, overlays: 1 });

  renderer.render(xml, { ...base, countingLevel: "beats" });
  renderer.render(xml, { ...base, countingLevel: "eighths" });
  renderer.render(xml, { ...base, countingLevel: "sixteenths" });
  renderer.render(xml, { ...base, showBeats: false });
  renderer.render(xml, { ...base, color: "#1d4ed8" });
  renderer.render(xml, { ...base, sizePt: 11 });
  assert.deepEqual(
    renderer.stats(),
    { engravings: 1, overlays: 7 },
    "chỉ lớp phủ được vẽ lại"
  );

  // Khổ giấy đổi thì bản nhạc thật sự khắc lại — và chỉ khi đó.
  renderer.render(xml, { ...base, orientation: "landscape" });
  assert.equal(renderer.stats().engravings, 2);
  renderer.destroy();
});

test("đổi cách chia nhịp lẻ mới khắc lại — vì nó đổi chính bản nhạc", async () => {
  const renderer = await createAnnotatedScoreRenderer();
  const xml = fixture("../musicxml-irregular/fixtures/five-plain.musicxml");
  renderer.render(xml, { ...DEFAULT_SCORE_SETTINGS });
  assert.equal(renderer.stats().engravings, 1);
  renderer.render(xml, {
    ...DEFAULT_SCORE_SETTINGS,
    grouping: { byMeter: { "5/8": [2, 3] } },
  });
  assert.equal(renderer.stats().engravings, 2);
  renderer.destroy();
});

test("bốn mức đếm dùng chung ĐÚNG MỘT bản MEI đã khắc", async () => {
  const renderer = await createAnnotatedScoreRenderer();
  const xml = fixture("./fixtures/guitar-tab.musicxml");
  const mei = (settings: Partial<typeof DEFAULT_SCORE_SETTINGS>) =>
    renderer.render(xml, { ...DEFAULT_SCORE_SETTINGS, ...settings })
      .renderedMEI;
  const base = mei({ showBeats: false });
  for (const level of ["beats", "eighths", "sixteenths"] as const)
    assert.equal(
      mei({ countingLevel: level }),
      base,
      `mức ${level} khắc ra một MEI khác`
    );
  renderer.destroy();
});
