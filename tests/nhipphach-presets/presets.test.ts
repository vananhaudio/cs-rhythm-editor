import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SYSTEM_PRESETS,
  PRESET_SCHEMA_VERSION,
  MAX_PRESET_NAME,
  applyPreset,
  isSystemPreset,
  migratePreset,
  presetFromSettings,
} from "../../src/nhipphach/presets.ts";
import type { NhipPhachPreset } from "../../src/nhipphach/presets.ts";
import { LocalPresetRepository } from "../../src/nhipphach/presetRepository.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";
import type { ScoreSettings } from "../../src/musicxml-beats/renderer/types.ts";
import { musicXMLToBeatMap } from "../../src/musicxml-beats/beatMap.ts";
import { createAnnotations } from "../../src/musicxml-beats/annotations.ts";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";
import { all, parse } from "../../src/musicxml-beats/renderer/xml.ts";

/** localStorage giả, đủ dùng và có thể ép lỗi. */
class FakeStorage {
  map = new Map<string, string>();
  failWrite = false;
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrite) throw new Error("QuotaExceededError");
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}
const repo = () => {
  const s = new FakeStorage();
  return { s, r: new LocalPresetRepository(s as unknown as Storage) };
};
const fixture = (dir: string, n: string) =>
  readFileSync(
    new URL(`../${dir}/fixtures/${n}.musicxml`, import.meta.url),
    "utf8"
  );

// ── Preset hệ thống ─────────────────────────────────────────────────────────────
test("có đủ 4 preset hệ thống, id ổn định", () => {
  assert.deepEqual(
    SYSTEM_PRESETS.map((p) => p.id),
    ["sys-phach-co-ban", "sys-moc-don", "sys-moc-kep", "sys-tai-lieu-hoc-sinh"]
  );
  assert.deepEqual(
    SYSTEM_PRESETS.map((p) => p.name),
    ["Phách cơ bản", "Chia móc đơn", "Chia móc kép", "Tài liệu học sinh"]
  );
  assert.deepEqual(
    SYSTEM_PRESETS.map((p) => p.countingLevel),
    ["beats", "eighths", "sixteenths", "beats"]
  );
  assert.ok(SYSTEM_PRESETS.every((p) => p.system && p.pageSize === "A4"));
});

test("“Tài liệu học sinh” dùng ĐÚNG cấu hình đã nghiệm thu, không nghĩ lại", () => {
  const p = SYSTEM_PRESETS.find((x) => x.id === "sys-tai-lieu-hoc-sinh")!;
  assert.equal(p.color, DEFAULT_SCORE_SETTINGS.color);
  assert.equal(p.sizePt, DEFAULT_SCORE_SETTINGS.sizePt);
  assert.equal(p.distance, DEFAULT_SCORE_SETTINGS.distance);
  assert.equal(p.orientation, "portrait");
  assert.equal(p.exportFormat, "pdf");
});

test("preset KHÔNG mang cách chia nhịp lẻ — chặn từ kiểu dữ liệu lẫn mã nguồn", () => {
  for (const p of SYSTEM_PRESETS) {
    assert.equal("grouping" in p, false);
    assert.equal("byMeter" in p, false);
  }
  const code = readFileSync(
    new URL("../../src/nhipphach/presets.ts", import.meta.url),
    "utf8"
  ).replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  for (const forbidden of [/byMeter/, /byMeasure/, /\[\s*2\s*,\s*3\s*\]/, /2\+3/])
    assert.equal(forbidden.test(code), false, String(forbidden));
});

test("không xoá / không đổi tên / không ghi đè preset hệ thống", async () => {
  const { r } = repo();
  for (const id of SYSTEM_PRESETS.map((p) => p.id)) {
    assert.equal(isSystemPreset(id), true);
    await assert.rejects(() => r.remove(id), /hệ thống/);
    await assert.rejects(() => r.rename(id, "Tên khác"), /hệ thống/);
    await assert.rejects(
      () => r.save({ ...SYSTEM_PRESETS[0], id, name: "Hack" }),
      /hệ thống/
    );
  }
  const store = await r.load();
  assert.deepEqual(
    store.presets.filter((p) => p.system).map((p) => p.name),
    SYSTEM_PRESETS.map((p) => p.name)
  );
});

