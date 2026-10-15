import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeReturnTo, loginUrlFor, returnToFromSearch, blockedRedirect } from "../../src/authReturn.ts";

test("giữ path + query + hash", () => {
  assert.equal(sanitizeReturnTo("/hopam/abc?x=1&y=2#m3"), "/hopam/abc?x=1&y=2#m3");
  assert.equal(sanitizeReturnTo("/me/t/123"), "/me/t/123");
});
test("loại điểm đến ra ngoài site", () => {
  for (const bad of [
    "https://evil.com", "//evil.com", "/\\evil.com", "\\\\evil.com", "javascript:alert(1)",
    "/%2F%2Fevil.com/../", "evil.com", "", "  ", "/a\nb", "/\t/evil.com",
  ]) {
    const r = sanitizeReturnTo(bad);
    assert.ok(r === null || (r.startsWith("/") && !r.startsWith("//")), `${JSON.stringify(bad)} → ${r}`);
  }
  assert.equal(sanitizeReturnTo("https://evil.com"), null);
  assert.equal(sanitizeReturnTo("//evil.com"), null);
  assert.equal(sanitizeReturnTo("/\\evil.com"), null);
  assert.equal(sanitizeReturnTo("javascript:alert(1)"), null);
  assert.equal(sanitizeReturnTo(null), null);
});
test("không quay lại /start (tránh vòng lặp)", () => {
  assert.equal(sanitizeReturnTo("/start"), null);
  assert.equal(sanitizeReturnTo("/start?tab=me"), null);
  assert.equal(sanitizeReturnTo("/start/"), null);
  assert.equal(sanitizeReturnTo("/start?return=%2Fstart"), null);
});
test("quá dài bị loại", () => {
  assert.equal(sanitizeReturnTo("/a?" + "x".repeat(3000)), null);
});
test("loginUrlFor / returnToFromSearch khứ hồi", () => {
  const url = loginUrlFor("/hopam/abc?x=1#m3");
  assert.equal(url, "/start?return=%2Fhopam%2Fabc%3Fx%3D1%23m3");
  assert.equal(returnToFromSearch(url.slice(url.indexOf("?"))), "/hopam/abc?x=1#m3");
  assert.equal(loginUrlFor("/start"), "/start");
  assert.equal(returnToFromSearch(""), null);
  assert.equal(returnToFromSearch("?tab=me"), null);
});
test("blockedRedirect: đã đăng nhập thiếu quyền → /start trần, khách → kèm điểm đến", () => {
  assert.equal(blockedRedirect(true, "/thuvien"), "/start");
  assert.equal(blockedRedirect(false, "/thuvien?q=1"), "/start?return=%2Fthuvien%3Fq%3D1");
});
