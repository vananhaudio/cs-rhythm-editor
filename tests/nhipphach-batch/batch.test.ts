import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  runBatch,
  planOutputNames,
  makeItems,
  groupingRequests,
  batchProgress,
  baseName,
} from "../../src/nhipphach/batch.ts";
import type {
  BatchFile,
  BatchFormat,
  BatchItem,
  BatchProcessor,
} from "../../src/nhipphach/batch.ts";
import { SYSTEM_PRESETS, applyPreset } from "../../src/nhipphach/presets.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";
import type { AnnotatedScore, ScoreSettings } from "../../src/musicxml-beats/renderer/types.ts";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import { exportScoreSVG } from "../../src/musicxml-beats/renderer/svgExport.ts";

const fx = (dir: string, n: string) =>
  readFileSync(new URL(`../${dir}/fixtures/${n}.musicxml`, import.meta.url), "utf8");
const settings = (over: Partial<ScoreSettings> = {}): ScoreSettings => ({
  ...DEFAULT_SCORE_SETTINGS,
  ...over,
});

// ── Tên file xuất ra ────────────────────────────────────────────────────────────
test("giữ basename nguồn, không UUID", () => {
  assert.deepEqual(
    planOutputNames(["Happy-Birthday.musicxml", "bai-01.xml", "Bài Tủ.MUSICXML"], "pdf"),
    ["Happy-Birthday.pdf", "bai-01.pdf", "Bài Tủ.pdf"]
  );
  assert.equal(baseName("  .musicxml"), "ban-nhac");
});

test("trùng tên xử lý xác định: bai, bai-2, bai-3", () => {
  const names = ["bai.musicxml", "bai.xml", "bai.musicxml", "khac.xml"];
  const a = planOutputNames(names, "pdf");
  assert.deepEqual(a, ["bai.pdf", "bai-2.pdf", "bai-3.pdf", "khac.pdf"]);
  // chạy lại phải ra y hệt
  assert.deepEqual(planOutputNames(names, "pdf"), a);
  assert.deepEqual(planOutputNames(names, "svg"), [
    "bai.svg",
    "bai-2.svg",
    "bai-3.svg",
    "khac.svg",
  ]);
  // không có tên nào là UUID/ngẫu nhiên
  for (const n of a) assert.doesNotMatch(n, /[0-9a-f]{8}-[0-9a-f]{4}/i);
});

test("trùng tên không phân biệt hoa thường", () =>
  assert.deepEqual(planOutputNames(["Bai.xml", "bai.musicxml"], "pdf"), [
    "Bai.pdf",
    "bai-2.pdf",
  ]));

// ── Điều phối bằng processor giả (kiểm logic, không kiểm bản khắc) ──────────────
const fakeScore = (): AnnotatedScore =>
  ({ beatMap: { measures: [] }, notices: [], diagnostics: [] } as unknown as AnnotatedScore);
const fake = (opts: { failOn?: string[]; delay?: number } = {}): BatchProcessor & {
  seen: string[];
  live: number;
  peak: number;
} => {
  const p = {
    seen: [] as string[],
    live: 0,
    peak: 0,
    async render(xml: string) {
      p.live++;
      p.peak = Math.max(p.peak, p.live);
      p.seen.push(xml);
      if (opts.delay) await new Promise((r) => setTimeout(r, opts.delay));
      p.live--;
      if (opts.failOn?.includes(xml)) throw new Error(`XML lỗi: ${xml}`);
      return fakeScore();
    },
    async toBlob() {
      return new Blob([xmlOf(p.seen.length)], { type: "application/pdf" });
    },
  };
  return p;
};
const xmlOf = (i: number) => `noi-dung-${i}`;
const files = (n: number, name = (i: number) => `bai-${i + 1}.musicxml`): BatchFile[] =>
  Array.from({ length: n }, (_, i) => ({ name: name(i), xml: `xml-${i + 1}` }));

for (const n of [1, 10, 50])
  test(`batch ${n} file: đủ, đúng thứ tự, không sót`, async () => {
    const p = fake();
    const items = await runBatch(files(n), p, { settings: settings(), format: "pdf" });
    assert.equal(items.length, n);
    assert.deepEqual(
      items.map((i) => i.fileName),
      files(n).map((f) => f.name),
      "thứ tự giữ nguyên theo đầu vào"
    );
    assert.ok(items.every((i) => i.status === "done" && i.blob));
    assert.deepEqual(batchProgress(items), { xong: n, loi: 0, canChon: 0, tong: n });
    assert.equal(new Set(items.map((i) => i.outputName)).size, n, "tên không đụng nhau");
  });

