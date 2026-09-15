/**
 * CỔNG PHÁT HÀNH: bản checkout SẠCH phải build được.
 *
 * Bài học có thật: `src/ClassLandingPage.tsx` import hai file chưa bao giờ được
 * `git add`. Ở nhà `npm run build` vẫn xanh vì file nằm trên đĩa; Netlify thì
 * build từ một bản checkout chỉ có những gì đã commit, nên MỌI lần deploy từ
 * 4980cad tới ecdbceb đều gãy TS2307 mà không ai biết.
 *
 * Test này không kiểm "script có chạy không" — nó dựng lại ĐÚNG hiện trường ấy
 * bằng một `git worktree` ở 4980cad và bắt cổng phải kêu đúng hai chỗ. Một cổng
 * chưa từng bắt được lỗi thật thì không ai tin được.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
  cwd: new URL(".", import.meta.url).pathname,
}).trim();
const CONG = join(REPO, "scripts/check-tracked-imports.mjs");

/** Chạy cổng trong một thư mục, trả mã thoát và toàn bộ chữ nó in ra. */
function chay(cwd: string) {
  const r = spawnSync(process.execPath, [join(cwd, "scripts/check-tracked-imports.mjs")], {
    cwd,
    encoding: "utf8",
  });
  return { ma: r.status, chu: `${r.stdout}${r.stderr}` };
}

/**
 * Mọi phép đo đều trên một BẢN CHECKOUT SẠCH, không bao giờ trên cây làm việc.
 * Cây làm việc luôn có việc đang làm dở — đo ở đó thì hoặc báo động giả, hoặc
 * (tệ hơn) xanh nhờ những file mà Netlify sẽ không có.
 */
function trongBanSach(ref: string, sua?: (cay: string) => void) {
  const cay = mkdtempSync(join(tmpdir(), "np-cong-"));
  try {
    execFileSync("git", ["worktree", "add", "-q", "--detach", cay, ref], { cwd: REPO });
    mkdirSync(join(cay, "scripts"), { recursive: true });
    cpSync(CONG, join(cay, "scripts/check-tracked-imports.mjs"));
    sua?.(cay);
    return chay(cay);
  } finally {
    execFileSync("git", ["worktree", "remove", "--force", cay], { cwd: REPO });
    rmSync(cay, { recursive: true, force: true });
  }
}

test("cổng import: bản checkout sạch của HEAD PASS", () => {
  const r = trongBanSach("HEAD");
  assert.equal(r.ma, 0, r.chu);
  assert.match(r.chu, /mọi import đều đã được commit/);
});

test("cổng import: dựng lại hiện trường 4980cad → bắt đúng hai import thiếu", () => {
  // Bản 4980cad chưa có cổng; mang đúng cổng HÔM NAY vào để soi lại quá khứ.
  const r = trongBanSach("4980cad");
  assert.equal(r.ma, 1, "cổng phải chặn commit này");
  assert.match(r.chu, /src\/ClassLandingPage\.tsx/);
  assert.match(r.chu, /\.\/classOffer/);
  assert.match(r.chu, /\.\/components\/ClassOfferCompare/);
  // Và nó chỉ kêu đúng hai chỗ trong đồ thị build, không kêu bừa.
  assert.match(r.chu, /\n2 chỗ hỏng/);
});

test("cổng import: file chết NGOÀI đồ thị build chỉ là cảnh báo, không chặn", () => {
  // Kêu oan vài lần thì lần sau không ai đọc nữa — nên luật này cũng phải khoá.
  const r = trongBanSach("HEAD");
  assert.equal(r.ma, 0);
  assert.match(r.chu, /Ngoài đồ thị build \(không chặn deploy\)/);
  assert.match(r.chu, /utils\.ts/, "utils.ts ở gốc repo là file chết, phải nằm ở phần cảnh báo");
});

test("cổng import: thử ngược — thêm một import chưa commit vào đồ thị thì PHẢI gãy", () => {
  const r = trongBanSach("HEAD", (cay) => {
    // Đúng cái bẫy cũ: file có thật trên đĩa, nhưng chưa `git add`.
    writeFileSync(join(cay, "src/khongBaoGioCommit.ts"), "export const x = 1;\n");
    const main = join(cay, "src/main.tsx");
    writeFileSync(
      main,
      `import { x } from "./khongBaoGioCommit";\nvoid x;\n` + readFileSync(main, "utf8")
    );
  });
  assert.equal(r.ma, 1, "luật không bắt được chính đột biến của nó");
  assert.match(r.chu, /khongBaoGioCommit\.ts CHƯA được commit/);
});
