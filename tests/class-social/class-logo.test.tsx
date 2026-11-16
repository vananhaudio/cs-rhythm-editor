// Logo khóa học trên dòng lớp /me: có logo / thiếu logo / nhiều lớp cùng khóa dùng chung / URL không an toàn.
import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { classLogoUrl, toClassCard, toCourseLogoMap } from "../../src/class-social/classes/classModel";
import { ClassRow } from "../../src/class-social/classes/ClassesPage";

const card = (id: string, code: string | null) =>
  toClassCard({ id, name: "Lớp " + id, course: code ? { code, name: "K", track: null } : null })!;

test("map logo: chỉ https, bỏ trống/không an toàn", () => {
  const m = toCourseLogoMap([
    { code: "DH1", image_url: "https://x.supabase.co/a.png" },
    { code: "CB1", image_url: null },
    { code: "BAD", image_url: "http://x/a.png" },
    { code: "JS", image_url: "javascript:alert(1)" },
    { code: null, image_url: "https://x/b.png" },
  ]);
  assert.deepEqual([...m.keys()], ["DH1"]);
  assert.equal(toCourseLogoMap(null).size, 0);
});

test("nhiều lớp cùng khóa → cùng một URL logo; khóa thiếu/lớp không có khóa → null", () => {
  const m = toCourseLogoMap([{ code: "DH1", image_url: "https://x/a.png" }]);
  assert.equal(classLogoUrl(card("1", "DH1"), m), "https://x/a.png");
  assert.equal(classLogoUrl(card("2", "DH1"), m), "https://x/a.png");
  assert.equal(classLogoUrl(card("3", "CB1"), m), null);
  assert.equal(classLogoUrl(card("4", null), m), null);
});

test("ClassRow chưa có logo → biểu tượng mặc định, vẫn đủ tên/link", () => {
  const h = renderToStaticMarkup(<ul><ClassRow c={card("9", "DH1")} onOpen={() => {}} /></ul>);
  assert.match(h, /cs-classrow-logo/);
  assert.doesNotMatch(h, /<img/);
  assert.match(h, /<a class="cs-classrow-name" href="\/me\/classes\/9">Lớp 9<\/a>/);
});
