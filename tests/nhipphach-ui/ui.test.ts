/**
 * Giai đoạn 11 — giao diện.
 *
 * Đây là test ĐỌC MÃ NGUỒN, không phải test render: dự án chưa có bộ dựng DOM
 * cho React, và phần nhìn đã được nghiệm thu bằng ảnh chụp trên trình duyệt
 * thật. Việc của bộ này là khoá lại những quyết định dễ bị vô tình phá khi sửa
 * sau: token lấy từ Class chứ không tự chế, thứ tự đọc trên một cột, nhãn tiếng
 * Việt, nhãn cho trình đọc màn hình, và trạng thái vô hiệu hoá.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NP_CSS, NP_SCOPE } from "../../src/nhipphach/theme.ts";

const page = readFileSync(
  new URL("../../src/pages/MusicXmlBeatsPage.tsx", import.meta.url),
  "utf8"
);
const sach = page.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
const classLanding = readFileSync(
  new URL("../../src/ClassLandingPage.tsx", import.meta.url),
  "utf8"
);

// ── 1. Token lấy đúng từ Class, không tự chế bảng màu mới ────────────────────

/** Đọc `--ten:#GIATRI` ra khỏi một khối CSS. */
const bien = (css: string, ten: string) =>
  css.match(new RegExp(`--${ten}\\s*:\\s*(#[0-9A-Fa-f]{3,8})`))?.[1]?.toUpperCase() ??
  null;

test("bảng màu chép nguyên từ .tva-class đang chạy trên Class", () => {
  const goc = classLanding.slice(classLanding.indexOf(".tva-class{"));
  const khoiGoc = goc.slice(0, goc.indexOf("}"));
  for (const ten of [
    "bg",
    "surface",
    "ink",
    "ink-soft",
    "ink-faint",
    "indigo",
    "indigo-dark",
    "indigo-tint",
    "honey",
    "honey-tint",
    "line",
    "online",
  ]) {
    const a = bien(khoiGoc, ten);
    const b = bien(NP_CSS, ten);
    assert.ok(a, `Class thiếu --${ten}`);
    assert.equal(b, a, `--${ten} lệch với Class`);
  }
});

