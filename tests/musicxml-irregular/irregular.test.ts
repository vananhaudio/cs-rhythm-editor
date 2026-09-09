import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { musicXMLToBeatMap } from "../../src/musicxml-beats/beatMap.ts";
import { parseMusicXML } from "../../src/musicxml-beats/parser.ts";
import { createAnnotations } from "../../src/musicxml-beats/annotations.ts";
import type { CompoundCountingMode } from "../../src/musicxml-beats/annotations.ts";
import {
  allowedPartitions,
  isValidPartition,
  isIrregularMeter,
  resolveGrouping,
  groupStartsOf,
  partitionCode,
  SUPPORTED_IRREGULAR,
} from "../../src/musicxml-beats/meterGrouping.ts";
import type { GroupingSelection } from "../../src/musicxml-beats/meterGrouping.ts";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";
import { all, parse } from "../../src/musicxml-beats/renderer/xml.ts";

const fixture = (n: string) =>
  readFileSync(new URL(`./fixtures/${n}.musicxml`, import.meta.url), "utf8");
const src = (p: string) =>
  readFileSync(new URL(`../../src/musicxml-beats/${p}`, import.meta.url), "utf8");
const E = JSON.parse(
  readFileSync(new URL("./expected/grids.json", import.meta.url), "utf8")
);
const modes: CompoundCountingMode[] = ["pulses", "compound"];
const grid = (
  xml: string,
  mode: CompoundCountingMode,
  selection?: GroupingSelection
) => {
  const map = musicXMLToBeatMap(xml, selection);
  return map.measures.map((m) =>
    createAnnotations(map, "beats", mode)
      .filter((a) => a.sourceMeasureId === m.measureId)
      .map((a) => [a.label, a.offset])
  );
};

// ── 1. Mô hình grouping: bất biến trước, registry sau ────────────────────────────
test("registry liệt kê đúng nhịp lẻ đã bật", () =>
  assert.deepEqual([...SUPPORTED_IRREGULAR], ["5/8", "7/8"]));

test("A. tổng nhóm phải đúng bằng số phách", () => {
  const five = { beats: 5, beatType: 8 };
  const seven = { beats: 7, beatType: 8 };
  assert.equal(isValidPartition(five, [2, 2]), false, "2+2 không phải 5/8");
  assert.equal(isValidPartition(five, [2, 4]), false);
  assert.equal(isValidPartition(seven, [2, 3, 3]), false, "2+3+3 không phải 7/8");
  assert.equal(isValidPartition(five, [2, 3]), true);
  assert.equal(isValidPartition(seven, [3, 2, 2]), true);
});

test("B. nhóm phải dương và nguyên", () => {
  const five = { beats: 5, beatType: 8 };
  for (const g of [[0, 5], [5, 0], [-2, 7], [2.5, 2.5], []])
    assert.equal(isValidPartition(five, g as number[]), false, String(g));
});

test("cách chia ngoài phạm vi Giai đoạn 8 không được nhận", () => {
  // Tổng đúng nhưng chưa mở: kiến trúc sẵn sàng, phạm vi thì chưa.
  assert.equal(isValidPartition({ beats: 5, beatType: 8 }, [1, 4]), false);
  assert.equal(isValidPartition({ beats: 7, beatType: 8 }, [3, 4]), false);
  assert.equal(isValidPartition({ beats: 7, beatType: 8 }, [1, 2, 2, 2]), false);
  assert.deepEqual(allowedPartitions({ beats: 5, beatType: 8 }), [[2, 3], [3, 2]]);
  assert.deepEqual(allowedPartitions({ beats: 7, beatType: 8 }), [
    [2, 2, 3],
    [2, 3, 2],
    [3, 2, 2],
  ]);
  assert.equal(allowedPartitions({ beats: 6, beatType: 8 }), null);
  assert.equal(isIrregularMeter({ beats: 5, beatType: 4 }), false);
});

test("mốc phách lớn sinh từ cộng dồn nhóm, không chia đều", () => {
  const u = "1/2" as const;
  assert.deepEqual(groupStartsOf([2, 3], u), ["0/1", "1/1"]);
  assert.deepEqual(groupStartsOf([3, 2], u), ["0/1", "3/2"]);
  assert.deepEqual(groupStartsOf([2, 2, 3], u), ["0/1", "1/1", "2/1"]);
  assert.deepEqual(groupStartsOf([2, 3, 2], u), ["0/1", "1/1", "5/2"]);
  assert.deepEqual(groupStartsOf([3, 2, 2], u), ["0/1", "3/2", "5/2"]);
});

