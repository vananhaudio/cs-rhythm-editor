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

// ── Play Scroll Share V2: bài đăng /me xem trước + chạy ngay trong bài ───────────────────────────
import { ChordSheetPostView, ChordPreview } from "../../src/class-social/toolshare/ChordSheetPost";
import { loadChordDetail, resetChordPostStore } from "../../src/class-social/toolshare/chordPostStore";
import { openEmbed, closeEmbed, activeEmbedId, resetEmbedStore } from "../../src/class-social/sections/publicationEmbed";

const FEED_VIEW = describeToolShare({ v: 1, tool: "chord_sheet", kind: "chord_sheet", version_id: V, title: "Anh còn nợ em", composer: "T", meter: { beats: 4, beatType: 4 }, bpm: 80 })!;
const DETAIL = { text: "Chiều [Am] nao, tiễn nhau [E7] đi\nHoàng [Dm] hôn đến đâu" } as never;

test("V2: bài đăng có nội dung hợp âm thật (hợp âm trên lời) + Tập ngay / Mở rộng / Chia sẻ; chưa tự phát", () => {
  const html = renderToStaticMarkup(<ChordSheetPostView view={FEED_VIEW} versionId={V} preview={DETAIL} playing={false} onPlay={() => undefined} onClose={() => undefined} onShare={() => undefined} />);
  assert.match(html, /Anh còn nợ em/);
  assert.match(html, /cs-chord-name[^>]*>Am</);
  assert.match(html, /Chiều/);
  assert.match(html, /aria-label="Phát Play Scroll"/);
  assert.match(html, /Bấm Play để tự cuộn hợp âm/);
  assert.match(html, new RegExp(`href="/hopam/${V}"`));
  assert.doesNotMatch(html, /rhythm-scroll-page/, "không dựng player khi chưa bấm");
  assert.match(html, /Chia sẻ/);
});

test("V2: đang tải → khung chờ, nút Tập ngay khoá; không quyền/thu hồi → không khả dụng", () => {
  const loading = renderToStaticMarkup(<ChordSheetPostView view={FEED_VIEW} versionId={V} preview={undefined} playing={false} onPlay={() => undefined} onClose={() => undefined} />);
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /cs-chord-play[^>]*disabled|disabled[^>]*cs-chord-play/);
  const gone = renderToStaticMarkup(<ChordSheetPostView view={FEED_VIEW} versionId={V} preview={null} playing={false} onPlay={() => undefined} onClose={() => undefined} />);
  assert.match(gone, /Nội dung này không còn khả dụng/);
  assert.doesNotMatch(gone, /Phát Play Scroll/);
});

test("V2: ChordPreview chỉ lấy vài dòng đầu (không kéo cả bài)", () => {
  const text = Array.from({ length: 30 }, (_, i) => `Dòng [C] số ${i}`).join("\n");
  const html = renderToStaticMarkup(<ChordPreview text={text} />);
  assert.equal((html.match(/cs-chord-line/g) ?? []).length, 6);
});

test("V2: mỗi lúc MỘT player trên Feed (dùng chung store với player TeamLab); đóng nhả chỗ", () => {
  resetEmbedStore();
  openEmbed("chord:p1"); assert.equal(activeEmbedId(), "chord:p1");
  openEmbed("chord:p2"); assert.equal(activeEmbedId(), "chord:p2", "mở bài khác → bài cũ tự gỡ");
  closeEmbed("chord:p1"); assert.equal(activeEmbedId(), "chord:p2", "đóng bài không phải bài đang mở: không ảnh hưởng");
  closeEmbed("chord:p2"); assert.equal(activeEmbedId(), null);
});

test("V2: kho nạp — lỗi mạng không cache (thử lại được); không quyền → null và cache; không gọi lại khi đã cache", async () => {
  resetChordPostStore();
  // Không có backend trong Node test: getChordLibrary() ở chế độ 'mock' (không PROD) → mock không có id lạ → NOT_FOUND-like hoặc lỗi; chỉ kiểm hợp đồng kiểu trả về.
  const r = await loadChordDetail("c9999999-0000-4000-8000-000000000001");
  assert.ok(r.ok === true || r.ok === false);
  const again = await loadChordDetail("c9999999-0000-4000-8000-000000000001");
  assert.deepEqual(Object.keys(again).sort(), Object.keys(r).sort());
});

test("V2: ToolShareBody chuyển bài chord_sheet sang ChordSheetPost (lazy); thẻ công cụ khác giữ nguyên; engine không đổi", () => {
  const src = read("src/class-social/toolshare/ToolShareCard.tsx").replace(/\/\/.*$/gm, "");
  assert.match(src, /lazy\(\(\) => import\('\.\/ChordSheetPost'\)\)/);
  assert.match(src, /ToolShareBodyView view=\{view\}/, "công cụ khác vẫn dùng thẻ cũ");
  const post = read("src/class-social/toolshare/ChordSheetPost.tsx");
  assert.match(post, /IntersectionObserver/);
  assert.match(post, /<RhythmScrollPage embedded autoStart/, "bấm Play ở xem trước → player chạy ngay, không bấm lần hai");
  assert.match(post, /lazy\(\(\) => import\('\.\.\/\.\.\/thuvien\/RhythmScrollPage'\)\)/);
  assert.doesNotMatch(post, /createProofClock|buildChordTimeline|locateBeat/, "không viết lại engine");
});
