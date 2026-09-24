import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { copyMasterToNhipPhach } from "../../src/nhipphach/masterCopy.ts";
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