// ── 2. Nguồn grouping và thứ tự ưu tiên ─────────────────────────────────────────
const meta = (xml: string, selection?: GroupingSelection) =>
  musicXMLToBeatMap(xml, selection).measures.map((m) => ({
    groups: m.groups ?? null,
    groupingSource: m.groupingSource,
    notices: (m.notices ?? []).map((n) => n.code),
  }));

test("cách chia ghi rõ trong MusicXML được dùng, nguồn là musicxml", () => {
  assert.deepEqual(meta(fixture("five-2-3"))[0], {
    groups: [2, 3],
    groupingSource: "musicxml",
    notices: [],
  });
  assert.deepEqual(meta(fixture("seven-3-2-2"))[0], {
    groups: [3, 2, 2],
    groupingSource: "musicxml",
    notices: [],
  });
});

test("người dùng chọn mặc định theo mã nhịp, nguồn là user", () =>
  assert.deepEqual(meta(fixture("five-plain"), { byMeter: { "5/8": [3, 2] } })[0], {
    groups: [3, 2],
    groupingSource: "user",
    notices: [],
  }));

test("đè theo từng ô nhịp thắng cả MusicXML, và ghi rõ là user", () => {
  const map = musicXMLToBeatMap(fixture("five-2-3"));
  const id = map.measures[0].measureId;
  assert.deepEqual(meta(fixture("five-2-3"), { byMeasure: { [id]: [3, 2] } })[0], {
    groups: [3, 2],
    groupingSource: "user",
    notices: [],
  });
});

test("cách chia người dùng đưa vào mà không hợp lệ thì bị bỏ, không im lặng", () => {
  const m = meta(fixture("five-plain"), { byMeter: { "5/8": [2, 2] } })[0];
  assert.equal(m.groups, null);
  assert.equal(m.groupingSource, "unresolved");
  assert.deepEqual(m.notices, ["INVALID_GROUPING", "IRREGULAR_GROUPING_REQUIRED"]);
});

test("resolveGrouping thuần: ba nguồn, không có đường thứ tư", () => {
  const five = { beats: 5, beatType: 8 };
  assert.equal(resolveGrouping(five, "m1").source, "unresolved");
  assert.equal(
    resolveGrouping({ ...five, additive: [2, 3] }, "m1").source,
    "musicxml"
  );
  assert.equal(
    resolveGrouping(five, "m1", { byMeter: { "5/8": [2, 3] } }).source,
    "user"
  );
  // additive không hợp lệ trong nguồn cũng không được dùng
  assert.equal(
    resolveGrouping({ ...five, additive: [2, 2] }, "m1").source,
    "unresolved"
  );
});

// ── 3. Chưa chọn cách chia: phách nhỏ vẫn chạy, phách lớn KHÔNG hiện bừa ─────────
for (const [name, meter] of [
  ["five-plain", "5/8"],
  ["seven-plain", "7/8"],
] as const)
  test(`${name}: unresolved — phách nhỏ chạy, phách lớn trống, ô không bị coi là lỗi`, () => {
    const map = musicXMLToBeatMap(fixture(name));
    const m = map.measures[0];
    assert.deepEqual(m.diagnostics, [], "KHÔNG được coi cả ô là lỗi");
    assert.equal(m.groupingSource, "unresolved");
    assert.equal(m.groups, null);
    assert.deepEqual(
      (m.notices ?? []).map((n) => n.code),
      ["IRREGULAR_GROUPING_REQUIRED"]
    );
    assert.match(m.notices![0].message, /requires an explicit grouping/);
    assert.deepEqual(grid(fixture(name), "pulses")[0], E.pulse[meter]);
    assert.deepEqual(grid(fixture(name), "compound")[0], []);
    assert.deepEqual(m.beatsMap, [], "không có phách lớn cấu trúc khi chưa biết cách chia");
  });

// ── 4. 5/8: 2+3 khác 3+2 · 7/8: ba cách chia khác nhau ──────────────────────────
const cases: [string, string, string][] = [
  ["five-2-3", "5/8", "2+3"],
  ["five-3-2", "5/8", "3+2"],
  ["seven-2-2-3", "7/8", "2+2+3"],
  ["seven-2-3-2", "7/8", "2+3+2"],
  ["seven-3-2-2", "7/8", "3+2+2"],
];
for (const [name, meter, part] of cases) {
  test(`${name}/pulses: lưới viết tay`, () =>
    assert.deepEqual(grid(fixture(name), "pulses")[0], E.pulse[meter]));
  test(`${name}/compound: phách lớn ${part}`, () =>
    assert.deepEqual(grid(fixture(name), "compound")[0], E.large[part]));
}

