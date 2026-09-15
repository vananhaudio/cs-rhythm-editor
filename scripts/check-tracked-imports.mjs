#!/usr/bin/env node
/**
 * Cổng CI: bản checkout SẠCH phải build được.
 *
 * Vì sao cần: Netlify build từ một bản checkout chỉ có những gì đã commit. Máy
 * ở nhà thì còn cả file chưa `git add`, nên `npm run build` tại chỗ vẫn xanh
 * trong khi production gãy TS2307. Chuyện này đã xảy ra thật: `ClassLandingPage`
 * import hai file chưa bao giờ được commit, và MỌI lần deploy từ 4980cad tới
 * ecdbceb đều hỏng mà không ai biết.
 *
 * Cách đo: đi TỪ ĐIỂM VÀO THẬT (thẻ <script> của index.html) theo đúng đồ thị
 * import — chứ không quét bừa mọi file trong repo. File chết nằm ngoài đồ thị
 * không làm gãy build, nên nó là CẢNH BÁO, không phải lỗi; kêu oan vài lần là
 * lần sau không ai đọc nữa.
 *
 * Chạy: npm run check:imports
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const git = (...a) => execFileSync("git", a, { encoding: "utf8" });
const goc = git("rev-parse", "--show-toplevel").trim();
const ten = (p) => p.slice(goc.length + 1);

const theoDoi = new Set(
  git("ls-files", "-z").split("\0").filter(Boolean).map((p) => resolve(goc, p))
);

const NGUON = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const DUOI = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", "/index.ts", "/index.tsx", "/index.js"];

/** File thật mà một đường dẫn tương đối trỏ tới; null khi không có file nào. */
function giaiDuongDan(tu, spec) {
  const base = resolve(dirname(tu), spec);
  for (const d of DUOI) {
    const p = base + d;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  // Viết đuôi .js nhưng nguồn là .ts — kiểu ESM của TypeScript.
  const doi = base.replace(/\.js$/, "");
  for (const d of [".ts", ".tsx"]) if (existsSync(doi + d)) return doi + d;
  return null;
}

// import/export tĩnh và import() động có chuỗi hằng.
const RE =
  /(?:^|[\s;}])(?:import|export)\s+(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

const nhapCua = (f) => [
  // Gộp trùng: một file thường vừa `import` giá trị vừa `import type` cùng một
  // chỗ, kể hai lần thì báo cáo dài gấp đôi mà không nói thêm gì.
  ...new Set(
    [...readFileSync(f, "utf8").matchAll(RE)]
      .map((m) => m[1] ?? m[2])
      .filter((s) => s && s.startsWith("."))
  ),
];

/** Điểm vào thật: mọi <script src> trỏ vào nguồn trong index.html. */
function diemVao() {
  const html = resolve(goc, "index.html");
  if (!existsSync(html)) throw new Error("Không thấy index.html — không biết build bắt đầu từ đâu.");
  const ra = [];
  for (const m of readFileSync(html, "utf8").matchAll(/<script[^>]+src=["']([^"']+)["']/g)) {
    const p = resolve(goc, m[1].replace(/^\//, ""));
    if (existsSync(p)) ra.push(p);
  }
  if (!ra.length) throw new Error("index.html không trỏ tới file nguồn nào.");
  return ra;
}

const loi = [];
const canh = [];
const daDi = new Set();
const hangDoi = diemVao();
for (const e of hangDoi) daDi.add(e);

while (hangDoi.length) {
  const f = hangDoi.shift();
  if (!NGUON.test(f)) continue;
  for (const spec of nhapCua(f)) {
    const dich = giaiDuongDan(f, spec);
    if (!dich) {
      // Ảnh/CSS/asset Vite lo được miễn là file có thật; không có file thật mới là lỗi.
      loi.push(`${ten(f)}\n    import "${spec}" → không có file nào khớp`);
      continue;
    }
    if (!theoDoi.has(dich))
      loi.push(`${ten(f)}\n    import "${spec}" → ${ten(dich)} CHƯA được commit`);
    if (!daDi.has(dich)) {
      daDi.add(dich);
      hangDoi.push(dich);
    }
  }
}

// Ngoài đồ thị: vẫn soi, nhưng chỉ nhắc. Không chặn.
for (const f of theoDoi) {
  if (daDi.has(f) || !NGUON.test(f) || !existsSync(f)) continue;
  for (const spec of nhapCua(f)) {
    const dich = giaiDuongDan(f, spec);
    if (!dich) canh.push(`${ten(f)} → "${spec}" không có file nào khớp`);
    else if (!theoDoi.has(dich)) canh.push(`${ten(f)} → ${ten(dich)} chưa commit`);
  }
}

if (canh.length) {
  console.log(`Ngoài đồ thị build (không chặn deploy), ${canh.length} chỗ đáng dọn:`);
  for (const c of canh) console.log(`  ${c}`);
  console.log("");
}
if (!loi.length) {
  console.log(`OK — ${daDi.size} file trong đồ thị build, mọi import đều đã được commit.`);
  process.exit(0);
}
console.error("Bản checkout sạch sẽ KHÔNG build được:\n");
for (const l of loi) console.error(`  ${l}`);
console.error(`\n${loi.length} chỗ hỏng. Commit file còn thiếu, hoặc bỏ import.`);
process.exit(1);
