// Markdown đơn giản của Broadcast: an toàn XSS, tương thích văn bản thuần cũ.
import React from "react";
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { renderSimpleMarkdown, safeHref } from "../../src/class-social/chat/simpleMarkdown";

const html = (s: string, mode: "anchor" | "text" = "anchor") => renderToStaticMarkup(<>{renderSimpleMarkdown(s, mode)}</>);

test("văn bản thuần (thông báo cũ) giữ nguyên chữ, xuống dòng thành <br>", () => {
  assert.equal(html("Thầy đã nhận bài của em."), '<span class="cs-md-p"><span>Thầy đã nhận bài của em.</span></span>');
  assert.match(html("Dòng 1\nDòng 2"), /Dòng 1<\/span><span><br\/>Dòng 2/);
  assert.equal(html("2 * 3 = 6 và a_b_c"), '<span class="cs-md-p"><span>2 * 3 = 6 và a_b_c</span></span>');
});

test("đậm / nghiêng / mã / danh sách", () => {
  assert.match(html("**Quan trọng** và *nhẹ* và `x=1`"), /<strong>Quan trọng<\/strong>.*<em>nhẹ<\/em>.*<code class="cs-md-code">x=1<\/code>/);
  const l = html("- một\n- hai\n\nKết");
  assert.equal((l.match(/cs-md-li/g) ?? []).length, 2);
  assert.match(l, /Kết/);
});

test("XSS: HTML thô bị escape, không sinh thẻ", () => {
  const h = html('<script>alert(1)</script> <img src=x onerror=alert(1)> **<b>x</b>**');
  assert.ok(!/<script|<img|<b>/.test(h));
  assert.match(h, /&lt;script&gt;/);
});

test("XSS: liên kết javascript:/data:/vbscript: không thành <a>", () => {
  for (const bad of ["javascript:alert(1)", "data:text/html,<b>x</b>", "vbscript:x", "//evil.com", "\\\\evil", " javascript:alert(1)"]) {
    assert.equal(safeHref(bad), null, bad);
    const h = html(`[bấm](${bad.replace(/\s/g, "")})`);
    assert.ok(!/<a /.test(h), h);
  }
  assert.ok(!/href="javascript/i.test(html("[x](javascript:alert(1))")));
});

test("liên kết hợp lệ: https mở tab mới + noopener; nội bộ giữ nguyên; URL trần tự nhận, bỏ dấu câu cuối", () => {
  assert.match(html("[Mở](https://class.vananhaudio.com/me)"), /<a class="cs-md-link" href="https:\/\/class.vananhaudio.com\/me" target="_blank" rel="noopener noreferrer nofollow">Mở<\/a>/);
  const i = html("[Hồ sơ](/me/profile)");
  assert.match(i, /href="\/me\/profile"/); assert.ok(!/target=/.test(i));
  const b = html("Xem https://a.vn/x?y=1.");
  assert.match(b, /href="https:\/\/a.vn\/x\?y=1"[^>]*>https:\/\/a.vn\/x\?y=1<\/a>\./);
});

test("chế độ 'text' (trong nút bấm): không sinh <a>", () => {
  const h = html("[Mở](https://a.vn) và https://b.vn", "text");
  assert.ok(!/<a /.test(h)); assert.match(h, /cs-md-link/);
});

test("không phá vỡ khi đầu vào lạ (chưa đóng, rỗng, dài)", () => {
  assert.equal(html(""), "");
  assert.doesNotThrow(() => html("**chưa đóng [x]( `y"));
  assert.doesNotThrow(() => html("*".repeat(5000) + "_".repeat(5000)));
});
