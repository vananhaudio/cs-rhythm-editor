/**
 * Play Scroll Share V1: thẻ hợp âm (Feed + Chat) theo tham chiếu version_id, URL /hopam/<id>, nút Chia sẻ chỉ ở bản đã duyệt.
 * DB (dm_share/chord_share_card/social_share_chord_sheet): db/chord_share_v1_setup.sql dryrun trên production + scripts kiểm quyền.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chordSheetRef, toShareRef, refId } from "../../src/share/shareRef";
import { chordCardView, REF_RESOLVERS } from "../../src/share/refCards";
import { describeToolShare, chordSheetHref } from "../../src/class-social/toolshare/registry";
import { ShareCardView } from "../../src/class-social/chat/ShareMessageCard";
import { hopamVersionFromPath } from "../../src/thuvien/HopamViewPage";
void React;

const V = "c1111111-0000-4000-8000-000000000009";
const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

test("tham chiếu chord_sheet: hợp lệ, chữ thường; có resolver", () => {
  assert.deepEqual(toShareRef("chord_sheet", V.toUpperCase()), { type: "chord_sheet", key: V });
  assert.equal(refId(chordSheetRef(V)), `chord_sheet:${V}`);
  assert.equal(typeof REF_RESOLVERS.chord_sheet, "function");
});

test("thẻ Feed: tên · tác giả · nhịp · BPM, nút Mở Play Scroll → /hopam/<id>; payload hỏng → null", () => {
  const v = describeToolShare({ v: 1, tool: "chord_sheet", kind: "chord_sheet", version_id: V, title: "Anh còn nợ em", composer: "Tác giả", meter: { beats: 4, beatType: 4 }, bpm: 76 })!;
  assert.equal(v.headline, "Anh còn nợ em");
  assert.equal(v.detail, "Tác giả · Nhịp 4/4 · 76 BPM");
  assert.deepEqual(v.action, { label: "Mở Play Scroll", href: `/hopam/${V}` });
  assert.deepEqual(v.shareRef, { type: "chord_sheet", key: V });
  assert.equal(chordSheetHref(V.toUpperCase()), `/hopam/${V}`);
  for (const bad of [{ version_id: "x" }, { title: "" }, { kind: "khac" }]) {
    assert.equal(describeToolShare({ v: 1, tool: "chord_sheet", kind: "chord_sheet", version_id: V, title: "T", ...bad }), null);
  }
});

test("thẻ Chat: chordCardView + ShareCardView hiện tên và nút mở; không lộ lời/hợp âm", () => {
  const view = chordCardView({ version_id: V, title: "Chuyến tàu", composer: null, meter: { beats: 2, beatType: 4 }, bpm: null })!;
  const html = renderToStaticMarkup(<ShareCardView view={view} />);
  assert.match(html, /Chuyến tàu/);
  assert.match(html, new RegExp(`/hopam/${V}`));
  assert.equal(chordCardView(null), null);
});

test("/hopam/<id>: chỉ nhận uuid; id lạ → null (không thử đọc)", () => {
  assert.equal(hopamVersionFromPath(`/hopam/${V}`), V);
  assert.equal(hopamVersionFromPath(`/hopam/${V}/`), V);
  for (const p of ["/hopam", "/hopam/", "/hopam/abc", `/hopam/${V}/x`, "/thuvien"]) assert.equal(hopamVersionFromPath(p), null, p);
});

test("rào chắn: route chỉ-xem không import trình sửa/quản trị; nút Chia sẻ chỉ khi current|old; engine không đổi", () => {
  const code = (f: string) => read(f).replace(/\/\/.*$/gm, "");
  const hop = code("src/thuvien/HopamViewPage.tsx");
  assert.doesNotMatch(hop, /ChordLibraryPage|ChordEditor|ThuVienPage|masterLibrary/);
  const page = code("src/thuvien/RhythmScrollPage.tsx");
  assert.match(page, /detail\.status === 'current' \|\| detail\.status === 'old'/);
  assert.match(page, /publishChordSheet\(detail\.versionId\)/);
  const mig = read("db/chord_share_v1_setup.sql");
  assert.match(mig, /review_status = 'approved' and s\.archived_at is null/);
  assert.match(mig, /revoke all on function public\.social_share_chord_sheet\(uuid\) from public, anon/);
  assert.doesNotMatch(mig, /create policy|create table|rls_setup/i);
});
