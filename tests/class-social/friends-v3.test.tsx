/**
 * Friends V3: tìm kiếm không dấu, gợi ý (cùng lớp/Band/bạn chung), render khối khám phá, migration additive.
 * DB: scripts/test-friends-v3-db.sh. Kế thừa Friends UX V2 (không xây lại).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  foldName, nameMatches, searchSub, searchTerm, suggestionSub, toSearchResults, toSuggestions,
} from "../../src/class-social/friends/friendModel";
import { FriendSearchBox, FriendSearchResults, FriendSuggestions } from "../../src/class-social/sections/FriendDiscovery";
void React;
const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");
const row = (o: Record<string, unknown>) => ({ user_id: "u1", name: "Dũng", avatar_url: null, role: "student", ...o });

test("foldName/searchTerm: bỏ dấu, đ→d, chữ hoa, NFD; dưới 2 ký tự → không tìm", () => {
  assert.equal(foldName("Đỗ Thái Nguyên"), "do thai nguyen");
  assert.equal(foldName("ĐẶNG QUYÊN"), "dang quyen");
  assert.equal(foldName("Nguyễn".normalize("NFD")), "nguyen");
  assert.equal(searchTerm("  Do   THAI "), "do thai");
  assert.equal(searchTerm("d"), "");
  assert.equal(searchTerm("   "), "");
});

test("nameMatches: mọi từ khoá phải có trong tên, thứ tự bất kỳ", () => {
  assert.ok(nameMatches("Đỗ Thái Nguyên", "nguyen do"));
  assert.ok(nameMatches("Phạm Dũng", "dung"));
  assert.ok(!nameMatches("Phạm Dũng", "dung x"));
  assert.ok(nameMatches("Ai Đó", ""));
});

test("toSearchResults/toSuggestions: chuẩn hoá hàng RPC, lý do chỉ lấy từ DB", () => {
  const r = toSearchResults([row({ relationship: "friends", mutual_count: 3, same_class: true, same_band: false }), row({ user_id: "" })] as never);
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].relationship, r[0].mutualCount, r[0].sameClass, r[0].sameBand], ["friends", 3, true, false]);
  assert.equal(searchSub(r[0]), "Cùng lớp · 3 bạn chung");
  const s = toSuggestions([
    row({ reason: "class", shared_label: "Guitar Solo 01", mutual_count: 2 }),
    row({ user_id: "u2", reason: "band", shared_label: "Band X", mutual_count: 0 }),
    row({ user_id: "u3", reason: "lạ", mutual_count: 4 }),
  ] as never);
  assert.equal(suggestionSub(s[0]), "Cùng lớp Guitar Solo 01 · 2 bạn chung");
  assert.equal(suggestionSub(s[1]), "Cùng Band Band X");
  assert.equal(s[2].reason, "mutual");
  assert.equal(suggestionSub(s[2]), "4 bạn chung");
});

test("Render: ô tìm, kết quả, trạng thái rỗng, gợi ý có Kết bạn + Gỡ, ẩn gợi ý đã gỡ", () => {
  assert.match(renderToStaticMarkup(<FriendSearchBox value="" onChange={() => {}} />), /type="search"[^>]*placeholder="Tìm bạn bè theo tên"/);
  assert.doesNotMatch(renderToStaticMarkup(<FriendSearchBox value="" onChange={() => {}} />), /Xoá nội dung tìm/);
  assert.match(renderToStaticMarkup(<FriendSearchBox value="du" onChange={() => {}} />), /Xoá nội dung tìm/);
  const noop = () => {};
  const items = toSearchResults([row({ relationship: "friends" }), row({ user_id: "u2", name: "Em", relationship: "none" })] as never);
  const h = renderToStaticMarkup(<FriendSearchResults state={{ status: "ready", items }} busyId={null} onAct={noop} onOpenProfile={noop} onMessage={noop} onRetry={noop} />);
  assert.match(h, /Kết quả tìm kiếm/);
  assert.match(h, />Bạn bè</);
  assert.match(h, />Kết bạn</);
  assert.equal((h.match(/Nhắn tin cho/g) ?? []).length, 1, "chỉ bạn bè mới có nút Nhắn tin");
  assert.match(renderToStaticMarkup(<FriendSearchResults state={{ status: "ready", items: [] }} busyId={null} onAct={noop} onOpenProfile={noop} onRetry={noop} />), /Không tìm thấy ai/);
  assert.equal(renderToStaticMarkup(<FriendSearchResults state={{ status: "idle" }} busyId={null} onAct={noop} onOpenProfile={noop} onRetry={noop} />), "");
  const sug = toSuggestions([row({ reason: "class", shared_label: "Lớp A" }), row({ user_id: "u2", name: "Em", reason: "band" })] as never);
  const g = renderToStaticMarkup(<FriendSuggestions state={{ status: "ready", items: sug }} hidden={new Set()} busyId={null} onAdd={noop} onHide={noop} onOpenProfile={noop} onRetry={noop} />);
  assert.match(g, /Những người bạn có thể biết/);
  assert.equal((g.match(/>Gỡ</g) ?? []).length, 2);
  const g2 = renderToStaticMarkup(<FriendSuggestions state={{ status: "ready", items: sug }} hidden={new Set(["u1"])} busyId={null} onAdd={noop} onHide={noop} onOpenProfile={noop} onRetry={noop} />);
  assert.equal((g2.match(/>Gỡ</g) ?? []).length, 1);
  assert.equal(renderToStaticMarkup(<FriendSuggestions state={{ status: "ready", items: [] }} hidden={new Set()} busyId={null} onAdd={noop} onHide={noop} onOpenProfile={noop} onRetry={noop} />), "", "không dựng khung rỗng");
});

test("Migration V3: additive, chỉ RPC đọc, không begin/commit/policy, không ghi friendships; trang Bạn bè tái dùng nhắn tin + RPC cũ", () => {
  const sql = read("db/friends_v3_setup.sql").replace(/--.*$/gm, "");
  assert.doesNotMatch(sql, /^\s*(begin|commit|rollback)\s*;/im);
  assert.doesNotMatch(sql, /create policy/i);
  assert.doesNotMatch(sql, /(insert into|update|delete from)\s+public\.friendships/i);
  assert.match(sql, /friend_search/); assert.match(sql, /friend_suggestions/);
  assert.match(sql, /revoke all on function public\.friends_ctx\(\) from public, anon, authenticated/);
  assert.match(sql, /class_ugc_pair_blocked/);
  const page = read("src/class-social/sections/Friends.tsx");
  assert.match(page, /onMessage/); assert.match(page, /runFriendAction/);
  assert.doesNotMatch(read("src/class-social/friends/friendsApi.ts"), /\.from\(['"]friendships['"]\)/);
});
