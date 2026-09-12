/**
 * Thư viện bài hát — kiểm chứng trên Supabase THẬT (bản local).
 *
 * Mọi phép kiểm quyền chạy bằng JWT thật của ba vai: thầy, học viên, khách.
 * `service_role` CHỈ dùng để dựng fixture (vai trò tài khoản, công tắc công cụ,
 * dọn dữ liệu cũ) — không bao giờ dùng để chứng minh RLS, vì nó đi vòng qua RLS.
 *
 * Cần: supabase start, và ba tài khoản teacher-a@ / teacher-b@ / student-c@test.local.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseScoreLibrary, BUCKET } from "../../src/nhipphach/libraryRepository.ts";

const API = "http://127.0.0.1:54321";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PW = "MatKhau123!";

/** Mỗi lần chạy có nội dung riêng, để dữ liệu sót của lần trước không chen vào. */
const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const xmlOf = (title: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${RUN} -->
<score-partwise version="3.1">
  <work><work-title>${title}</work-title></work>
  <identification><creator type="composer">Châu Kỳ</creator>
  <creator type="lyricist">Hồ Đình Phương</creator></identification>
  <part id="P1"><measure number="1"><attributes>
    <divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time>
  </attributes></measure></part>
</score-partwise>`;

let admin: SupabaseClient;
let thayA: SupabaseClient, thayB: SupabaseClient, hocVien: SupabaseClient, khach: SupabaseClient; // thayB = quản trị viên
let uidA = "", uidB = "", uidHV = "";
let khoA: SupabaseScoreLibrary, khoB: SupabaseScoreLibrary, khoHV: SupabaseScoreLibrary;
/** Dọn sạch những gì bộ test này tạo ra, không đụng dữ liệu khác. */
const DAU = "[test-thu-vien] ";

async function dangNhap(email: string) {
  const client = createClient(API, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { client, uid: data.user!.id };
}

async function donDep() {
  const { data } = await admin
    .from("nhipphach_scores")
    .select("id")
    .like("title", `${DAU}%`);
  for (const row of data ?? []) {
    const { data: vs } = await admin
      .from("nhipphach_score_versions")
      .select("storage_path")
      .eq("score_id", row.id);
    const paths = (vs ?? []).map((v) => v.storage_path as string);
    if (paths.length) await admin.storage.from(BUCKET).remove(paths);
    // Không xoá cứng được: trigger bất biến chặn cả DELETE đi qua cascade — đó
    // là hành vi CỐ Ý (mục "Bản gốc bất biến"). Dọn bằng cách lưu trữ; mỗi lần
    // chạy có nội dung riêng (RUN) nên dòng cũ không chen vào kết quả.
    await admin
      .from("nhipphach_scores")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", row.id);
  }
}

before(async () => {
  admin = createClient(API, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const a = await dangNhap("teacher-a@test.local");
  const b = await dangNhap("teacher-b@test.local");
  const hv = await dangNhap("student-c@test.local");
  thayA = a.client; uidA = a.uid;
  thayB = b.client; uidB = b.uid;
  hocVien = hv.client; uidHV = hv.uid;
  khach = createClient(API, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Fixture: vai trò và công tắc công cụ. Đây là thứ duy nhất service_role làm.
  // KHÔNG đụng teacher-b: tài khoản đó là QUẢN TRỊ VIÊN trong fixture chung của
  // các bộ test khác (nhipphach-caps). Ở đây nó đóng vai "người thứ hai có quyền
  // lưu" — admin có đủ mọi quyền nên vẫn đúng vai.
  await admin.from("app_users").upsert([
    { id: uidA, role: "teacher" },
    { id: uidHV, role: "student" },
  ]);
  await admin.from("edu_tools").upsert({ id: "nhipphach", enabled: true });
  khoA = new SupabaseScoreLibrary(thayA);
  khoB = new SupabaseScoreLibrary(thayB);
  khoHV = new SupabaseScoreLibrary(hocVien);
  await donDep();
});
after(async () => {
  await donDep();
});

// ── Lưu và phiên bản ──────────────────────────────────────────────────────
test("thầy lưu bài mới: có bài, có v1, con trỏ trỏ v1", async () => {
  const r = await khoA.save({ title: `${DAU}Con đường xưa em đi`, xml: xmlOf("A") });
  assert.equal(r.versionNumber, 1);
  assert.equal(r.createdScore, true);
  const versions = await khoA.versions(r.scoreId);
  assert.equal(versions.length, 1);
  assert.equal(versions[0].changeType, "original");
  const list = await khoA.list(DAU);
  const bai = list.find((s) => s.id === r.scoreId)!;
  assert.equal(bai.currentVersionNumber, 1);
  assert.equal(bai.versionCount, 1);
});

test("lưu tiếp tạo v2, con trỏ tiến, v1 KHÔNG đổi", async () => {
  const v1 = await khoA.save({ title: `${DAU}Hạ Trắng`, xml: xmlOf("B1") });
  const truoc = (await khoA.versions(v1.scoreId))[0];
  const v2 = await khoA.save({
    scoreId: v1.scoreId,
    title: `${DAU}Hạ Trắng`,
    xml: xmlOf("B2"),
    changeNote: "Sửa lời",
  });
  assert.equal(v2.versionNumber, 2);
  const versions = await khoA.versions(v1.scoreId);
  assert.deepEqual(versions.map((v) => v.versionNumber), [2, 1], "mới nhất đứng trước");
  const conNguyen = versions.find((v) => v.versionNumber === 1)!;
  assert.equal(conNguyen.storagePath, truoc.storagePath);
  assert.equal(conNguyen.sha256, truoc.sha256);
  assert.equal(versions[0].parentVersionId, truoc.id, "v2 nối vào v1");
  const bai = (await khoA.list(DAU)).find((s) => s.id === v1.scoreId)!;
  assert.equal(bai.currentVersionNumber, 2);
  // Nội dung v1 tải về vẫn đúng bản gốc.
  assert.match(await khoA.readVersion(conNguyen), /<work-title>B1<\/work-title>/);
});

test("phiên bản là BẤT BIẾN: sửa và xoá đều bị chặn", async () => {
  const r = await khoA.save({ title: `${DAU}Bất biến`, xml: xmlOf("C") });
  const v = (await khoA.versions(r.scoreId))[0];
  const sua = await thayA
    .from("nhipphach_score_versions")
    .update({ storage_path: "khac.musicxml" })
    .eq("id", v.id)
    .select();
  assert.ok(sua.error || (sua.data ?? []).length === 0, "không được sửa phiên bản");
  const xoa = await thayA
    .from("nhipphach_score_versions")
    .delete()
    .eq("id", v.id)
    .select();
  assert.ok(xoa.error || (xoa.data ?? []).length === 0, "không được xoá phiên bản");
  assert.equal((await khoA.versions(r.scoreId)).length, 1, "phiên bản vẫn còn đó");
});

// ── Quyền theo vai ────────────────────────────────────────────────────────
test("học viên ĐỌC được kho chung", async () => {
  const r = await khoA.save({ title: `${DAU}Học viên đọc`, xml: xmlOf("D") });
  const list = await khoHV.list(DAU);
  assert.ok(list.some((s) => s.id === r.scoreId), "học viên phải thấy bài của thầy");
  const versions = await khoHV.versions(r.scoreId);
  assert.equal(versions.length, 1);
  assert.match(await khoHV.readVersion(versions[0]), /score-partwise/);
});

test("học viên KHÔNG lưu được", async () => {
  await assert.rejects(
    () => khoHV.save({ title: `${DAU}Học viên tự lưu`, xml: xmlOf("E") }),
    "RLS phải chặn học viên ghi vào kho"
  );
  const con = await admin
    .from("nhipphach_scores")
    .select("id")
    .eq("title", `${DAU}Học viên tự lưu`);
  assert.equal((con.data ?? []).length, 0, "không được để lại bài nào");
});

test("khách chưa đăng nhập không đọc được gì", async () => {
  const kho = new SupabaseScoreLibrary(khach);
  const list = await kho.list(DAU).catch(() => null);
  assert.ok(list === null || list.length === 0, "khách không được thấy bài nào");
});

test("thầy khác cũng đọc và lưu được — kho là CHUNG", async () => {
  const r = await khoA.save({ title: `${DAU}Kho chung`, xml: xmlOf("F") });
  assert.ok((await khoB.list(DAU)).some((s) => s.id === r.scoreId));
  const v2 = await khoB.save({ scoreId: r.scoreId, title: `${DAU}Kho chung`, xml: xmlOf("F2") });
  assert.equal(v2.versionNumber, 2);
});

test("người gọi KHÔNG gán được chủ sở hữu khác cho mình", async () => {
  const { data, error } = await thayA.rpc("nhipphach_save_version", {
    score_json: {
      id: null,
      title: `${DAU}Mạo danh`,
      owner_id: uidB,
      created_by: uidB,
    },
    version_json: {
      storage_path: `gia/${Date.now()}.musicxml`,
      sha256: "f".repeat(64),
      size_bytes: 10,
      change_type: "original",
    },
  });
  assert.equal(error, null);
  const row = await admin
    .from("nhipphach_scores")
    .select("owner_id,created_by")
    .eq("id", (data as { score_id: string }).score_id)
    .single();
  assert.equal(row.data!.owner_id, uidA, "owner_id phải lấy từ phiên, không từ payload");
  assert.equal(row.data!.created_by, uidA);
});

// ── Storage ───────────────────────────────────────────────────────────────
test("bucket riêng tư: URL công khai không tải được", async () => {
  const r = await khoA.save({ title: `${DAU}Riêng tư`, xml: xmlOf("G") });
  const v = (await khoA.versions(r.scoreId))[0];
  const pub = `${API}/storage/v1/object/public/${BUCKET}/${v.storagePath}`;
  const res = await fetch(pub);
  assert.ok(!res.ok, `URL công khai phải bị từ chối, nhận ${res.status}`);
});

test("học viên tải về được nhưng KHÔNG tải lên được", async () => {
  const r = await khoA.save({ title: `${DAU}Chỉ đọc`, xml: xmlOf("H") });
  const v = (await khoA.versions(r.scoreId))[0];
  assert.match(await khoHV.readVersion(v), /score-partwise/);
  const len = await hocVien.storage
    .from(BUCKET)
    .upload(`${r.scoreId}/hv-chen-vao.musicxml`, new Blob([xmlOf("X")]));
  assert.ok(len.error, "học viên không được tải file lên kho");
});

test("khách không tải được file dù biết đường dẫn", async () => {
  const r = await khoA.save({ title: `${DAU}Khách thử`, xml: xmlOf("I") });
  const v = (await khoA.versions(r.scoreId))[0];
  const res = await khach.storage.from(BUCKET).download(v.storagePath);
  assert.ok(res.error, "khách không được tải file trong kho");
});

test("không ai ghi đè được object của một phiên bản đã lưu", async () => {
  const r = await khoA.save({ title: `${DAU}Không ghi đè`, xml: xmlOf("J") });
  const v = (await khoA.versions(r.scoreId))[0];
  const de = await thayA.storage
    .from(BUCKET)
    .upload(v.storagePath, new Blob([xmlOf("ĐÈ")]), { upsert: true });
  assert.ok(de.error, "object của phiên bản cũ phải bất khả xâm phạm");
  assert.match(await khoA.readVersion(v), /<work-title>J<\/work-title>/);
});

test("object của một phiên bản đã lưu thì KHÔNG ai xoá được", async () => {
  const r = await khoA.save({ title: `${DAU}Không xoá`, xml: xmlOf("P") });
  const v = (await khoA.versions(r.scoreId))[0];
  const xoa = await thayA.storage.from(BUCKET).remove([v.storagePath]);
  const conDo = await khoA.readVersion(v).catch(() => null);
  assert.ok(
    conDo !== null,
    `file của phiên bản đã lưu phải còn nguyên (remove trả: ${JSON.stringify(xoa.data)})`
  );
  assert.match(conDo!, /<work-title>P<\/work-title>/);
});

// ── Nguyên tử: hỏng ở giữa không được để lại rác ──────────────────────────
test("tải lên xong mà database hỏng thì object vừa tải bị dọn", async () => {
  const goc = await khoA.save({ title: `${DAU}Nguyên tử`, xml: xmlOf("K") });
  const truocVersions = await khoA.versions(goc.scoreId);
  const truocFiles = await admin.storage.from(BUCKET).list(goc.scoreId);
  const truocBai = (await khoA.list(DAU)).find((s) => s.id === goc.scoreId)!;

  // Lỗi THẬT ở phía database: ghi chú vượt 300 ký tự, CHECK constraint từ chối.
  await assert.rejects(
    () =>
      khoA.save({
        scoreId: goc.scoreId,
        title: `${DAU}Nguyên tử`,
        xml: xmlOf("K2"),
        changeNote: "x".repeat(400),
      }),
    "payload sai phải làm hỏng cả lượt lưu"
  );

  const sauVersions = await khoA.versions(goc.scoreId);
  assert.equal(sauVersions.length, truocVersions.length, "không được sinh phiên bản mới");
  const sauBai = (await khoA.list(DAU)).find((s) => s.id === goc.scoreId)!;
  assert.equal(sauBai.currentVersionNumber, truocBai.currentVersionNumber, "con trỏ không đổi");
  const sauFiles = await admin.storage.from(BUCKET).list(goc.scoreId);
  assert.equal(
    (sauFiles.data ?? []).length,
    (truocFiles.data ?? []).length,
    "object vừa tải lên phải được dọn, không để lại rác"
  );

  // Ngay sau đó, payload hợp lệ vẫn lưu được bình thường.
  const lai = await khoA.save({
    scoreId: goc.scoreId,
    title: `${DAU}Nguyên tử`,
    xml: xmlOf("K3"),
    changeNote: "Lần này hợp lệ",
  });
  assert.equal(lai.versionNumber, truocVersions.length + 1);
  assert.equal((await admin.storage.from(BUCKET).list(goc.scoreId)).data!.length,
    (truocFiles.data ?? []).length + 1);
});

test("tải lên hỏng thì KHÔNG có dòng nào trong database", async () => {
  const goc = await khoA.save({ title: `${DAU}Tải hỏng`, xml: xmlOf("L") });
  const truoc = await khoA.versions(goc.scoreId);
  // Vượt giới hạn 10MB của bucket: lỗi thật ở tầng Storage, trước khi tới RPC.
  const qua = xmlOf("L2") + " ".repeat(11 * 1024 * 1024);
  await assert.rejects(
    () => khoA.save({ scoreId: goc.scoreId, title: `${DAU}Tải hỏng`, xml: qua }),
    "file quá lớn phải bị Storage từ chối"
  );
  const sau = await khoA.versions(goc.scoreId);
  assert.equal(sau.length, truoc.length, "không được tạo dòng trỏ tới file không tồn tại");
  const bai = (await khoA.list(DAU)).find((s) => s.id === goc.scoreId)!;
  assert.equal(bai.currentVersionNumber, truoc.length);
});

// ── Dò trùng ──────────────────────────────────────────────────────────────
test("cùng nội dung thì nhận ra dù tên file khác", async () => {
  const xml = xmlOf("M");
  const r = await khoA.save({
    title: `${DAU}Bản gốc`,
    sourceFilename: "ten-mot.musicxml",
    xml,
  });
  const trung = await khoA.findDuplicate(xml);
  assert.ok(trung, "phải nhận ra bản nhạc đã có");
  assert.equal(trung!.scoreId, r.scoreId);
  assert.equal(trung!.versionNumber, 1);
  // Khác một ký tự là bản khác.
  assert.equal(await khoA.findDuplicate(xml + "\n"), null);
  // Học viên cũng dò được vì có quyền đọc.
  assert.ok(await khoHV.findDuplicate(xml));
});

test("người dùng vẫn được quyền lưu thành bài mới dù trùng", async () => {
  const xml = xmlOf("N");
  const mot = await khoA.save({ title: `${DAU}Trùng 1`, xml });
  const hai = await khoA.save({ title: `${DAU}Trùng 2`, xml });
  assert.notEqual(mot.scoreId, hai.scoreId, "hai bài riêng biệt");
  const v1 = (await khoA.versions(mot.scoreId))[0];
  const v2 = (await khoA.versions(hai.scoreId))[0];
  assert.equal(v1.sha256, v2.sha256, "cùng nội dung, cùng hash");
  assert.notEqual(v1.storagePath, v2.storagePath, "nhưng hai object riêng");
});

// ── Tìm kiếm ──────────────────────────────────────────────────────────────
test("tìm theo tên bài và tên tác giả, có dấu tiếng Việt", async () => {
  await khoA.save({
    title: `${DAU}Diễm Xưa`,
    composer: "Trịnh Công Sơn",
    xml: xmlOf("O"),
  });
  assert.ok((await khoA.list("Diễm")).some((s) => s.title.includes("Diễm Xưa")));
  assert.ok((await khoA.list("Trịnh Công")).some((s) => s.composer === "Trịnh Công Sơn"));
  assert.equal((await khoA.list("không-có-bài-nào-tên-này")).length, 0);
});
