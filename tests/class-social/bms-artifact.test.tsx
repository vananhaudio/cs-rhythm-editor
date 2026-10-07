// BMS Artifact Share V1 — registry thẻ Feed, chuyển nháp ⇄ artifact, local-first, route chỉ-luyện.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describeToolShare } from "../../src/class-social/toolshare/registry";
import { ToolShareBodyView } from "../../src/class-social/toolshare/ToolShareCard";
import { draftFromArtifact, isArtifactId, songPayloadFromDraft, songShareBlocker } from "../../src/bms/bmsArtifact";
import BmsArtifactPage from "../../src/bms/BmsArtifactPage";
import { makeAnchor } from "../../src/logic/songBuilder";
import type { SongDraft } from "../../src/logic/songDraftStorage";

void React;
const ART = "6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f";
const share = { v: 1, tool: "bms", kind: "song", artifact_id: ART, title: "Có Chàng Trai Viết Lên Cây", video_id: "dQw4w9WgXcQ",
  bpm: 76, beats_per_bar: 4, chord_count: 3, client_key: "k" };
const draft = (o: Partial<SongDraft> = {}): SongDraft => ({
  id: "d_local1", title: "Có Chàng Trai", youtubeUrl: "https://youtu.be/dQw4w9WgXcQ?t=3", videoId: "dQw4w9WgXcQ", thumbnail: "https://evil.test/x.jpg",
  lyricsText: "Có chàng trai viết lên cây\nlời yêu thương",
  fit: { ok: true, fitted: true, bpm: 76.4, beatDuration: 0.7853, gridOffset: 1.25, validTaps: 12, rejected: 0, avgError: 0.01, maxError: 0.02, assign: [{ t: 1, n: 0 }] },
  timeSignature: 4, downbeatPosition: 1, groupBeats: true,
  anchors: [makeAnchor(0, "Có", 0), makeAnchor(6, "lời", 8)], chords: [{ wordIndex: 0, name: "Am" }, { wordIndex: 3, name: "F" }],
  step: 5, createdAt: 1, updatedAt: 2, ...o,
});

