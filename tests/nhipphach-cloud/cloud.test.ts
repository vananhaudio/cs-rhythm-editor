import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SupabasePresetRepository,
  PRESET_CONFLICT,
} from "../../src/nhipphach/supabasePresetRepository.ts";
import { ResilientPresetRepository } from "../../src/nhipphach/resilientPresetRepository.ts";
import { LocalPresetRepository } from "../../src/nhipphach/presetRepository.ts";
import type { PresetRepository, PresetStore } from "../../src/nhipphach/presetRepository.ts";
import {
  migrateLocalPresets,
  markMigrated,
  alreadyMigrated,
  claimLegacy,
  legacyClaimedBy,
  LEGACY_CLAIMED_KEY,
} from "../../src/nhipphach/presetSync.ts";
import { keyFor, LEGACY_KEY } from "../../src/nhipphach/presetRepository.ts";
import {
  SYSTEM_PRESETS,
  presetFromSettings,
  isSystemPreset,
} from "../../src/nhipphach/presets.ts";
import type { NhipPhachPreset } from "../../src/nhipphach/presets.ts";
import { DEFAULT_SCORE_SETTINGS } from "../../src/musicxml-beats/renderer/types.ts";
import { stateFromStore, SYNC_LABEL } from "../../src/nhipphach/syncState.ts";
import { readFileSync } from "node:fs";

const API = "http://127.0.0.1:54321";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const PW = "MatKhau123!";

