// Lớp truy cập dữ liệu của "Hợp âm chuẩn hóa". Component CHỈ gọi qua interface `ChordLibrary` —
// không gọi Supabase rải rác. Ba trạng thái (xem `chooseChordBackend`):
//   • rpc      — backend thật: RPC chord_sheet_* (db/chord_library_v1_setup.sql). Bật bằng VITE_CHORD_LIBRARY_BACKEND=rpc.
//   • mock     — dữ liệu thử trong trình duyệt (localStorage), CHỈ ở dev/proof, luôn kèm băng cảnh báo.
//   • disabled — bản production mà backend chưa được bật: KHÔNG lưu gì, báo rõ. Không bao giờ rơi về mock.
//
// Mô hình lưu (giống hệt ở mock và rpc):
//   Lưu nội dung (lời / nhịp / BPM) = tạo PHIÊN BẢN MỚI ở dạng BẢN NHÁP. Bản đang dùng không đổi cho tới khi
//   thầy bấm Duyệt. Tên bài / tác giả thuộc về BÀI, sửa là có hiệu lực ngay.
//   File nguồn (PDF/ảnh sheet) thuộc về PHIÊN BẢN: tải lên thư mục {uid}/{version_id}/ của phiên bản SẮP tạo
//   (version_id do client sinh trước — `newVersionId()`), rồi lưu = ghi phiên bản kèm danh sách file. Phiên bản
//   đã ghi thì bộ file nguồn đóng băng; muốn thay nguồn = tạo phiên bản mới (file cũ được CHÉP sang, không dời).
import { matchesQuery } from './masterLibrary.ts'
import { canonicalChordText, validateChordDraft } from './chordText.ts'
import type { ChordDraft, ChordMeter } from './chordText.ts'
import { SOURCE_BUCKET, createMemorySourceStore, createRefusingSourceStore, createSupabaseSourceStore, parseSourcePath, sourcesFromServer, sourcesPayload } from './chordSources.ts'
import type { ChordSource, ChordSourceStore } from './chordSources.ts'
import { parseAnchors } from './chordAnchors.ts'
import type { AnchorsStatus, ChordAnchors } from './chordAnchors.ts'

/** current = bản đang dùng · draft = bản nháp chưa duyệt · old = đã duyệt nhưng không còn là bản đang dùng · discarded = bản nháp đã bỏ */
export type ChordVersionStatus = 'current' | 'draft' | 'old' | 'discarded'

export type ChordSheetSummary = {
  sheetId: string
  /** Bản đang dùng; bài chưa có bản nào được duyệt thì là bản nháp mới nhất. Mở bài = mở phiên bản này. */
  versionId: string
  title: string
  composer: string | null
  hasAnchors: boolean
  updatedAt: string
  status: ChordVersionStatus
  /** Bản nháp chưa duyệt MỚI HƠN `versionId` (nếu có). */
  draftVersionId: string | null
}

export type ChordSheetDetail = ChordSheetSummary & {
  versionNumber: number
  text: string
  meter: ChordMeter | null
  suggestedBpm: number | null
  hasSource: boolean
  /** File nguồn ĐÃ GẮN với phiên bản này (bất biến), theo thứ tự trang. */
  sources: ChordSource[]
  /** null = chưa có, hoặc dữ liệu không đọc được theo lời của phiên bản này. */
  anchors: ChordAnchors | null
  anchorsStatus: AnchorsStatus
}

/** Phiên bản sắp ghi: version_id đã dùng để tải file nguồn, và danh sách file (đã nằm trong bucket). */
export type ChordSaveOptions = { versionId?: string; sources?: ChordSource[] }

/** Phần NỘI DUNG của một phiên bản (không gồm tên bài/tác giả — hai thứ đó thuộc về bài). */
export type ChordContent = Pick<ChordDraft, 'text' | 'meter' | 'suggestedBpm'>

