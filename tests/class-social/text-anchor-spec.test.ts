// Contextual Share V2 (chia sẻ vùng văn bản) — SPEC THUẦN, chưa phải mã tính năng. Thiết kế: docs/CONTEXTUAL-SHARE-V2-TEXT.md (§6–§9).
// Mục đích: chốt bằng ví dụ chạy được (1) chỉ số ký tự nhất quán JS ↔ PostgreSQL, (2) cách tính block_fp, (3) thuật toán tìm lại
// ok / moved / stale. Bản cài đặt thật (SQL + FE) phải cho CÙNG kết quả với các hàm tham chiếu dưới đây.
// fixtures/text-anchor-pg-vectors.json do PostgreSQL 17.11 UTF8 (cụm tạm, KHÔNG phải production) sinh ra: length/substr/sha256/position.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { boundaryOk, cpLen, cpSlice, cpToUtf16, snapToGraphemes, textLeaves, utf16ToCp } from '../../src/share/textAnchor.ts'

// ───────────────────────── 1. ĐƠN VỊ = ĐIỂM MÃ (hàm THẬT của client: src/share/textAnchor.ts) ─────────────────────────
const sha = (s: string) => createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex')

type Vec = { name: string; text: string; pgLengthCp: number; jsUtf16Length: number; ranges: { from: number; to: number; substr: string; sha: string; firstPosCp: number }[] }
const vectors = JSON.parse(readFileSync(new URL('./fixtures/text-anchor-pg-vectors.json', import.meta.url), 'utf8')) as { cases: Vec[] }

test('JS đếm/cắt/băm theo điểm mã khớp PostgreSQL trên tiếng Việt NFC/NFD, emoji, ZWJ, cờ, CRLF, ký hiệu nhạc', () => {
  assert.ok(vectors.cases.length >= 8)
  for (const c of vectors.cases) {
    assert.equal(cpLen(c.text), c.pgLengthCp, `${c.name}: độ dài điểm mã`)
    for (const r of c.ranges) {
      const sub = cpSlice(c.text, r.from, r.to)
      assert.equal(sub, r.substr, `${c.name}: substr [${r.from},${r.to})`)
      assert.equal(sha(sub), r.sha, `${c.name}: sha256 UTF-8 của đoạn chọn`)
      assert.equal(cpLen(c.text.slice(0, c.text.indexOf(sub))), r.firstPosCp, `${c.name}: vị trí xuất hiện đầu tiên (điểm mã)`)
    }
  }
})

test('Có mẫu mà UTF-16 ≠ điểm mã (đây là bẫy phải chặn): emoji ngoài BMP, ZWJ, cờ', () => {
  const diff = vectors.cases.filter(c => c.jsUtf16Length !== c.pgLengthCp).map(c => c.name)
  assert.deepEqual(diff.sort(), ['emoji_bmp_astral', 'emoji_skin_flag', 'emoji_zwj_family', 'mixed_music'])
})

test('Đổi qua lại UTF-16 ↔ điểm mã là song ánh; Range rơi giữa cặp thay thế bị từ chối', () => {
  const s = 'Đàn 🎸 hay 😀 lắm'
  for (let cp = 0; cp <= cpLen(s); cp++) assert.equal(utf16ToCp(s, cpToUtf16(s, cp)), cp)
  const guitar = s.indexOf('🎸')
  assert.equal(utf16ToCp(s, guitar + 1), -1, 'giữa hai nửa của 🎸')
  assert.equal(cpToUtf16(s, 99), -1, 'vượt độ dài')
})

test('Không chuẩn hoá Unicode: NFC ≠ NFD → băm khác → neo cũ thành stale (fail-closed, chủ ý)', () => {
  const nfc = 'giữ đều tay', nfd = nfc.normalize('NFD')
  assert.notEqual(cpLen(nfc), cpLen(nfd))
  assert.notEqual(sha(nfc), sha(nfd))
})