test("cùng 5/8, hai cách chia cho phách lớn KHÁC nhau", () =>
  assert.notDeepEqual(
    grid(fixture("five-2-3"), "compound")[0],
    grid(fixture("five-3-2"), "compound")[0]
  ));

test("ba cách chia của 7/8 đôi một khác nhau", () => {
  const g = ["seven-2-2-3", "seven-2-3-2", "seven-3-2-2"].map(
    (n) => JSON.stringify(grid(fixture(n), "compound")[0])
  );
  assert.equal(new Set(g).size, 3);
});

// ── 5. Độc lập với nốt, bè, beam, divisions ─────────────────────────────────────
test("E/F. note và voice không đổi lưới phách lớn", () => {
  for (const n of [
    "five-2-3",
    "five-2-3-whole-rest",
    "five-2-3-sustained",
    "five-2-3-syncopation",
    "five-2-3-two-voices",
    "five-2-3-tuplet",
    "five-2-3-lyrics",
  ]) {
    assert.deepEqual(grid(fixture(n), "compound")[0], E.large["2+3"], n);
    assert.deepEqual(grid(fixture(n), "pulses")[0], E.pulse["5/8"], n);
  }
});

test("G. beam không thể quyết cách chia — engine không hề nhìn thấy beam", () => {
  // Mạnh hơn một phép thử hành vi: mô hình chuẩn hoá KHÔNG có trường beam nào,
  // nên không có đường nào để beam ảnh hưởng tới cách chia.
  const code = (f: string) =>
    src(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ""); // bỏ chú thích, chỉ soi mã thật
  for (const f of ["model.ts", "meterGrouping.ts", "beatEngine.ts", "annotations.ts"])
    assert.equal(/\bbeam\b/i.test(code(f)), false, `${f} nhắc tới beam`);
  const events = parseMusicXML(fixture("five-2-3-beam-a")).parts[0].measures[0].events;
  assert.ok(events.length > 0);
  for (const e of events)
    assert.equal("beam" in e, false, "sự kiện đã chuẩn hoá không mang thông tin beam");
});

test("G. beam không đổi lưới phách lớn", () =>
  assert.deepEqual(
    grid(fixture("five-2-3-beam-a"), "compound")[0],
    grid(fixture("five-2-3-beam-b"), "compound")[0]
  ));

test("G. beam TRÔNG như 2+3 nhưng nguồn không khai báo thì vẫn unresolved", () => {
  const m = musicXMLToBeatMap(fixture("five-beam-looks-2-3")).measures[0];
  assert.equal(m.groupingSource, "unresolved");
  assert.equal(m.groups, null);
  assert.deepEqual(
    (m.notices ?? []).map((n) => n.code),
    ["IRREGULAR_GROUPING_REQUIRED"]
  );
  assert.deepEqual(grid(fixture("five-beam-looks-2-3"), "compound")[0], []);
  // ...nhưng nếu người dùng chọn thì vẫn dùng được ngay
  assert.deepEqual(
    grid(fixture("five-beam-looks-2-3"), "compound", { byMeter: { "5/8": [2, 3] } })[0],
    E.large["2+3"]
  );
});

test("D. divisions 1/4/24/480 cho cùng offsets", () => {
  for (const [name, meter, part] of cases)
    for (const d of [1, 4, 24, 480]) {
      const xml = fixture(name)
        .replace("<divisions>12</divisions>", `<divisions>${d}</divisions>`)
        .replaceAll("<duration>6</duration>", `<duration>${d / 2}</duration>`);
      assert.deepEqual(grid(xml, "pulses")[0], E.pulse[meter], `${name}/${d}`);
      assert.deepEqual(grid(xml, "compound")[0], E.large[part], `${name}/${d}`);
    }
});