test("thẻ Feed BMS: BMS · Dựng bài hát → tên bài → BPM · nhịp · hợp âm → thumbnail → Luyện bài này", () => {
  const v = describeToolShare(share)!;
  assert.equal(v.toolLabel, "BMS"); assert.equal(v.kindLabel, "Dựng bài hát");
  assert.equal(v.headline, "Có Chàng Trai Viết Lên Cây");
  assert.equal(v.detail, "76 BPM · 4/4 · 3 hợp âm");
  assert.equal(v.thumbnail, "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");
  assert.deepEqual(v.action, { label: "Luyện bài này", href: `/song-builder?artifact=${ART}` });
  assert.equal(describeToolShare({ ...share, chord_count: 0 })!.detail, "76 BPM · 4/4", "không hợp âm → không ghi '0 hợp âm'");
  const h = renderToStaticMarkup(<ToolShareBodyView view={v} />);
  assert.match(h, /BMS · Dựng bài hát[\s\S]*Có Chàng Trai Viết Lên Cây[\s\S]*76 BPM · 4\/4 · 3 hợp âm[\s\S]*<img class="cs-tool-share-thumb" src="https:\/\/i\.ytimg\.com\/vi\/dQw4w9WgXcQ\/mqdefault\.jpg"[\s\S]*>Luyện bài này<\/a>/);
  assert.ok(!/client_key|artifact_id|\{/.test(h.replace(/href="[^"]*"/g, "")));
});

test("thẻ Feed BMS: payload hỏng / id lạ → không hiện CTA chết, không crash", () => {
  for (const bad of [{ ...share, artifact_id: "../x" }, { ...share, artifact_id: 5 }, { ...share, video_id: "javascript:1" }, { ...share, title: "" },
    { ...share, title: "x".repeat(121) }, { ...share, bpm: 999 }, { ...share, beats_per_bar: 1 }, { ...share, chord_count: -1 }, { ...share, kind: "draft" }]) {
    assert.equal(describeToolShare(bad), null, JSON.stringify(bad));
  }
});

test("chỉ bài đủ dữ liệu mới chia sẻ được; lý do rõ ràng", () => {
  assert.equal(songShareBlocker(draft()), null);
  assert.match(songShareBlocker(draft({ videoId: null }))!, /video/);
  assert.match(songShareBlocker(draft({ fit: null }))!, /nhịp/);
  assert.match(songShareBlocker(draft({ anchors: [] }))!, /mốc/);
  assert.match(songShareBlocker(draft({ lyricsText: " " }))!, /lời/);
  assert.match(songShareBlocker(draft({ lyricsText: "a ".repeat(4001) }))!, /quá dài/);
});

test("payload gửi server: chỉ trường cần để tái tạo bài (không id nháp / tap thô / thumbnail / youtubeUrl)", () => {
  const p = songPayloadFromDraft(draft())!;
  assert.deepEqual(Object.keys(p).sort(), ["anchors", "chords", "downbeat_position", "fit", "group_beats", "lyrics", "time_signature", "title", "video_id"]);
  assert.deepEqual(p.fit, { bpm: 76.4, beat_duration: 0.7853, grid_offset: 1.25 });
  assert.deepEqual(p.anchors, [{ word_index: 0, beat_index: 0 }, { word_index: 6, beat_index: 8 }]);
  assert.ok(!JSON.stringify(p).includes("evil.test") && !JSON.stringify(p).includes("d_local1") && !JSON.stringify(p).includes("assign"));
  assert.equal(songPayloadFromDraft(draft({ anchors: [] })), null);
});

test("artifact → bài chỉ-luyện: đúng lưới nhịp, mốc, hợp âm; dữ liệu hỏng → null", () => {
  const p = songPayloadFromDraft(draft())!;
  const server = { schema: "bms.song", v: 1, ...p };   // như bms_song_normalize trả về
  const d = draftFromArtifact(ART, server)!;
  assert.equal(d.title, "Có Chàng Trai"); assert.equal(d.videoId, "dQw4w9WgXcQ");
  assert.equal(d.fit!.bpm, 76.4); assert.equal(d.fit!.beatDuration, 0.7853); assert.equal(d.fit!.gridOffset, 1.25); assert.equal(d.fit!.ok, true);
  assert.deepEqual(d.anchors.map(a => [a.wordIndex, a.word, a.beatIndex, a.tick]), [[0, "Có", 0, 0], [6, "lời", 8, 3840]]);
  assert.deepEqual(d.chords, [{ wordIndex: 0, name: "Am" }, { wordIndex: 3, name: "F" }]);
  assert.equal(d.timeSignature, 4); assert.equal(d.downbeatPosition, 1); assert.equal(d.groupBeats, true);
  // mốc/hợp âm trỏ ra ngoài lời → bỏ, không crash
  const odd = draftFromArtifact(ART, { ...server, anchors: [{ word_index: 99, beat_index: 1 }, { word_index: 1, beat_index: 2 }], chords: [{ word_index: 99, name: "C" }] })!;
  assert.deepEqual(odd.anchors.map(a => a.wordIndex), [1]); assert.deepEqual(odd.chords, []);
  for (const bad of [null, [], "x", { ...server, schema: "other" }, { ...server, v: 2 }, { ...server, video_id: "x" }, { ...server, fit: null }, { ...server, anchors: null }]) {
    assert.equal(draftFromArtifact(ART, bad), null, JSON.stringify(bad)?.slice(0, 40));
  }
  assert.equal(isArtifactId(ART), true); assert.equal(isArtifactId("abc"), false); assert.equal(isArtifactId(null), false);
});

test("trang chỉ-luyện: trạng thái đang mở, không có nút lưu/sửa", () => {
  const h = renderToStaticMarkup(<BmsArtifactPage artifactId={ART} />);
  assert.match(h, /Đang mở bài…/);
  const src = readFileSync("src/bms/BmsArtifactPage.tsx", "utf8");
  assert.ok(!/saveDraft|saveScratch|autosave|from\('tool_artifacts'\)\.(update|insert|upsert)/.test(src), "không ghi nháp / không sửa artifact");
  assert.match(src, /chỉ luyện, không sửa bài gốc/);
  assert.match(src, /không còn được chia sẻ/);
});

test("local-first: kho nháp + trình dựng KHÔNG gọi server; chỉ nút Chia sẻ mới gọi (qua prop)", () => {
  assert.ok(!/supabase/.test(readFileSync("src/logic/songDraftStorage.ts", "utf8")));
  const sb = readFileSync("src/SongBuilderPage.tsx", "utf8");
  assert.ok(!/supabase|social_share_tool_result|bms_save_for_share|social_publish_tool_artifact/.test(sb), "SongBuilderPage không tự gọi server");
  assert.match(sb, /bmsShare\.save\(buildDraft\(\)\)/);
  const r = readFileSync("src/AppRouter.tsx", "utf8");
  assert.match(r, /bmsShare=\{user && !embedded && !standalone \? bmsShareApi : undefined\}/);
  assert.match(r, /if \(artifactId !== null\) return <BmsArtifactPage artifactId=\{artifactId\} \/>/);
  assert.ok(!/onShareSong|bmsShare/.test(readFileSync("src/MobileStudentPortal.tsx", "utf8")), "BMS nhúng trong App học không có chia sẻ");
});