// ───────────────────────── 2. BIÊN CHỌN: không cắt giữa cụm ký tự (hàm THẬT: boundaryOk / snapToGraphemes) ─────────────────────────
test('Biên tiếng Việt tổ hợp (NFD) và emoji ZWJ: client co ra grapheme, server chặn biên cắt giữa cụm', () => {
  const nfd = 'giữ đều tay'.normalize('NFD')              // "ữ" = u + ◌̛ + ◌̃
  const iU = Array.from(nfd).indexOf('u')
  assert.equal(boundaryOk(nfd, iU + 1, iU + 3), false, 'bắt đầu bằng dấu tổ hợp')
  assert.equal(boundaryOk(nfd, 0, iU + 1), false, 'kết thúc ngay trước dấu tổ hợp')
  const [a, b] = snapToGraphemes(nfd, iU + 1, iU + 3)
  assert.equal(boundaryOk(nfd, a, b), true)
  assert.equal(cpSlice(nfd, a, b).normalize('NFC').startsWith('ữ'), true)
  const fam = 'Cả nhà 👨‍👩‍👧‍👦 cùng học'
  const start = Array.from(fam).indexOf('👨')
  assert.equal(boundaryOk(fam, start + 2, start + 5), false, 'giữa chuỗi ZWJ')
  const [fa, fb] = snapToGraphemes(fam, start + 2, start + 5)
  assert.equal(cpSlice(fam, fa, fb), '👨‍👩‍👧‍👦')
  const noJoin = 'a😀b'
  assert.equal(boundaryOk(noJoin, 1, 2), true)
})

// ───────────────────────── 3. block_fp và bộ tìm lại (mô hình tham chiếu) ─────────────────────────
type Section = { kind: string; title?: string; [k: string]: unknown }
const FP_TAG = 'tsa1'
/** block_fp = sha256_hex(utf8('tsa1' ␟ kind ␟ title)); title thiếu → ''.  Không chuẩn hoá, không cắt khoảng trắng. */
const blockFp = (s: Section) => sha(`${FP_TAG}\u001f${s.kind}\u001f${typeof s.title === 'string' ? s.title : ''}`)

const leaves = (s: Section) => textLeaves(s)   // enumerator THẬT của client (đối chiếu với SQL share_text_leaves ở run-share-text-db.mjs)

type Anchor = { section: number; path: string[]; from: number; to: number; sel: string /* sha */; ctx: string /* sha */; fp: string }
const CTX_N = 32
const ctxOf = (leaf: string, a: number, b: number) => { const c = Array.from(leaf); return sha(`${c.slice(Math.max(0, a - CTX_N), a).join('')}\u001f${c.slice(b, b + CTX_N).join('')}`) }
const getLeaf = (sections: Section[], i: number, path: string[]) => leaves(sections[i] ?? { kind: '' }).find(l => l.path.join('.') === path.join('.'))?.text

/** Server dựng neo từ tham số rời; client KHÔNG gửi băm. null = không tạo được (một thông báo chung, không lộ lý do). */
function buildAnchor(sections: Section[], section: number, path: string[], from: number, to: number): Anchor | null {
  const t = getLeaf(sections, section, path)
  if (t === undefined || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from || to - from > 500 || to > cpLen(t)) return null
  const sel = cpSlice(t, from, to)
  if (!sel.trim() || !boundaryOk(t, from, to)) return null
  return { section, path, from, to, sel: sha(sel), ctx: ctxOf(t, from, to), fp: blockFp(sections[section]) }
}

export const MAX_WINDOWS = 60_000        // trần số cửa sổ băm cho MỘT lần tìm lại (đo thực: ~52k cửa sổ ≈ 74 ms trên PG17)
export const MAX_FP_SECTIONS = 8         // tối đa số khối cùng block_fp được dò ở bước 3
type Resolved = { status: 'ok' | 'moved'; section: number; path: string[]; from: number; to: number } | { status: 'stale' }
type Hit = { section: number; path: string[]; from: number; to: number; ctxOk: boolean }

function scan(sections: Section[], i: number, a: Anchor, budget: { n: number }): Hit[] | null {
  const hits: Hit[] = []
  const L = a.to - a.from
  for (const lf of leaves(sections[i])) {
    const c = Array.from(lf.text)
    for (let p = 0; p + L <= c.length; p++) {
      if (--budget.n < 0) return null                           // quá ngân sách → KHÔNG đoán
      if (sha(c.slice(p, p + L).join('')) === a.sel && boundaryOk(lf.text, p, p + L)) hits.push({ section: i, path: lf.path, from: p, to: p + L, ctxOk: ctxOf(lf.text, p, p + L) === a.ctx })
    }
  }
  return hits
}
const unique = (h: Hit[]): Hit | null => {
  if (h.length === 1) return h[0]
  const by = h.filter(x => x.ctxOk)
  return by.length === 1 ? by[0] : null                          // ≥2 ứng viên mà ctx cũng không phân xử → null
}

