/**
 * Danh tính: ảnh đại diện / ảnh bìa — kiểm tra ảnh, URL an toàn, và bất biến MỘT user = MỘT avatar.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sniffImageType, fitWithin, avatarPath, coverPath, MAX_INPUT_BYTES, OUTPUT } from "../../src/class-social/profile/imageFile.ts";
import { safeImageUrl } from "../../src/class-social/media/safeImageUrl.ts";

const bytes = (...b: number[]) => new Uint8Array([...b, ...Array(12).fill(0)].slice(0, Math.max(12, b.length)));

test("Nhận diện ảnh bằng BYTE ĐẦU (không tin đuôi file)", () => {
  assert.equal(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0)), "jpeg");
  assert.equal(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), "png");
  assert.equal(sniffImageType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)), "gif");
  assert.equal(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50])), "webp");
  assert.equal(sniffImageType(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])), "heic");
  // "ảnh" giả: file text/HTML/PDF/SVG đổi đuôi .jpg → bị từ chối
  const enc = (s: string) => new TextEncoder().encode(s.padEnd(12, " "));
  for (const fake of ["<svg onload=x", "<html><script", "%PDF-1.7 ....", "GIF87 no", "just text!!"]) assert.equal(sniffImageType(enc(fake)), null, fake);
  assert.equal(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20])), null, "RIFF nhưng là AVI");
});

test("Thu nhỏ giữ tỉ lệ, không phóng to; giới hạn đầu vào 15 MB", () => {
  assert.deepEqual(fitWithin(4032, 3024, 800, 800), { w: 800, h: 600 });
  assert.deepEqual(fitWithin(3000, 4000, OUTPUT.cover.maxW, OUTPUT.cover.maxH), { w: 810, h: 1080 });
  assert.deepEqual(fitWithin(400, 300, 800, 800), { w: 400, h: 300 });
  assert.deepEqual(fitWithin(0, 300, 800, 800), { w: 0, h: 0 });
  assert.equal(MAX_INPUT_BYTES, 15 * 1024 * 1024);
});

test("Tên file theo quy ước App học (bucket avatars, <id>-<ms>.jpg) — không dùng tên file người dùng", () => {
  assert.equal(avatarPath("0d5c7f3e-1111-4222-8333-444455556666", 1727000000000), "0d5c7f3e-1111-4222-8333-444455556666-1727000000000.jpg");
  assert.equal(coverPath("abc-DEF-123", 1), "cover-abc-DEF-123-1.jpg");
  assert.equal(avatarPath("../../etc/x", 1), "etcx-1.jpg", "loại ký tự đường dẫn");
  assert.match(coverPath("u<script>", 5), /^cover-uscript-5\.jpg$/);
});

test("URL ảnh an toàn: https / blob / data:image raster; còn lại → null", () => {
  assert.equal(safeImageUrl("https://x.supabase.co/storage/v1/object/public/avatars/a-1.jpg"), "https://x.supabase.co/storage/v1/object/public/avatars/a-1.jpg");
  assert.ok(safeImageUrl("blob:http://class.localhost:5188/6f1c3a2b-1111-4222-8333-444455556666"));
  assert.ok(safeImageUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg=="));
  for (const bad of ["javascript:alert(1)", "http://insecure.test/a.jpg", "data:text/html;base64,PHNjcmlwdD4=", "data:image/svg+xml;base64,PHN2Zz4=", 'https://x.test/a.jpg" onerror="x', "", null, undefined]) {
    assert.equal(safeImageUrl(bad as string), null, String(bad));
  }
});

const read = (p: string) => readFileSync(new URL(`../../src/${p}`, import.meta.url), "utf8");

test("MỘT USER = MỘT AVATAR: Social ghi đúng bucket + cột mà App học dùng (edu_students.avatar_url)", () => {
  const api = read("class-social/profile/profileApi.ts");
  const app = read("MobileStudentPortal.tsx");   // chỉ ĐỌC để đối chiếu — App học không bị sửa
  assert.match(app, /storage\.from\('avatars'\)\.upload\(/);
  assert.match(app, /from\('edu_students'\)\.update\(\{ avatar_url: pub\.publicUrl \}\)/);
  assert.match(api, /const BUCKET = 'avatars'/);
  assert.match(api, /from\('edu_students'\)\.update\(\{ avatar_url: up\.value \}\)\.eq\('id', studentId\)/);
  // Social ĐỌC avatar từ cùng cột
  assert.match(read("class-social/useClassSession.ts"), /select\('id,full_name,display_name,email,avatar_url,/);
  // Không có cột/bảng avatar riêng cho Social
  assert.equal(/social_avatar|avatar_social|class_avatar/i.test(api + read("class-social/useClassSession.ts")), false);
  const cover = readFileSync(new URL("../../db/profile_media_setup.sql", import.meta.url), "utf8");
  assert.equal(/avatar_url/.test(cover.replace(/--.*$/gm, "")), false, "bảng ảnh bìa không chứa avatar");
});

test("Logo chuẩn Thầy Văn Anh Guitar trên top bar (cùng cặp với trang tuyển sinh); bỏ chữ 'Văn Anh Class'", () => {
  const layout = read("class-social/ClassSocialLayout.tsx");
  const landing = read("ClassLandingPage.tsx");
  assert.match(landing, /src="\/logo-green\.svg" alt="Thầy Văn Anh Guitar" \/> Thầy Văn Anh Guitar/);
  assert.match(layout, /src="\/logo-green\.svg"/);
  assert.match(layout, />Thầy Văn Anh Guitar</);
  assert.equal(/Văn Anh Class|VĂN ANH CLASS/.test(layout.replace(/\/\/.*$/gm, "")), false);
});