// ── 6. Pickup: chứng minh cách chia ĐỔI vị trí phách lớn ────────────────────────
for (const [name, key, part] of [
  ["pickup-five-1-plain", "pickup5_1", "plain"],
  ["pickup-five-1-2-3", "pickup5_1", "2+3"],
  ["pickup-five-1-3-2", "pickup5_1", "3+2"],
  ["pickup-five-2-plain", "pickup5_2", "plain"],
  ["pickup-five-2-2-3", "pickup5_2", "2+3"],
  ["pickup-five-2-3-2", "pickup5_2", "3+2"],
] as const)
  for (const mode of modes)
    test(`${name}/${mode}: giữ phase của ô đầy đủ`, () => {
      const map = musicXMLToBeatMap(fixture(name));
      assert.equal(map.measures[0].pickupOffset, name.includes("-1-") ? "2/1" : "3/2");
      const full =
        part === "plain" && mode === "compound" ? [] : mode === "pulses" ? E.pulse["5/8"] : E.large[part];
      assert.deepEqual(grid(fixture(name), mode), [E[key][part][mode], full]);
    });

test("QUYẾT ĐỊNH: pickup 2 móc đơn — 3+2 có phách lớn tại 3/2, 2+3 thì không", () => {
  // 3/2 đúng là mốc nhóm của 3+2 nên phách lớn 2 phải hiện ngay đầu ô lấy đà.
  assert.deepEqual(grid(fixture("pickup-five-2-3-2"), "compound")[0], [["2", "0/1"]]);
  // Với 2+3 thì 3/2 không phải mốc nhóm nào → không được bịa ra phách mới.
  assert.deepEqual(grid(fixture("pickup-five-2-2-3"), "compound")[0], []);
});

for (const [name, part] of [
  ["pickup-seven-plain", "plain"],
  ["pickup-seven-2-2-3", "2+2+3"],
  ["pickup-seven-2-3-2", "2+3+2"],
  ["pickup-seven-3-2-2", "3+2+2"],
] as const)
  for (const mode of modes)
    test(`${name}/${mode}: pickup 7/8 giữ phase`, () => {
      const map = musicXMLToBeatMap(fixture(name));
      assert.equal(map.measures[0].pickupOffset, "3/2");
      const full =
        part === "plain" && mode === "compound" ? [] : mode === "pulses" ? E.pulse["7/8"] : E.large[part];
      assert.deepEqual(grid(fixture(name), mode), [E.pickup7_4[part][mode], full]);
    });

test("pickup 7/8 phân biệt được cả BA cách chia", () => {
  const g = ["pickup-seven-2-2-3", "pickup-seven-2-3-2", "pickup-seven-3-2-2"].map(
    (n) => JSON.stringify(grid(fixture(n), "compound")[0])
  );
  assert.equal(new Set(g).size, 3, "ba cách chia phải cho ba kết quả khác nhau");
});

// ── 7. Đổi cách chia giữa hai ô liền nhau + đổi nhịp hỗn hợp ────────────────────
test("hai ô 7/8 liền nhau, mỗi ô một cách chia, không rò state", () => {
  assert.deepEqual(grid(fixture("grouping-change"), "compound"), [
    E.large["2+2+3"],
    E.large["3+2+2"],
  ]);
  assert.deepEqual(meta(fixture("grouping-change")).map((m) => m.groups), [
    [2, 2, 3],
    [3, 2, 2],
  ]);
  assert.deepEqual(grid(fixture("grouping-change"), "pulses"), [
    E.pulse["7/8"],
    E.pulse["7/8"],
  ]);
});

test("đổi nhịp hỗn hợp: mỗi ô dùng đúng meter và cách chia của chính nó", () => {
  assert.deepEqual(grid(fixture("mixed-meter"), "compound"), [
    E["simple-four"],
    E.large["2+3"],
    E["compound-6-large"],
    E.large["2+2+3"],
    E["simple-three"],
    E.large["3+2"],
    E["compound-12-large"],
    E.large["3+2+2"],
  ]);
  assert.deepEqual(grid(fixture("mixed-meter"), "pulses"), [
    E["simple-four"],
    E.pulse["5/8"],
    E["compound-6"],
    E.pulse["7/8"],
    E["simple-three"],
    E.pulse["5/8"],
    E["compound-12"],
    E.pulse["7/8"],
  ]);
});