test("chạy song song có giới hạn, không dựng cùng lúc hàng chục bản khắc", async () => {
  const p = fake({ delay: 5 });
  await runBatch(files(20), p, { settings: settings(), format: "pdf", concurrency: 3 });
  assert.ok(p.peak <= 3, `đỉnh đồng thời ${p.peak}`);
  const q = fake({ delay: 5 });
  await runBatch(files(20), q, { settings: settings(), format: "pdf", concurrency: 99 });
  assert.ok(q.peak <= 4, "trần cứng 4 dù xin nhiều hơn");
});

test("một file lỗi KHÔNG chặn các file khác", async () => {
  const p = fake({ failOn: ["xml-3"] });
  const items = await runBatch(files(5), p, { settings: settings(), format: "pdf" });
  assert.deepEqual(
    items.map((i) => i.status),
    ["done", "done", "error", "done", "done"]
  );
  assert.match(items[2].error!, /XML lỗi/);
  assert.equal(items[2].blob, undefined);
  assert.deepEqual(batchProgress(items), { xong: 4, loi: 1, canChon: 0, tong: 5 });
});

test("nhiều file lỗi vẫn không làm hỏng mẻ", async () => {
  const p = fake({ failOn: ["xml-1", "xml-4", "xml-7"] });
  const items = await runBatch(files(8), p, { settings: settings(), format: "pdf" });
  assert.equal(batchProgress(items).loi, 3);
  assert.equal(batchProgress(items).xong, 5);
});

test("huỷ giữa chừng: phần chưa chạy quay về hàng đợi", async () => {
  const signal = { aborted: false };
  const p = fake({ delay: 4 });
  const run = runBatch(files(20), p, {
    settings: settings(),
    format: "pdf",
    concurrency: 1,
    signal,
    onUpdate: (items) => {
      if (items.filter((i) => i.status === "done").length >= 3) signal.aborted = true;
    },
  });
  const items = await run;
  const done = items.filter((i) => i.status === "done").length;
  assert.ok(done >= 3 && done < 20, `dừng sớm ở ${done}/20`);
  assert.ok(items.some((i) => i.status === "queued"));
});

test("nhường lượt cho trình duyệt vẽ giữa các bài", async () => {
  // Không có nhịp nhường này thì cả vòng lặp chạy trong microtask, trình duyệt
  // không vẽ lần nào và thầy thấy bộ đếm đứng im tới lúc xong.
  const code = readFileSync(
    new URL("../../src/nhipphach/batch.ts", import.meta.url),
    "utf8"
  ).replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  assert.match(code, /setTimeout\(r, 0\)/, "phải nhường bằng macrotask");
  assert.equal((code.match(/await nhuongLuot\(\)/g) || []).length >= 2, true);
  // và thực sự có macrotask xen vào giữa các bài
  let macrotask = 0;
  const tick = () => {
    macrotask++;
    if (macrotask < 50) setTimeout(tick, 0);
  };
  setTimeout(tick, 0);
  await runBatch(files(6), fake(), {
    settings: settings(),
    format: "pdf",
    onUpdate: () => {},
  });
  assert.ok(macrotask >= 6, `trình duyệt có ${macrotask} nhịp xen giữa 6 bài`);
});

test("onUpdate báo tiến độ và trả bản sao, không lộ mảng gốc", async () => {
  const mocs: number[] = [];
  let snapshot: readonly BatchItem[] | null = null;
  const items = await runBatch(files(4), fake(), {
    settings: settings(),
    format: "pdf",
    onUpdate: (it) => {
      mocs.push(it.filter((i) => i.status === "done").length);
      snapshot ??= it;
    },
  });
  assert.equal(mocs.at(-1), 4);
  assert.ok(mocs.length >= 4);
  assert.equal(snapshot![0].status, "queued", "ảnh chụp cũ không bị sửa về sau");
  assert.equal(items[0].status, "done");
});

// ── Preset áp cho TẤT CẢ các file ───────────────────────────────────────────────
test("preset áp cho mọi file, không sót file nào", async () => {
  const dung: ScoreSettings[] = [];
  const p: BatchProcessor = {
    async render(_xml, s) {
      dung.push(s);
      return fakeScore();
    },
    async toBlob() {
      return new Blob(["x"]);
    },
  };
  for (const preset of SYSTEM_PRESETS) {
    dung.length = 0;
    const s = applyPreset(preset, settings());
    await runBatch(files(6), p, { settings: s, format: "pdf" });
    assert.equal(dung.length, 6);
    for (const used of dung) {
      assert.equal(used.countingLevel, preset.countingLevel, preset.name);
      assert.equal(used.color, preset.color);
      assert.equal(used.sizePt, preset.sizePt);
      assert.equal(used.distance, preset.distance);
      assert.equal(used.orientation, preset.orientation);
    }
  }
});

