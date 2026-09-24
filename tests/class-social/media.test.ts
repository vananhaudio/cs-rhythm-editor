/**
 * parseExternalMedia — chuẩn hoá/kiểm tra link video ngoài (YouTube / TikTok / Facebook / link khác).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { parseExternalMedia, hostIs, MAX_URL_LENGTH, type ParseResult } from "../../src/class-social/media/parseExternalMedia.ts";

const ok = (r: ParseResult) => { assert.ok(r.ok, JSON.stringify(r)); return (r as Extract<ParseResult, { ok: true }>).media; };
const err = (r: ParseResult) => { assert.equal(r.ok, false, JSON.stringify(r)); return (r as Extract<ParseResult, { ok: false }>).error; };

// ── YouTube ─────────────────────────────────────────────────────────────────
test("YouTube: watch / youtu.be / shorts / embed / live / m. / query thêm → cùng ID, embed nocookie", () => {
  const cases: [string, string, "landscape" | "portrait"][] = [
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ", "landscape"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123&si=abc", "dQw4w9WgXcQ", "landscape"],
    ["https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ", "dQw4w9WgXcQ", "landscape"],
    ["https://youtu.be/dQw4w9WgXcQ?si=trackme", "dQw4w9WgXcQ", "landscape"],
    ["youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ", "landscape"],
    ["https://www.youtube.com/shorts/aBcDeFgHiJ0?feature=share", "aBcDeFgHiJ0", "portrait"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ", "landscape"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ?si=x", "dQw4w9WgXcQ", "landscape"],
    ["HTTPS://WWW.YOUTUBE.COM/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ", "landscape"],
  ];
  for (const [url, id, aspect] of cases) {
    const m = ok(parseExternalMedia(url));
    assert.equal(m.provider, "youtube", url);
    assert.equal(m.externalId, id, url);
    assert.equal(m.canEmbed, true);
    assert.equal(m.aspect, aspect, url);
    assert.equal(m.embedUrl, `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`);
    assert.ok(!m.embedUrl!.includes("autoplay=1"));
    assert.ok(!m.canonicalUrl.includes("si=") && !m.canonicalUrl.includes("list="), "bỏ tham số theo dõi");
  }
  assert.equal(ok(parseExternalMedia("https://youtube.com/shorts/aBcDeFgHiJ0")).canonicalUrl, "https://www.youtube.com/shorts/aBcDeFgHiJ0");
});

test("YouTube: không phải video / ID hỏng → báo rõ, KHÔNG rơi xuống link khác", () => {
  for (const url of [
    "https://www.youtube.com/", "https://www.youtube.com/@thayvananh", "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ<x", "https://youtu.be/", "https://www.youtube.com/playlist?list=PL1",
    "https://youtu.be/dQw4w9WgXcQ%22onload",
  ]) {
    const r = parseExternalMedia(url);
    assert.equal(r.ok, false, url);
  }
  assert.equal(err(parseExternalMedia("https://www.youtube.com/@thayvananh")), "youtube_not_video");
});

test("YouTube: hostname giả mạo KHÔNG được nhận là YouTube", () => {
  for (const url of [
    "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "https://evilyoutube.com/watch?v=dQw4w9WgXcQ",
    "https://notyoutu.be/dQw4w9WgXcQ",
    "https://youtube.evil.test/watch?v=dQw4w9WgXcQ",
    "https://evil.test/?u=https://youtube.com/watch?v=dQw4w9WgXcQ",
    "https://evil.test/youtube.com/watch?v=dQw4w9WgXcQ",
  ]) {
    const m = ok(parseExternalMedia(url));
    assert.equal(m.provider, "external_link", url);
    assert.equal(m.canEmbed, false);
    assert.equal(m.embedUrl, undefined);
  }
  assert.ok(hostIs("www.youtube.com", "youtube.com"));
  assert.equal(hostIs("youtube.com.evil.test", "youtube.com"), false);
  assert.equal(hostIs("evilyoutube.com", "youtube.com"), false);
});

// ── TikTok ──────────────────────────────────────────────────────────────────
test("TikTok: link đầy đủ → Embed Player chính thức, dọc, không tự phát", () => {
  const id = "7301234567890123456";
  for (const url of [
    `https://www.tiktok.com/@thay.vananh/video/${id}`,
    `https://www.tiktok.com/@thay.vananh/video/${id}?is_from_webapp=1&sender_device=pc&_r=1`,
    `https://m.tiktok.com/v/${id}.html`,
    `https://www.tiktok.com/embed/v2/${id}`,
    `https://www.tiktok.com/player/v1/${id}`,
    `tiktok.com/@thay.vananh/video/${id}`,
  ]) {
    const m = ok(parseExternalMedia(url));
    assert.equal(m.provider, "tiktok", url);
    assert.equal(m.externalId, id);
    assert.equal(m.canEmbed, true);
    assert.equal(m.aspect, "portrait");
    assert.equal(m.embedUrl, `https://www.tiktok.com/player/v1/${id}?autoplay=0&music_info=0&description=0&rel=0`);
  }
  assert.equal(ok(parseExternalMedia(`https://www.tiktok.com/@thay.vananh/video/${id}?_r=1`)).canonicalUrl,
    `https://www.tiktok.com/@thay.vananh/video/${id}`);
});

test("TikTok: link rút gọn (vm./vt./t/) → nhận, nhưng chỉ thẻ mở video (không có ID)", () => {
  for (const [url, canon] of [
    ["https://vm.tiktok.com/ZMabc123/", "https://vm.tiktok.com/ZMabc123"],
    ["https://vt.tiktok.com/ZSxyz789", "https://vt.tiktok.com/ZSxyz789"],
    ["https://www.tiktok.com/t/ZTRabc12/", "https://www.tiktok.com/t/ZTRabc12"],
  ]) {
    const m = ok(parseExternalMedia(url));
    assert.equal(m.provider, "tiktok", url);
    assert.equal(m.shortLink, true);
    assert.equal(m.canEmbed, false);
    assert.equal(m.embedUrl, undefined);
    assert.equal(m.canonicalUrl, canon);
  }
});

test("TikTok: trang cá nhân / ID hỏng / host giả", () => {
  assert.equal(err(parseExternalMedia("https://www.tiktok.com/@thay.vananh")), "tiktok_not_video");
  assert.equal(err(parseExternalMedia("https://www.tiktok.com/@a/video/abc")), "tiktok_not_video");
  assert.equal(ok(parseExternalMedia("https://tiktok.com.evil.test/@a/video/7301234567890123456")).provider, "external_link");
  assert.equal(ok(parseExternalMedia("https://faketiktok.com/@a/video/7301234567890123456")).provider, "external_link");
});

// ── Facebook ────────────────────────────────────────────────────────────────
test("Facebook: các dạng bài/video công khai → thẻ mở nội dung gốc (P1 không nhúng)", () => {
  const cases: [string, string, string | undefined][] = [
    ["https://www.facebook.com/watch?v=1234567890123", "https://www.facebook.com/watch?v=1234567890123", "1234567890123"],
    ["https://www.facebook.com/thayvananh/videos/1234567890123/?mibextid=abc", "https://www.facebook.com/thayvananh/videos/1234567890123/", "1234567890123"],
    ["https://m.facebook.com/reel/987654321098765?rdid=x&share_url=y", "https://www.facebook.com/reel/987654321098765", "987654321098765"],
    ["https://www.facebook.com/share/v/1AbCdEfGh/", "https://www.facebook.com/share/v/1AbCdEfGh/", undefined],
    ["https://web.facebook.com/thayvananh/posts/pfbid02abc", "https://www.facebook.com/thayvananh/posts/pfbid02abc", undefined],
    ["https://www.facebook.com/story.php?story_fbid=123&id=456&ref=x", "https://www.facebook.com/story.php?story_fbid=123&id=456", undefined],
    ["https://fb.watch/abcDEF123/", "https://fb.watch/abcDEF123/", undefined],
  ];
  for (const [url, canon, id] of cases) {
    const m = ok(parseExternalMedia(url));
    assert.equal(m.provider, "facebook", url);
    assert.equal(m.canEmbed, false);
    assert.equal(m.embedUrl, undefined);
    assert.equal(m.canonicalUrl, canon, url);
    assert.equal(m.externalId, id, url);
  }
});

test("Facebook: trang chủ / đăng nhập / nhóm / host giả", () => {
  for (const url of ["https://www.facebook.com/", "https://www.facebook.com/login.php?next=x", "https://www.facebook.com/groups/123", "https://www.facebook.com/thayvananh"]) {
    assert.equal(err(parseExternalMedia(url)), "facebook_not_video", url);
  }
  assert.equal(ok(parseExternalMedia("https://facebook.com.evil.test/watch?v=1234567890")).provider, "external_link");
  assert.equal(ok(parseExternalMedia("https://notfacebook.com/reel/1234567890")).provider, "external_link");
});

// ── Link khác ───────────────────────────────────────────────────────────────
test("Link khác hợp lệ → external_link, chỉ thẻ liên kết, bỏ #hash", () => {
  const m = ok(parseExternalMedia("https://drive.google.com/file/d/abc/view?usp=sharing#frag"));
  assert.equal(m.provider, "external_link");
  assert.equal(m.canEmbed, false);
  assert.equal(m.canonicalUrl, "https://drive.google.com/file/d/abc/view?usp=sharing");
  assert.equal(ok(parseExternalMedia("http://example.org/video")).canonicalUrl, "http://example.org/video");
});

// ── Bảo mật ─────────────────────────────────────────────────────────────────
test("Bảo mật: scheme nguy hiểm, HTML/iframe, rỗng, quá dài, host đáng ngờ, credentials", () => {
  assert.equal(err(parseExternalMedia("")), "empty");
  assert.equal(err(parseExternalMedia("   ")), "empty");
  assert.equal(err(parseExternalMedia("javascript:alert(1)")), "scheme");
  assert.equal(err(parseExternalMedia("JaVaScRiPt:alert(1)")), "scheme");
  assert.equal(err(parseExternalMedia("data:text/html;base64,PHNjcmlwdD4=")), "scheme");
  assert.equal(err(parseExternalMedia("ftp://example.org/video.mp4")), "scheme");
  assert.equal(err(parseExternalMedia("file:///etc/passwd")), "scheme");
  assert.equal(err(parseExternalMedia("vbscript:msgbox(1)")), "scheme");
  assert.equal(err(parseExternalMedia('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>')), "html");
  assert.equal(err(parseExternalMedia('<script>alert(1)</script>')), "html");
  assert.equal(err(parseExternalMedia("https://www.youtube.com/watch?v=dQw4w9WgXcQ\"onmouseover=\"x")), "invalid");
  assert.equal(err(parseExternalMedia("https://exa mple.org")), "invalid");
  assert.equal(err(parseExternalMedia("https://" + "a".repeat(MAX_URL_LENGTH))), "too_long");
  assert.equal(err(parseExternalMedia("https://localhost/x")), "host");
  assert.equal(err(parseExternalMedia("https://127.0.0.1/x")), "host");
  assert.equal(err(parseExternalMedia("http://[::1]/x")), "host");
  assert.equal(err(parseExternalMedia("https://intranet/x")), "host");
  assert.equal(err(parseExternalMedia("https://example.org:8443/x")), "host");
  assert.equal(err(parseExternalMedia("https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ")), "credentials");
  assert.equal(err(parseExternalMedia("https://")), "invalid");
  assert.equal(err(parseExternalMedia("https://%%%")), "invalid");
});

test("embedUrl luôn là URL cố định do Class dựng (chỉ youtube-nocookie / tiktok player)", () => {
  const inputs = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/shorts/aBcDeFgHiJ0",
    "https://www.tiktok.com/@a/video/7301234567890123456", "https://www.facebook.com/watch?v=1234567890",
    "https://vimeo.com/123", "https://evil.test/embed?src=javascript:alert(1)",
  ];
  for (const url of inputs) {
    const r = parseExternalMedia(url);
    if (!r.ok || !r.media.embedUrl) continue;
    assert.match(r.media.embedUrl, /^https:\/\/(www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}\?rel=0&playsinline=1|www\.tiktok\.com\/player\/v1\/\d{8,25}\?autoplay=0&music_info=0&description=0&rel=0)$/, url);
  }
});
