import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyOptimistic, likeErrorText, likeKey, likeLabel, parseSummary } from "../../src/class-social/likes/likeModel";
import { __peek as peek, __resetLikeStore, __setLikeApi, ensureLike, toggleLike } from "../../src/class-social/likes/likeStore";
import type { LikeApi } from "../../src/class-social/likes/likesApi";
import LikeBar from "../../src/class-social/likes/LikeBar";
import FeedEntryCard from "../../src/class-social/sections/FeedEntryCard";
import { toPublicationEntry } from "../../src/class-social/posts/postModel";
void React;

const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const ID2 = "aaaaaaaa-0000-4000-8000-000000000002";
const tick = (ms = 5) => new Promise(r => setTimeout(r, ms));

function fakeApi(over: Partial<LikeApi> = {}, log: string[] = []): LikeApi {
  const db = new Map<string, { count: number; liked: boolean }>();
  return {
    async summary(ts) { log.push("summary:" + ts.length); const m = new Map<string, { count: number; liked: boolean }>(); for (const t of ts) m.set(likeKey(t.kind, t.id), db.get(likeKey(t.kind, t.id)) ?? { count: 0, liked: false }); return { ok: true, rows: m }; },
    async set(t, liked) { log.push(`set:${liked}`); await tick(10); const k = likeKey(t.kind, t.id); const cur = db.get(k) ?? { count: 0, liked: false }; const next = { liked, count: cur.count + (liked === cur.liked ? 0 : liked ? 1 : -1) }; db.set(k, next); return { ok: true, state: next }; },
    ...over,
  };
}

test("model: parseSummary bỏ hàng hỏng, ép số, chữ thường id; applyOptimistic không âm", () => {
  const m = parseSummary([
    { target_kind: "post", target_id: ID.toUpperCase(), like_count: "3", liked: true },
    { target_kind: "bogus", target_id: ID, like_count: 1, liked: true },
    { target_kind: "post", target_id: "not-uuid", like_count: 1, liked: true },
    { target_kind: "learning_thread", target_id: ID2, like_count: -5, liked: "yes" },
  ]);
  assert.equal(m.size, 2);
  assert.deepEqual(m.get(likeKey("post", ID)), { count: 3, liked: true });
  assert.deepEqual(m.get(likeKey("learning_thread", ID2)), { count: 0, liked: false });
  assert.equal(parseSummary(null).size, 0);
  assert.deepEqual(applyOptimistic({ count: 0, liked: true }, false), { count: 0, liked: false });
  assert.deepEqual(applyOptimistic({ count: 2, liked: false }, true), { count: 3, liked: true });
  assert.equal(applyOptimistic({ count: 2, liked: true }, true).count, 2);
  assert.equal(likeLabel(0), "");
  assert.equal(likeLabel(5), "5 lượt thích");
  assert.match(likeErrorText(undefined, false), /Không có mạng/);
  assert.match(likeErrorText("FEED_NOT_VISIBLE", true), /không còn khả dụng/);
});

test("store: nhiều thẻ mount cùng nhịp → MỘT lần summary; bấm Thích lạc quan rồi xác nhận từ server", async () => {
  __resetLikeStore(); const log: string[] = []; __setLikeApi(fakeApi({}, log));
  ensureLike("post", ID); ensureLike("learning_thread", ID2); ensureLike("post", ID);
  await tick();
  assert.deepEqual(log, ["summary:2"], "gộp lô, không N+1");
  toggleLike("post", ID);
  assert.deepEqual(peek("post", ID).state, { count: 1, liked: true }, "lạc quan ngay");
  assert.equal(peek("post", ID).busy, true);
  await tick(40);
  assert.deepEqual(peek("post", ID).state, { count: 1, liked: true });
  assert.equal(peek("post", ID).busy, false);
  toggleLike("post", ID); await tick(40);
  assert.deepEqual(peek("post", ID).state, { count: 0, liked: false }, "bấm lại = bỏ thích");
  __setLikeApi(null);
});