export interface ChordLibrary {
  readonly mode: 'mock' | 'rpc' | 'disabled'
  /** Nơi lưu file nguồn (cùng chế độ với thư viện). */
  readonly sources: ChordSourceStore
  /** version_id cho phiên bản SẮP tạo — để tải file nguồn trước khi lưu. */
  newVersionId(): string
  searchChordSheets(query: string): Promise<ChordSheetSummary[]>
  getChordSheet(versionId: string): Promise<ChordSheetDetail>
  /** Bài mới + phiên bản đầu tiên, ở dạng bản nháp. */
  createChordSheet(draft: ChordDraft, options?: ChordSaveOptions): Promise<ChordSheetDetail>
  /** Sửa nội dung = phiên bản MỚI ở dạng bản nháp (phiên bản cũ bất biến). `fromVersionId` = bản đang sửa. */
  createChordSheetVersion(sheetId: string, content: ChordContent, fromVersionId: string, options?: ChordSaveOptions): Promise<ChordSheetDetail>
  updateChordSheetInfo(sheetId: string, info: Pick<ChordDraft, 'title' | 'composer'>): Promise<void>
  /** Duyệt = đặt làm bản đang dùng. */
  approveChordSheetVersion(versionId: string): Promise<ChordSheetDetail>
  /** Bỏ một bản nháp (không xoá — chỉ thôi coi là bản chờ duyệt). */
  discardChordSheetVersion(versionId: string): Promise<void>
  /**
   * Chấp nhận vạch nhịp = PHIÊN BẢN MỚI (cùng lời, nhịp, BPM, file nguồn của `fromVersionId`; cha = nó;
   * dạng bản nháp — vẫn phải Duyệt). Máy chủ tự kiểm vạch với đúng lời. Trùng bộ vạch → trả bản đã có.
   */
  acceptAnchors(fromVersionId: string, anchors: ChordAnchors): Promise<ChordSheetDetail>
  /** Chỉ có ở mock: xoá dữ liệu thử, trả về bộ mẫu ban đầu. */
  resetMock?(): void
}

const firstError = (draft: ChordDraft) => Object.values(validateChordDraft(draft))[0]
const sameMeter = (a: ChordMeter | null, b: ChordMeter | null) => (a?.beats ?? null) === (b?.beats ?? null) && (a?.beatType ?? null) === (b?.beatType ?? null)
/** Như chord_source_key ở máy chủ: bộ file nguồn so theo sha256 đã sắp xếp. */
const sourceKey = (sources: ChordSource[] | undefined) => (sources ?? []).map(source => source.sha256).sort().join(',')

// ── MOCK ────────────────────────────────────────────────────────────────────────────────────
type MockVersion = {
  versionId: string; versionNumber: number; text: string; meter: ChordMeter | null; suggestedBpm: number | null
  hasAnchors: boolean; createdAt: string; review: 'private' | 'approved' | 'rejected'
  sources?: ChordSource[]; anchors?: ChordAnchors | null
}
type MockSheet = { sheetId: string; title: string; composer: string | null; currentVersionId: string | null; versions: MockVersion[] }

export const MOCK_STORAGE_KEY = 'tv-chordlib-mock-v2'