// ── Preset cá nhân ──────────────────────────────────────────────────────────────
const custom = (name = "Của tôi"): NhipPhachPreset =>
  presetFromSettings(name, {
    ...DEFAULT_SCORE_SETTINGS,
    countingLevel: "eighths",
    color: "#1d4ed8",
    sizePt: 9,
    distance: 5,
    orientation: "landscape",
  });

test("lưu rồi đọc lại giữ nguyên mọi trường", async () => {
  const { r } = repo();
  const p = custom();
  await r.save(p);
  const back = (await r.load()).presets.find((x) => x.id === p.id)!;
  assert.deepEqual(back, { ...p, system: false });
  assert.equal(back.schemaVersion, PRESET_SCHEMA_VERSION);
});

test("đổi tên không đổi id, nên mặc định không bị mất", async () => {
  const { r } = repo();
  const p = custom();
  await r.save(p);
  await r.setDefault(p.id);
  await r.rename(p.id, "Tên mới");
  const store = await r.load();
  assert.equal(store.presets.find((x) => x.id === p.id)!.name, "Tên mới");
  assert.equal(store.defaultId, p.id, "mặc định vẫn trỏ đúng preset");
  await assert.rejects(() => r.rename(p.id, "   "), /trống/);
});

test("tên bị cắt theo giới hạn", async () => {
  const { r } = repo();
  const p = presetFromSettings("x".repeat(200), DEFAULT_SCORE_SETTINGS);
  assert.equal(p.name.length, MAX_PRESET_NAME);
  await r.save(p);
  await r.rename(p.id, "y".repeat(200));
  assert.equal(
    (await r.load()).presets.find((x) => x.id === p.id)!.name.length,
    MAX_PRESET_NAME
  );
});

test("nhân bản preset hệ thống thành preset cá nhân sửa được", async () => {
  const { r } = repo();
  const copy = await r.duplicate("sys-tai-lieu-hoc-sinh");
  assert.equal(copy.system, false);
  assert.notEqual(copy.id, "sys-tai-lieu-hoc-sinh");
  assert.match(copy.name, /Tài liệu học sinh/);
  assert.equal(copy.color, DEFAULT_SCORE_SETTINGS.color);
  await r.rename(copy.id, "Bản của tôi");
  await r.remove(copy.id);
  assert.equal((await r.load()).presets.some((p) => p.id === copy.id), false);
});

test("xoá preset đang là mặc định thì bỏ luôn mặc định", async () => {
  const { r } = repo();
  const p = custom();
  await r.save(p);
  await r.setDefault(p.id);
  await r.remove(p.id);
  assert.equal((await r.load()).defaultId, null);
});

test("đặt mặc định cho preset không tồn tại thì báo lỗi", async () => {
  const { r } = repo();
  await assert.rejects(() => r.setDefault("khong-co"), /Không tìm thấy/);
});

test("mặc định còn nguyên sau khi tải lại trang (repo mới trên cùng storage)", async () => {
  const { s, r } = repo();
  const p = custom("Giáo án A4 ngang");
  await r.save(p);
  await r.setDefault(p.id);
  const sau = await new LocalPresetRepository(s as unknown as Storage).load();
  assert.equal(sau.defaultId, p.id);
  assert.equal(sau.presets.find((x) => x.id === p.id)!.name, "Giáo án A4 ngang");
});

// ── Hỏng dữ liệu và lỗi lưu ─────────────────────────────────────────────────────
test("preset hỏng không làm sập, chỉ bỏ qua và báo nhẹ", async () => {
  for (const bad of [
    "{{{ không phải JSON",
    JSON.stringify({ presets: "không phải mảng" }),
    JSON.stringify({ presets: [null, 5, { name: "thiếu id" }, { id: "x" }] }),
  ]) {
    const s = new FakeStorage();
    s.setItem("nhipphach-presets-v1", bad);
    const store = await new LocalPresetRepository(s as unknown as Storage).load();
    assert.equal(store.recovered, true, bad.slice(0, 20));
    assert.deepEqual(
      store.presets.map((p) => p.id),
      SYSTEM_PRESETS.map((p) => p.id),
      "vẫn còn đủ preset hệ thống"
    );
    assert.equal(store.defaultId, null);
  }
});

