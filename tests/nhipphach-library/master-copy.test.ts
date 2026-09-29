import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { copyMasterToNhipPhach, findExistingCopy, openExistingCopy } from "../../src/nhipphach/masterCopy.ts";
import { byteLength, sha256Hex } from "../../src/nhipphach/scoreHash.ts";
import type { SaveRequest } from "../../src/nhipphach/libraryRepository.ts";

const a = readFileSync(new URL("../musicxml-beats/fixtures/simple-4-4.musicxml", import.meta.url), "utf8");
const b = a.replace(/<step>C<\/step>/, "<step>D</step>");

test("Master copy becomes an independent Nhịp Phách version", async () => {
  const versions: SaveRequest[] = [];
  const library = { async save(request: SaveRequest) {
    versions.push({ ...request });
    return { scoreId: `score-${versions.length}`, versionId: `version-${versions.length}`, versionNumber: 1, createdScore: true };
  } };
  const masterA = { id: "master-1", title: "Bài A", composer: null, originalFilename: "a.musicxml",
    musicxmlText: a, contentHash: await sha256Hex(a), sizeBytes: byteLength(a) };
  await copyMasterToNhipPhach(masterA, library);
  const masterB = { ...masterA, musicxmlText: b, contentHash: await sha256Hex(b), sizeBytes: byteLength(b) };
  assert.equal(versions[0].xml, a);
  assert.equal(versions[0].scoreId, undefined, "copy creates a new Nhịp Phách score");
  assert.equal(masterB.contentHash, await sha256Hex(b));
  await library.save({ title: "Bản sửa", xml: b, scoreId: "score-1" });
  assert.equal(masterB.musicxmlText, b, "consumer edit does not write to Master");
  assert.equal(versions[0].xml, a);
  await assert.rejects(copyMasterToNhipPhach({ ...masterA, contentHash: masterB.contentHash }, library));
});

/** Kho Nhịp Phách trong bộ nhớ: dò trùng theo SHA-256 y như SupabaseScoreLibrary. */
function memoryLibrary() {
  type V = { id: string; scoreId: string; versionNumber: number; storagePath: string; sha256: string; xml: string };
  const scores: { id: string; title: string }[] = [], rows: V[] = [];
  let n = 0;
  return {
    scores, rows,
    async findDuplicate(xml: string) {
      const sha = await sha256Hex(xml), v = rows.find(x => x.sha256 === sha);
      return v ? { scoreId: v.scoreId, title: scores.find(s => s.id === v.scoreId)!.title, versionNumber: v.versionNumber } : null;
    },
    async versions(scoreId: string) {
      return rows.filter(v => v.scoreId === scoreId).sort((x, y) => y.versionNumber - x.versionNumber)
        .map(v => ({ id: v.id, scoreId, versionNumber: v.versionNumber, parentVersionId: null, storagePath: v.storagePath,
          sha256: v.sha256, sizeBytes: byteLength(v.xml), changeType: "import" as const, changeNote: null, createdAt: "" }));
    },
    async readVersion(v: { storagePath: string }) { return rows.find(x => x.storagePath === v.storagePath)!.xml; },
    async save(request: SaveRequest) {
      const scoreId = request.scoreId ?? `score-${++n}`;
      if (!request.scoreId) scores.push({ id: scoreId, title: request.title });
      const versionNumber = rows.filter(v => v.scoreId === scoreId).length + 1, id = `v-${rows.length + 1}`;
      rows.push({ id, scoreId, versionNumber, storagePath: `${scoreId}/${id}`, sha256: await sha256Hex(request.xml), xml: request.xml });
      return { scoreId, versionId: id, versionNumber, createdScore: !request.scoreId };
    },
  };
}

test("Duplicate: same SHA-256 is found; open-existing creates nothing; create-new is explicit", async () => {
  const library = memoryLibrary();
  const master = { id: "m1", title: "Diễm xưa", composer: null, originalFilename: "a.musicxml",
    musicxmlText: a, contentHash: await sha256Hex(a), sizeBytes: byteLength(a) };
  const before = { xml: master.musicxmlText, hash: master.contentHash };

  assert.equal(await findExistingCopy(master, library), null, "lần đầu: chưa có bản trùng");
  const first = await copyMasterToNhipPhach(master, library);
  assert.equal(library.rows[0].xml, a, "bản sao khớp byte với bản gốc");
  assert.equal(library.rows[0].sha256, master.contentHash);

  // Master KHÁC id, KHÁC tên nhưng cùng XML vẫn là trùng — tên không phải định danh.
  const hit = await findExistingCopy({ ...master, id: "m2", title: "Tên khác" }, library);
  assert.deepEqual(hit, { scoreId: first.scoreId, title: "Diễm xưa", versionNumber: 1 });

  // Bản sao đã được sửa trong Nhịp Phách → "Mở bản đã có" mở bản HIỆN HÀNH, không tạo gì.
  await library.save({ scoreId: first.scoreId, title: "Diễm xưa", xml: b });
  const counts = [library.scores.length, library.rows.length];
  const opened = await openExistingCopy(hit!, library);
  assert.deepEqual([library.scores.length, library.rows.length], counts, "mở bản đã có: không tăng score/version");
  assert.deepEqual({ ...opened, xml: opened.xml === b }, { xml: true, name: "Diễm xưa", scoreId: first.scoreId, versionId: "v-2", versionNumber: 2, isCurrent: true });

  // Người dùng chủ động "Tạo thêm bản mới" → đúng pipeline cũ, một bài độc lập nữa.
  const second = await copyMasterToNhipPhach(master, library);
  assert.notEqual(second.scoreId, first.scoreId);
  assert.equal(library.scores.length, 2);

  // Bản gốc không đổi byte nào, hash không đổi.
  assert.equal(master.musicxmlText, before.xml);
  assert.equal(master.contentHash, before.hash);
  assert.equal(await sha256Hex(master.musicxmlText), before.hash);
});

test("Different XML is not a duplicate even with the same title", async () => {
  const library = memoryLibrary();
  const master = { id: "m1", title: "Bài A", composer: null, originalFilename: "a.musicxml",
    musicxmlText: a, contentHash: await sha256Hex(a), sizeBytes: byteLength(a) };
  await copyMasterToNhipPhach(master, library);
  assert.equal(await findExistingCopy({ ...master, musicxmlText: b, contentHash: await sha256Hex(b), sizeBytes: byteLength(b) }, library), null);
});