// ── 8. Stress: 100 ô 7/8 luân phiên ba cách chia ────────────────────────────────
test("C. stress 100 ô 7/8: không drift, không carry cách chia của ô trước", () => {
  const map = musicXMLToBeatMap(fixture("stress-seven"));
  assert.equal(map.measures.length, 100);
  assert.deepEqual(map.measures.flatMap((m) => m.diagnostics), []);
  assert.deepEqual(map.measures.flatMap((m) => m.notices ?? []), []);
  const cyc = ["2+2+3", "2+3+2", "3+2+2"];
  map.measures.forEach((m, i) =>
    assert.equal(partitionCode(m.groups!), cyc[i % 3], `ô ${i + 1}`)
  );
  const pulses = createAnnotations(map, "beats", "pulses");
  const large = createAnnotations(map, "beats", "compound");
  assert.equal(pulses.length, 700);
  assert.equal(large.length, 300);
  assert.equal(new Set(large.map((a) => a.id)).size, 300);
  const g = grid(fixture("stress-seven"), "compound");
  for (let i = 0; i < 100; i++)
    assert.deepEqual(g[i], E.large[cyc[i % 3]], `ô ${i + 1} lệch`);
});

// ── 9. Renderer không chứa logic nhịp lẻ ────────────────────────────────────────
test("renderer chỉ nhận annotation cuối cùng, không tự giải cách chia", () => {
  for (const f of [
    "renderer/temporalAnnotations.ts",
    "renderer/verovioAdapter.ts",
    "renderer/svgExport.ts",
  ]) {
    const text = src(f);
    for (const forbidden of [
      /allowedPartitions|isValidPartition|resolveGrouping|groupStartsOf/,
      /\badditive\b/,
      /\b(5|7)\s*\/\s*8\b/,
      /beats\s*===?\s*(5|7)\b/,
    ])
      assert.equal(forbidden.test(text), false, `${f} ~ ${forbidden}`);
  }
});

// ── 10. Renderer: tstamp, notices, parity ───────────────────────────────────────
const renderer = await createAnnotatedScoreRenderer();
after(() => renderer.destroy());

test("tstamp MEI theo mẫu số của chính ô nhịp", () => {
  for (const [name, part] of [
    ["five-2-3", "2+3"],
    ["five-3-2", "3+2"],
    ["seven-2-3-2", "2+3+2"],
  ] as const) {
    const s = renderer.render(fixture(name), {
      ...DEFAULT_SCORE_SETTINGS,
      compoundCountingMode: "compound",
    });
    assert.deepEqual(s.diagnostics, []);
    // tstamp = 1 + offset / (4/beatType); offset lấy từ expected viết tay.
    assert.deepEqual(
      s.anchors.map((a) => a.timestamp),
      E.large[part].map(([, off]: [string, string]) => {
        const [n, d] = off.split("/").map(Number);
        return String(1 + (n / d) * 2);
      })
    );
  }
});

test("chưa chọn cách chia: bản nhạc vẫn khắc, notice báo rõ, không có nhãn phách lớn", () => {
  const s = renderer.render(fixture("five-plain"), {
    ...DEFAULT_SCORE_SETTINGS,
    compoundCountingMode: "compound",
  });
  assert.deepEqual(s.diagnostics, []);
  assert.deepEqual(s.notices.map((n) => n.code), ["IRREGULAR_GROUPING_REQUIRED"]);
  assert.equal(s.anchors.length, 0);
  assert.ok(s.pages.length >= 1, "vẫn khắc được bản nhạc");
  const pulse = renderer.render(fixture("five-plain"), DEFAULT_SCORE_SETTINGS);
  assert.equal(pulse.anchors.length, 5, "phách nhỏ vẫn dùng được bình thường");
});

test("người dùng chọn cách chia thì renderer đổi theo, cache không giữ bản cũ", () => {
  const a = renderer.render(fixture("five-plain"), {
    ...DEFAULT_SCORE_SETTINGS,
    compoundCountingMode: "compound",
    grouping: { byMeter: { "5/8": [2, 3] } },
  });
  const b = renderer.render(fixture("five-plain"), {
    ...DEFAULT_SCORE_SETTINGS,
    compoundCountingMode: "compound",
    grouping: { byMeter: { "5/8": [3, 2] } },
  });
  assert.deepEqual(a.anchors.map((x) => x.timestamp), ["1", "3"]);
  assert.deepEqual(b.anchors.map((x) => x.timestamp), ["1", "4"]);
  assert.deepEqual(a.notices, []);
  assert.deepEqual(b.notices, []);
});