// ── Nhịp lẻ: KHÔNG tự đoán ──────────────────────────────────────────────────────
const renderer = await createAnnotatedScoreRenderer();
after(() => renderer.destroy());
const real: BatchProcessor = {
  async render(xml, s) {
    return renderer.render(xml, s);
  },
  async toBlob(score) {
    return new Blob([exportScoreSVG(score)], { type: "image/svg+xml" });
  },
};

for (const [meter, name, options] of [
  ["5/8", "five-plain", 2],
  ["7/8", "seven-plain", 3],
] as const)
  test(`${meter} chưa khai cách chia + đếm phách lớn → cần chọn, KHÔNG đoán`, async () => {
    const s = settings({ compoundCountingMode: "compound" });
    const items = await runBatch(
      [{ name: `${name}.musicxml`, xml: fx("musicxml-irregular", name) }],
      real,
      { settings: s, format: "svg" }
    );
    assert.equal(items[0].status, "needs-grouping");
    assert.equal(items[0].blob, undefined, "không xuất ra file sai");
    assert.deepEqual(items[0].needs!.map((n) => n.meter), [meter]);
    assert.equal(items[0].needs![0].options.length, options);
  });

test("chọn cách chia cho riêng một file rồi chạy lại thì xong", async () => {
  const s = settings({ compoundCountingMode: "compound" });
  const list = [
    { name: "seven-plain.musicxml", xml: fx("musicxml-irregular", "seven-plain") },
    { name: "whole-note.musicxml", xml: fx("musicxml-subdivision", "whole-note") },
  ];
  const lan1 = await runBatch(list, real, { settings: s, format: "svg" });
  assert.deepEqual(lan1.map((i) => i.status), ["needs-grouping", "done"]);
  const lan2 = await runBatch(list, real, {
    settings: s,
    format: "svg",
    groupingByItem: { "item-1": { byMeter: { "7/8": [3, 2, 2] } } },
  });
  assert.deepEqual(lan2.map((i) => i.status), ["done", "done"]);
  assert.ok(lan2[0].blob);
  // và cách chia đó chỉ áp cho file 1, không rò sang file khác
  const svg = await lan2[0].blob!.text();
  assert.equal((svg.match(/id="tva-beat-/g) || []).length, 3, "3 phách lớn của 3+2+2");
});

test("ở chế độ phách nhỏ, nhịp lẻ chưa khai cách chia vẫn xuất được đầy đủ", async () => {
  const items = await runBatch(
    [
      { name: "seven.musicxml", xml: fx("musicxml-irregular", "seven-plain") },
      { name: "five.musicxml", xml: fx("musicxml-irregular", "five-plain") },
    ],
    real,
    { settings: settings({ compoundCountingMode: "pulses" }), format: "svg" }
  );
  assert.deepEqual(items.map((i) => i.status), ["done", "done"]);
  assert.equal((await items[0].blob!.text()).match(/id="tva-beat-/g)!.length, 7);
  assert.equal((await items[1].blob!.text()).match(/id="tva-beat-/g)!.length, 5);
});

test("groupingRequests chỉ hỏi khi cách đếm thật sự cần", () => {
  const score = renderer.render(fx("musicxml-irregular", "seven-plain"), settings());
  assert.deepEqual(groupingRequests(score, settings({ compoundCountingMode: "pulses" })), []);
  const hoi = groupingRequests(score, settings({ compoundCountingMode: "compound" }));
  assert.deepEqual(hoi.map((h) => h.meter), ["7/8"]);
  assert.deepEqual(hoi[0].options, [[2, 2, 3], [2, 3, 2], [3, 2, 2]]);
  // nhịp kép/đơn không bao giờ bị hỏi
  const kep = renderer.render(fx("musicxml-generalized", "basic-12-8"), settings());
  assert.deepEqual(groupingRequests(kep, settings({ compoundCountingMode: "compound" })), []);
});

// ── XML thật hỏng ───────────────────────────────────────────────────────────────
test("XML hỏng thật thì báo lỗi file đó, các file khác vẫn xong", async () => {
  const items = await runBatch(
    [
      { name: "tot.musicxml", xml: fx("musicxml-subdivision", "whole-note") },
      { name: "hong.musicxml", xml: "<không phải musicxml>" },
      { name: "rong.musicxml", xml: "" },
      { name: "tot-2.musicxml", xml: fx("musicxml-subdivision", "lyrics-harmony") },
    ],
    real,
    { settings: settings(), format: "svg" }
  );
  assert.deepEqual(items.map((i) => i.status), ["done", "error", "error", "done"]);
  assert.deepEqual(items.map((i) => i.outputName), [
    "tot.svg",
    "hong.svg",
    "rong.svg",
    "tot-2.svg",
  ]);
});

test("lời và hợp âm giữ nguyên qua batch", async () => {
  const items = await runBatch(
    [{ name: "lyrics-harmony.musicxml", xml: fx("musicxml-subdivision", "lyrics-harmony") }],
    real,
    { settings: applyPreset(SYSTEM_PRESETS[1], settings()), format: "svg" }
  );
  const svg = await items[0].blob!.text();
  assert.ok(svg.includes("Thầy Văn Anh") && svg.includes("Âm nhạc"));
  assert.equal((svg.match(/id="tva-beat-/g) || []).length, 8, "preset móc đơn → 8 nhãn");
});

// ── ZIP ─────────────────────────────────────────────────────────────────────────
test("ZIP đúng số file, đúng tên, bỏ file lỗi và file cần chọn", async () => {
  const { zipBatch } = await import("../../src/nhipphach/batchZip.ts");
  const { unzipSync } = await import("fflate");
  const items = await runBatch(
    [
      { name: "bai.musicxml", xml: fx("musicxml-subdivision", "whole-note") },
      { name: "bai.xml", xml: fx("musicxml-subdivision", "lyrics-harmony") },
      { name: "hong.xml", xml: "<hỏng>" },
      { name: "bay-tam.xml", xml: fx("musicxml-irregular", "seven-plain") },
    ],
    real,
    { settings: settings({ compoundCountingMode: "compound" }), format: "svg" }
  );
  assert.deepEqual(items.map((i) => i.status), [
    "done",
    "done",
    "error",
    "needs-grouping",
  ]);
  const zip = await zipBatch(items);
  const entries = Object.keys(unzipSync(new Uint8Array(await zip.blob.arrayBuffer())));
  assert.deepEqual(entries.sort(), ["bai-2.svg", "bai.svg"]);
  assert.equal(zip.count, 2);
  assert.equal(zip.name, "Tai-lieu-nhip-phach.zip");
});

test("chưa có bài nào xong thì không đóng gói ZIP rỗng", async () => {
  const { zipBatch } = await import("../../src/nhipphach/batchZip.ts");
  const items = await runBatch([{ name: "hong.xml", xml: "<hỏng>" }], real, {
    settings: settings(),
    format: "svg",
  });
  await assert.rejects(() => zipBatch(items), /Chưa có bài nào/);
});

test("ZIP không nối thành một file khổng lồ — mỗi bài một entry", async () => {
  const { zipBatch } = await import("../../src/nhipphach/batchZip.ts");
  const { unzipSync } = await import("fflate");
  const list = Array.from({ length: 6 }, (_, i) => ({
    name: `bai-${i + 1}.musicxml`,
    xml: fx("musicxml-subdivision", "whole-note"),
  }));
  const items = await runBatch(list, real, { settings: settings(), format: "svg" });
  const zip = await zipBatch(items);
  const entries = Object.keys(unzipSync(new Uint8Array(await zip.blob.arrayBuffer())));
  assert.equal(entries.length, 6);
  assert.deepEqual(entries.sort(), list.map((f, i) => `bai-${i + 1}.svg`).sort());
});

// ── Không đụng chế độ một-file ──────────────────────────────────────────────────
test("batch chỉ GỌI LẠI pipeline một-file, không có engine thứ hai", () => {
  const code = readFileSync(
    new URL("../../src/nhipphach/batch.ts", import.meta.url),
    "utf8"
  ).replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  for (const forbidden of [
    /parseMusicXML/,
    /musicXMLToBeatMap/,
    /createAnnotations/,
    /VerovioToolkit|createVerovioModule/,
    /jsPDF|svg2pdf/,
    /groupStartsOf|resolveGrouping|isValidPartition/,
  ])
    assert.equal(forbidden.test(code), false, String(forbidden));
  assert.equal(makeItems([{ name: "a.xml", xml: "" }], "pdf")[0].outputName, "a.pdf");
});