/** Điều kiện: người gọi ĐÃ qua các cổng quyền (visible → score_ok). Hàm này chỉ quyết ok / moved / stale. */
function resolveText(sections: Section[], a: Anchor): Resolved {
  // Bước 1 — đúng vị trí gợi ý: băm khớp ⇒ ok (không cần fp: nhận dạng = chính đoạn chữ)
  const t = getLeaf(sections, a.section, a.path)
  if (t !== undefined && a.to <= cpLen(t) && sha(cpSlice(t, a.from, a.to)) === a.sel && boundaryOk(t, a.from, a.to)) return { status: 'ok', section: a.section, path: a.path, from: a.from, to: a.to }
  const budget = { n: MAX_WINDOWS }
  // Bước 2 — cùng chỉ số khối, mọi lá; CHỈ khi khối ở chỉ số này vẫn là khối cũ (cùng block_fp) — khối khác trượt vào không chứng minh được neo
  if (sections[a.section] && blockFp(sections[a.section]) === a.fp) {
    const h = scan(sections, a.section, a, budget)
    if (h === null) return { status: 'stale' }
    const u = unique(h)
    if (u) return { status: 'moved', section: u.section, path: u.path, from: u.from, to: u.to }
    if (h.length > 1) return { status: 'stale' }                // mơ hồ trong chính khối: dừng, không sang khối khác
  }
  // Bước 3 — khối khác có CÙNG block_fp
  const cands = sections.map((s, i) => ({ s, i })).filter(({ s, i }) => i !== a.section && blockFp(s) === a.fp)
  if (cands.length === 0 || cands.length > MAX_FP_SECTIONS) return { status: 'stale' }
  const all: Hit[] = []
  for (const { i } of cands) { const h = scan(sections, i, a, budget); if (h === null) return { status: 'stale' }; all.push(...h) }
  const u = unique(all)
  return u ? { status: 'moved', section: u.section, path: u.path, from: u.from, to: u.to } : { status: 'stale' }
}

// ── fixture ──
const SEL = 'nghe kỹ nhịp chùm ba'
const P1 = 'Giữ nhịp thật đều. Hãy nghe kỹ nhịp chùm ba ở ô 2 và ô 3 trong cả bài.'
const study = (blocks: unknown[], title = 'Ôn tập 7 ngày'): Section => ({ kind: 'study', title, blocks })
const doc = (): Section[] => [
  { kind: 'objectives', items: ['Đàn đều tay'] },
  study([{ b: 'h', text: 'Ngày 1' }, { b: 'p', text: P1 }, { b: 'ul', items: ['Khởi động', 'Đếm nhịp'] }, { b: 'table', rows: [['Ô', 'Việc'], ['1', 'Chậm'], ['2', '___']] }]),
  { kind: 'note', text: 'Ghi chú cuối.' },
]
const mk = (s = doc()) => { const t = P1; const from = cpLen(t.slice(0, t.indexOf(SEL))); return { s, a: buildAnchor(s, 1, ['blocks', '1', 'text'], from, from + cpLen(SEL))! } }

test('block_fp: xác định, theo (kind, title), không chuẩn hoá; cùng nội dung khác tiêu đề → fp khác', () => {
  const a = blockFp(study([], 'A')), b = blockFp(study([], 'A')), c = blockFp(study([], 'a'))
  assert.equal(a, b); assert.notEqual(a, c)
  assert.notEqual(blockFp({ kind: 'note', text: 'x' }), blockFp({ kind: 'checklist', items: [] }))
  assert.equal(blockFp({ kind: 'note', text: 'x' }), blockFp({ kind: 'note', text: 'khác hẳn' }), 'khối không tiêu đề: fp chỉ theo kind (cố ý — nên bước 3 giới hạn số khối)')
})