for (const name of ["five-2-3-lyrics", "seven-2-2-3-lyrics"])
  for (const mode of modes)
    test(`${name}/${mode}: không đụng notation, lời và hợp âm`, () => {
      const s = renderer.render(fixture(name), {
        ...DEFAULT_SCORE_SETTINGS,
        compoundCountingMode: mode,
      });
      assert.deepEqual(s.diagnostics, []);
      const off = renderer.render(fixture(name), {
        ...DEFAULT_SCORE_SETTINGS,
        showBeats: false,
      });
      for (const tag of ["note", "syl", "harm", "verse"])
        assert.deepEqual(
          all(parse(s.renderedMEI), tag).map((e) => e.toString()),
          all(parse(off.renderedMEI), tag).map((e) => e.toString())
        );
    });

test("lặng cả ô: lưới đúng, và Verovio khắc được khi nhịp ghi thường", () => {
  // Bản thân lưới không phụ thuộc nốt — kể cả ô chỉ có một dấu lặng.
  for (const [name, meter, part, groups] of [
    ["five-plain-whole-rest", "5/8", "2+3", [2, 3]],
    ["seven-plain-whole-rest", "7/8", "3+2+2", [3, 2, 2]],
  ] as const) {
    const sel = { byMeter: { [meter]: groups } };
    assert.deepEqual(grid(fixture(name), "pulses", sel)[0], E.pulse[meter]);
    assert.deepEqual(grid(fixture(name), "compound", sel)[0], E.large[part]);
    const s = renderer.render(fixture(name), {
      ...DEFAULT_SCORE_SETTINGS,
      grouping: sel,
    });
    assert.deepEqual(s.diagnostics, [], name);
    assert.equal(s.anchors.length, meter === "5/8" ? 5 : 7, name);
  }
});

test("GIỚI HẠN VEROVIO: ô chỉ có lặng-cả-ô + nhịp ghi dạng cộng thì ẩn nhãn, có báo", () => {
  // Verovio không giải được tstamp trong ô mRest khi @meter.count viết dạng cộng
  // ("2+3"). Đây là giới hạn của bộ khắc, không phải của beat-map: lưới vẫn đúng.
  // Chốt an toàn sẵn có ẨN nhãn và báo lỗi, thay vì đặt nhãn sai chỗ.
  const map = musicXMLToBeatMap(fixture("five-2-3-whole-rest"));
  assert.deepEqual(map.measures[0].groups, [2, 3]);
  assert.deepEqual(grid(fixture("five-2-3-whole-rest"), "pulses")[0], E.pulse["5/8"]);
  assert.deepEqual(grid(fixture("five-2-3-whole-rest"), "compound")[0], E.large["2+3"]);
  const s = renderer.render(fixture("five-2-3-whole-rest"), DEFAULT_SCORE_SETTINGS);
  assert.equal(s.anchors.length, 0, "nhãn bị ẩn");
  assert.ok(
    s.diagnostics.every((d) => d.code === "ANNOTATION_DENSITY_COLLISION"),
    "và nói rõ vì sao"
  );
  // Cùng ô đó, nhịp ghi thường + người dùng chọn cách chia thì khắc được bình thường.
  const ok = renderer.render(fixture("five-plain-whole-rest"), {
    ...DEFAULT_SCORE_SETTINGS,
    grouping: { byMeter: { "5/8": [2, 3] } },
  });
  assert.equal(ok.anchors.length, 5);
  assert.deepEqual(ok.diagnostics, []);
});

test("H. neo phách lớn nằm đúng nốt móc đơn Verovio khắc ra", () => {
  for (const [name, part] of [
    ["five-2-3", "2+3"],
    ["five-3-2", "3+2"],
    ["seven-3-2-2", "3+2+2"],
  ] as const) {
    const s = renderer.render(fixture(name), {
      ...DEFAULT_SCORE_SETTINGS,
      compoundCountingMode: "compound",
    });
    const doc = parse(s.pages[0].svg);
    const heads = all(doc, "g")
      .filter((g) => g.getAttribute("class") === "notehead")
      .map((g) =>
        Number(
          all(g, "use")[0].getAttribute("transform")!.match(/translate\(([-\d.]+)/)![1]
        )
      );
    const want = E.large[part].map(([, off]: [string, string]) => {
      const [n, d] = off.split("/").map(Number);
      return heads[(n / d) * 2]; // móc đơn thứ mấy
    });
    const got = s.anchors.map((a) =>
      Number(
        all(all(doc, "g").find((g) => g.getAttribute("id") === a.id)!, "text")[0].getAttribute("x")
      )
    );
    assert.deepEqual(got, want, name);
  }
});