test("mặc định trỏ vào preset đã biến mất thì bỏ qua, không lỗi", async () => {
  const s = new FakeStorage();
  s.setItem(
    "nhipphach-presets-v1",
    JSON.stringify({ presets: [], defaultId: "usr-da-xoa" })
  );
  const store = await new LocalPresetRepository(s as unknown as Storage).load();
  assert.equal(store.defaultId, null);
  assert.equal(store.recovered, true);
});

test("không có localStorage thì công cụ vẫn chạy với preset hệ thống", async () => {
  const store = await new LocalPresetRepository(null).load();
  assert.equal(store.presets.length, SYSTEM_PRESETS.length);
  assert.equal(store.recovered, false);
  await assert.rejects(() => new LocalPresetRepository(null).save(custom()));
});

test("lưu lỗi thì NÉM lỗi, không giả báo thành công", async () => {
  const { s, r } = repo();
  s.failWrite = true;
  await assert.rejects(() => r.save(custom()), /Quota/);
  s.failWrite = false;
  assert.equal((await r.load()).presets.every((p) => p.system), true);
});

// ── Migration ───────────────────────────────────────────────────────────────────
test("trường lạ bị bỏ qua, trường thiếu lấy mặc định an toàn", () => {
  const p = migratePreset({
    id: "usr-1",
    name: "Cũ",
    truongTuongLai: { a: 1 },
    countingLevel: "khong-hop-le",
    color: "đỏ",
    sizePt: 999,
    distance: -3,
    orientation: "cheo",
  })!;
  assert.equal("truongTuongLai" in p, false);
  assert.equal(p.countingLevel, "beats");
  assert.equal(p.color, DEFAULT_SCORE_SETTINGS.color);
  assert.equal(p.sizePt, DEFAULT_SCORE_SETTINGS.sizePt);
  assert.equal(p.distance, DEFAULT_SCORE_SETTINGS.distance);
  assert.equal(p.orientation, "portrait");
  assert.equal(p.schemaVersion, PRESET_SCHEMA_VERSION);
  assert.equal(p.pageSize, "A4");
});

test("dữ liệu không cứu được thì trả null", () => {
  for (const bad of [null, 5, "chuỗi", {}, { id: "x" }, { name: "y" }, { id: " ", name: " " }])
    assert.equal(migratePreset(bad), null, JSON.stringify(bad));
});

test("preset mang id hệ thống trong dữ liệu lưu bị coi là hệ thống, không đè được", async () => {
  const s = new FakeStorage();
  s.setItem(
    "nhipphach-presets-v1",
    JSON.stringify({ presets: [{ id: "sys-moc-don", name: "Giả mạo", sizePt: 14 }] })
  );
  const store = await new LocalPresetRepository(s as unknown as Storage).load();
  const real = store.presets.find((p) => p.id === "sys-moc-don")!;
  assert.equal(real.name, "Chia móc đơn");
  assert.equal(real.sizePt, DEFAULT_SCORE_SETTINGS.sizePt);
});

// ── Trang có thật sự nối preset vào không ───────────────────────────────────────
const page = readFileSync(
  new URL("../../src/pages/MusicXmlBeatsPage.tsx", import.meta.url),
  "utf8"
);

