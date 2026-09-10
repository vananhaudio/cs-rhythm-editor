/**
 * Giai đoạn 12 — phân quyền tính năng.
 *
 * Điều phải chứng minh: **vai trò ≠ mức giao diện ≠ quyền tính năng**. Học viên
 * được Admin bật Nhiều bài thì dùng được; thầy giáo bị tắt thì không thấy. Không
 * một dòng nào trong mã được quyết định tính năng bằng cách so vai trò.
 *
 * Phần DB chạy trên Supabase LOCAL với JWT thật của bốn tài khoản
 * teacher-a / teacher-b / student-c / khách.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  can,
  parseCaps,
  isKhoa,
  NO_CAPS,
  NHIPPHACH_CAPS,
  KHOA_CHO_HOC_VIEN,
  CAP_LABEL,
  type Capability,
} from "../../src/nhipphach/capabilities.ts";

const API = "http://127.0.0.1:54321";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const PW = "MatKhau123!";
const doc = (p: string) =>
  readFileSync(new URL(p, import.meta.url), "utf8");
const sach = (p: string) => doc(p).replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

// ══ 1. Hàm can(): mặc định là TỪ CHỐI ══════════════════════════════════════

test("thiếu thông tin thì không có quyền, không bao giờ mở hết", () => {
  for (const c of NHIPPHACH_CAPS) {
    assert.equal(can(null, c), false);
    assert.equal(can(NO_CAPS, c), false);
  }
  // Chỉ đúng `true` mới là có quyền.
  const la = { role: "student", caps: { batch: 1 } } as never;
  assert.equal(can(la, "batch"), false);
});

test("đọc jsonb của máy chủ thì bỏ mọi khoá lạ và giá trị không phải true", () => {
  const s = parseCaps({
    role: "student",
    caps: {
      access: true,
      batch: false,
      "export.pdf": "true",
      "nhipphach.admin": true,
      linh_tinh: true,
    },
  });
  assert.deepEqual(s, { role: "student", caps: { access: true } });
  // Vai trò lạ bị hạ về khách.
  assert.equal(parseCaps({ role: "superuser", caps: {} }).role, "guest");
  assert.deepEqual(parseCaps(null), NO_CAPS);
  assert.deepEqual(parseCaps("teacher"), NO_CAPS);
});

test("hai quyền còn khoá cho học viên được khai rõ ràng", () => {
  assert.deepEqual([...KHOA_CHO_HOC_VIEN], ["presets", "history"]);
  assert.equal(isKhoa("student", "presets"), true);
  assert.equal(isKhoa("student", "history"), true);
  assert.equal(isKhoa("student", "batch"), false);
  assert.equal(isKhoa("teacher", "presets"), false);
});

test("mọi quyền đều có tên tiếng Việt để hiện ở trang quản trị", () => {
  for (const c of NHIPPHACH_CAPS) assert.ok(CAP_LABEL[c], `thiếu nhãn ${c}`);
});

// ══ 2. Không chỗ nào quyết tính năng bằng vai trò ═══════════════════════════

test("trang công cụ không hề so vai trò để mở tính năng", () => {
  const page = sach("../../src/pages/MusicXmlBeatsPage.tsx");
  for (const cam of [
    /role === ["']teacher["']/,
    /role === ["']admin["']/,
    /role === ["']student["']/,
    /isTeacher/,
  ])
    assert.equal(cam.test(page), false, `lộ luật vai trò: ${cam}`);
  // Mọi tính năng đi qua can().
  for (const cap of [
    "advanced",
    "batch",
    "presets",
    "history",
    "export.pdf",
    "export.png",
    "export.svg",
    "export.beatmap",
  ])
    assert.ok(page.includes(`can(caps, "${cap}")`), `thiếu can() cho ${cap}`);
});

test("router bỏ hẳn luật teacher-only cho /nhipphach", () => {
  const router = sach("../../src/AppRouter.tsx");
  const khoi = router.slice(
    router.indexOf("if (NHIPPHACH_PATHS.includes"),
    router.indexOf("/app-v2-preview")
  );
  assert.equal(/teacherRouteAccess/.test(router), false);
  assert.equal(/isTeacher/.test(khoi), false);
  assert.match(khoi, /<NhipPhachGate \/>/);
});

// ══ 3. Ẩn giao diện thôi chưa đủ — handler phải tự chặn ═════════════════════

test("mọi handler nhạy cảm đều kiểm quyền lại từ đầu", () => {
  const page = sach("../../src/pages/MusicXmlBeatsPage.tsx");
  const than = (ten: string) => {
    const t = page.slice(page.indexOf(ten));
    return t.slice(0, t.indexOf("\n  }\n") + 4);
  };
  assert.match(
    than("async function exportPrint"),
    /if \(!can\(caps, `export\.\$\{format\}` as const\)\) return;/
  );
  assert.match(than("async function runBatchNow"), /if \(!can\(caps, "batch"\)\) return;/);
  assert.match(than("async function downloadZip"), /if \(!can\(caps, "batch"\)\) return;/);
  assert.match(than("function taiBeatMap"), /if \(!can\(caps, "export\.beatmap"\)/);
  assert.match(than("async function guard"), /if \(!can\(caps, "presets"\)\) return;/);
  assert.match(than("async function ghiLichSu"), /if \(!can\(caps, "history"\)/);
  assert.match(than("async function refreshHistory"), /if \(!can\(caps, "history"\)/);
});

test("chốt nằm ở ĐẦU handler, trước mọi việc khác", () => {
  const page = sach("../../src/pages/MusicXmlBeatsPage.tsx");
  for (const [ten, cap] of [
    ["async function runBatchNow", '"batch"'],
    ["async function downloadZip", '"batch"'],
    ["async function guard", '"presets"'],
  ] as [string, string][]) {
    const t = page.slice(page.indexOf(ten));
    const dong = t.slice(0, t.indexOf("\n  }\n")).split("\n");
    const iChot = dong.findIndex((d) => d.includes(`can(caps, ${cap})`));
    assert.equal(iChot, 1, `${ten}: chốt phải là dòng đầu tiên của thân hàm`);
  }
});

// ══ 4. Quyền không bao giờ đến từ localStorage ══════════════════════════════

test("localStorage chỉ nhớ mức giao diện, không phải quyền", () => {
  const page = sach("../../src/pages/MusicXmlBeatsPage.tsx");
  const hook = sach("../../src/nhipphach/useCapabilities.ts");
  // Trang chỉ đụng localStorage đúng một khoá, và là khoá sở thích.
  const khoa = page.match(/localStorage\.(get|set)Item\(([^)]*)\)/g) ?? [];
  assert.ok(khoa.length > 0);
  for (const k of khoa) assert.match(k, /KHOA_MUC/);
  assert.match(page, /const KHOA_MUC = "nhipphach:giao-dien"/);
  // Cổng đọc quyền tuyệt đối không chạm localStorage.
  assert.equal(/localStorage/.test(hook), false, "quyền phải do máy chủ trả");
  assert.match(hook, /supabase\.rpc\("my_nhipphach_caps"\)/);
});

test("cổng quyền theo đúng khuôn ToolRouteGate đã nghiệm thu", () => {
  const hook = sach("../../src/nhipphach/useCapabilities.ts");
  // Danh tính đọc từ phiên cục bộ, không gọi mạng.
  assert.match(hook, /getSession\(\)/);
  assert.equal(/supabase\.auth\.getUser\(\)/.test(hook), false);
  // Quyền tốt gần nhất gắn với một tài khoản cụ thể.
  assert.match(hook, /totNhat\.current\.uid !== uid/);
  // Đăng xuất / đổi người: quên ngay.
  assert.match(hook, /event === "SIGNED_OUT"[\s\S]{0,120}quen\(\)/);
  // Chỉ lỗi mạng mới giữ quyền cũ; trả lời hợp lệ dù là "không cho" cũng theo.
  assert.match(hook, /const giu = totNhat\.current && totNhat\.current\.uid === uid;/);
});

// ══ 5. Kho preset / lịch sử tôn trọng quyền ════════════════════════════════

test("không có quyền thì không mở kho đám mây, và hai quyền tách rời", () => {
  const gate = sach("../../src/nhipphach/presetGateway.ts");
  assert.match(gate, /if \(!userId \|\| !cho\.presets\)/);
  assert.match(
    gate,
    /const jobs =\s*\n?\s*userId && cho\.history \? new SupabaseJobRepository\(supabase, userId\) : null;/
  );
});

// ══ 6. Trang quản trị ═════════════════════════════════════════════════════

test("Admin dùng nguyên shell chung, không dựng app quản trị riêng", () => {
  const shell = doc("../../src/TeacherAdminPage.tsx");
  assert.match(shell, /import NhipPhachAdmin from '\.\/admin\/NhipPhachAdmin'/);
  assert.match(shell, /\{ id: 'nhipphach' as Section, icon: '🎼', label: 'Nhịp phách'/);
  assert.match(shell, /\{section === 'nhipphach' && \(/);
  // /admin/nhipphach mở đúng mục nhưng vẫn nằm trong shell.
  assert.match(shell, /window\.location\.pathname\.replace\(\/\^\\\/admin\\\/\?\/, ''\)/);
  const admin = sach("../../src/admin/NhipPhachAdmin.tsx");
  // Không tự dựng sidebar, header hay lớp xác thực riêng.
  for (const cam of [/<nav/, /position: *'fixed'/, /supabase\.auth\.signIn/, /NAV *=/])
    assert.equal(cam.test(admin), false, `Admin tự dựng lại: ${cam}`);
});

test("trang quản trị KHOÁ hai ô chưa mở được, kèm lý do", () => {
  const admin = doc("../../src/admin/NhipPhachAdmin.tsx");
  assert.match(admin, /if \(isKhoa\(role, cap\)\) return/);
  assert.match(admin, /Chưa hỗ trợ cho học viên/);
  assert.match(admin, /Khoá/);
  // Ghi thẳng vào bảng, không đi đường vòng.
  assert.match(admin, /from\('tool_capabilities'\)/);
  assert.match(admin, /onConflict: 'tool_id,role,capability'/);
  // Chỉ hai vai trò, không có Khách.
  assert.match(admin, /id: 'student' as const, ten: 'Học viên'/);
  assert.match(admin, /id: 'teacher' as const, ten: 'Giáo viên'/);
  assert.equal(/guest/.test(admin), false);
});

// ══ 7. Ma trận trên Supabase LOCAL, JWT thật ═══════════════════════════════

const TOOL = "nhipphach";
async function may(email: string) {
  const client = createClient(API, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { client, uid: data.user!.id };
}
let A: { client: SupabaseClient; uid: string };   // giáo viên
let AD: { client: SupabaseClient; uid: string };  // quản trị viên
let C: { client: SupabaseClient; uid: string };   // học viên
let khach: SupabaseClient;
const goc: Record<string, boolean> = {};
let toolBatDau = true;

const capsCua = async (c: SupabaseClient) => {
  const { data, error } = await c.rpc("my_nhipphach_caps");
  if (error) throw new Error(error.message);
  return parseCaps(data);
};
/** Chỉ quản trị viên mới sửa được ma trận — dùng đúng tài khoản đó. */
const dat = async (role: string, cap: Capability, allowed: boolean) => {
  const { error } = await AD.client
    .from("tool_capabilities")
    .upsert({ tool_id: TOOL, role, capability: cap, allowed }, { onConflict: "tool_id,role,capability" });
  if (error) throw new Error(error.message);
};