test("dùng đúng font và bề ngang khung của Class", () => {
  assert.match(NP_CSS, /font-family:'Be Vietnam Pro',system-ui,sans-serif/);
  assert.match(NP_CSS, /\.np-wrap\{max-width:1080px/);
  assert.match(classLanding, /\.tva-class \.wrap\{max-width:1080px/);
});

test("không còn bảng màu xám cũ trong trang", () => {
  // Tông zinc của bản cũ (#f4f4f5, #18181b, #71717a, #a1a1aa, #e4e4e7…) đã
  // được thay hết bằng biến; còn sót một mã cứng là lại lệch khỏi Class.
  const macCung = sach.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
  assert.deepEqual(macCung, [], `còn màu cứng: ${macCung.join(", ")}`);
});

// ── 2. Thứ bậc và thứ tự đọc ─────────────────────────────────────────────────

test("một cột xếp theo đúng thứ tự: nguồn → mẫu → thiết lập → xem trước → xuất", () => {
  const mob = NP_CSS.slice(NP_CSS.indexOf("@media(max-width:1023px)"));
  const thu = (ten: string) =>
    Number(mob.match(new RegExp(`\\.np-o-${ten}\\{order:(\\d+)`))?.[1] ?? NaN);
  assert.ok(thu("source") < thu("preset"));
  assert.ok(thu("preset") < thu("settings"));
  assert.ok(thu("settings") < thu("preview"));
  assert.ok(thu("preview") < thu("export"));
  // Ở chế độ nhiều bài, danh sách bài nằm ngay sau khu chọn file.
  assert.ok(thu("source") < thu("list") && thu("list") < thu("preset"));
  // Thông báo lên trên cùng.
  assert.ok(thu("note") < thu("source"));
});

test("desktop là hai cột, mobile tự về một cột", () => {
  assert.match(NP_CSS, /\.np-grid\{display:grid;grid-template-columns:340px minmax\(0,1fr\)/);
  const mob = NP_CSS.slice(NP_CSS.indexOf("@media(max-width:1023px)"));
  assert.match(mob, /\.np-grid\{display:flex;flex-direction:column/);
  assert.match(mob, /align-items:stretch/, "thẻ phải giãn hết bề ngang");
  assert.match(mob, /\.np-col\{display:contents;\}/);
});

test("bốn khu làm việc đều là thẻ có tiêu đề riêng", () => {
  for (const nhan of [
    "Bản nhạc",
    "Mẫu trình bày",
    "Cách đọc",
    "Trình bày",
    "Xuất tài liệu",
  ])
    assert.match(
      sach,
      new RegExp(`aria-label="${nhan}"`),
      `thiếu khu “${nhan}”`
    );
  assert.match(sach, /aria-label="Xem trước bản nhạc"/);
  assert.match(sach, /aria-label="Danh sách bài"/);
});

// ── 3. Chuyển chế độ ─────────────────────────────────────────────────────────

test("Một bài / Nhiều bài là tab thật, có aria-selected", () => {
  const seg = sach.slice(sach.indexOf('className="np-seg"'));
  const than = seg.slice(0, seg.indexOf("</div>"));
  assert.match(than, /role="tablist"/);
  assert.match(than, /role="tab"/);
  assert.match(than, /aria-selected=\{tab === t\}/);
  assert.match(than, /Một bài/);
  assert.match(than, /Nhiều bài/);
  // Trạng thái đang chọn tô bằng màu thương hiệu, không phải màu tuỳ tiện.
  assert.match(NP_CSS, /\.np-seg button\[aria-selected="true"\]\{background:var\(--indigo\)/);
});

// ── 4. Chữ trên màn hình là tiếng thầy dùng khi dạy ──────────────────────────

test("cách đếm nhịp đơn gọi theo lối dạy, kèm ví dụ", () => {
  for (const [ten, viDu] of [
    ["Phách", "1 2 3 4"],
    ["Chia đôi", "1 & 2 & 3 & 4 &"],
    ["Chia tư", "1 e & a"],
  ]) {
    assert.ok(sach.includes(`"${ten}"`), `thiếu nhãn ${ten}`);
    assert.ok(sach.includes(`"${viDu}"`), `thiếu ví dụ ${viDu}`);
  }
  assert.ok(sach.includes('"Phách nhỏ"') && sach.includes('"Phách lớn"'));
});

test("không đưa từ kỹ thuật ra giao diện chính", () => {
  // Phần hiển thị cho thầy: mọi chuỗi trong JSX và trong nhãn.
  for (const cam of [
    /Verovio/,
    /\bMEI\b/,
    /Rational/,
    /IRREGULAR_GROUPING_REQUIRED/,
    /TEMPORAL_ANCHOR_NOT_RESOLVED/,
  ])
    assert.equal(cam.test(sach), false, `lộ từ kỹ thuật ${cam}`);
  // Mã chẩn đoán chỉ được nằm trong khối “chi tiết” gập lại.
  const diag = sach.slice(sach.indexOf('className="np-card np-o-diag"'));
  assert.match(diag.slice(0, 900), /<summary/);
  assert.match(diag, /\{d\.code\}/);
});

test("cảnh báo nhịp lẻ nói thành câu, không mang giọng lỗi", () => {
  assert.match(sach, /Chọn cách chia nhịp \{code\}/);
  assert.match(sach, /Bản nhạc \{code\} chưa ghi cách chia/);
  assert.match(sach, /chọn một cách chia để đếm phách lớn/);
  assert.match(sach, /Công cụ không tự đoán cách chia/);
});

// ── 5. Trạng thái mẻ: có icon VÀ có chữ ─────────────────────────────────────

test("mỗi trạng thái file có cả dấu lẫn chữ, không chỉ dựa vào màu", () => {
  const ds = sach.slice(
    sach.indexOf('aria-label="Danh sách bài"'),
    sach.indexOf('aria-label="Xem trước bản nhạc"')
  );
  for (const [dau, chu] of [
    ["✓", "Hoàn tất"],
    ["✕", "File lỗi"],
    ["⚠", "Chọn cách chia"],
    ["◔", "Đang xử lý"],
    ["○", "Đang chờ"],
  ]) {
    assert.ok(ds.includes(dau), `thiếu dấu ${dau}`);
    assert.ok(ds.includes(chu), `thiếu chữ ${chu}`);
  }
  // Nút chọn cách chia nằm ngay trong dòng của bài đó.
  assert.match(ds, /pickBatchGrouping\(\s*item,\s*need\.meter,\s*groups\s*\)/);
  assert.match(ds, /aria-pressed=\{dangChon\}/);
});

// ── 6. Tiến độ và chống bấm hai lần ─────────────────────────────────────────

test("mẻ có thanh tiến độ đọc được và có chữ kèm theo", () => {
  assert.match(sach, /role="progressbar"/);
  assert.match(sach, /aria-valuemin=\{0\}/);
  assert.match(sach, /aria-valuemax=\{p\.tong\}/);
  assert.match(sach, /aria-valuenow=/);
  assert.match(sach, /Đang xử lý \{p\.xong \+ p\.loi \+ p\.canChon\} \/ \{p\.tong\}/);
  assert.match(NP_CSS, /\.np-bar/);
});

test("nút chạy lâu bị vô hiệu hoá khi đang chạy, và chốt một lượt còn nguyên", () => {
  assert.match(sach, /disabled=\{!score \|\| busy \|\| exporting\}/);
  assert.match(sach, /disabled=\{!batchFiles\.length \|\| batchRunning\}/);
  assert.match(sach, /disabled=\{!batchItems\.some\(\(i\) => i\.status === "done"\)\}/);
  assert.match(sach, /if \(!giuLuot\(dangXuat\)\) return;/);
  assert.match(sach, /if \(!giuLuot\(dangChayMe\)\) return;/);
  assert.match(NP_CSS, /\.np-btn:disabled\{opacity:\.45;cursor:not-allowed;\}/);
});

// ── 7. Xuất: PDF là nút chính ───────────────────────────────────────────────

test("PDF là nút chính, PNG và SVG là phụ", () => {
  const xuat = sach.slice(sach.indexOf('aria-label="Xuất tài liệu"'));
  const than = xuat.slice(0, xuat.indexOf("</section>"));
  const pdf = than.indexOf("Xuất PDF");
  const png = than.indexOf("Xuất PNG");
  const svg = than.indexOf("Xuất SVG");
  assert.ok(pdf > 0 && pdf < png && png < svg, "PDF phải đứng trước và nổi hơn");
  assert.match(
    than.slice(0, pdf),
    /np-btn np-btn-primary np-btn-wide/,
    "PDF phải là nút chính chiếm hết bề ngang"
  );
  assert.match(than.slice(pdf, svg + 40), /np-btn sm np-btn-quiet/);
});

// ── 8. Gần đây: gọn, không tranh chỗ với công cụ chính ───────────────────────

test("Gần đây nằm cuối trang, mặc định 5 mục, xoá là hành động mờ", () => {
  assert.ok(
    sach.indexOf('className="np-recent"') >
      sach.indexOf('className="np-grid"'),
    "Gần đây phải nằm sau khu làm việc"
  );
  assert.match(sach, /listRecent\(5\)/);
  const ganDay = sach.slice(sach.indexOf('className="np-recent"'));
  const acts = ganDay.slice(ganDay.indexOf('className="np-job-acts"'));
  assert.equal((acts.match(/className="np-link"/g) || []).length, 2);
  assert.match(acts, /Xem chi tiết/);
  assert.match(acts, /Dùng lại thiết lập/);
  assert.match(acts, /className="np-link danger"/);
  assert.match(sach, /aria-label=\{`Xoá lịch sử \$\{khiNao\(job\.createdAt\)\}`\}/);
});

test("chưa có lịch sử thì không dựng khung rỗng", () => {
  assert.match(sach, /\{!!jobsRepo\.current && !!recent\.length && \(/);
});

// ── 9. Trợ năng tối thiểu ───────────────────────────────────────────────────

test("mọi ô nhập đều có nhãn thật", () => {
  const nhan = [
    'aria-label="Chọn file MusicXML"',
    'aria-label="Chọn nhiều file MusicXML"',
    'aria-label="Mẫu trình bày"',
    'aria-label="Màu số phách"',
    'aria-label="Cỡ số phách"',
    'aria-label="Khoảng cách dưới khuông"',
    'aria-label="Hướng giấy"',
    'aria-label="Độ phân giải PNG"',
    'aria-label="Định dạng xuất"',
  ];
  for (const n of nhan) assert.ok(sach.includes(n), `thiếu ${n}`);
  // Nhóm radio nào cũng nằm trong fieldset có legend.
  assert.equal(
    (sach.match(/name="counting-level"|name="compound-counting"|name=\{`grouping-\$\{code\}`\}/g) || [])
      .length,
    3
  );
  assert.ok((sach.match(/<legend>/g) || []).length >= 3);
});

test("bàn phím thấy được ô đang chọn và chạm được trên điện thoại", () => {
  assert.match(NP_CSS, /:focus-visible\{outline:2\.5px solid var\(--indigo\)/);
  assert.match(NP_CSS, /\.np-btn\{[^}]*min-height:44px/);
  assert.match(NP_CSS, /select\.np-select\{[^}]*min-height:44px/);
  assert.match(NP_CSS, /\.np-opt\{[^}]*min-height:42px/);
});

test("dấu trang trí bị giấu khỏi trình đọc màn hình", () => {
  const dau = sach.match(/aria-hidden="true"/g) || [];
  assert.ok(dau.length >= 8, `mới có ${dau.length} chỗ ẩn dấu trang trí`);
  assert.match(sach, /<div className="np-glyph" aria-hidden="true">/);
});

// ── 10. Tương phản chữ đạt WCAG AA ──────────────────────────────────────────

/** Tỉ lệ tương phản theo WCAG 2.1 giữa một màu và nền trắng. */
function tuongPhanVoiTrang(hex: string) {
  const v = hex.replace("#", "");
  const kenh = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * kenh[0] + 0.7152 * kenh[1] + 0.0722 * kenh[2];
  return 1.05 / (L + 0.05);
}

test("mọi màu CHỮ trên nền trắng đạt ít nhất 4,5:1", () => {
  for (const ten of ["ink", "ink-soft", "indigo", "np-danger", "honey-ink", "online-ink", "ink-hint"]) {
    const mau = bien(NP_CSS, ten)!;
    const ti = tuongPhanVoiTrang(mau);
    assert.ok(ti >= 4.5, `--${ten} ${mau} chỉ đạt ${ti.toFixed(2)}:1`);
  }
});

test("ba màu chữ đậm hơn được dùng thay cho bản gốc ở đúng chỗ", () => {
  // Màu gốc của Class vẫn còn để dùng cho nền/viền, nhưng không được đặt làm
  // màu chữ nhỏ nữa.
  const camDungLamChu: [string, RegExp][] = [
    ["--honey", /color:var\(--honey\)/],
    ["--online", /color:var\(--online\)/],
    ["--ink-faint", /\.np-muted\{font-size:12\.5px;color:var\(--ink-faint\)/],
  ];
  for (const [ten, dat] of camDungLamChu)
    assert.equal(dat.test(NP_CSS), false, `${ten} vẫn đang làm màu chữ`);
  assert.match(NP_CSS, /--honey-ink:#8A4A12/);
  assert.match(NP_CSS, /--online-ink:#12813B/);
});

// ── 11. Phạm vi CSS ─────────────────────────────────────────────────────────

test("toàn bộ CSS bị bó trong một class, không rò ra trang khác", () => {
  const luat = NP_CSS.replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((d) => d.trim())
    .filter((d) => d && !d.startsWith("/*") && !d.startsWith("@") && !d.startsWith("}"));
  for (const d of luat)
    assert.ok(
      d.startsWith(`.${NP_SCOPE}`) || d.includes(":") === false || /^[a-z-]+:/.test(d),
      `luật thoát khỏi phạm vi: ${d.slice(0, 60)}`
    );
  assert.match(page, /<main\s*\n?\s*className=\{`\$\{NP_SCOPE\}/);
  assert.match(page, /<style>\{NP_CSS\}<\/style>/);
});

// ── 12. Thông báo phân loại rõ ──────────────────────────────────────────────

test("bốn loại thông báo có thành phần riêng, không dùng chung một kiểu", () => {
  for (const k of ["ok", "info", "warn", "error"])
    assert.match(NP_CSS, new RegExp(`\\.np-note-${k}\\{background:`), `thiếu kiểu ${k}`);
  // Cùng một dòng chữ mà lúc tốt lúc hỏng thì phải mang loại khác nhau.
  assert.match(sach, /type Note = \{ kind: "ok" \| "info" \| "warn" \| "error"; text: string \} \| null/);
  assert.match(sach, /setPresetNote\(text \? \{ kind: "ok", text \} : null\)/);
  assert.match(sach, /kind: "error",\s*\n\s*text: e instanceof Error/);
  assert.match(sach, /kind: "ok",\s*\n\s*text: "Đã dùng lại thiết lập/);
  assert.match(sach, /kind: "warn",\s*\n\s*text: "Đã xuất file, nhưng chưa lưu được lịch sử\."/);
  // Lỗi thì báo cho trình đọc màn hình bằng role="alert".
  assert.match(sach, /role=\{presetNote\.kind === "error" \? "alert" : "status"\}/);
  assert.match(sach, /<div role="alert" className="np-note np-note-error np-o-note">/);
});

// ── 13. Hai mức giao diện ───────────────────────────────────────────────────

/**
 * Thẻ này có bị khoá sau mức nâng cao không: tìm `{nangCao && (` gần nhất phía
 * trước, rồi kiểm giữa hai chỗ đó không có dấu đóng `)}` nào — tức thẻ vẫn nằm
 * trong khối điều kiện.
 */
const chiNangCao = (moc: string) => {
  const i = sach.indexOf(moc);
  if (i < 0) return null;
  const truoc = sach.slice(0, i);
  const mo = truoc.lastIndexOf("{nangCao && (");
  if (mo < 0) return false;
  return !truoc.slice(mo).includes(")}");
};

test("mở trang lần đầu là mức Cơ bản", () => {
  // Không có gì trong localStorage thì mucDaLuu() trả false.
  assert.match(sach, /const \[nangCao, setNangCao\] = useState\(mucDaLuu\)/);
  assert.match(sach, /return localStorage\.getItem\(KHOA_MUC\) === "nang-cao"/);
  assert.match(sach, /catch \{[\s\S]{0,180}return false;/, "localStorage hỏng vẫn phải về Cơ bản");
});

test("mức giao diện chỉ nằm ở máy, không chui vào preset hay lịch sử", () => {
  assert.match(sach, /const KHOA_MUC = "nhipphach:giao-dien"/);
  // Không được lọt vào ảnh chụp thiết lập hay preset.
  const jobs = readFileSync(
    new URL("../../src/nhipphach/jobs.ts", import.meta.url),
    "utf8"
  );
  const presets = readFileSync(
    new URL("../../src/nhipphach/presets.ts", import.meta.url),
    "utf8"
  );
  for (const [ten, mp] of [["jobs.ts", jobs], ["presets.ts", presets]] as [string, string][]) {
    assert.equal(/nangCao|giao-dien/.test(mp), false, `${ten} dính mức giao diện`);
  }
  // Và không được truyền vào `update()` — thứ đi thẳng vào ScoreSettings.
  assert.equal(/update\(\{[^}]*nangCao/.test(sach), false);
});

test("mức Cơ bản giấu đúng những thứ đã liệt kê", () => {
  for (const [ten, moc] of [
    ["tab Nhiều bài", 'className="np-seg" role="tablist"'],
    ["mẫu trình bày", 'className="np-card np-o-preset"'],
    ["trình bày + trang giấy", 'className="np-card np-o-look"'],
  ] as [string, string][])
    assert.equal(chiNangCao(moc), true, `${ten} phải nằm trong {nangCao && (`);
  // PNG / SVG / beat-map bọc chung một khối nâng cao.
  const xuat = sach.slice(sach.indexOf('aria-label="Xuất tài liệu"'));
  const truocPng = xuat.slice(0, xuat.indexOf("Xuất PNG"));
  assert.match(truocPng, /\{nangCao && \(/);
  assert.ok(truocPng.indexOf("Xuất PDF") < truocPng.lastIndexOf("{nangCao && ("));
});

test("mức Cơ bản vẫn thấy PDF, và PDF là nút chính", () => {
  const xuat = sach.slice(sach.indexOf('aria-label="Xuất tài liệu"'));
  const pdf = xuat.indexOf("Xuất PDF");
  const truoc = xuat.slice(0, pdf);
  assert.equal(
    truoc.includes("{nangCao && ("),
    false,
    "PDF không được nằm trong khối nâng cao"
  );
  assert.match(truoc, /np-btn np-btn-primary np-btn-wide/);
});

test("mức Cơ bản đánh số ba bước, mức Nâng cao thì không", () => {
  assert.match(sach, /\{nangCao \? "Bản nhạc" : "1\. Chọn bản nhạc"\}/);
  assert.match(sach, /\{nangCao \? "Cách đọc" : "2\. Cách đọc"\}/);
  assert.match(sach, /\{nangCao \? "Xuất tài liệu" : "3\. Xuất tài liệu"\}/);
});

test("nút mở mức nâng cao có mặt và nói rõ bên trong có gì", () => {
  assert.match(sach, /className="np-more"/);
  assert.match(sach, /aria-expanded=\{nangCao\}/);
  assert.match(sach, /Ẩn thiết lập nâng cao/);
  assert.match(sach, /Thiết lập nâng cao/);
  assert.match(sach, /xử lý nhiều bài/);
  // Tắt nâng cao thì quay về luồng một bài, KHÔNG xoá mẻ đang có.
  assert.match(sach, /if \(!bat\) setTab\("one"\);/);
  assert.equal(/setBatchFiles\(\[\]\)[\s\S]{0,80}setNangCao/.test(sach), false);
});

test("chỉ hỏi cách chia nhịp lẻ khi thật sự cần", () => {
  assert.match(
    sach,
    /\{\(nangCao \|\|\s*\n?\s*\(settings\.showBeats &&\s*\n?\s*\(settings\.compoundCountingMode \|\| "pulses"\) === "compound"\)\) &&\s*\n?\s*irregularMeters\.map/
  );
});

test("chẩn đoán: Cơ bản nói một câu, mã kỹ thuật chờ Nâng cao", () => {
  assert.match(sach, /score\.diagnostics\.length > 0 && !nangCao/);
  assert.match(sach, /Có một phần của bản nhạc chưa đánh dấu được chính xác/);
  const chiTiet = sach.slice(sach.indexOf("score.diagnostics.length > 0 && nangCao"));
  assert.match(chiTiet.slice(0, 600), /<details/);
  assert.match(chiTiet, /\{d\.code\}/);
});

test("Gần đây ở mức Cơ bản chỉ có tóm tắt và Xem chi tiết", () => {
  const acts = sach.slice(sach.indexOf('className="np-job-acts"'));
  const than = acts.slice(0, acts.indexOf("</span>"));
  const iXem = than.indexOf("Xem chi tiết");
  const iDung = than.indexOf("Dùng lại thiết lập");
  const iXoa = than.indexOf("Xoá");
  assert.ok(iXem > 0 && iDung > iXem && iXoa > iDung);
  // Hai thao tác sau nằm sau một điều kiện nangCao.
  assert.match(than.slice(iXem, iDung), /\{nangCao && \(/);
  assert.match(than.slice(iDung, iXoa), /\{nangCao && \(/);
});

// ── 14. Thương hiệu ─────────────────────────────────────────────────────────

test("dùng đúng logo asset của Class và về đúng trang chính", () => {
  assert.match(sach, /src="\/logo-green\.svg"/);
  // Cùng file mà ClassLandingPage đang dùng.
  assert.match(classLanding, /src="\/logo-green\.svg"/);
  assert.match(sach, /<a className="np-brand" href="\/">/);
  assert.match(sach, /<a className="np-back" href="\/">\s*\n?\s*← Trang chính/);
  assert.equal(/href="\/start"/.test(sach), false, "không được về /start nữa");
});

// ── 15. Hai trạng thái: chưa có file và đã có bản nhạc ──────────────────────

test("có bản nhạc thì đổi sang dáng bàn làm việc, chưa có thì giữ nguyên", () => {
  // Cờ trạng thái nằm ở gốc và ở lưới.
  assert.match(sach, /\$\{NP_SCOPE\}\$\{score \|\| batchItems\.length \? " np-has" : ""\}/);
  assert.match(sach, /np-grid\$\{score \|\| batchItems\.length \? " np-loaded" : ""\}/);
  // Khung rộng ra CHỈ khi đã có bản nhạc.
  assert.match(NP_CSS, /\.np-wrap\{max-width:1080px/);
  assert.ok(NP_CSS.includes(`.${NP_SCOPE}.np-has .np-wrap{max-width:1400px;}`));
});

test("thanh bên HẸP lại khi đã có bản nhạc, không rộng thêm", () => {
  const trong = NP_CSS.match(/\.np-grid\{display:grid;grid-template-columns:(\d+)px/)![1];
  const day = NP_CSS.match(/\.np-loaded\{grid-template-columns:(\d+)px/)![1];
  assert.ok(Number(day) < Number(trong), `thanh bên ${trong} → ${day}px`);
  assert.ok(Number(day) >= 300 && Number(day) <= 320, "giữ trong khoảng 300–320px");
  // Thẻ bên trái cũng gọn lại để đỡ phải cuộn sớm.
  assert.match(NP_CSS, /\.np-loaded \.np-card\{padding:16px;\}/);
  assert.match(NP_CSS, /\.np-loaded \.np-col\{gap:12px;\}/);
});

test("tờ giấy A4 tách khỏi nền, không còn là khoảng trắng trong card", () => {
  // Mặt bàn đậm hơn nền trang.
  const paper = bien(NP_CSS, "np-paper")!;
  const bg = bien(NP_CSS, "bg")!;
  const sang = (h: string) =>
    [0, 2, 4].reduce((t, i) => t + parseInt(h.slice(i + 1, i + 3), 16), 0);
  assert.ok(sang(paper) < sang(bg), `mặt bàn ${paper} phải tối hơn nền ${bg}`);
  // Và tờ giấy có viền + bóng.
  assert.match(NP_CSS, /\.np-page\{[^}]*border:1px solid #D3CBBD/);
  assert.match(NP_CSS, /\.np-page\{[^}]*box-shadow:0 14px 32px/);
  assert.match(NP_CSS, /\.np-loaded \.np-prev\{border-color:#D5CCBE/);
});

// ── 16. Thanh phóng ─────────────────────────────────────────────────────────

test("thanh phóng chỉ hiện khi đã có bản nhạc", () => {
  const i = sach.indexOf('className="np-zoom"');
  assert.ok(i > 0);
  assert.match(sach.slice(Math.max(0, i - 160), i), /\{!!score && \(/);
});

test("đủ ba cách xem: bước phóng, vừa khung, vừa chiều rộng", () => {
  assert.match(sach, /aria-label="Thu nhỏ"/);
  assert.match(sach, /aria-label="Phóng to"/);
  assert.match(sach, /aria-pressed=\{xem\.che === "khung"\}[\s\S]{0,200}Vừa khung/);
  assert.match(sach, /aria-pressed=\{xem\.che === "rong"\}[\s\S]{0,200}Vừa chiều rộng/);
  assert.match(sach, /role="group" aria-label="Mức phóng bản nhạc"/);
  // Mức phóng đọc được thành chữ, không chỉ là hình.
  assert.match(sach, /xem\.che === "khung" \? "Vừa khung" : `\$\{xem\.pct\}%`/);
});

test("mở file mới luôn trở lại vừa chiều rộng", () => {
  assert.equal(
    (sach.match(/setXem\(\{ che: "rong", pct: 100 \}\)/g) || []).length >= 2,
    true,
    "cả chọn file lẫn dùng file mẫu đều phải đặt lại"
  );
  assert.match(sach, /useState<\{ che: CheXem; pct: number \}>\(\{\s*\n?\s*che: "rong",/);
});

test("mức phóng bị chặn hai đầu và bước đều", () => {
  assert.match(sach, /const ZOOM_MIN = 50;/);
  assert.match(sach, /const ZOOM_MAX = 300;/);
  assert.match(sach, /const ZOOM_BUOC = 25;/);
  assert.match(sach, /Math\.max\(ZOOM_MIN, v\.pct - ZOOM_BUOC\)/);
  assert.match(sach, /Math\.min\(ZOOM_MAX, v\.pct \+ ZOOM_BUOC\)/);
  assert.match(sach, /disabled=\{xem\.che !== "khung" && xem\.pct <= ZOOM_MIN\}/);
  assert.match(sach, /disabled=\{xem\.che !== "khung" && xem\.pct >= ZOOM_MAX\}/);
});

test("hai kiểu xem dựng bằng CSS, tờ giấy ôm đúng ảnh khi vừa khung", () => {
  assert.match(NP_CSS, /\.np-page\{[^}]*width:calc\(var\(--np-zoom\) \* 1%\)/);
  assert.match(NP_CSS, /\.np-fit-page \.np-page\{width:fit-content;max-width:100%;\}/);
  assert.match(NP_CSS, /\.np-fit-page \.np-page img\{width:auto;height:calc\(78vh/);
  assert.match(sach, /xem\.che === "khung" \? " np-fit-page" : ""/);
  assert.match(sach, /"--np-zoom": xem\.che === "rong" \? 100 : xem\.pct/);
});

test("mức phóng KHÔNG đụng tới file xuất ra", () => {
  // Đường xuất file không được đọc `xem` — file luôn là A4 thật.
  for (const ten of ["async function exportPrint", "async function runBatchNow"]) {
    const than = sach.slice(sach.indexOf(ten));
    const body = than.slice(0, than.indexOf("\n  }\n") + 4);
    assert.equal(/\bxem\b/.test(body), false, `${ten} dính mức phóng`);
  }
  // Và không lọt vào ảnh chụp thiết lập.
  assert.equal(/update\(\{[^}]*xem/.test(sach), false);
});

// ── 17. Tập trung xem bản nhạc ──────────────────────────────────────────────

test("thu gọn thiết lập nhường hết bề ngang cho bản nhạc, chỉ trên desktop", () => {
  assert.match(sach, /aria-pressed=\{thuGon\}/);
  assert.match(sach, /thuGon \? "Hiện thiết lập" : "Thu gọn thiết lập"/);
  assert.match(NP_CSS, /\.np-focus\{grid-template-columns:minmax\(0,1fr\);\}/);
  assert.match(NP_CSS, /\.np-focus \.np-col:first-child\{display:none;\}/);
  // Nút này vô nghĩa ở một cột nên bị giấu.
  assert.match(NP_CSS, /\.np-zfocus\{display:none;\}/);
  assert.match(NP_CSS, /@media\(min-width:1024px\)\{[\s\S]{0,140}\.np-loaded \.np-zfocus\{display:inline-flex/);
  // Ẩn chứ không xoá: thiết lập vẫn còn nguyên trong cây, bật lại là thấy.
  assert.equal(/setSettings\([^)]*\)[\s\S]{0,60}setThuGon/.test(sach), false);
});

test("đầu khung xem trước gọn, tiêu đề và số liệu cùng một dòng", () => {
  assert.match(sach, /<div className="np-prev-tit">\s*\n?\s*<h2>Xem trước<\/h2>/);
  assert.match(NP_CSS, /\.np-prev-bar\{[^}]*padding:9px 14px/);
  assert.match(NP_CSS, /\.np-prev-bar h2\{font-size:14\.5px/);
});

// ── 18. Thứ tự luật CSS ─────────────────────────────────────────────────────

test("khối mobile nằm CUỐI, không bị luật gốc phía sau đè chết", () => {
  // Đây là lỗi thật đã gặp: khối @media viết ở giữa file nên
  // .np-prev-body{max-height:62vh} bị luật gốc 78vh phía sau ghi đè, và mọi
  // override cùng độ ưu tiên khác cũng chết theo mà không báo gì.
  const mob = NP_CSS.indexOf("@media(max-width:1023px)");
  assert.ok(mob > 0);
  const sau = NP_CSS.slice(NP_CSS.indexOf("}", NP_CSS.lastIndexOf("}", NP_CSS.length - 3)));
  const conLuat = NP_CSS.slice(mob)
    .replace(/@media\(max-width:1023px\)\{[\s\S]*?\n\}/, "")
    .split("\n")
    .map((d) => d.trim())
    .filter((d) => d.startsWith(`.${NP_SCOPE}`));
  assert.deepEqual(conLuat, [], `còn luật gốc sau khối mobile: ${conLuat.slice(0, 3).join(" · ")}`);
  // Và những override hay va chạm phải thật sự thắng.
  for (const luat of [
    ".np-prev-body{max-height:62vh;}",
    ".np-zbtn{font-size:12.5px;padding:0 8px;min-height:34px;}",
    ".np-prev-bar{padding:10px 12px;}",
  ]) {
    const iMob = NP_CSS.indexOf(luat, mob);
    assert.ok(iMob > 0, `thiếu override ${luat}`);
    const ten = luat.slice(0, luat.indexOf("{"));
    const iGoc = NP_CSS.lastIndexOf(`.${NP_SCOPE} ${ten}{`, mob);
    assert.ok(iGoc < iMob, `${ten}: luật gốc phải đứng TRƯỚC override mobile`);
  }
});
