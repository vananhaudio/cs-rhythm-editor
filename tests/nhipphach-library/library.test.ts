/**
 * Thư viện bài hát — bất biến chạy được không cần database.
 *
 * Phần cần Supabase (RLS, giao dịch, dọn rác) nằm ở bộ test DB riêng; bộ này
 * khoá những thứ một phiên sau rất dễ phá mà không ai nhận ra: bản gốc bị ghi
 * đè, XML lọt vào database, hoặc Thư viện mọc ra một pipeline khắc nhạc thứ hai.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  readScoreMetadata,
  readPrimaryMeter,
  titleFromFilename,
} from "../../src/nhipphach/scoreMetadata.ts";
import { sha256Hex, byteLength } from "../../src/nhipphach/scoreHash.ts";

const src = (file: string) =>
  readFileSync(new URL(`../../src/nhipphach/${file}`, import.meta.url), "utf8");
const sql = readFileSync(
  new URL("../../db/nhipphach_library_setup.sql", import.meta.url),
  "utf8"
);
/** Bỏ chú thích: một chữ trong lời giải thích không phải là vi phạm. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(\/\/|--).*$/gm, "");

const XML = `<?xml version="1.0"?>
<score-partwise version="3.1">
  <work><work-title>Con đường xưa em đi</work-title></work>
  <identification>
    <creator type="composer">Châu Kỳ</creator>
    <creator type="lyricist">Hồ Đình Phương</creator>
  </identification>
  <part id="P1"><measure number="1">
    <attributes><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
  </measure></part>
</score-partwise>`;

// ── Metadata đọc từ chuẩn MusicXML, không đoán ────────────────────────────
test("đọc tên bài và tác giả từ chính MusicXML", () => {
  const meta = readScoreMetadata(XML, "bat-ky.musicxml");
  assert.equal(meta.title, "Con đường xưa em đi");
  assert.equal(meta.composer, "Châu Kỳ");
  assert.equal(meta.lyricist, "Hồ Đình Phương");
  assert.equal(readPrimaryMeter(XML), "4/4");
});

test("không có tên bài thì lấy tên file làm nhãn tạm", () => {
  const trong = XML.replace(/<work>[\s\S]*?<\/work>/, "");
  assert.equal(
    readScoreMetadata(trong, "/tai/ve/ha-trang_final.musicxml").title,
    "ha trang final"
  );
  assert.equal(titleFromFilename("con-duong-xua-em-di.xml"), "con duong xua em di");
});

test("movement-title đỡ khi không có work-title", () => {
  const xml = XML.replace(
    /<work>[\s\S]*?<\/work>/,
    "<movement-title>Hạ Trắng</movement-title>"
  );
  assert.equal(readScoreMetadata(xml, "x.xml").title, "Hạ Trắng");
});

test("XML hỏng không làm sập việc nạp file", () => {
  const meta = readScoreMetadata("<không phải xml", "cuu-toi.musicxml");
  assert.equal(meta.title, "cuu toi");
  assert.equal(meta.composer, null);
});

// ── Hash: cùng file cho cùng hash, khác một byte là khác hash ──────────────
test("SHA-256 ổn định và nhạy với thay đổi nhỏ nhất", async () => {
  const a = await sha256Hex(XML);
  const b = await sha256Hex(XML);
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, await sha256Hex(XML + " "));
});

test("đếm byte theo UTF-8, không theo độ dài chuỗi", () => {
  assert.equal(byteLength("a"), 1);
  assert.equal(byteLength("\u1EA1"), 3); // "ạ" — ba byte UTF-8
  assert.ok(byteLength(XML) > XML.length, "tiếng Việt tốn nhiều byte hơn ký tự");
});

// ── Bản gốc bất biến — khoá ở cả SQL lẫn mã client ─────────────────────────
test("database tự chặn sửa và xoá phiên bản", () => {
  const body = code(sql);
  assert.match(body, /before\s+update\s+or\s+delete\s+on\s+public\.nhipphach_score_versions/i);
  assert.match(body, /NHIPPHACH_VERSION_IMMUTABLE/);
  assert.match(body, /NHIPPHACH_VERSION_UNDELETABLE/);
  // Không có policy UPDATE/DELETE trên bảng phiên bản: request còn chẳng tới
  // được trigger.
  assert.equal(
    /create policy[^;]*on public\.nhipphach_score_versions\s+for\s+(update|delete)/is.test(body),
    false,
    "bảng phiên bản không được có policy UPDATE/DELETE"
  );
});

test("mỗi lần lưu là một object mới, không ghi đè object cũ", () => {
  const body = code(src("libraryRepository.ts"));
  // `upsert: true` trên bucket này nghĩa là bản gốc bị ghi đè trong im lặng.
  assert.equal(/upsert:\s*true/.test(body), false, "không được upsert lên bản nhạc đã lưu");
  assert.match(body, /upsert:\s*false/);
  // Đường dẫn sinh từ id + hash, không nhận tên file người dùng đặt.
  assert.equal(
    /path\s*=\s*[`'"].*(sourceFilename|request\.title)/.test(body),
    false,
    "đường dẫn Storage không được dựng từ tên file hay tên bài"
  );
});

test("con trỏ current chỉ tiến, khôi phục bản cũ phải tạo phiên bản mới", () => {
  const body = code(sql);
  // Chỉ đúng một chỗ được đổi current_version_id, và nó nằm trong hàm lưu.
  const updates = body.match(/set\s+current_version_id\s*=/gi) ?? [];
  assert.equal(updates.length, 1, "chỉ hàm lưu phiên bản mới được dời con trỏ");
  // Client được ĐỌC con trỏ để hiện "Đã lưu · v3", nhưng không được GHI nó:
  // dời con trỏ là việc của hàm một-giao-dịch.
  const client = code(src("libraryRepository.ts"));
  assert.equal(
    /update\(\{[^}]*current_version_id/s.test(client),
    false,
    "client không được tự viết con trỏ current"
  );
});

// ── Database không giữ bản nhạc ───────────────────────────────────────────
test("không cột nào trong database chứa MusicXML", () => {
  const body = code(sql);
  for (const forbidden of [/\bxml\s+text\b/i, /\bcontent\s+text\b/i, /\bbase64\b/i, /\bbytea\b/i])
    assert.equal(forbidden.test(body), false, `database không được giữ nội dung bản nhạc: ${forbidden}`);
  // Thứ duy nhất trỏ tới file là đường dẫn và hash.
  assert.match(body, /storage_path\s+text\s+not null unique/i);
  assert.match(body, /sha256\s+text\s+not null check/i);
});

test("bucket bản nhạc KHÔNG công khai", () => {
  const body = code(sql);
  assert.match(body, /'nhipphach-scores',\s*'nhipphach-scores',\s*false/);
  assert.match(body, /set public = false/);
  const client = code(src("libraryRepository.ts"));
  assert.equal(
    /getPublicUrl/.test(client),
    false,
    "bản nhạc không được tải qua URL công khai đoán được"
  );
  assert.match(client, /storage\.from\(BUCKET\)\.download/);
});

test("hàm lưu là SECURITY INVOKER và tự lấy người dùng từ phiên", () => {
  const body = code(sql);
  assert.match(body, /create or replace function public\.nhipphach_save_version[\s\S]*?security invoker/i);
  assert.match(body, /uid\s+uuid\s*:=\s*auth\.uid\(\)/);
  assert.match(body, /revoke all on function public\.nhipphach_save_version\(jsonb, jsonb\) from anon/);
});

// ── Thư viện không mọc ra pipeline khắc nhạc thứ hai ──────────────────────
test("Thư viện không tự đọc nhạc hay tự khắc nhạc", () => {
  for (const file of ["libraryRepository.ts", "scoreMetadata.ts", "scoreHash.ts"]) {
    const body = code(src(file));
    for (const forbidden of [
      /verovio|VerovioToolkit/i,
      /musicXMLToBeatMap|createAnnotations|beatEngine/i,
      /parseMusicXML/,
      /applyAnchorLattice|renderToSVG/,
    ])
      assert.equal(forbidden.test(body), false, `${file} không được dùng ${forbidden}`);
  }
});

test("quyền Thư viện khai đủ ở cả hai phía", async () => {
  const client = await import("../../src/nhipphach/capabilities.ts");
  const body = code(sql);
  for (const cap of ["library.read", "library.save", "library.manage"]) {
    assert.ok(
      (client.NHIPPHACH_CAPS as readonly string[]).includes(cap),
      `client thiếu quyền ${cap}`
    );
    assert.ok(body.includes(`'${cap}'`), `SQL thiếu quyền ${cap}`);
    assert.ok(cap in client.CAP_LABEL, `thiếu tên tiếng Việt cho ${cap}`);
  }
  // Policy phải đi qua capability, không phải vai trò viết cứng.
  assert.equal(
    /create policy[\s\S]*?is_teacher\(\)/.test(body),
    false,
    "policy Thư viện không được kiểm vai trò trực tiếp"
  );
  assert.match(body, /public\.nhipphach_can\('library\.read'\)/);
  assert.match(body, /public\.nhipphach_can\('library\.save'\)/);
});

// ── Luật khoá thêm cho đột biến — mỗi luật ứng với một cách phá cụ thể ──────
test("policy tải lên Storage đòi đúng quyền library.save, và khe dọn rác chỉ dọn rác", () => {
  const body = code(sql);
  const insert = /create policy "nhipphach scores insert" on storage\.objects[\s\S]*?;/i.exec(body)?.[0] ?? "";
  assert.match(insert, /nhipphach_can\('library\.save'\)/, "học viên không được tải lên");
  const cleanup = /create policy "nhipphach scores cleanup" on storage\.objects[\s\S]*?;/i.exec(body)?.[0] ?? "";
  assert.match(cleanup, /not exists[\s\S]*nhipphach_score_versions/, "chỉ dọn object CHƯA thành phiên bản");
  assert.match(cleanup, /owner = auth\.uid\(\)/, "chỉ dọn object của chính mình");
});

test("tải lên xong mà database hỏng thì client phải dọn object vừa tải", () => {
  const body = code(src("libraryRepository.ts"));
  const save = /async save\([\s\S]*?\n {2}\}\n/.exec(body)?.[0] ?? "";
  assert.match(save, /catch[\s\S]*storage\.from\(BUCKET\)\.remove\(\[path\]\)/, "thiếu bước dọn object mồ côi");
});

test("upload đi TRƯỚC, ghi database đi SAU — không bao giờ ngược lại", () => {
  const body = code(src("libraryRepository.ts"));
  const upload = body.indexOf(".upload(");
  const rpc = body.indexOf("rpc(SAVE_VERSION");
  assert.ok(upload > 0 && rpc > 0 && upload < rpc, "dòng database trỏ tới file chưa tồn tại là lỗi không sửa được");
});

test("trang không lưu trùng trong im lặng: phải dò SHA và hỏi rõ", () => {
  const page = code(readFileSync(new URL("../../src/pages/MusicXmlBeatsPage.tsx", import.meta.url), "utf8"));
  const luu = /async function luuVaoThuVien[\s\S]*?\n {2}\}\n/.exec(page)?.[0] ?? "";
  assert.match(luu, /findDuplicate\(/, "phải dò trùng trước khi lưu bài mới");
  assert.match(page, /Bản nhạc này đã có trong thư viện/, "phải nói rõ với người dùng");
  assert.match(page, /Vẫn lưu thành bài mới/, "và để người dùng tự quyết");
  assert.match(page, /Mở bài đã có/, "kèm đường mở bài đã có");
});