const batTool = async (enabled: boolean) => {
  const { error } = await AD.client
    .from("edu_tools")
    .update({ enabled })
    .eq("id", TOOL);
  if (error) throw new Error(error.message);
};

before(async () => {
  A = await may("teacher-a@test.local");
  AD = await may("teacher-b@test.local");
  C = await may("student-c@test.local");
  khach = createClient(API, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await AD.client
    .from("tool_capabilities")
    .select("role,capability,allowed")
    .eq("tool_id", TOOL);
  for (const r of data ?? []) goc[`${r.role}:${r.capability}`] = r.allowed;
  const { data: t } = await AD.client
    .from("edu_tools")
    .select("enabled")
    .eq("id", TOOL)
    .single();
  toolBatDau = t?.enabled ?? true;
});
after(async () => {
  // Trả ma trận và công tắc tổng về đúng như lúc đầu.
  for (const [k, v] of Object.entries(goc)) {
    const [role, cap] = k.split(":");
    await dat(role, cap as Capability, v);
  }
  await batTool(toolBatDau);
});

test("seed đúng như đã chốt", async () => {
  const hv = await capsCua(C.client);
  assert.equal(hv.role, "student");
  assert.deepEqual(hv.caps, {
    access: true,
    advanced: true,
    "export.pdf": true,
    "export.png": true,
  });
  const gv = await capsCua(A.client);
  assert.equal(gv.role, "teacher");
  for (const c of NHIPPHACH_CAPS) assert.equal(can(gv, c), true, `thầy thiếu ${c}`);
});

test("khách thậm chí không được CHẠY hàm đọc quyền", async () => {
  // Hàm là SECURITY DEFINER nên `anon` bị thu hồi hẳn quyền execute; client
  // cũng không gọi khi chưa có phiên (xem useCapabilities).
  const { error } = await khach.rpc("my_nhipphach_caps");
  assert.ok(error, "anon không được chạy my_nhipphach_caps");
  assert.match(error!.message, /permission denied/i);
  // Và client coi "không có phiên" là câu trả lời dứt khoát: không quyền nào.
  const hook = readFileSync(
    new URL("../../src/nhipphach/useCapabilities.ts", import.meta.url),
    "utf8"
  );
  assert.match(hook, /if \(!uid\) \{[\s\S]{0,200}setState\(NO_CAPS\);[\s\S]{0,80}setPhase\("ready"\);/);
  for (const c of NHIPPHACH_CAPS) assert.equal(can(NO_CAPS, c), false);
});

test("HỌC VIÊN: bật SVG và Nhiều bài thì học viên dùng được ngay", async () => {
  assert.equal(can(await capsCua(C.client), "export.svg"), false);
  assert.equal(can(await capsCua(C.client), "batch"), false);
  await dat("student", "export.svg", true);
  await dat("student", "batch", true);
  const sau = await capsCua(C.client);
  assert.equal(sau.role, "student", "vai trò KHÔNG đổi");
  assert.equal(can(sau, "export.svg"), true);
  assert.equal(can(sau, "batch"), true);
  await dat("student", "export.svg", false);
  await dat("student", "batch", false);
  assert.equal(can(await capsCua(C.client), "batch"), false);
});

test("GIÁO VIÊN: tắt Nhiều bài thì thầy cũng không có, dù vai trò là teacher", async () => {
  assert.equal(can(await capsCua(A.client), "batch"), true);
  await dat("teacher", "batch", false);
  const sau = await capsCua(A.client);
  assert.equal(sau.role, "teacher");
  assert.equal(can(sau, "batch"), false, "vai trò không được vượt mặt ma trận");
  // Các quyền khác không bị ảnh hưởng lây.
  assert.equal(can(sau, "export.pdf"), true);
  await dat("teacher", "batch", true);
});

test("tắt quyền vào cửa thì học viên bị chặn, bật lại thì vào được", async () => {
  assert.equal(can(await capsCua(C.client), "access"), true);
  await dat("student", "access", false);
  assert.equal(can(await capsCua(C.client), "access"), false);
  await dat("student", "access", true);
  assert.equal(can(await capsCua(C.client), "access"), true);
});

test("thiếu dòng trong ma trận là KHÔNG có quyền", async () => {
  await AD.client
    .from("tool_capabilities")
    .delete()
    .eq("tool_id", TOOL)
    .eq("role", "student")
    .eq("capability", "export.png");
  assert.equal(can(await capsCua(C.client), "export.png"), false);
  await dat("student", "export.png", true);
  assert.equal(can(await capsCua(C.client), "export.png"), true);
});

test("học viên KHÔNG đọc và KHÔNG sửa được ma trận", async () => {
  const doc_ = await C.client.from("tool_capabilities").select("*");
  assert.deepEqual(doc_.data, []);
  const ghi = await C.client
    .from("tool_capabilities")
    .upsert({ tool_id: TOOL, role: "student", capability: "batch", allowed: true });
  assert.ok(ghi.error, "học viên không được tự bật quyền cho mình");
  assert.equal(can(await capsCua(C.client), "batch"), false);
});

test("GIÁO VIÊN cũng không đọc và không sửa được ma trận", async () => {
  // Đây là trang quản trị chung. Cho giáo viên ghi là cho họ tự bật Nhiều bài
  // cho mình và đổi quyền của học viên.
  const doc_ = await A.client.from("tool_capabilities").select("*");
  assert.deepEqual(doc_.data, [], "giáo viên không được đọc trực tiếp");
  const ghi = await A.client
    .from("tool_capabilities")
    .upsert({ tool_id: TOOL, role: "teacher", capability: "batch", allowed: true });
  assert.ok(ghi.error, "giáo viên không được ghi");
  const sua = await A.client
    .from("tool_capabilities")
    .update({ allowed: true })
    .eq("tool_id", TOOL)
    .eq("role", "student")
    .eq("capability", "batch");
  assert.equal(
    (await capsCua(C.client)).caps.batch ?? false,
    false,
    "học viên không được lên quyền vì thầy sửa"
  );
  void sua;
  // Nhưng giáo viên VẪN đọc được quyền của chính mình qua RPC.
  const cua = await capsCua(A.client);
  assert.equal(cua.role, "teacher");
  assert.equal(can(cua, "access"), true);
});

test("QUẢN TRỊ VIÊN đọc và sửa được, và updated_by là chính mình", async () => {
  const d = await AD.client.from("tool_capabilities").select("*").eq("tool_id", TOOL);
  assert.ok((d.data ?? []).length >= 18, "admin phải đọc được cả ma trận");
  await dat("student", "export.svg", true);
  const { data } = await AD.client
    .from("tool_capabilities")
    .select("allowed,updated_by")
    .eq("tool_id", TOOL)
    .eq("role", "student")
    .eq("capability", "export.svg")
    .single();
  assert.equal(data!.allowed, true);
  assert.equal(data!.updated_by, AD.uid, "máy chủ đặt updated_by, không tin client");
  await dat("student", "export.svg", false);
});

test("quản trị viên có đủ mọi quyền, không phụ thuộc ma trận", async () => {
  const q = await capsCua(AD.client);
  assert.equal(q.role, "admin");
  for (const c of NHIPPHACH_CAPS) assert.equal(can(q, c), true, `admin thiếu ${c}`);
});

test("khách vãng lai không chạm được vào ma trận", async () => {
  const d = await khach.from("tool_capabilities").select("*");
  assert.equal(d.data === null || d.data.length === 0, true);
  const g = await khach
    .from("tool_capabilities")
    .insert({ tool_id: TOOL, role: "student", capability: "batch", allowed: true });
  assert.ok(g.error);
});

test("RPC không nhận vai trò từ client", async () => {
  // Gửi kèm role cũng không đổi được gì: hàm không có tham số nào.
  const { error } = await C.client.rpc("my_nhipphach_caps", { role: "teacher" } as never);
  assert.ok(error, "hàm không được có tham số role");
  assert.equal(can(await capsCua(C.client), "batch"), false);
});

test("Nhịp Phách là công cụ chính thức trong sổ chung", async () => {
  const { data } = await A.client
    .from("edu_tools")
    .select("id,route,enabled")
    .eq("id", TOOL)
    .single();
  assert.equal(data!.route, "/nhipphach");
  assert.equal(data!.enabled, true);
});

// ══ 8. Khoá cứng phía máy chủ cho preset / lịch sử của học viên ════════════

test("sửa thẳng DB cũng KHÔNG mở được preset/lịch sử cho học viên", async () => {
  // Đây là chốt fail-closed: RLS của bốn bảng kia vẫn là is_teacher(), nên dù
  // ai đó bật cờ trong ma trận thì resolver vẫn phải trả false.
  await dat("student", "presets", true);
  await dat("student", "history", true);
  const hv = await capsCua(C.client);
  assert.equal(can(hv, "presets"), false, "clamp phải chặn ngay ở resolver");
  assert.equal(can(hv, "history"), false);
  // Hàng trong bảng vẫn là true — clamp che chứ không sửa dữ liệu của Admin.
  const { data } = await AD.client
    .from("tool_capabilities")
    .select("capability,allowed")
    .eq("tool_id", TOOL)
    .eq("role", "student")
    .in("capability", ["presets", "history"]);
  assert.deepEqual(
    (data ?? []).map((r) => r.allowed),
    [true, true]
  );
  // Giáo viên KHÔNG bị clamp: backend đỡ được cho họ.
  assert.equal(can(await capsCua(A.client), "presets"), true);
  assert.equal(can(await capsCua(A.client), "history"), true);
  await dat("student", "presets", false);
  await dat("student", "history", false);
});

// ══ 9. Công tắc tổng ══════════════════════════════════════════════════════

test("tắt công cụ là tắt cho CẢ học viên lẫn giáo viên", async () => {
  assert.equal(can(await capsCua(C.client), "access"), true);
  assert.equal(can(await capsCua(A.client), "access"), true);
  await batTool(false);
  const hv = await capsCua(C.client);
  const gv = await capsCua(A.client);
  // Giáo viên KHÔNG được đi vòng như ở my_tool_route_access() cũ.
  assert.equal(can(hv, "access"), false, "học viên bị chặn");
  assert.equal(can(gv, "access"), false, "giáo viên cũng bị chặn");
  for (const c of NHIPPHACH_CAPS) {
    assert.equal(can(hv, c), false);
    assert.equal(can(gv, c), false);
  }
  // Quản trị viên vẫn vào được để còn bật lại — tránh tự khoá hệ quản trị.
  const q = await capsCua(AD.client);
  assert.equal(can(q, "access"), true, "admin phải giữ được đường quản trị");
  await batTool(true);
  assert.equal(can(await capsCua(C.client), "access"), true);
});

test("công tắc tổng chỉ CHE, không xoá lựa chọn nào", async () => {
  await dat("student", "export.svg", true);
  await batTool(false);
  assert.equal(can(await capsCua(C.client), "export.svg"), false);
  await batTool(true);
  assert.equal(can(await capsCua(C.client), "export.svg"), true, "bật lại là còn nguyên");
  await dat("student", "export.svg", false);
});

// ══ 10. access và advanced chỉ CHE ════════════════════════════════════════

test("tắt access thì che hết, bật lại thì mọi lựa chọn cũ trở về", async () => {
  await dat("student", "export.svg", true);
  await dat("student", "batch", true);
  await dat("student", "access", false);
  const tat = await capsCua(C.client);
  for (const c of NHIPPHACH_CAPS) assert.equal(can(tat, c), false);
  // Dữ liệu trong bảng không hề bị đụng.
  const { data } = await AD.client
    .from("tool_capabilities")
    .select("capability,allowed")
    .eq("tool_id", TOOL)
    .eq("role", "student")
    .in("capability", ["export.svg", "batch"]);
  assert.deepEqual((data ?? []).map((r) => r.allowed).sort(), [true, true]);
  await dat("student", "access", true);
  const bat = await capsCua(C.client);
  assert.equal(can(bat, "export.svg"), true);
  assert.equal(can(bat, "batch"), true);
  await dat("student", "export.svg", false);
  await dat("student", "batch", false);
});

test("tắt advanced chỉ che tính năng thuộc Nâng cao, không đụng cái khác", async () => {
  await dat("student", "export.svg", true);
  await dat("student", "batch", true);
  await dat("student", "advanced", false);
  const c1 = await capsCua(C.client);
  // Bị che: những thứ chỉ có bên trong mức Nâng cao.
  assert.equal(can(c1, "batch"), false);
  assert.equal(can(c1, "export.svg"), false);
  assert.equal(can(c1, "export.beatmap"), false);
  // KHÔNG bị che: vào cửa, PDF, và PNG — PNG là nút chính khi Admin tắt PDF,
  // che nó đi là người dùng mất hẳn đường xuất file.
  assert.equal(can(c1, "access"), true);
  assert.equal(can(c1, "export.pdf"), true);
  assert.equal(can(c1, "export.png"), true);
  // Bật lại: SVG và Nhiều bài trở về, không phải đặt lại tay.
  await dat("student", "advanced", true);
  const c2 = await capsCua(C.client);
  assert.equal(can(c2, "batch"), true);
  assert.equal(can(c2, "export.svg"), true);
  await dat("student", "export.svg", false);
  await dat("student", "batch", false);
});

// ══ 11. Chạy lại migration không được xoá cấu hình ═════════════════════════

test("migration chỉ seed dòng còn thiếu, không ghi đè lựa chọn Admin", () => {
  const sql = readFileSync(
    new URL("../../db/nhipphach_capabilities_setup.sql", import.meta.url),
    "utf8"
  );
  // Ma trận: do nothing, tuyệt đối không do update.
  const seed = sql.slice(sql.indexOf("insert into public.tool_capabilities"));
  assert.match(seed.slice(0, seed.indexOf(";")), /on conflict \(tool_id, role, capability\) do nothing/);
  assert.equal(/on conflict[\s\S]{0,80}do update set allowed/.test(sql), false);
  // Công tắc tổng: không được bật lại công cụ Admin đã tắt.
  const tool = sql.slice(sql.indexOf("insert into public.edu_tools"));
  const doi = tool.slice(tool.indexOf("do update"), tool.indexOf(";"));
  assert.equal(/enabled/.test(doi), false, "on conflict không được đụng enabled");
  assert.equal(/status|tier|order_index/.test(doi), false);
});

test("chạy lại migration THẬT: mọi lựa chọn Admin còn nguyên", async () => {
  // Dựng một cấu hình khác hẳn seed rồi chạy lại nguyên file migration.
  await dat("student", "export.svg", true);
  await dat("student", "batch", true);
  await dat("teacher", "batch", false);
  await batTool(false);

  const { execSync } = await import("node:child_process");
  const file = new URL("../../db/nhipphach_capabilities_setup.sql", import.meta.url)
    .pathname;
  execSync(
    `docker exec -i supabase_db_cs-rhythm-editor psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 < ${JSON.stringify(file)}`,
    { shell: "/bin/zsh", stdio: "pipe" }
  );

  const { data } = await AD.client
    .from("tool_capabilities")
    .select("role,capability,allowed")
    .eq("tool_id", TOOL)
    .in("capability", ["export.svg", "batch"]);
  const lay = (r: string, c: string) =>
    (data ?? []).find((x) => x.role === r && x.capability === c)?.allowed;
  assert.equal(lay("student", "export.svg"), true, "SVG học viên bị reset");
  assert.equal(lay("student", "batch"), true, "Nhiều bài học viên bị reset");
  assert.equal(lay("teacher", "batch"), false, "Nhiều bài giáo viên bị bật lại");
  const { data: t } = await AD.client
    .from("edu_tools")
    .select("enabled")
    .eq("id", TOOL)
    .single();
  assert.equal(t!.enabled, false, "công cụ Admin đã tắt bị bật lại");

  await batTool(true);
  await dat("student", "export.svg", false);
  await dat("student", "batch", false);
  await dat("teacher", "batch", true);
});

// ══ 12. Danh sách quyền hai bên không được trôi ════════════════════════════

test("danh sách quyền ở DB và ở client trùng khít", async () => {
  const { data, error } = await AD.client.rpc("nhipphach_capability_list");
  assert.equal(error, null);
  assert.deepEqual([...(data as string[])].sort(), [...NHIPPHACH_CAPS].sort());
  // Và trang quản trị hiện đủ từng ấy dòng.
  for (const c of data as string[])
    assert.ok(CAP_LABEL[c as Capability], `client chưa biết quyền ${c}`);
});

test("nhóm 'chỉ có ở Nâng cao' được khai ở DB, khớp với cái UI giấu", async () => {
  const { data } = await AD.client.rpc("nhipphach_advanced_only");
  assert.deepEqual(
    [...(data as string[])].sort(),
    ["batch", "export.beatmap", "export.svg", "presets"]
  );
});

// ══ 13. Hàm SECURITY DEFINER được siết đúng cách ═══════════════════════════

test("my_nhipphach_caps không nhận tham số và không cho anon chạy", () => {
  const sql = readFileSync(
    new URL("../../db/nhipphach_capabilities_setup.sql", import.meta.url),
    "utf8"
  );
  const fn = sql.slice(sql.indexOf("create or replace function public.my_nhipphach_caps"));
  assert.match(fn.slice(0, 200), /my_nhipphach_caps\(\)\s*\n?returns jsonb/);
  assert.match(fn.slice(0, 260), /security definer set search_path = ''/);
  // Người gọi xác định bằng auth.uid(), vai trò lấy phía máy chủ.
  assert.match(fn, /v_uid\s+uuid := auth\.uid\(\)/);
  assert.match(fn, /public\.my_learning_state\(\) ->> 'mode'/);
  assert.match(sql, /revoke all on function public\.my_nhipphach_caps\(\) from anon/);
  assert.match(sql, /grant execute on function public\.my_nhipphach_caps\(\) to authenticated/);
  // is_admin() là vị từ RIÊNG, không dùng is_teacher() cho quyền ghi.
  assert.match(sql, /create or replace function public\.is_admin\(\)/);
  assert.match(sql, /au\.role = 'admin'/);
  // `revoke from public` không gỡ nổi quyền Supabase cấp thẳng cho anon.
  for (const fn of [
    "is_admin",
    "my_nhipphach_caps",
    "nhipphach_capability_list",
    "nhipphach_advanced_only",
  ])
    assert.match(
      sql,
      new RegExp(`revoke all on function public\\.${fn}\\(\\) from anon`),
      `${fn} chưa revoke đích danh khỏi anon`
    );
  const rls = sql.slice(
    sql.indexOf("create policy tool_capabilities_admin_select"),
    sql.indexOf("revoke all on public.tool_capabilities from anon")
  );
  assert.equal(/is_teacher\(\)/.test(rls), false, "RLS ma trận không được dùng is_teacher()");
  // 4 policy: select, insert, update (using + with check), delete → 5 lần.
  assert.equal((rls.match(/public\.is_admin\(\)/g) || []).length, 5);
  for (const cmd of ["select", "insert", "update", "delete"])
    assert.match(rls, new RegExp(`for ${cmd} to authenticated`));
});

// ══ 14. Alias không phải đường vòng ═══════════════════════════════════════

test("/musicxml-beats dùng CHUNG một ma trận, không tạo công cụ thứ hai", async () => {
  const router = readFileSync(
    new URL("../../src/AppRouter.tsx", import.meta.url),
    "utf8"
  );
  // Hai đường cùng đi vào một cổng, cổng đó không nhìn đường dẫn.
  assert.match(
    router,
    /NHIPPHACH_PATHS: readonly string\[\] = \['\/nhipphach', '\/musicxml-beats'\]/
  );
  const khoi = router.slice(
    router.indexOf("if (NHIPPHACH_PATHS.includes"),
    router.indexOf("/app-v2-preview")
  );
  assert.match(khoi, /<NhipPhachGate \/>/);
  const gate = readFileSync(
    new URL("../../src/nhipphach/NhipPhachGate.tsx", import.meta.url),
    "utf8"
  );
  // `location.reload()` để thử lại thì được; đọc đường dẫn để quyết quyền thì không.
  assert.equal(
    /location\.(pathname|href|search)/.test(gate),
    false,
    "cổng không được nhìn đường dẫn"
  );
  // Và chỉ có ĐÚNG MỘT công cụ trong sổ.
  const { data } = await AD.client
    .from("edu_tools")
    .select("id,route")
    .in("route", ["/nhipphach", "/musicxml-beats"]);
  assert.deepEqual(data, [{ id: TOOL, route: "/nhipphach" }]);
  // Tắt quyền vào cửa là tắt cho cả hai đường, vì cùng một câu trả lời.
  await dat("student", "access", false);
  assert.equal(can(await capsCua(C.client), "access"), false);
  await dat("student", "access", true);
});

// ══ 15. Quyền bị thu hồi thì handler từ chối, không chỉ ẩn nút ═════════════

/**
 * Dựng lại đúng hình dạng handler của trang: chốt quyền đọc từ `caps` hiện
 * hành, không phải từ một bản chụp lúc gắn sự kiện.
 */
function nutXuat(lay: () => ReturnType<typeof parseCaps>) {
  let soLanChay = 0;
  return {
    soLanChay: () => soLanChay,
    xuat(dinhDang: "pdf" | "png" | "svg") {
      const caps = lay();
      if (!can(caps, `export.${dinhDang}` as Capability)) return "tu-choi";
      soLanChay++;
      return "da-xuat";
    },
  };
}

test("Admin thu hồi SVG: lần bấm sau bị từ chối dù nút còn trên màn hình", async () => {
  await dat("student", "export.svg", true);
  let caps = await capsCua(C.client);
  const nut = nutXuat(() => caps);
  assert.equal(nut.xuat("svg"), "da-xuat");

  // Admin tắt SVG. Trang chưa vẽ lại, nhưng quyền đã được đọc lại.
  await dat("student", "export.svg", false);
  caps = await capsCua(C.client);
  assert.equal(nut.xuat("svg"), "tu-choi", "handler phải tự chặn");
  assert.equal(nut.soLanChay(), 1, "không có lần xuất nào thứ hai");
  // Các định dạng khác không bị vạ lây.
  assert.equal(nut.xuat("pdf"), "da-xuat");
});

test("chốt đọc quyền HIỆN HÀNH, không đóng băng lúc gắn sự kiện", async () => {
  // Nếu handler chụp `caps` một lần rồi giữ mãi thì việc thu hồi quyền sẽ vô
  // hiệu cho tới khi người dùng F5 — đó là lỗ hổng, không phải tính năng.
  const page = readFileSync(
    new URL("../../src/pages/MusicXmlBeatsPage.tsx", import.meta.url),
    "utf8"
  ).replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
  // `caps` là prop của component, mọi handler đọc thẳng nó trong thân hàm.
  assert.match(page, /caps = NO_CAPS,\s*\n?\s*\}: \{/);
  for (const h of [
    "async function exportPrint",
    "async function runBatchNow",
    "async function downloadZip",
    "function taiBeatMap",
    "async function guard",
    "async function ghiLichSu",
  ]) {
    const t = page.slice(page.indexOf(h));
    assert.match(
      t.slice(0, t.indexOf("\n  }\n")),
      /can\(caps, /,
      `${h} phải đọc caps hiện hành`
    );
  }
  // Và không có bản chụp quyền nào nằm ngoài prop.
  assert.equal(/useRef<CapState/.test(page), false);
  assert.equal(/useState<CapState/.test(page), false);
});