test('Lá hợp lệ đúng 6 loại khối; ô ___ và tệp/link không phải lá', () => {
  const s = doc()
  assert.deepEqual(leaves(s[1]).map(l => l.path.join('.')), ['blocks.0.text', 'blocks.1.text', 'blocks.2.items.0', 'blocks.2.items.1', 'blocks.3.rows.0.0', 'blocks.3.rows.0.1', 'blocks.3.rows.1.0', 'blocks.3.rows.1.1', 'blocks.3.rows.2.0'])
  assert.deepEqual(leaves({ kind: 'video', title: 'x', url: 'https://y' } as Section), [])
  assert.deepEqual(leaves({ kind: 'repertoire', title: 't', pieces: [{ note: 'n' }] } as Section), [])
})

test('buildAnchor: từ chối vùng chọn lệ (rỗng/khoảng trắng/quá dài/ngoài lá/cắt giữa cụm); lá không tồn tại → null (một kết quả chung)', () => {
  const s = doc()
  assert.equal(buildAnchor(s, 1, ['blocks', '1', 'text'], 5, 5), null)
  assert.equal(buildAnchor(s, 1, ['blocks', '1', 'text'], 0, 9999), null)
  assert.equal(buildAnchor(s, 1, ['blocks', '3', 'rows', '2', '1'], 0, 1), null, 'ô ___')
  assert.equal(buildAnchor(s, 7, ['blocks', '1', 'text'], 0, 3), null, 'khối không tồn tại')
  assert.equal(buildAnchor(s, 0, ['url'], 0, 3), null, 'trường ngoài danh sách trắng')
  assert.ok(buildAnchor(s, 1, ['blocks', '1', 'text'], 0, 8))
})

test('ok: không đổi; sửa chữ XUNG QUANH đoạn chọn vẫn ok nếu vị trí còn đúng, ngược lại moved', () => {
  const { s, a } = mk()
  assert.equal(resolveText(s, a).status, 'ok')
  const edited = doc(); (edited[1].blocks as { text: string }[])[1].text = P1.replace('ở ô 2', 'ở ô 7')   // sửa SAU đoạn chọn → vị trí cũ vẫn đúng
  assert.equal(resolveText(edited, a).status, 'ok')
  const before = doc(); (before[1].blocks as { text: string }[])[1].text = 'Mở đầu thêm. ' + P1
  const r = resolveText(before, a); assert.equal(r.status, 'moved')
  if (r.status === 'moved') assert.equal(cpSlice((before[1].blocks as { text: string }[])[1].text, r.from, r.to), SEL)
})

test('moved: chèn khối phía trước (chỉ số khối dịch) → tìm lại qua block_fp; thêm/bớt đoạn trong khối → tìm lại cùng khối', () => {
  const { s, a } = mk()
  const shifted = [{ kind: 'note', text: 'Khối mới chèn' } as Section, ...s]
  const r = resolveText(shifted, a)
  assert.deepEqual(r.status === 'moved' ? [r.section, r.path.join('.')] : r.status, [2, 'blocks.1.text'])
  const inner = doc(); (inner[1].blocks as unknown[]).splice(1, 0, { b: 'p', text: 'Đoạn chèn thêm.' })
  const r2 = resolveText(inner, a)
  assert.deepEqual(r2.status === 'moved' ? [r2.section, r2.path.join('.')] : r2.status, [1, 'blocks.2.text'])
})

test('stale: sửa đúng đoạn chọn · xoá lá · NFC↔NFD · khối đổi tiêu đề VÀ dịch chỉ số', () => {
  const { s, a } = mk()
  const edit = doc(); (edit[1].blocks as { text: string }[])[1].text = P1.replace('nghe kỹ', 'lắng nghe')
  assert.equal(resolveText(edit, a).status, 'stale')
  const del = doc(); (del[1].blocks as unknown[]).splice(1, 1)
  assert.equal(resolveText(del, a).status, 'stale')
  const nfd = doc(); (nfd[1].blocks as { text: string }[])[1].text = P1.normalize('NFD')
  assert.equal(resolveText(nfd, a).status, 'stale')
  const renamed = [{ kind: 'note', text: 'x' } as Section, { kind: 'note', text: 'y' } as Section, study(s[1].blocks as unknown[], 'Tên khác'), s[2]]
  assert.equal(resolveText(renamed, a).status, 'stale', 'đổi tiêu đề + dịch chỉ số ⇒ không nhận ra khối ⇒ stale (an toàn)')
})

