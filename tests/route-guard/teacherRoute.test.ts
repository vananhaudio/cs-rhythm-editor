import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const router = readFileSync(
  new URL("../../src/AppRouter.tsx", import.meta.url),
  "utf8"
);
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

test("Nhịp Phách KHÔNG còn teacher-only cứng, đi qua cổng capability", () => {
  const block = router.slice(
    router.indexOf("if (NHIPPHACH_PATHS.includes"),
    router.indexOf("/app-v2-preview")
  );
  // Luật cứng theo vai trò đã bị bỏ khỏi toàn bộ router.
  assert.equal(/teacherRouteAccess/.test(router), false);
  assert.equal(/appUser\?\.role/.test(block), false, "không được quyết theo vai trò");
  assert.equal(/window\.location\.href = '\/start'/.test(block), false, "không đá ra nữa");
  // Thay bằng cổng đọc quyền từ máy chủ.
  assert.match(block, /<NhipPhachGate \/>/);
  assert.match(router, /const NhipPhachGate = lazy\(\(\) => import\('\.\/nhipphach\/NhipPhachGate'\)\)/);
});

test("cổng Nhịp Phách quyết bằng quyền, không bằng vai trò", () => {
  const gate = readFileSync(
    new URL("../../src/nhipphach/NhipPhachGate.tsx", import.meta.url),
    "utf8"
  );
  assert.match(gate, /can\(state, "access"\)/);
  // Không có chỗ nào so vai trò để mở tính năng. Chỉ được dùng vai trò để
  // chọn CÂU CHỮ giải thích cho người bị chặn.
  const quyet = gate.slice(0, gate.indexOf("state.role === \"guest\""));
  assert.equal(/role === "teacher"|role === "admin"|role === "student"/.test(quyet), false);
  // Phân biệt rõ ba trạng thái: đang tải, lỗi, và bị từ chối.
  assert.match(gate, /phase === "loading"/);
  assert.match(gate, /phase === "error"/);
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