test("mở trang là nạp preset và ÁP preset mặc định", () => {
  // Không có React test runner trong repo, nên khoá bằng chính mã nguồn:
  // gỡ đoạn áp mặc định đi là test này đỏ.
  assert.match(page, /presets\.current\s*\n?\s*\.load\(\)/, "có nạp preset khi mở trang");
  const mount = page.slice(
    page.indexOf("presets.current"),
    page.indexOf("const refreshPresets")
  );
  assert.match(mount, /store\.presets\.find\(\(p\) => p\.id === store\.defaultId\)/);
  assert.match(mount, /setSettings\(\(current\) => applyPreset\(preferred, current\)\)/);
  assert.match(mount, /setDefaultPresetId\(store\.defaultId\)/);
  // Hỏng storage thì báo nhẹ, không ném ra ngoài.
  assert.match(mount, /store\.recovered/);
  assert.match(mount, /\.catch\(/);
});

test("chọn preset là áp ngay vào thiết lập đang dùng", () => {
  const choose = page.slice(
    page.indexOf("const choosePreset"),
    page.indexOf("const currentPreset")
  );
  assert.match(choose, /applyPreset\(preset, current\)/);
});

test("trang không tự bơm cách chia nhịp lẻ vào thiết lập", () => {
  const code = page.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  // Chỉ được đặt `grouping` từ lựa chọn của người dùng (pickGrouping), không từ preset.
  const froms = [...code.matchAll(/grouping:/g)].length;
  assert.ok(froms >= 1);
  assert.equal(/preset[A-Za-z]*\.grouping/.test(code), false);
});

// ── Áp preset vào thiết lập ─────────────────────────────────────────────────────
test("áp preset đổi đúng counting level, màu, cỡ, khoảng cách, hướng giấy", () => {
  const before: ScoreSettings = { ...DEFAULT_SCORE_SETTINGS };
  const after = applyPreset(custom(), before);
  assert.equal(after.countingLevel, "eighths");
  assert.equal(after.color, "#1d4ed8");
  assert.equal(after.sizePt, 9);
  assert.equal(after.distance, 5);
  assert.equal(after.orientation, "landscape");
  assert.equal(after.showBeats, true);
});

test("mỗi preset hệ thống cho đúng cấp đếm của nó", () => {
  const map = musicXMLToBeatMap(fixture("musicxml-subdivision", "whole-note"));
  const counts = SYSTEM_PRESETS.map((p) => {
    const s = applyPreset(p, { ...DEFAULT_SCORE_SETTINGS });
    return createAnnotations(map, s.countingLevel, s.compoundCountingMode).length;
  });
  assert.deepEqual(counts, [4, 8, 16, 4], "cơ bản 4 · móc đơn 8 · móc kép 16");
});

test("áp preset KHÔNG đụng cách chia đang chọn cho từng ô", () => {
  const grouping = { byMeter: { "7/8": [3, 2, 2] }, byMeasure: { m1: [2, 3, 2] } };
  const after = applyPreset(custom(), {
    ...DEFAULT_SCORE_SETTINGS,
    grouping,
  } as ScoreSettings);
  assert.deepEqual(after.grouping, grouping);
});

// ── 5/8 và 7/8: preset KHÔNG được đoán cách chia ────────────────────────────────
for (const [meter, name] of [
  ["5/8", "five-plain"],
  ["7/8", "seven-plain"],
] as const)
  test(`${meter} chưa khai cách chia: preset không biến nó thành cách chia nào`, () => {
    const map = musicXMLToBeatMap(fixture("musicxml-irregular", name));
    assert.equal(map.measures[0].groupingSource, "unresolved");
    for (const preset of SYSTEM_PRESETS) {
      const s = applyPreset(preset, { ...DEFAULT_SCORE_SETTINGS });
      assert.equal(s.grouping, undefined, `${preset.name} không mang cách chia`);
      // phách nhỏ vẫn chạy
      assert.equal(
        createAnnotations(map, "beats", "pulses").length,
        meter === "5/8" ? 5 : 7
      );
      // phách lớn vẫn trống + vẫn báo cần chọn
      assert.equal(createAnnotations(map, "beats", "compound").length, 0);
    }
    assert.deepEqual(
      (map.measures[0].notices ?? []).map((n) => n.code),
      ["IRREGULAR_GROUPING_REQUIRED"]
    );
  });

test("preset dùng chế độ phách lớn cũng không tự resolve 7/8", () => {
  const preset: NhipPhachPreset = {
    ...SYSTEM_PRESETS[3],
    id: "usr-large",
    system: false,
    compoundCountingMode: "compound",
  };
  const s = applyPreset(preset, { ...DEFAULT_SCORE_SETTINGS });
  const map = musicXMLToBeatMap(fixture("musicxml-irregular", "seven-plain"));
  assert.equal(createAnnotations(map, s.countingLevel, s.compoundCountingMode).length, 0);
  assert.equal(map.measures[0].groups, null);
});

test("đổi nhịp: preset không đè meter hay cách chia của từng ô", () => {
  const sel = { byMeter: { "5/8": [2, 3], "7/8": [2, 2, 3] } };
  const map = musicXMLToBeatMap(fixture("musicxml-irregular", "mixed-meter"), sel);
  const s = applyPreset(SYSTEM_PRESETS[0], {
    ...DEFAULT_SCORE_SETTINGS,
    grouping: sel,
  } as ScoreSettings);
  assert.deepEqual(s.grouping, sel);
  assert.deepEqual(
    map.measures.map((m) => m.meter && `${m.meter.beats}/${m.meter.beatType}`),
    ["4/4", "2+3/8", "6/8", "2+2+3/8", "3/4", "3+2/8", "12/8", "3+2+2/8"].map(
      (x) => x.replace(/^(\d+(?:\+\d+)*)\/(\d+)$/, (_, b, d) =>
        `${String(b).split("+").reduce((a: number, n: string) => a + Number(n), 0)}/${d}`
      )
    )
  );
});

// ── Renderer thật: preset đổi bản khắc, không đổi thời điểm ─────────────────────
const renderer = await createAnnotatedScoreRenderer();
test("preset đổi màu/cỡ trong SVG nhưng giữ nguyên vị trí thời gian", () => {
  const xml = fixture("musicxml-subdivision", "whole-note");
  const a = renderer.render(xml, applyPreset(SYSTEM_PRESETS[0], { ...DEFAULT_SCORE_SETTINGS }));
  const b = renderer.render(
    xml,
    applyPreset(
      { ...SYSTEM_PRESETS[0], id: "usr-x", system: false, color: "#1d4ed8", sizePt: 11 },
      { ...DEFAULT_SCORE_SETTINGS }
    )
  );
  assert.deepEqual(a.diagnostics, []);
  assert.deepEqual(b.diagnostics, []);
  assert.deepEqual(
    a.anchors.map((x) => x.timestamp),
    b.anchors.map((x) => x.timestamp),
    "thời điểm không đổi"
  );
  assert.match(parse(a.pages[0]!.svg).documentElement!.toString(), /#dc2626/i);
  assert.match(parse(b.pages[0]!.svg).documentElement!.toString(), /#1d4ed8/i);
});

test("hướng giấy A4 dọc/ngang đổi khổ trang thật", () => {
  const xml = fixture("musicxml-subdivision", "whole-note");
  const doc = renderer.render(xml, applyPreset(SYSTEM_PRESETS[3], { ...DEFAULT_SCORE_SETTINGS }));
  const ngang = renderer.render(
    xml,
    applyPreset(
      { ...SYSTEM_PRESETS[3], id: "usr-l", system: false, orientation: "landscape" },
      { ...DEFAULT_SCORE_SETTINGS }
    )
  );
  assert.ok(doc.pages[0]!.height > doc.pages[0]!.width, "dọc");
  assert.ok(ngang.pages[0]!.width > ngang.pages[0]!.height, "ngang");
  assert.deepEqual(
    doc.anchors.map((a) => a.label),
    ngang.anchors.map((a) => a.label)
  );
});

test("preset móc kép cho đúng 16 nhãn trong bản khắc thật", () => {
  const s = applyPreset(SYSTEM_PRESETS[2], { ...DEFAULT_SCORE_SETTINGS });
  const out = renderer.render(fixture("musicxml-subdivision", "whole-note"), s);
  assert.deepEqual(out.diagnostics, []);
  assert.equal(out.anchors.length, 16);
  assert.deepEqual(
    all(parse(out.pages[0].svg), "g")
      .filter((g) => (g.getAttribute("id") || "").startsWith("tva-beat-"))
      .length,
    16
  );
  renderer.destroy();
});