test("store: bấm liên tiếp nhanh — tối đa 1 yêu cầu bay, kết quả cuối khớp ý muốn cuối, không lượt thích trùng", async () => {
  __resetLikeStore(); const log: string[] = []; __setLikeApi(fakeApi({}, log));
  ensureLike("post", ID); await tick();
  toggleLike("post", ID); toggleLike("post", ID); toggleLike("post", ID);   // thích → bỏ → thích
  await tick(80);
  assert.deepEqual(peek("post", ID).state, { count: 1, liked: true });
  assert.ok(log.filter(l => l.startsWith("set:")).length <= 3);
  toggleLike("post", ID); toggleLike("post", ID);                         // bỏ → thích: server cuối vẫn thích
  await tick(80);
  assert.deepEqual(peek("post", ID).state, { count: 1, liked: true });
  __setLikeApi(null);
});

test("store: lỗi mạng → hoàn về trạng thái đã xác nhận + báo lỗi ngắn; không mất nút", async () => {
  __resetLikeStore(); __setLikeApi(fakeApi({ async set() { return { ok: false, error: {} }; } }));
  ensureLike("post", ID); await tick();
  toggleLike("post", ID);
  assert.equal(peek("post", ID).state?.liked, true);
  await tick(20);
  const v = peek("post", ID);
  assert.deepEqual(v.state, { count: 0, liked: false }, "hoàn lại");
  assert.match(v.error ?? "", /Chưa lưu được/);
  assert.equal(v.hidden, false);
  assert.equal(v.busy, false);
  __setLikeApi(null);
});

test("store: server từ chối (FEED_NOT_VISIBLE) → ẩn thanh Thích; summary không trả hàng → ẩn", async () => {
  __resetLikeStore(); __setLikeApi(fakeApi({ async set() { return { ok: false, error: { code: "FEED_NOT_VISIBLE" } }; } }));
  ensureLike("post", ID); await tick(); toggleLike("post", ID); await tick(20);
  assert.equal(peek("post", ID).hidden, true);
  __resetLikeStore(); __setLikeApi(fakeApi({ async summary() { return { ok: true, rows: new Map() }; } }));
  ensureLike("post", ID); await tick();
  assert.equal(peek("post", ID).hidden, true, "không thấy mục → không hiện nút");
  assert.equal(renderToStaticMarkup(<LikeBar kind="post" id={ID} />).includes("Thích"), true, "SSR chưa biết → vẫn hiện nút (không gây nhấp nháy)");
  __setLikeApi(null);
});

test("store: summary lỗi mạng → nút vẫn dùng được (chưa số); thích thành công cập nhật số thật từ server", async () => {
  __resetLikeStore(); __setLikeApi(fakeApi({ async summary() { return { ok: false, error: {} }; } }));
  ensureLike("post", ID); await tick();
  assert.equal(peek("post", ID).hidden, false);
  assert.equal(peek("post", ID).state, undefined);
  toggleLike("post", ID); await tick(30);
  assert.deepEqual(peek("post", ID).state, { count: 1, liked: true });
  __setLikeApi(null);
});

test("UI: LikeBar là nút thật, aria-pressed, mục tiêu cho iPhone; FeedEntryCard gắn thanh Thích cho thẻ TeamLab (không loại trừ tài nguyên chia sẻ)", () => {
  const html = renderToStaticMarkup(<LikeBar kind="teamlab_publication" id={ID} />);
  assert.match(html, /<button[^>]*aria-pressed="false"/);
  assert.match(html, /cs-likebar-btn/);
  assert.ok(!/Bình luận|Chia sẻ/.test(html), "không hiện nút chưa hoạt động");
  const e = toPublicationEntry({ publication_id: ID, project_id: "11111111-2222-4333-8444-555555555555", slug: "bai-a", title: "Bài A", band_name: "B", project_name: "P" }, "2026-10-13T09:00:00Z")!;
  const card = renderToStaticMarkup(<FeedEntryCard entry={e} />);
  assert.match(card, /cs-likebar/);
  assert.match(card, /data-kind="teamlab_publication"/);
});