// Lời TỰ ĐẶT để thử giao diện — không phải bài hát thật, không có bản quyền của ai.
// Bản build production không bao giờ dùng mock (chooseChordBackend → disabled), nên bộ mẫu bị bỏ khỏi bundle:
// Vite thay `import.meta.env.PROD` bằng hằng `true`, minifier xoá nhánh chết. Ngoài Vite (test node) → giữ bộ mẫu.
const IS_PROD_BUILD = typeof import.meta.env !== 'undefined' && import.meta.env.PROD === true
const SEED: MockSheet[] = IS_PROD_BUILD ? [] : [
  {
    sheetId: 'mock-sheet-01', title: 'Bài thử 01', composer: 'Dữ liệu mẫu', currentVersionId: 'mock-version-01',
    versions: [{
      versionId: 'mock-version-01', versionNumber: 1, meter: { beats: 4, beatType: 4 }, suggestedBpm: 80, hasAnchors: true, createdAt: '2026-10-01T08:00:00.000Z', review: 'approved',
      anchors: { measures: [{ line: 0, token: 0 }, { line: 0, token: 5 }, { line: 1, token: 0 }, { line: 1, token: 4 }, { line: 2, token: 0 }, { line: 2, token: 3 }, { line: 2, token: 4 }, { line: 2, token: 7 }, { line: 3, token: 0 }, { line: 3, token: 3 }, { line: 3, token: 5 }] },
      text: '1. [C] Một câu hát mẫu cho [Am] buổi chiều\n[F] Dòng tiếp theo đi [G] thật chậm\nĐK: [C] Hát lên cho [Em] vui, [F] hát cho quên [G] ngày dài\n[Am] Rồi ta về [G] lại câu [C] đầu',
    }],
  },
  {
    sheetId: 'mock-sheet-02', title: 'Tình khúc mẫu', composer: 'Dữ liệu mẫu', currentVersionId: 'mock-version-02',
    versions: [{
      versionId: 'mock-version-02', versionNumber: 1, meter: { beats: 3, beatType: 4 }, suggestedBpm: 96, hasAnchors: false, createdAt: '2026-10-02T08:00:00.000Z', review: 'approved',
      text: '[Am] Dòng một của tình khúc [Dm] mẫu\n[G] Dòng hai nối [C] theo\n[F] Dòng ba ngân [E7] dài rồi [Am] nghỉ',
    }],
  },
  {
    sheetId: 'mock-sheet-03', title: 'Đêm Thử Nghiệm', composer: null, currentVersionId: 'mock-version-03',
    versions: [{
      versionId: 'mock-version-03', versionNumber: 1, meter: null, suggestedBpm: null, hasAnchors: false, createdAt: '2026-10-03T08:00:00.000Z', review: 'approved',
      text: '[Em] Đêm nay ngồi thử [C] một bài\n[G] Đường xa vẫn [D] đợi ngày mai',
    }],
  },
]

type MockOptions = {
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  newId?: () => string
  now?: () => string
  /** Chủ thư mục file nguồn trong chế độ thử. */
  ownerId?: string
}
export const MOCK_OWNER_ID = '00000000-0000-4000-8000-00000000a11a'