test('Khối cũ bị xoá và một khối KHÁC chứa cùng cụm từ trượt vào chỉ số cũ → stale (không "moved" sang khối lạ)', () => {
  const { s, a } = mk()
  const replaced = [s[0], { kind: 'note', title: 'Khối khác', text: 'Thầy nhắc: hãy nghe kỹ nhịp chùm ba mỗi ngày.' } as Section, s[2]]
  assert.equal(resolveText(replaced, a).status, 'stale')
  // đối chứng: cùng khối (cùng fp) chỉ thêm đoạn phía trước ⇒ vẫn moved
  const inner = doc(); (inner[1].blocks as unknown[]).splice(1, 0, { b: 'p', text: 'Đoạn chèn thêm.' })
  assert.equal(resolveText(inner, a).status, 'moved')
})

test('Hai khối GIỐNG HỆT (cùng fp, cùng chữ): vị trí gốc còn đúng → ok; sau khi dịch chuyển → stale, không đoán', () => {
  const { s, a } = mk()
  const dup = [s[0], s[1], study(s[1].blocks as unknown[]), s[2]]
  assert.equal(resolveText(dup, a).status, 'ok', 'bước 1 chạy trước, không bị bản sao làm nhiễu')
  const shifted = [{ kind: 'note', text: 'mới' } as Section, ...dup]
  assert.equal(resolveText(shifted, a).status, 'stale', 'hai ứng viên không phân xử được')
})

test('Đoạn chữ lặp trong cùng khối: ctx (tiền/hậu tố) phân xử; ctx cũng trùng → stale', () => {
  const s: Section[] = [study([{ b: 'p', text: 'Đàn đều. Nghe kỹ nhịp. Rồi nghỉ.' }, { b: 'p', text: 'Khác. Nghe kỹ nhịp. Hết.' }])]
  const a = buildAnchor(s, 0, ['blocks', '1', 'text'], 7, 20)!                    // "Nghe kỹ nhịp." ở đoạn 2
  const moved = [study([{ b: 'p', text: 'Thêm đầu.' }, ...(s[0].blocks as unknown[])])]
  const r = resolveText(moved, a)
  assert.deepEqual(r.status === 'moved' ? [r.section, r.path.join('.')] : r.status, [0, 'blocks.2.text'], 'ctx chọn đúng đoạn 2')
  const same: Section[] = [study([{ b: 'p', text: 'Nghe kỹ nhịp.' }, { b: 'p', text: 'Nghe kỹ nhịp.' }])]
  const a2 = buildAnchor(same, 0, ['blocks', '0', 'text'], 0, 13)!
  const mv = [study([{ b: 'p', text: 'Thêm.' }, ...(same[0].blocks as unknown[])])]
  assert.equal(resolveText(mv, a2).status, 'stale')
})

test('Ngân sách: vượt MAX_WINDOWS → stale (fail-closed), không treo', () => {
  const big = Array.from({ length: 400 }, (_, i) => ({ b: 'p', text: `Đoạn số ${i}: ` + 'x'.repeat(300) }))
  const s: Section[] = [study(big)]
  const a = buildAnchor(s, 0, ['blocks', '399', 'text'], 0, 12)!
  const removed = [study(big.slice(0, 399))]
  const t0 = Date.now()
  assert.equal(resolveText(removed, a).status, 'stale')
  assert.ok(Date.now() - t0 < 5000)
})

test('Tiếng Việt tổ hợp & emoji: neo, tìm lại và cắt theo điểm mã cho cùng kết quả', () => {
  const t = 'Nốt 🎸 “giữ đều tay” rất quan trọng'.normalize('NFD')
  const s: Section[] = [{ kind: 'note', text: t }]
  const sel = 'giữ đều tay'.normalize('NFD')
  const from = cpLen(t.slice(0, t.indexOf(sel)))
  const a = buildAnchor(s, 0, ['text'], from, from + cpLen(sel))!
  assert.ok(a)
  const moved: Section[] = [{ kind: 'note', text: '😀 ' + t }]
  const r = resolveText(moved, a)
  assert.equal(r.status, 'moved')
  if (r.status === 'moved') {
    assert.equal(cpSlice(moved[0].text as string, r.from, r.to), sel)
    const u0 = cpToUtf16(moved[0].text as string, r.from), u1 = cpToUtf16(moved[0].text as string, r.to)
    assert.equal((moved[0].text as string).slice(u0, u1), sel, 'vùng <mark> cắt theo UTF-16 từ chỉ số điểm mã')
  }
})
