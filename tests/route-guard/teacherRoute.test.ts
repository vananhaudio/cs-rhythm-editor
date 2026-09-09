import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  teacherRouteAccess,
  isTeacherRole,
} from "../../src/teacherRouteAccess.ts";

const router = readFileSync(
  new URL("../../src/AppRouter.tsx", import.meta.url),
  "utf8"
);
const decide = (signedIn: boolean, role: string | null | undefined) =>
  teacherRouteAccess({ loading: false, signedIn, role });

// ── Chưa đăng nhập ──────────────────────────────────────────────────────────────
test("chưa đăng nhập: không vào được", () => {
  assert.equal(decide(false, null), "redirect");
  assert.equal(decide(false, undefined), "redirect");
  // Kể cả khi có role sót lại trong state, chưa có phiên là không vào.
  for (const role of ["teacher", "admin"])
    assert.equal(decide(false, role), "redirect");
});

// ── Học sinh / user thường ──────────────────────────────────────────────────────
test("user thường: không vào được", () => {
  for (const role of ["student", "user", "guest", "editor", "staff", "member"])
    assert.equal(decide(true, role), "redirect", role);
});

test("đăng nhập nhưng không đọc được role: fail-closed", () => {
  // Lỗi mạng/RLS khiến app_users không nạp được — không được mặc định cho vào.
  assert.equal(decide(true, null), "redirect");
  assert.equal(decide(true, undefined), "redirect");
  assert.equal(decide(true, ""), "redirect");
});

test("không nhận vai trò gần giống hay sai hoa thường", () => {
  for (const role of [
    "Teacher",
    "ADMIN",
    "Admin",
    " teacher",
    "teacher ",
    "teachers",
    "administrator",
    "superadmin",
    "admin,teacher",
  ])
    assert.equal(decide(true, role), "redirect", role);
});

// ── Teacher / admin ─────────────────────────────────────────────────────────────
test("teacher và admin vào được", () => {
  assert.equal(decide(true, "teacher"), "allow");
  assert.equal(decide(true, "admin"), "allow");
});

// ── Mở thẳng URL / F5 / Back-Forward: đang nạp phiên thì CHỜ ────────────────────
test("đang nạp phiên: chờ, không cho vào và cũng không đá ra", () => {
  // Mọi điều hướng đều chạy lại router từ đầu với loading = true.
  // Quyết sớm ở đây = đá cả thầy ra /start khi mở thẳng URL, F5 hoặc Back/Forward.
  for (const signedIn of [true, false])
    for (const role of [null, undefined, "", "student", "teacher", "admin"])
      assert.equal(
        teacherRouteAccess({ loading: true, signedIn, role }),
        "wait",
        `${signedIn}/${role}`
      );
});

test("chỉ có ba kết quả, luôn xác định", () => {
  for (const loading of [true, false])
    for (const signedIn of [true, false])
      for (const role of [null, undefined, "", "student", "teacher", "admin"])
        assert.ok(
          ["wait", "allow", "redirect"].includes(
            teacherRouteAccess({ loading, signedIn, role })
          )
        );
});

// ── Khớp với luật đang chạy trong AppRouter, không phải hệ auth thứ hai ─────────
test("dùng đúng luật isTeacher sẵn có của AppRouter", () => {
  // AppRouter vẫn giữ nguyên biểu thức gốc; nếu ai đổi luật ở một nơi mà quên nơi
  // kia, test này FAIL.
  assert.match(
    router,
    /const isTeacher = appUser\?\.role === 'teacher' \|\| appUser\?\.role === 'admin'/
  );
  assert.equal(isTeacherRole("teacher") && isTeacherRole("admin"), true);
  assert.equal(isTeacherRole("student"), false);
});

test("URL chính thức là /nhipphach, đường cũ vẫn giữ", () => {
  assert.match(
    router,
    /NHIPPHACH_PATHS: readonly string\[\] = \['\/nhipphach', '\/musicxml-beats'\]/,
    "phần tử đầu phải là URL chính thức /nhipphach"
  );
  // Đường cũ chưa được bỏ trong giai đoạn chuyển đổi.
  assert.ok(router.includes("'/musicxml-beats'"));
  // Không route nào khác chiếm /nhipphach.
  assert.equal(
    (router.match(/'\/nhipphach'/g) || []).length,
    1,
    "chỉ một nơi khai /nhipphach"
  );
});