export function createMockChordLibrary(options: MockOptions = {}): ChordLibrary {
  const storage = options.storage ?? null
  const newId = options.newId ?? (() => crypto.randomUUID())
  const now = options.now ?? (() => new Date().toISOString())
  const seed = (): MockSheet[] => JSON.parse(JSON.stringify(SEED))

  function load(): MockSheet[] {
    try {
      const saved = storage?.getItem(MOCK_STORAGE_KEY)
      const parsed: unknown = saved ? JSON.parse(saved) : null
      if (Array.isArray(parsed)) return parsed as MockSheet[]
    } catch { /* dữ liệu thử hỏng → quay về bộ mẫu */ }
    return seed()
  }
  let sheets = load()
  const persist = () => { try { storage?.setItem(MOCK_STORAGE_KEY, JSON.stringify(sheets)) } catch { /* hết chỗ / chế độ riêng tư: vẫn chạy trong phiên */ } }

  const statusOf = (sheet: MockSheet, version: MockVersion): ChordVersionStatus =>
    version.versionId === sheet.currentVersionId ? 'current' : version.review === 'private' ? 'draft' : version.review === 'approved' ? 'old' : 'discarded'
  const newerDraft = (sheet: MockSheet, version: MockVersion) =>
    sheet.versions.filter(entry => entry.review === 'private' && entry.versionNumber > version.versionNumber)
      .sort((a, b) => b.versionNumber - a.versionNumber)[0]?.versionId ?? null
  /** Phiên bản đại diện của bài trong danh sách: bản đang dùng, không có thì bản nháp mới nhất. */
  const lead = (sheet: MockSheet) => sheet.versions.find(version => version.versionId === sheet.currentVersionId)
    ?? sheet.versions.filter(version => version.review === 'private').sort((a, b) => b.versionNumber - a.versionNumber)[0]
  const summary = (sheet: MockSheet, version: MockVersion): ChordSheetSummary => ({
    sheetId: sheet.sheetId, versionId: version.versionId, title: sheet.title, composer: sheet.composer,
    hasAnchors: version.hasAnchors, updatedAt: version.createdAt, status: statusOf(sheet, version), draftVersionId: newerDraft(sheet, version),
  })
  const detail = (sheet: MockSheet, version: MockVersion): ChordSheetDetail => {
    const anchors = parseAnchors(version.anchors ?? null, version.text)
    return {
      ...summary(sheet, version), versionNumber: version.versionNumber, text: version.text,
      meter: version.meter, suggestedBpm: version.suggestedBpm, hasSource: !!version.sources?.length,
      sources: version.sources ?? [], anchors, anchorsStatus: anchors ? 'ready' : 'none',
    }
  }
  const store = createMemorySourceStore({ ownerId: options.ownerId ?? MOCK_OWNER_ID, isRecorded: id => sheets.some(sheet => sheet.versions.some(version => version.versionId === id)) })
  /** Như máy chủ: thư mục phiên bản phải chứa ĐÚNG các file khai trong sources. */
  function checkSources(versionId: string, sources: ChordSource[]) {
    const inFolder = [...store.files.keys()].filter(path => parseSourcePath(path)?.versionId === versionId).sort()
    const listed = sources.map(source => source.path).sort()
    if (sources.some(source => parseSourcePath(source.path)?.versionId !== versionId)) throw new Error('file nguồn không hợp lệ — đường dẫn phải nằm trong thư mục của phiên bản này')
    if (listed.some(path => !store.files.has(path))) throw new Error('file nguồn chưa được tải lên')
    if (inFolder.join('|') !== listed.join('|')) throw new Error('thư mục phiên bản có file chưa được khai trong sources — khai đủ hoặc xoá bớt')
  }
  const missing = () => new Error('Không tìm thấy bài này trong dữ liệu thử.')
  const findSheet = (sheetId: string) => {
    const sheet = sheets.find(entry => entry.sheetId === sheetId)
    if (!sheet) throw missing()
    return sheet
  }
  const findVersion = (versionId: string) => {
    for (const sheet of sheets) {
      const version = sheet.versions.find(entry => entry.versionId === versionId)
      if (version) return { sheet, version }
    }
    throw missing()
  }

  return {
    mode: 'mock',
    sources: store,
    newVersionId: newId,
    async searchChordSheets(query) {
      return sheets.filter(sheet => matchesQuery(sheet, query))
        .flatMap(sheet => { const version = lead(sheet); return version ? [summary(sheet, version)] : [] })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    async getChordSheet(versionId) {
      const { sheet, version } = findVersion(versionId)
      return detail(sheet, version)
    },
    async createChordSheet(draft, saveOptions = {}) {
      const error = firstError(draft)
      if (error) throw new Error(error)
      const versionId = saveOptions.versionId ?? newId()
      checkSources(versionId, saveOptions.sources ?? [])
      const version: MockVersion = { versionId, versionNumber: 1, text: canonicalChordText(draft.text), meter: draft.meter, suggestedBpm: draft.suggestedBpm, hasAnchors: false, createdAt: now(), review: 'private', sources: saveOptions.sources ?? [] }
      const sheet: MockSheet = { sheetId: newId(), title: draft.title.trim(), composer: draft.composer.trim() || null, currentVersionId: null, versions: [version] }
      sheets = [sheet, ...sheets]
      persist()
      return detail(sheet, version)
    },
    async createChordSheetVersion(sheetId, content, fromVersionId, saveOptions = {}) {
      const sheet = findSheet(sheetId)
      const error = firstError({ title: sheet.title, composer: sheet.composer ?? '', ...content })
      if (error) throw new Error(error)
      const text = canonicalChordText(content.text)
      const versionId = saveOptions.versionId ?? newId()
      checkSources(versionId, saveOptions.sources ?? [])
      // Như máy chủ: trùng = cùng lời + nhịp + BPM + bộ file nguồn với bản đang dùng hoặc một bản nháp còn hiệu lực.
      const same = sheet.versions.find(entry => entry.review !== 'rejected' && (entry.review === 'private' || entry.versionId === sheet.currentVersionId)
        && entry.text === text && sameMeter(entry.meter, content.meter) && entry.suggestedBpm === content.suggestedBpm
        && sourceKey(entry.sources) === sourceKey(saveOptions.sources))
      if (same) return detail(sheet, same)
      const from = sheet.versions.find(entry => entry.versionId === fromVersionId)
      // Vạch nhịp neo theo từng chữ của lời: đổi lời là neo cũ hết hiệu lực. Chỉ đổi nhịp/BPM/nguồn thì giữ.
      const keepAnchors = !!from?.hasAnchors && from.text === text
      const version: MockVersion = {
        versionId, versionNumber: Math.max(...sheet.versions.map(entry => entry.versionNumber)) + 1,
        text, meter: content.meter, suggestedBpm: content.suggestedBpm,
        hasAnchors: keepAnchors, anchors: keepAnchors ? from?.anchors ?? null : null, createdAt: now(), review: 'private',
        sources: saveOptions.sources ?? [],
      }
      sheet.versions.push(version)
      persist()
      return detail(sheet, version)
    },
    async updateChordSheetInfo(sheetId, info) {
      const sheet = findSheet(sheetId)
      const error = firstError({ ...info, meter: null, suggestedBpm: null, text: '-' })
      if (error) throw new Error(error)
      sheet.title = info.title.trim()
      sheet.composer = info.composer.trim() || null
      persist()
    },
    async approveChordSheetVersion(versionId) {
      const { sheet, version } = findVersion(versionId)
      version.review = 'approved'
      sheet.currentVersionId = version.versionId
      persist()
      return detail(sheet, version)
    },
    async acceptAnchors(fromVersionId, anchors) {
      const { sheet, version } = findVersion(fromVersionId)
      if (version.review === 'rejected') throw new Error('không gắn vạch nhịp vào bản đã bỏ')
      const clean = parseAnchors(anchors, version.text)
      if (!clean) throw new Error('vạch nhịp không hợp lệ với lời của phiên bản này')
      const same = sheet.versions.find(entry => entry.review !== 'rejected' && !!entry.anchors && entry.text === version.text
        && sameMeter(entry.meter, version.meter) && entry.suggestedBpm === version.suggestedBpm && sourceKey(entry.sources) === sourceKey(version.sources)
        && JSON.stringify(entry.anchors) === JSON.stringify(clean))
      if (same) return detail(sheet, same)
      const next: MockVersion = {
        versionId: newId(), versionNumber: Math.max(...sheet.versions.map(entry => entry.versionNumber)) + 1,
        text: version.text, meter: version.meter, suggestedBpm: version.suggestedBpm, sources: version.sources ?? [],
        hasAnchors: true, anchors: clean, createdAt: now(), review: 'private',
      }
      sheet.versions.push(next)
      persist()
      return detail(sheet, next)
    },
    async discardChordSheetVersion(versionId) {
      const { sheet, version } = findVersion(versionId)
      if (version.review === 'approved') throw new Error('Bản đã duyệt không bỏ được — muốn thay thì duyệt bản khác.')
      version.review = 'rejected'
      void sheet
      persist()
    },
    resetMock() {
      sheets = seed()
      try { storage?.removeItem(MOCK_STORAGE_KEY) } catch { /* không sao */ }
    },
  }
}

// ── RPC (backend thật) ──────────────────────────────────────────────────────────────────────
export type RpcCall = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>

type Row = Record<string, unknown>
const hasAnchorsStatus = (status: unknown) => status === 'ready' || status === 'needs_review'
const statusOfRow = (row: Row): ChordVersionStatus =>
  row.is_canonical ? 'current' : row.review_status === 'private' ? 'draft' : row.review_status === 'approved' ? 'old' : 'discarded'

function rpcError(message: string): Error {
  if (message.includes('CHORDLIB_FORBIDDEN')) return new Error('Tài khoản không có quyền với Thư viện hợp âm.')
  if (message.includes('CHORDLIB_NOT_FOUND')) return new Error('Không tìm thấy bài này.')
  if (message.includes('CHORDLIB_RETRY')) return new Error('Bài vừa được thay đổi ở nơi khác — tải lại rồi thử lại.')
  const invalid = /CHORDLIB_(?:INVALID|LIMIT): (.+)/.exec(message)
  if (invalid) return new Error(invalid[1])
  // Backend chưa được cài (migration chưa chạy): PostgREST báo không tìm thấy hàm.
  if (/Could not find the function|PGRST202|does not exist/i.test(message)) return new Error('Máy chủ chưa có Thư viện hợp âm (chưa chạy migration).')
  return new Error(message || 'Không kết nối được Thư viện hợp âm.')
}

export function createRpcChordLibrary(rpc: RpcCall, sourceStore: ChordSourceStore = createRefusingSourceStore('Chưa nối kho file nguồn.')): ChordLibrary {
  async function call(fn: string, args: Record<string, unknown>): Promise<unknown> {
    let reply: Awaited<ReturnType<RpcCall>>
    try { reply = await rpc(fn, args) }
    catch (cause) { throw rpcError(cause instanceof Error ? cause.message : '') }
    if (reply.error) throw rpcError(reply.error.message)
    return reply.data
  }
  const toSummary = (row: Row, draftVersionId: string | null): ChordSheetSummary => ({
    sheetId: String(row.sheet_id), versionId: String(row.version_id), title: String(row.title),
    composer: row.composer == null ? null : String(row.composer),
    hasAnchors: hasAnchorsStatus(row.anchors_status), updatedAt: String(row.created_at),
    status: statusOfRow(row), draftVersionId,
  })
  async function get(versionId: string): Promise<ChordSheetDetail> {
    const row = await call('chord_sheet_get', { p_version_id: versionId }) as Row
    const text = String(row.text)
    const sources = sourcesFromServer(row.sources)
    const status = String(row.anchors_status ?? 'none')
    return {
      ...toSummary(row, row.draft_version_id == null ? null : String(row.draft_version_id)),
      versionNumber: Number(row.version_number), text,
      meter: (row.meter as ChordMeter | null) ?? null,
      suggestedBpm: row.suggested_bpm == null ? null : Number(row.suggested_bpm),
      hasSource: sources.length > 0, sources,
      anchors: parseAnchors(row.anchors ?? null, text),
      anchorsStatus: (['none', 'processing', 'needs_review', 'ready', 'failed'].includes(status) ? status : 'none') as AnchorsStatus,
    }
  }
  // Lưu = ĐÓNG GÓP (bản nháp, chưa duyệt). KHÔNG tự duyệt ngầm: duyệt là hành động riêng của thầy.
  // Máy chủ báo `duplicate` = nội dung y hệt một bản đã có → trả chính bản đó, không có phiên bản rác.
  async function contribute(args: Record<string, unknown>, saveOptions: ChordSaveOptions = {}): Promise<ChordSheetDetail> {
    if (saveOptions.versionId) args.p_version_id = saveOptions.versionId
    if (saveOptions.sources?.length) args.p_sources = sourcesPayload(saveOptions.sources)
    const result = await call('chord_sheet_contribute', args) as Row
    return get(String(result.version_id))
  }

  return {
    mode: 'rpc',
    sources: sourceStore,
    newVersionId: () => crypto.randomUUID(),
    async searchChordSheets(query) {
      const rows = (await call('chord_sheet_search', { p_query: query, p_limit: 50 }) as Row[])
        .filter(row => row.review_status !== 'rejected')
      // Máy chủ trả theo PHIÊN BẢN (bản chuẩn + bản đang chờ). Danh sách của thầy là theo BÀI:
      // đại diện = bản đang dùng, chưa có thì bản nháp mới nhất; kèm bản nháp mới hơn đại diện (nếu có).
      const bySheet = new Map<string, Row[]>()
      for (const row of rows) bySheet.set(String(row.sheet_id), [...(bySheet.get(String(row.sheet_id)) ?? []), row])
      const number = (row: Row) => Number(row.version_number)
      return [...bySheet.values()].map(group => {
        const drafts = group.filter(row => !row.is_canonical).sort((a, b) => number(b) - number(a))
        const lead = group.find(row => row.is_canonical) ?? drafts[0]
        const newer = drafts.find(row => row !== lead && number(row) > number(lead))
        return toSummary(lead, newer ? String(newer.version_id) : null)
      })
    },
    getChordSheet: get,
    async createChordSheet(draft, saveOptions) {
      const error = firstError(draft)
      if (error) throw new Error(error)
      return contribute({
        p_text: draft.text, p_title: draft.title.trim(), p_composer: draft.composer.trim() || null,
        p_meter: draft.meter, p_suggested_bpm: draft.suggestedBpm,
      }, saveOptions)
    },
    async createChordSheetVersion(sheetId, content, fromVersionId, saveOptions) {
      return contribute({
        p_text: content.text, p_sheet_id: sheetId, p_parent_version_id: fromVersionId,
        p_meter: content.meter, p_suggested_bpm: content.suggestedBpm,
      }, saveOptions)
    },
    async updateChordSheetInfo(sheetId, info) {
      await call('chord_sheet_update_info', { p_sheet_id: sheetId, p_title: info.title.trim(), p_composer: info.composer.trim() || null })
    },
    async approveChordSheetVersion(versionId) {
      await call('chord_sheet_approve', { p_version_id: versionId })
      return get(versionId)
    },
    async discardChordSheetVersion(versionId) {
      await call('chord_sheet_reject', { p_version_id: versionId, p_reason: 'Bỏ bản nháp (bàn biên tập).' })
    },
    async acceptAnchors(fromVersionId, anchors) {
      const result = await call('chord_sheet_accept_anchors', {
        p_from_version_id: fromVersionId,
        p_anchors: { ...(anchors.pickup ? { pickup: anchors.pickup } : {}), measures: anchors.measures },
        p_anchor_review: { mode: 'manual' },
      }) as Row
      return get(String(result.version_id))
    },
  }
}

// ── DISABLED (production chưa bật backend) ──────────────────────────────────────────────────
export const DISABLED_MESSAGE = 'Hợp âm chuẩn hóa chưa được bật trên máy chủ này. Chưa có gì được lưu.'

export function createDisabledChordLibrary(): ChordLibrary {
  const refuse = async (): Promise<never> => { throw new Error(DISABLED_MESSAGE) }
  return {
    mode: 'disabled',
    sources: createRefusingSourceStore(DISABLED_MESSAGE),
    newVersionId: () => crypto.randomUUID(),
    searchChordSheets: refuse, getChordSheet: refuse, createChordSheet: refuse, createChordSheetVersion: refuse,
    updateChordSheetInfo: refuse, approveChordSheetVersion: refuse, discardChordSheetVersion: refuse, acceptAnchors: refuse,
  }
}

// ── Chọn hiện thực ──────────────────────────────────────────────────────────────────────────
/**
 * `rpc` khi được bật tường minh. Mock CHỈ có ở dev. Bản production mà chưa bật backend → `disabled`:
 * không bao giờ để thầy tưởng đang lưu production trong khi dữ liệu nằm ở localStorage.
 */
export function chooseChordBackend(env: { prod: boolean; setting: string | undefined }): ChordLibrary['mode'] {
  if (env.setting === 'rpc') return 'rpc'
  return env.prod ? 'disabled' : 'mock'
}

let instance: ChordLibrary | null = null

export function getChordLibrary(): ChordLibrary {
  if (instance) return instance
  const mode = chooseChordBackend({ prod: import.meta.env?.PROD ?? true, setting: import.meta.env?.VITE_CHORD_LIBRARY_BACKEND })
  if (mode === 'rpc') {
    const client = async () => (await import('../supabase.ts')).supabase
    instance = createRpcChordLibrary(async (fn, args) => (await client()).rpc(fn, args), createSupabaseSourceStore({
      bucket: async () => (await client()).storage.from(SOURCE_BUCKET),
      userId: async () => (await (await client()).auth.getUser()).data.user?.id ?? null,
    }))
  } else if (mode === 'mock') {
    let storage: Storage | null = null
    try { storage = globalThis.localStorage ?? null } catch { /* bị chặn (chế độ riêng tư) → chỉ giữ trong phiên */ }
    instance = createMockChordLibrary({ storage })
  } else instance = createDisabledChordLibrary()
  return instance
}
