/**
 * Lưu nháp thành phiên bản mới — trên Supabase THẬT (bản local), JWT thật của thầy.
 *
 * Điều phải thấy bằng mắt: (1) mọi thao tác nháp (áp/hoàn tác/làm lại/huỷ)
 * không tạo một object hay một dòng nào; (2) Lưu → vN+1 trỏ về vN, loại "edit";
 * (3) object của vN không đổi một byte; (4) nháp không qua kiểm tra → không có
 * gì mới trong Storage lẫn database.
 *
 * Cần: supabase start + teacher-a@test.local (mật khẩu MatKhau123!).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseScoreLibrary, BUCKET } from "../../src/nhipphach/libraryRepository.ts";
import { sha256Hex } from "../../src/nhipphach/scoreHash.ts";
import { appliedCommands, applyToDraft, cancelDraft, createDraft, redo, undo } from "../../src/nhipphach/edit/draftEngine.ts";
import { describeCommands } from "../../src/nhipphach/edit/commands.ts";
import { saveDraftAsVersion } from "../../src/nhipphach/edit/versionSave.ts";
import { createAnnotatedScoreRenderer } from "../../src/musicxml-beats/renderer/verovioAdapter.ts";

const API = "http://127.0.0.1:54321";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PW = "MatKhau123!";
const DAU = "[test-bien-tap] ";
const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const FX = readFileSync(new URL("./fixtures/edit-toolkit.musicxml", import.meta.url), "utf8")
  .replace("<work-title>Bộ công cụ biên tập — fixture</work-title>", `<work-title>${DAU}${RUN}</work-title>`);
const P22 = "/score-partwise/part[1]/measure[2]/*[2]";
const P23 = "/score-partwise/part[1]/measure[2]/*[3]";

let admin: SupabaseClient, thay: SupabaseClient, kho: SupabaseScoreLibrary;
let renderer: Awaited<ReturnType<typeof createAnnotatedScoreRenderer>>;
let scoreId = "", v1Id = "", v1Path = "";

const objects = async (folder: string) => {
  const { data, error } = await admin.storage.from(BUCKET).list(folder, { limit: 1000 });
  if (error) throw new Error(error.message);
  return (data ?? []).map((o) => o.name).sort();
};
const versions = async () => {
  const { data, error } = await admin
    .from("nhipphach_score_versions")
    .select("id, version_number, parent_version_id, storage_path, sha256, change_type, change_note")
    .eq("score_id", scoreId)
    .order("version_number");
  if (error) throw new Error(error.message);
  return data ?? [];
};

before(async () => {
  admin = createClient(API, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  thay = createClient(API, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await thay.auth.signInWithPassword({ email: "teacher-a@test.local", password: PW });
  if (error) throw new Error(error.message);
  kho = new SupabaseScoreLibrary(thay);
  renderer = await createAnnotatedScoreRenderer();
  const v1 = await kho.save({ title: `${DAU}${RUN}`, sourceFilename: "fixture.musicxml", xml: FX });
  scoreId = v1.scoreId;
  const [row] = await versions();
  v1Id = row.id as string;
  v1Path = row.storage_path as string;
});

after(async () => {
  renderer?.destroy();
  // Dọn: object thì xoá được; dòng phiên bản bất biến nên chỉ lưu trữ bài (đúng thiết kế).
  if (scoreId) {
    const paths = (await versions()).map((v) => v.storage_path as string);
    if (paths.length) await admin.storage.from(BUCKET).remove(paths);
    await admin.from("nhipphach_scores").update({ archived_at: new Date().toISOString() }).eq("id", scoreId);
  }
});

test("áp / hoàn tác / làm lại / huỷ: không một object, không một dòng nào được tạo", async () => {
  const truocObj = await objects(scoreId), truocVer = await versions();
  assert.equal(truocObj.length, 1);
  assert.equal(truocVer.length, 1);
  let d = createDraft(FX);
  d = applyToDraft(d, { type: "ChangePitch", path: P22, pitch: { step: "F", alter: 1, octave: 4 } });
  d = applyToDraft(d, { type: "ChangeLyricText", path: P22, lyricNumber: "1", text: "Đường" });
  d = redo(undo(d));
  d = cancelDraft(d);
  assert.equal(d.xml, FX);
  assert.deepEqual(await objects(scoreId), truocObj);
  assert.deepEqual(await versions(), truocVer);
});

test("nháp không qua kiểm tra: không có gì mới trong Storage lẫn database", async () => {
  const truocObj = await objects(scoreId);
  const out = await saveDraftAsVersion({
    library: kho, scoreId, sourceFilename: "fixture.musicxml", original: FX,
    draft: FX.replace("<step>E</step>", "<step>H</step>"), changeNote: "hỏng", pageCount: 1,
    render: (x) => renderer.render(x),
  });
  assert.equal(out.result, null);
  assert.equal(out.report.ok, false);
  assert.deepEqual(await objects(scoreId), truocObj);
  assert.equal((await versions()).length, 1);
});

test("Lưu → v2 trỏ về v1, loại 'edit', đúng nội dung nháp; object v1 không đổi một byte", async () => {
  const goc = await kho.readVersion({ storagePath: v1Path });
  assert.equal(goc, FX);
  const shaGoc = await sha256Hex(goc);
  let d = createDraft(FX);
  d = applyToDraft(d, { type: "ChangePitch", path: P22, pitch: { step: "F", alter: 1, octave: 4 } });
  d = applyToDraft(d, { type: "RespellNote", path: P22, pitch: { step: "G", alter: -1, octave: 4 } });
  // Đổi trường độ theo CẶP để ô nhịp vẫn đủ phách — nếu không, cổng nhịp chặn
  // lưu (đúng như nó phải làm) và ta không kiểm được bước tạo phiên bản.
  d = applyToDraft(d, { type: "ChangeDuration", path: P22, noteType: "eighth", dots: 0 });
  d = applyToDraft(d, { type: "ChangeDuration", path: P23, noteType: "quarter", dots: 1 });
  d = applyToDraft(d, { type: "ChangeLyricText", path: P22, lyricNumber: "1", text: "Đường" });
  const out = await saveDraftAsVersion({
    library: kho, scoreId, sourceFilename: "fixture.musicxml", original: d.original, draft: d.xml,
    changeNote: describeCommands(appliedCommands(d)), pageCount: 1, render: (x) => renderer.render(x),
  });
  assert.equal(out.report.ok, true, JSON.stringify(out.report.stages));
  assert.equal(out.result?.versionNumber, 2);
  assert.equal(out.result?.scoreId, scoreId);
  const vs = await versions();
  assert.equal(vs.length, 2);
  const [v1, v2] = vs;
  assert.equal(v1.id, v1Id);
  assert.equal(v1.sha256, shaGoc);
  assert.equal(v2.parent_version_id, v1Id);
  assert.equal(v2.change_type, "edit");
  assert.equal(v2.change_note, "Sửa cao độ 1 nốt · đổi cách ghi 1 nốt · sửa trường độ 2 nốt · sửa lời 1 chỗ");
  assert.equal(v2.sha256, await sha256Hex(d.xml));
  assert.notEqual(v2.storage_path, v1.storage_path);
  // Đọc lại từ Storage: v1 vẫn là bản gốc, v2 đúng là nháp — cùng byte, cùng hash.
  assert.equal(await kho.readVersion({ storagePath: v1.storage_path as string }), FX);
  assert.equal(await kho.readVersion({ storagePath: v2.storage_path as string }), d.xml);
  assert.equal((await objects(scoreId)).length, 2);
  // Bài trỏ vào v2 là bản hiện hành.
  const { data: bai } = await admin.from("nhipphach_scores").select("current_version_id").eq("id", scoreId).single();
  assert.equal(bai?.current_version_id, v2.id);
  // Phiên bản cũ bất biến: đổi nội dung v1 bị chặn, kể cả bằng service role.
  const { error } = await admin.from("nhipphach_score_versions").update({ change_note: "x" }).eq("id", v1Id);
  assert.ok(error, "trigger bất biến phải chặn UPDATE");
});