test("công cụ Nhịp Phách đi qua guard và đá về /start", () => {
  const block = router.slice(
    router.indexOf("if (NHIPPHACH_PATHS.includes"),
    router.indexOf("/app-v2-preview")
  );
  assert.match(block, /teacherRouteAccess\(\{\s*loading,\s*signedIn: !!user/);
  assert.match(block, /role: appUser\?\.role/);
  assert.match(block, /'wait'\)\s*return null/);
  assert.match(block, /window\.location\.href = '\/start'/);
  // Không được render trang trước khi quyết xong.
  assert.ok(
    block.indexOf("MusicXmlBeatsPage") > block.indexOf("teacherRouteAccess")
  );
});

test("cả hai đường đều được guard, kể cả khi có dấu / ở cuối", () => {
  // Router bỏ dấu / cuối trước khi so, nên /nhipphach/ không lọt qua guard.
  assert.match(router, /path\.replace\(\/\\\/\$\/, ''\)/);
});

test("đích redirect là route công khai, không tạo vòng lặp", () => {
  // /start phải là route KHÔNG có guard thầy, nếu không sẽ đá qua đá lại.
  const start = router.slice(
    router.indexOf("path === '/start'"),
    router.indexOf("path === '/start'") + 400
  );
  assert.doesNotMatch(start, /window\.location\.href = '\/musicxml-beats'/);
  assert.equal(
    router.split("window.location.href = '/nhipphach'").length - 1,
    0,
    "không route nào đá ngược về /nhipphach"
  );
});


// ── Mất mạng không được thu hồi quyền đã cấp ────────────────────────────────────
test("ToolRouteGate giữ quyền khi một lần kiểm tra bị lỗi mạng", () => {
  const gate = readFileSync(
    new URL("../../src/ToolRouteGate.tsx", import.meta.url),
    "utf8"
  );
  // Lỗi tạm thời: KHÔNG được setAllowed(null) — làm thế là gỡ cả công cụ khỏi DOM,
  // mất bản nhạc đang mở và mẻ nhiều bài đang chạy.
  assert.doesNotMatch(gate, /setAllowed\(error\?null/, "không hạ quyền khi lỗi");
  assert.match(gate, /const keep=lastGood\.current && lastGood\.current\.uid===uid/);
  assert.match(gate, /if\(keep\)setAllowed\(lastGood\.current!\.allowed\)/);
  // Chưa từng xác định được quyền thì vẫn báo lỗi
  assert.match(gate, /else\{lastGood\.current=null;setAllowed\(null\);setError\(true\)\}/);
  // …và quyền tốt gần nhất phải gắn với ĐÚNG tài khoản
  assert.match(gate, /lastGood=useRef<\{uid:string\|null;allowed:boolean\}\|null>\(null\)/);
  assert.match(gate, /lastGood\.current=\{uid,allowed:data===true\}/);
  // Danh tính phải lấy từ phiên CỤC BỘ. getUser() gọi mạng nên mất mạng sẽ bị
  // hiểu nhầm là đổi tài khoản, xoá quyền và gỡ mất công cụ đang dùng.
  assert.match(gate, /supabase\.auth\.getSession\(\)/);
  assert.doesNotMatch(gate, /supabase\.auth\.getUser\(\)/);
});


test("chỉ bản DEV mới được trỏ Supabase đi nơi khác", () => {
  const sb = readFileSync(new URL("../../src/supabase.ts", import.meta.url), "utf8");
  // Giá trị production là hằng trong mã, không phải biến môi trường.
  assert.match(sb, /const PROD_URL = 'https:\/\/wojmdilyflffvdtpovmq\.supabase\.co'/);
  // Ghi đè chỉ có hiệu lực khi import.meta.env.DEV — bản build production luôn
  // dùng project thật dù biến môi trường có được đặt hay không.
  assert.match(sb, /import\.meta\.env\.DEV && typeof value === 'string'/);
  assert.match(sb, /devOverride\(import\.meta\.env\.VITE_SUPABASE_URL, PROD_URL\)/);
  assert.match(sb, /devOverride\(import\.meta\.env\.VITE_SUPABASE_ANON_KEY, PROD_ANON_KEY\)/);
});