/** Mỗi "thiết bị" là một client riêng, phiên riêng — đúng như hai trình duyệt. */
async function device(email: string): Promise<{ client: SupabaseClient; uid: string }> {
  const client = createClient(API, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { client, uid: data.user!.id };
}
const repoFor = async (email: string) => {
  const d = await device(email);
  return new SupabasePresetRepository(d.client, d.uid);
};
class FakeStorage {
  map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
const custom = (name: string, over: Partial<NhipPhachPreset> = {}): NhipPhachPreset => ({
  ...presetFromSettings(name, { ...DEFAULT_SCORE_SETTINGS, countingLevel: "eighths" }),
  ...over,
});

let A: SupabasePresetRepository, B: SupabasePresetRepository, C: SupabasePresetRepository;
let devA: { client: SupabaseClient; uid: string };
before(async () => {
  devA = await device("teacher-a@test.local");
  A = new SupabasePresetRepository(devA.client, devA.uid);
  B = await repoFor("teacher-b@test.local");
  C = await repoFor("student-c@test.local");
});
async function wipe() {
  for (const r of [A, B]) {
    const s = await r.load();
    for (const p of s.presets.filter((x) => !x.system)) await r.remove(p.id);
    await r.setDefault(null);
  }
}
after(async () => { await wipe(); });

// ── CRUD theo tài khoản ─────────────────────────────────────────────────────────
test("A tạo, đọc, đổi tên, xoá preset của mình", async () => {
  await wipe();
  const p = custom("Của A");
  await A.save(p);
  let s = await A.load();
  assert.equal(s.origin, "cloud");
  assert.deepEqual(s.presets.filter((x) => !x.system).map((x) => x.name), ["Của A"]);
  assert.equal(s.presets.find((x) => x.id === p.id)!.countingLevel, "eighths");
  assert.ok(s.versions![p.id], "có dấu thời gian máy chủ");
  await A.rename(p.id, "Của A đổi");
  s = await A.load();
  assert.equal(s.presets.find((x) => x.id === p.id)!.name, "Của A đổi");
  await A.remove(p.id);
  s = await A.load();
  assert.equal(s.presets.filter((x) => !x.system).length, 0);
});

test("cô lập: A không thấy preset của B và ngược lại", async () => {
  await wipe();
  await A.save(custom("Riêng A"));
  await B.save(custom("Riêng B"));
  const [sa, sb] = [await A.load(), await B.load()];
  assert.deepEqual(sa.presets.filter((x) => !x.system).map((x) => x.name), ["Riêng A"]);
  assert.deepEqual(sb.presets.filter((x) => !x.system).map((x) => x.name), ["Riêng B"]);
});

test("A không xoá/sửa được preset của B", async () => {
  await wipe();
  const pb = custom("Của B");
  await B.save(pb);
  await assert.rejects(() => A.rename(pb.id, "A chiếm"), /Không tìm thấy/);
  await A.remove(pb.id); // RLS lọc sạch, không ném nhưng cũng không xoá được gì
  assert.equal((await B.load()).presets.some((x) => x.id === pb.id), true, "của B vẫn còn");
});

test("học viên không đọc, không ghi preset", async () => {
  await wipe();
  await A.save(custom("Của A"));
  const s = await C.load();
  assert.equal(s.presets.filter((x) => !x.system).length, 0, "học viên không thấy gì");
  await assert.rejects(() => C.save(custom("Của C")));
});

test("chặn nằm ở DATABASE: bỏ hết bộ lọc phía client thì A vẫn không chạm được B", async () => {
  await wipe();
  const pb = custom("Của B");
  await B.save(pb);
  // Gọi thẳng PostgREST bằng phiên của A, KHÔNG có .eq("user_id") nào cả.
  const doc = await devA.client.from("nhipphach_presets").select("*");
  assert.deepEqual(doc.data, [], "A select trần → rỗng");
  const sua = await devA.client
    .from("nhipphach_presets")
    .update({ name: "A chiếm" })
    .eq("id", pb.id)
    .select("id");
  assert.deepEqual(sua.data, [], "A update trần → không đụng được dòng nào");
  const xoa = await devA.client
    .from("nhipphach_presets")
    .delete()
    .eq("id", pb.id)
    .select("id");
  assert.deepEqual(xoa.data, [], "A delete trần → không xoá được gì");
  // A cố ghi một dòng MANG user_id của B
  const gia = await devA.client
    .from("nhipphach_presets")
    .insert({ id: "usr-gia-mao", user_id: "00000000-0000-0000-0000-000000000000", name: "giả", settings: {} });
  assert.notEqual(gia.error, null, "ghi hộ người khác bị từ chối");
  assert.equal((await B.load()).presets.some((x) => x.id === pb.id), true, "của B nguyên vẹn");
});

// ── Khoá chính ghép (user_id, id) ───────────────────────────────────────────────
test("BẮT BUỘC: hai thầy dùng CÙNG một id, ai thấy của người nấy", async () => {
  await wipe();
  const ID = "usr-same-id";
  await A.save({ ...custom("Preset A"), id: ID });
  await B.save({ ...custom("Preset B"), id: ID });
  const [sa, sb] = [await A.load(), await B.load()];
  assert.deepEqual(
    sa.presets.filter((x) => !x.system).map((x) => [x.id, x.name]),
    [[ID, "Preset A"]],
    "A chỉ thấy Preset A"
  );
  assert.deepEqual(
    sb.presets.filter((x) => !x.system).map((x) => [x.id, x.name]),
    [[ID, "Preset B"]],
    "B chỉ thấy Preset B"
  );
});

test("cùng id: A sửa không đụng tới bản của B", async () => {
  await wipe();
  const ID = "usr-same-id";
  await A.save({ ...custom("Preset A"), id: ID });
  await B.save({ ...custom("Preset B"), id: ID });
  const va = (await A.load()).versions![ID];
  await A.save({ ...custom("A đã sửa"), id: ID }, va);
  assert.equal((await A.load()).presets.find((x) => x.id === ID)!.name, "A đã sửa");
  assert.equal(
    (await B.load()).presets.find((x) => x.id === ID)!.name,
    "Preset B",
    "bản của B không suy suyển"
  );
});

test("cùng id: A đổi tên và A xoá không đụng tới bản của B", async () => {
  await wipe();
  const ID = "usr-same-id";
  await A.save({ ...custom("Preset A"), id: ID });
  await B.save({ ...custom("Preset B"), id: ID });
  await A.rename(ID, "A đổi tên");
  assert.equal((await B.load()).presets.find((x) => x.id === ID)!.name, "Preset B");
  await A.remove(ID);
  assert.equal((await A.load()).presets.some((x) => x.id === ID), false, "của A đã xoá");
  assert.equal((await B.load()).presets.some((x) => x.id === ID), true, "của B vẫn còn");
});

test("cùng id: mặc định của mỗi người trỏ đúng bản của mình", async () => {
  await wipe();
  const ID = "usr-same-id";
  await A.save({ ...custom("Preset A"), id: ID });
  await B.save({ ...custom("Preset B"), id: ID });
  await A.setDefault(ID, "custom");
  await B.setDefault(ID, "custom");
  const [sa, sb] = [await A.load(), await B.load()];
  assert.equal(sa.presets.find((x) => x.id === sa.defaultId)!.name, "Preset A");
  assert.equal(sb.presets.find((x) => x.id === sb.defaultId)!.name, "Preset B");
});

test("khoá chính là (user_id, id), không phải (id)", async () => {
  const { data, error } = await devA.client.rpc("nhipphach_pk_columns").select?.() ?? { data: null, error: null };
  // Không có RPC thì kiểm gián tiếp: cùng id ở hai người dùng phải chèn được.
  if (error || !data) {
    await wipe();
    const ID = "usr-pk-check";
    await A.save({ ...custom("A"), id: ID });
    await B.save({ ...custom("B"), id: ID });
    assert.equal((await A.load()).presets.some((x) => x.id === ID), true);
    assert.equal((await B.load()).presets.some((x) => x.id === ID), true);
  }
  // …và trùng id TRONG CÙNG một người vẫn bị chặn
  await assert.rejects(
    () => A.save({ ...custom("A lần hai"), id: "usr-pk-check" }),
    (e: Error) => e.message === PRESET_CONFLICT
  );
});

// ── Preset hệ thống ─────────────────────────────────────────────────────────────
test("preset hệ thống không lên máy chủ, không sửa, không xoá", async () => {
  await wipe();
  for (const p of SYSTEM_PRESETS) {
    await assert.rejects(() => A.save(p), /hệ thống/);
    await assert.rejects(() => A.rename(p.id, "x"), /hệ thống/);
    await assert.rejects(() => A.remove(p.id), /hệ thống/);
  }
  const s = await A.load();
  assert.deepEqual(
    s.presets.filter((p) => p.system).map((p) => p.id),
    SYSTEM_PRESETS.map((p) => p.id)
  );
  assert.equal(s.presets.filter((x) => !x.system).length, 0, "bảng vẫn trống");
});

test("nhân bản preset hệ thống thành preset cá nhân trên máy chủ", async () => {
  await wipe();
  const copy = await A.duplicate("sys-tai-lieu-hoc-sinh");
  assert.equal(copy.system, false);
  assert.equal(isSystemPreset(copy.id), false);
  assert.equal((await A.load()).presets.some((p) => p.id === copy.id), true);
});

// ── Mặc định: system và custom ──────────────────────────────────────────────────
test("mặc định trỏ preset HỆ THỐNG mà không nhân bản nó xuống máy chủ", async () => {
  await wipe();
  await A.setDefault("sys-moc-kep", "system");
  const s = await A.load();
  assert.equal(s.defaultId, "sys-moc-kep");
  assert.equal(s.defaultSource, "system");
  assert.equal(s.presets.filter((x) => !x.system).length, 0, "không có dòng nào bị tạo thêm");
});

test("mặc định trỏ preset CÁ NHÂN", async () => {
  await wipe();
  const p = custom("Giáo án A4 ngang");
  await A.save(p);
  await A.setDefault(p.id, "custom");
  const s = await A.load();
  assert.equal(s.defaultId, p.id);
  assert.equal(s.defaultSource, "custom");
});

test("đặt mặc định vào preset không có thật thì báo lỗi", async () => {
  await wipe();
  await assert.rejects(() => A.setDefault("usr-khong-co", "custom"), /Không tìm thấy/);
  await assert.rejects(() => A.setDefault("sys-khong-co", "system"), /Không tìm thấy/);
});

test("xoá preset đang là mặc định thì gỡ luôn con trỏ, không để trỏ hụt", async () => {
  await wipe();
  const p = custom("Sắp xoá");
  await A.save(p);
  await A.setDefault(p.id, "custom");
  await A.remove(p.id);
  const s = await A.load();
  assert.equal(s.defaultId, null);
  assert.equal(s.defaultSource, null);
});

// ── Nhiều thiết bị ──────────────────────────────────────────────────────────────
test("thiết bị B thấy preset và mặc định do thiết bị A tạo", async () => {
  await wipe();
  const may1 = await repoFor("teacher-a@test.local");
  const may2 = await repoFor("teacher-a@test.local"); // phiên khác, cùng tài khoản
  const p = custom("Giáo án chung");
  await may1.save(p);
  await may1.setDefault(p.id, "custom");
  const s2 = await may2.load();
  assert.equal(s2.presets.some((x) => x.id === p.id), true);
  assert.equal(s2.defaultId, p.id);
  assert.equal(s2.defaultSource, "custom");
  // máy 2 đổi tên → máy 1 tải lại thấy tên mới
  await may2.rename(p.id, "Tên từ máy 2");
  assert.equal((await may1.load()).presets.find((x) => x.id === p.id)!.name, "Tên từ máy 2");
});

// ── Ghi chồng ───────────────────────────────────────────────────────────────────
test("hai máy cùng sửa: máy đến sau bị PRESET_CONFLICT, không đè âm thầm", async () => {
  await wipe();
  const may1 = await repoFor("teacher-a@test.local");
  const may2 = await repoFor("teacher-a@test.local");
  const p = custom("Tranh chấp");
  await may1.save(p);
  const v1 = (await may1.load()).versions![p.id];
  const v2 = (await may2.load()).versions![p.id];
  assert.equal(v1, v2, "hai máy cùng đọc một phiên bản");
  await may1.save({ ...p, name: "Máy 1 sửa", sizePt: 12 }, v1);
  await assert.rejects(
    () => may2.save({ ...p, name: "Máy 2 sửa", sizePt: 6 }, v2),
    (e: Error) => e.message === PRESET_CONFLICT
  );
  const cuoi = (await may1.load()).presets.find((x) => x.id === p.id)!;
  assert.equal(cuoi.name, "Máy 1 sửa", "bản của máy 1 còn nguyên, không bị máy 2 đè");
  // sau khi tải lại phiên bản mới thì máy 2 ghi được
  const v3 = (await may2.load()).versions![p.id];
  await may2.save({ ...p, name: "Máy 2 sửa sau khi tải lại" }, v3);
  assert.equal(
    (await may1.load()).presets.find((x) => x.id === p.id)!.name,
    "Máy 2 sửa sau khi tải lại"
  );
});

test("tạo trùng id thì báo PRESET_CONFLICT chứ không ghi đè", async () => {
  await wipe();
  const p = custom("Bản gốc");
  await A.save(p);
  await assert.rejects(
    () => A.save({ ...p, name: "Bản khác" }),
    (e: Error) => e.message === PRESET_CONFLICT
  );
  assert.equal((await A.load()).presets.find((x) => x.id === p.id)!.name, "Bản gốc");
});

// ── Đưa preset trên máy lên tài khoản ───────────────────────────────────────────
const localStore = async (presets: NhipPhachPreset[], defaultId: string | null = null) => {
  const s = new FakeStorage();
  const repo = new LocalPresetRepository(s as unknown as Storage);
  for (const p of presets) await repo.save(p);
  if (defaultId) await repo.setDefault(defaultId);
  return { storage: s, store: await repo.load() };
};

test("chỉ có trên máy → đẩy hết lên, preset hệ thống KHÔNG lên", async () => {
  await wipe();
  const { store } = await localStore([custom("Máy 1"), custom("Máy 2")]);
  const r = await migrateLocalPresets(store, A);
  assert.equal(r.uploaded.length, 2);
  assert.deepEqual(r.conflicted, []);
  assert.equal(r.ignoredSystem.length, SYSTEM_PRESETS.length, "bỏ qua đủ 4 preset hệ thống");
  assert.equal(r.complete, true);
  const s = await A.load();
  assert.deepEqual(
    s.presets.filter((x) => !x.system).map((x) => x.name).sort(),
    ["Máy 1", "Máy 2"]
  );
});

test("chỉ có trên máy chủ → không đụng gì", async () => {
  await wipe();
  await A.save(custom("Chỉ trên máy chủ"));
  const { store } = await localStore([]);
  const r = await migrateLocalPresets(store, A);
  assert.deepEqual([r.uploaded, r.conflicted, r.failed], [[], [], []]);
  assert.equal((await A.load()).presets.filter((x) => !x.system).length, 1);
});

test("cùng id + cùng nội dung → bỏ qua, không nhân đôi", async () => {
  await wipe();
  const p = custom("Giống hệt");
  await A.save(p);
  const { store } = await localStore([p]);
  const r = await migrateLocalPresets(store, A);
  assert.deepEqual(r.skipped, [p.id]);
  assert.deepEqual(r.uploaded, []);
  assert.equal((await A.load()).presets.filter((x) => !x.system).length, 1);
});

test("cùng id + khác nội dung → KHÔNG ghi đè, giữ cả hai", async () => {
  await wipe();
  const p = custom("Trên máy chủ");
  await A.save(p);
  const { store } = await localStore([{ ...p, name: "Trên máy", sizePt: 13 }]);
  const r = await migrateLocalPresets(store, A);
  assert.equal(r.conflicted.length, 1);
  assert.equal(r.conflicted[0].id, p.id);
  const s = await A.load();
  const custom2 = s.presets.filter((x) => !x.system);
  assert.equal(custom2.length, 2, "cả hai bản đều còn");
  assert.equal(custom2.find((x) => x.id === p.id)!.name, "Trên máy chủ", "bản máy chủ nguyên vẹn");
  assert.match(custom2.find((x) => x.id === r.conflicted[0].copyId)!.name, /bản trên máy/);
});

test("trùng TÊN nhưng khác id → hai preset khác nhau, đẩy cả hai", async () => {
  await wipe();
  const a = custom("Giáo án");
  await A.save(a);
  const b = custom("Giáo án");
  assert.notEqual(a.id, b.id);
  const { store } = await localStore([b]);
  const r = await migrateLocalPresets(store, A);
  assert.deepEqual(r.uploaded, [b.id]);
  assert.equal((await A.load()).presets.filter((x) => !x.system).length, 2);
});

test("đứt giữa chừng rồi chạy lại: idempotent, không nhân đôi", async () => {
  await wipe();
  const ps = [custom("Một"), custom("Hai"), custom("Ba")];
  const { store } = await localStore(ps);
  // lần 1: hỏng ngay ở bài thứ hai
  let n = 0;
  const flaky: PresetRepository = {
    load: () => A.load(),
    save: (p, v) => (++n === 2 ? Promise.reject(new Error("mạng lỗi")) : A.save(p, v)),
    rename: (i, nm) => A.rename(i, nm),
    duplicate: (i, nm) => A.duplicate(i, nm),
    remove: (i) => A.remove(i),
    setDefault: (i, s2) => A.setDefault(i, s2),
  };
  const r1 = await migrateLocalPresets(store, flaky);
  assert.equal(r1.complete, false, "chưa xong thì KHÔNG đánh dấu hoàn tất");
  assert.equal(r1.failed.length, 1);
  const storage = new FakeStorage() as unknown as Storage;
  if (r1.complete) markMigrated(storage, devA.uid);
  assert.equal(alreadyMigrated(storage, devA.uid), false, "không đánh dấu khi chưa ACK");
  // lần 2: chạy lại đầy đủ
  const r2 = await migrateLocalPresets(store, A);
  assert.equal(r2.complete, true);
  markMigrated(storage, devA.uid);
  assert.equal(alreadyMigrated(storage, devA.uid), true);
  const s = await A.load();
  assert.equal(s.presets.filter((x) => !x.system).length, 3, "đúng 3, không nhân đôi");
  // lần 3: chạy lại lần nữa vẫn không nhân đôi
  const r3 = await migrateLocalPresets(store, A);
  assert.equal(r3.skipped.length, 3);
  assert.equal((await A.load()).presets.filter((x) => !x.system).length, 3);
});

test("dữ liệu local lẫn preset hệ thống thì không đẩy lên", async () => {
  await wipe();
  const s = new FakeStorage();
  s.setItem(
    "nhipphach-presets-v1",
    JSON.stringify({
      schemaVersion: 1,
      presets: [{ ...SYSTEM_PRESETS[1], system: false }, custom("Thật")],
      defaultId: null,
    })
  );
  const store = await new LocalPresetRepository(s as unknown as Storage).load();
  const r = await migrateLocalPresets(store, A);
  assert.deepEqual(r.uploaded.map(() => true), [true], "chỉ đẩy 1 preset cá nhân");
  assert.equal(
    (await A.load()).presets.filter((x) => !x.system).length,
    1,
    "preset hệ thống không thành preset cá nhân trên máy chủ"
  );
});

test("mặc định trên máy được đưa lên khi máy chủ chưa có", async () => {
  await wipe();
  const p = custom("Mặc định máy");
  const { store } = await localStore([p], p.id);
  await migrateLocalPresets(store, A);
  const s = await A.load();
  assert.equal(s.defaultId, p.id);
  assert.equal(s.defaultSource, "custom");
});

test("máy chủ đã có mặc định thì bản trên máy KHÔNG đè", async () => {
  await wipe();
  await A.setDefault("sys-moc-don", "system");
  const p = custom("Mặc định máy");
  const { store } = await localStore([p], p.id);
  await migrateLocalPresets(store, A);
  const s = await A.load();
  assert.equal(s.defaultId, "sys-moc-don", "lựa chọn trên tài khoản được tôn trọng");
});

// ── Lỗi máy chủ ─────────────────────────────────────────────────────────────────
test("máy chủ lỗi: đọc lùi về bản trên máy, ghi thì NÉM lỗi", async () => {
  const hong: PresetRepository = {
    load: () => Promise.reject(new Error("mạng lỗi")),
    save: () => Promise.reject(new Error("mạng lỗi")),
    rename: () => Promise.reject(new Error("mạng lỗi")),
    duplicate: () => Promise.reject(new Error("mạng lỗi")),
    remove: () => Promise.reject(new Error("mạng lỗi")),
    setDefault: () => Promise.reject(new Error("mạng lỗi")),
  };
  const s = new FakeStorage();
  const local = new LocalPresetRepository(s as unknown as Storage);
  const p = custom("Bản trên máy");
  await local.save(p);
  const repo = new ResilientPresetRepository(hong, local);
  const store = await repo.load();
  assert.equal(store.origin, "cloud-fallback");
  assert.equal(store.recovered, true);
  assert.equal(store.presets.some((x) => x.id === p.id), true, "vẫn dùng được preset cũ");
  await assert.rejects(() => repo.save(custom("Mới")), /mạng lỗi/, "KHÔNG giả báo thành công");
});

test("đọc được máy chủ thì chép xuống làm bộ nhớ đệm", async () => {
  await wipe();
  const p = custom("Từ máy chủ");
  await A.save(p);
  let cached: PresetStore | null = null;
  const repo = new ResilientPresetRepository(
    A,
    new LocalPresetRepository(new FakeStorage() as unknown as Storage),
    (s2) => { cached = s2; }
  );
  const store = await repo.load();
  assert.equal(store.origin, "cloud");
  assert.equal(cached !== null, true);
  assert.equal(cached!.presets.some((x) => x.id === p.id), true);
});

// ── Cách chia nhịp lẻ TUYỆT ĐỐI không lên máy chủ ───────────────────────────────
test("preset trên máy chủ không mang cách chia 5/8, 7/8", async () => {
  await wipe();
  const ban = {
    ...custom("Có rác"),
    grouping: { byMeter: { "7/8": [2, 2, 3] } },
  } as unknown as NhipPhachPreset;
  await A.save(ban);
  const { data } = await devA.client
    .from("nhipphach_presets")
    .select("settings")
    .eq("id", ban.id)
    .single();
  const raw = JSON.stringify(data!.settings);
  for (const cam of ["grouping", "byMeter", "byMeasure", "7/8", "2,2,3"])
    assert.equal(raw.includes(cam), false, `settings chứa "${cam}": ${raw}`);
  const back = (await A.load()).presets.find((x) => x.id === ban.id)!;
  assert.equal("grouping" in back, false);
});


// ── Trạng thái đồng bộ trên UI ──────────────────────────────────────────────────
test("nhãn trạng thái: fallback KHÔNG bao giờ được gọi là đã đồng bộ", () => {
  assert.equal(stateFromStore({ presets: [], defaultId: null, recovered: false, origin: "cloud" }), "synced");
  assert.equal(
    stateFromStore({ presets: [], defaultId: null, recovered: true, origin: "cloud-fallback" }),
    "cached"
  );
  assert.equal(stateFromStore({ presets: [], defaultId: null, recovered: false, origin: "local" }), "local");
  assert.equal(SYNC_LABEL.synced, "✓ Đã đồng bộ");
  assert.equal(SYNC_LABEL.cached, "Đang dùng bản lưu trên máy");
  assert.equal(SYNC_LABEL.failed, "Không thể đồng bộ");
  // Không nhãn nào ngoài "synced" được chứa chữ "Đã đồng bộ"
  for (const [k, v] of Object.entries(SYNC_LABEL))
    if (k !== "synced") assert.equal(v.includes("Đã đồng bộ"), false, `${k}: ${v}`);
});

test("trang KHÔNG gọi Supabase trực tiếp — chỉ qua PresetRepository", () => {
  const page = readFileSync(
    new URL("../../src/pages/MusicXmlBeatsPage.tsx", import.meta.url),
    "utf8"
  ).replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  for (const cam of [/from ["'].*supabase["']/, /createClient/, /supabase\./, /\.from\(["']nhipphach/])
    assert.equal(cam.test(page), false, String(cam));
  assert.match(page, /openPresetRepository\(\)/, "đi qua gateway");
  assert.match(page, /presets\.current = gate\.repo/, "thay repository theo phiên");
  assert.match(page, /setSyncState\(/);
});

test("gateway: chưa đăng nhập thì dùng kho trên máy, không đổi hành vi cũ", () => {
  const gate = readFileSync(
    new URL("../../src/nhipphach/presetGateway.ts", import.meta.url),
    "utf8"
  ).replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  // Nhánh chưa đăng nhập: kho trên máy KHÔNG gắn uid, KHÔNG có kho lịch sử đám
  // mây, và trạng thái là "local" — kiểm cả ba trong đúng nhánh đó.
  const chuaDangNhap = gate.slice(gate.indexOf("if (!userId)"));
  const than = chuaDangNhap.slice(0, chuaDangNhap.indexOf("};") + 2);
  assert.match(than, /new LocalPresetRepository\(store\)/);
  assert.equal(/new LocalPresetRepository\(store, /.test(than), false);
  assert.match(than, /jobs: null/, "chưa đăng nhập thì không có lịch sử đám mây");
  assert.match(than, /state: "local"/);
  // Chỉ đánh dấu đã đưa lên khi máy chủ xác nhận xong
  // Chỉ đánh dấu "đã đưa lên" SAU khi máy chủ xác nhận xong — cả markMigrated
  // lẫn claimLegacy đều nằm trong nhánh report.complete.
  const nhanh = gate.slice(gate.indexOf("if (report.complete)"), gate.indexOf("else"));
  assert.match(nhanh, /markMigrated\(store, userId\)/);
  assert.match(nhanh, /claimLegacy\(store, userId\)/);
  assert.equal(/markMigrated\(store, userId\);\s*\n\s*const report/.test(gate), false);
});


test("mọi thao tác đều ghim user_id + id, không bao giờ chỉ id", () => {
  const code = readFileSync(
    new URL("../../src/nhipphach/supabasePresetRepository.ts", import.meta.url),
    "utf8"
  ).replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  // Tách từng chuỗi truy vấn bắt đầu bằng .from(TABLE) cho tới dấu ;
  const chains = code.split(".from(TABLE)").slice(1).map((c) => c.split(";")[0]);
  assert.ok(chains.length >= 5, `tìm thấy ${chains.length} truy vấn`);
  for (const c of chains) {
    if (/\.insert\(/.test(c)) continue; // insert mang user_id trong payload
    assert.match(c, /\.eq\("user_id", this\.userId\)/, `truy vấn thiếu user_id: ${c.slice(0, 90)}`);
    if (/\.eq\("id"/.test(c))
      assert.ok(
        c.indexOf('.eq("user_id"') < c.indexOf('.eq("id"'),
        "phải ghim user_id trước khi ghim id"
      );
  }
  // update có kiểm phiên bản
  assert.match(code, /\.eq\("updated_at", expectedUpdatedAt\)/);
  // payload insert luôn mang user_id
  assert.match(code, /user_id: this\.userId/);
  // prefs cũng ghim user_id
  const prefChains = code.split(".from(PREFS)").slice(1).map((c) => c.split(";")[0]);
  for (const c of prefChains)
    assert.ok(
      /\.eq\("user_id", this\.userId\)/.test(c) || /user_id: this\.userId/.test(c),
      `prefs thiếu user_id: ${c.slice(0, 90)}`
    );
});


// ── Bộ nhớ đệm phải gắn với TÀI KHOẢN ───────────────────────────────────────────
test("đệm của hai người dùng nằm ở hai khoá khác nhau", () => {
  assert.equal(keyFor("uid-a"), "nhipphach:presets:uid-a");
  assert.notEqual(keyFor("uid-a"), keyFor("uid-b"));
  assert.equal(keyFor(null), LEGACY_KEY);
  assert.equal(keyFor(), LEGACY_KEY);
});

test("BẮT BUỘC: A sync rồi đăng xuất, B đăng nhập lúc mất mạng KHÔNG thấy preset của A", async () => {
  const s = new FakeStorage() as unknown as Storage;
  // A: kho riêng của A, có preset và mặc định
  const khoA = new LocalPresetRepository(s, "uid-a");
  const pa = custom("Preset của A");
  await khoA.save(pa);
  await khoA.setDefault(pa.id);
  // B: cùng một browser storage, nhưng kho riêng của B
  const khoB = new LocalPresetRepository(s, "uid-b");
  const sb = await khoB.load();
  assert.deepEqual(
    sb.presets.filter((x) => !x.system),
    [],
    "B không thấy preset cá nhân nào của A"
  );
  assert.equal(sb.defaultId, null, "B không nhận mặc định của A");
  // và khi máy chủ hỏng, fallback của B vẫn là kho của B
  const hong: PresetRepository = {
    load: () => Promise.reject(new Error("mạng lỗi")),
    save: () => Promise.reject(new Error("mạng lỗi")),
    rename: () => Promise.reject(new Error("mạng lỗi")),
    duplicate: () => Promise.reject(new Error("mạng lỗi")),
    remove: () => Promise.reject(new Error("mạng lỗi")),
    setDefault: () => Promise.reject(new Error("mạng lỗi")),
  };
  const fallbackB = await new ResilientPresetRepository(hong, khoB).load();
  assert.equal(fallbackB.origin, "cloud-fallback");
  assert.deepEqual(fallbackB.presets.filter((x) => !x.system), []);
  assert.equal(fallbackB.defaultId, null);
  // A vẫn còn nguyên dữ liệu của mình
  const lai = await khoA.load();
  assert.equal(lai.presets.some((x) => x.id === pa.id), true);
  assert.equal(lai.defaultId, pa.id);
});

test("học viên đăng nhập sau cũng không nhận đệm của thầy", async () => {
  const s = new FakeStorage() as unknown as Storage;
  const thay = new LocalPresetRepository(s, "uid-teacher");
  await thay.save(custom("Giáo án riêng"));
  const hocVien = await new LocalPresetRepository(s, "uid-student").load();
  assert.deepEqual(hocVien.presets.filter((x) => !x.system), []);
});

test("kho cũ 9A chỉ MỘT tài khoản được nhận", async () => {
  const s = new FakeStorage();
  // dữ liệu 9A: khoá cũ, chưa gắn danh tính
  const legacy = new LocalPresetRepository(s as unknown as Storage, null);
  await legacy.save(custom("Preset thời 9A"));
  assert.equal(legacyClaimedBy(s as unknown as Storage), null);
  claimLegacy(s as unknown as Storage, "uid-a");
  assert.equal(legacyClaimedBy(s as unknown as Storage), "uid-a");
  // người thứ hai claim không đổi được chủ
  claimLegacy(s as unknown as Storage, "uid-b");
  assert.equal(legacyClaimedBy(s as unknown as Storage), "uid-a");
  assert.equal(s.getItem(LEGACY_CLAIMED_KEY), "uid-a");
  // dữ liệu cũ vẫn còn nguyên để lỡ cần quay lại
  assert.equal(
    (await legacy.load()).presets.some((x) => x.name === "Preset thời 9A"),
    true
  );
});

test("gateway: đệm dựng theo uid, kho cũ chỉ đọc khi chưa ai nhận", () => {
  const gate = readFileSync(
    new URL("../../src/nhipphach/presetGateway.ts", import.meta.url),
    "utf8"
  ).replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  assert.match(gate, /new LocalPresetRepository\(store, userId\)/, "đệm theo uid");
  assert.match(gate, /legacyClaimedBy\(store\)/);
  assert.match(gate, /claimed === null \|\| claimed === userId/);
  assert.match(gate, /claimLegacy\(store, userId\)/);
  // KHÔNG được dựng kho fallback không namespace cho người đã đăng nhập
  assert.equal(
    /ResilientPresetRepository\(cloud, new LocalPresetRepository\(store\)/.test(gate),
    false
  );
});

// ── ToolRouteGate: quyền tốt gần nhất gắn với phiên ─────────────────────────────
test("ToolRouteGate: quyền cache gắn với auth uid, đổi phiên là quên", () => {
  const gate = readFileSync(
    new URL("../../src/ToolRouteGate.tsx", import.meta.url),
    "utf8"
  );
  assert.match(gate, /lastGood=useRef<\{uid:string\|null;allowed:boolean\}\|null>/);
  // so uid trước khi dùng lại quyền cũ
  assert.match(gate, /lastGood\.current\.uid!==uid/);
  assert.match(gate, /lastGood\.current\.uid===uid/);
  // đăng xuất / đổi người dùng thì quên NGAY, không chờ poll
  assert.match(gate, /event==='SIGNED_OUT'\|\|event==='SIGNED_IN'\|\|event==='USER_UPDATED'/);
  assert.match(gate, /const forget=\(\)=>\{lastGood\.current=null/);
  // câu trả lời hợp lệ "không cho" phải chặn ngay, không giữ quyền cũ
  assert.match(gate, /setError\(false\);lastGood\.current=\{uid,allowed:data===true\}/);
  assert.equal(/if\(error\)[\s\S]{0,120}data===true/.test(gate), false);
});
