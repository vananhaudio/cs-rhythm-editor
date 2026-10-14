import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  entryKey, isPostEntry, isPublicationEntry, isThreadEntry, teamAssetUrl, toFeedEntries, toPublicationEntry, type MixedRow,
} from "../../src/class-social/posts/postModel";
import FeedEntryCard from "../../src/class-social/sections/FeedEntryCard";
import PublicationCard from "../../src/class-social/sections/PublicationCard";
void React;

const PID = "11111111-2222-4333-8444-555555555555";
const NOW = new Date("2026-10-14T10:00:00Z");
const pub = (over: Record<string, unknown> = {}) => ({
  publication_id: "aaaaaaaa-0000-4000-8000-000000000001", project_id: PID, slug: "dem-nang-gia-ban", title: "Đêm nàng giả bạn",
  band_name: "Mưa Thu", project_name: "Team Mưa Thu", cover_path: `${PID}/cover-1700000000-ab12cd34.jpg`, avatar_path: `${PID}/av-1.jpg`,
  published_at: "2026-10-13T09:00:00Z", ...over,
});
const row = (post: unknown, over: Partial<MixedRow> = {}): MixedRow => ({ kind: "teamlab_publication", sort_at: "2026-10-13T09:00:00Z", sort_key: "u:aaaaaaaa-0000-4000-8000-000000000001", post, thread: null, ...over });

test("toFeedEntries: mục teamlab_publication → một thẻ; đúng thứ tự server; kind lạ bị bỏ", () => {
  const e = toFeedEntries([row(pub()), { kind: "post", sort_at: "2026-10-12T00:00:00Z", sort_key: "p:x", post: null, thread: null }, { ...row(pub()), kind: "khac" }]);
  assert.equal(e.length, 1);
  const u = e[0];
  assert.ok(isPublicationEntry(u));
  assert.equal(isThreadEntry(u), false);
  assert.equal(isPostEntry(u), false, "không bị coi là bài Social (không nạp bình luận)");
  assert.equal(entryKey(u), "u:aaaaaaaa-0000-4000-8000-000000000001", "khoá keyset khớp sort_key của server");
  assert.equal(u.createdAt, "2026-10-13T09:00:00Z", "mốc phân trang = published_at");
});

test("toPublicationEntry: kiểm slug/tên; Band trống → dùng tên project; payload hỏng → null", () => {
  assert.equal(toPublicationEntry(pub({ slug: "../x" }), "t"), null);
  assert.equal(toPublicationEntry(pub({ slug: "A_B" }), "t"), null);
  assert.equal(toPublicationEntry(pub({ title: "  " }), "t"), null);
  assert.equal(toPublicationEntry(null, "t"), null);
  const e = toPublicationEntry(pub({ band_name: null }), "t")!;
  assert.equal(e.bandName, null);
  const html = renderToStaticMarkup(<PublicationCard entry={e} now={NOW} />);
  assert.match(html, /Team Mưa Thu/);
});

test("ảnh Team: chỉ khoá đúng dạng và thuộc đúng project (bucket công khai), ngược lại null", () => {
  assert.match(teamAssetUrl(PID, `${PID}/cover-1-a.jpg`, "cover")!, /\/storage\/v1\/object\/public\/teamlab-team-avatars\/11111111-/);
  assert.equal(teamAssetUrl(PID, `22222222-2222-4333-8444-555555555555/cover-1.jpg`, "cover"), null, "khác project");
  assert.equal(teamAssetUrl(PID, `${PID}/../evil.jpg`, "avatar"), null);
  assert.equal(teamAssetUrl(PID, `${PID}/a.png`, "avatar"), null);
  assert.equal(teamAssetUrl(PID, `${PID}/cover-1.jpg`, "avatar") !== null, true, "avatar regex rộng hơn nhưng vẫn jpg + đúng project");
  assert.equal(teamAssetUrl(PID, null, "cover"), null);
});

test("thẻ: tên Band, tên bài, bìa, thời điểm, nút mở /teamlab/song/<slug>; không lộ take/track/người", () => {
  const e = toPublicationEntry(pub(), "2026-10-13T09:00:00Z")!;
  const html = renderToStaticMarkup(<FeedEntryCard entry={e} now={NOW} />);
  assert.match(html, /Mưa Thu/);
  assert.match(html, /Đêm nàng giả bạn/);
  assert.match(html, /Bài mới phát hành/);
  assert.match(html, /href="\/teamlab\/song\/dem-nang-gia-ban"[^>]*>Nghe bài</);
  assert.match(html, /cs-pub-cover/);
  assert.match(html, /<time[^>]*dateTime="2026-10-13T09:00:00Z"/);
  assert.equal(/take|track|user_id/i.test(html), false);
  const noCover = renderToStaticMarkup(<PublicationCard entry={{ ...e, coverUrl: null }} />);
  assert.equal(/cs-pub-cover/.test(noCover), false, "không có bìa → không ảnh");
});

test("DB: migration chỉ thay social_feed; không RLS/bảng mới; rollback có mặt", async () => {
  const { readFileSync } = await import("node:fs");
  const sql = readFileSync(new URL("../../db/social_feed_teamlab_publications_v1_setup.sql", import.meta.url), "utf8").replace(/--.*$/gm, "");
  assert.equal((sql.match(/create or replace function/gi) || []).length, 1);
  assert.doesNotMatch(sql, /create table|alter table|create policy|drop |insert into|update public|delete from/i);
  assert.match(sql, /teamlab_publications pb[\s\S]*status = 'published'/);
  assert.match(sql, /is_class_member\(\)/);
  const rb = readFileSync(new URL("../../db/social_feed_teamlab_publications_v1_rollback.sql", import.meta.url), "utf8");
  assert.doesNotMatch(rb.replace(/--.*$/gm, ""), /teamlab_publication/);
});
