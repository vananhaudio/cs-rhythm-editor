// Lớp truy cập dữ liệu của "Hợp âm chuẩn hóa". Component CHỈ gọi qua interface `ChordLibrary` —
// không gọi Supabase rải rác. Ba trạng thái (xem `chooseChordBackend`):
//   • rpc      — backend thật: RPC chord_sheet_* (db/chord_library_v1_setup.sql). Bật bằng VITE_CHORD_LIBRARY_BACKEND=rpc.
//   • mock     — dữ liệu thử trong trình duyệt (localStorage), CHỈ ở dev/proof, luôn kèm băng cảnh báo.
//   • disabled — bản production mà backend chưa được bật: KHÔNG lưu gì, báo rõ. Không bao giờ rơi về mock.
//
// Mô hình lưu (giống hệt ở mock và rpc):
//   Lưu nội dung (lời / nhịp / BPM) = tạo PHIÊN BẢN MỚI ở dạng BẢN NHÁP. Bản đang dùng không đổi cho tới khi
//   thầy bấm Duyệt. Tên bài / tác giả thuộc về BÀI, sửa là có hiệu lực ngay.
import { matchesQuery } from './masterLibrary.ts'
import { canonicalChordText, validateChordDraft } from './chordText.ts'
import type { ChordDraft, ChordMeter } from './chordText.ts'

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
}

/** Phần NỘI DUNG của một phiên bản (không gồm tên bài/tác giả — hai thứ đó thuộc về bài). */
export type ChordContent = Pick<ChordDraft, 'text' | 'meter' | 'suggestedBpm'>

export interface ChordLibrary {
  readonly mode: 'mock' | 'rpc' | 'disabled'
  searchChordSheets(query: string): Promise<ChordSheetSummary[]>
  getChordSheet(versionId: string): Promise<ChordSheetDetail>
  /** Bài mới + phiên bản đầu tiên, ở dạng bản nháp. */
  createChordSheet(draft: ChordDraft): Promise<ChordSheetDetail>
  /** Sửa nội dung = phiên bản MỚI ở dạng bản nháp (phiên bản cũ bất biến). `fromVersionId` = bản đang sửa. */
  createChordSheetVersion(sheetId: string, content: ChordContent, fromVersionId: string): Promise<ChordSheetDetail>
  updateChordSheetInfo(sheetId: string, info: Pick<ChordDraft, 'title' | 'composer'>): Promise<void>
  /** Duyệt = đặt làm bản đang dùng. */
  approveChordSheetVersion(versionId: string): Promise<ChordSheetDetail>
  /** Bỏ một bản nháp (không xoá — chỉ thôi coi là bản chờ duyệt). */
  discardChordSheetVersion(versionId: string): Promise<void>
  /** Chỉ có ở mock: xoá dữ liệu thử, trả về bộ mẫu ban đầu. */
  resetMock?(): void
}

const firstError = (draft: ChordDraft) => Object.values(validateChordDraft(draft))[0]
const sameMeter = (a: ChordMeter | null, b: ChordMeter | null) => (a?.beats ?? null) === (b?.beats ?? null) && (a?.beatType ?? null) === (b?.beatType ?? null)

// ── MOCK ────────────────────────────────────────────────────────────────────────────────────
type MockVersion = {
  versionId: string; versionNumber: number; text: string; meter: ChordMeter | null; suggestedBpm: number | null
  hasAnchors: boolean; createdAt: string; review: 'private' | 'approved' | 'rejected'
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
}

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
  const detail = (sheet: MockSheet, version: MockVersion): ChordSheetDetail => ({
    ...summary(sheet, version), versionNumber: version.versionNumber, text: version.text,
    meter: version.meter, suggestedBpm: version.suggestedBpm, hasSource: false,
  })
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
    async searchChordSheets(query) {
      return sheets.filter(sheet => matchesQuery(sheet, query))
        .flatMap(sheet => { const version = lead(sheet); return version ? [summary(sheet, version)] : [] })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    async getChordSheet(versionId) {
      const { sheet, version } = findVersion(versionId)
      return detail(sheet, version)
    },
    async createChordSheet(draft) {
      const error = firstError(draft)
      if (error) throw new Error(error)
      const version: MockVersion = { versionId: newId(), versionNumber: 1, text: canonicalChordText(draft.text), meter: draft.meter, suggestedBpm: draft.suggestedBpm, hasAnchors: false, createdAt: now(), review: 'private' }
      const sheet: MockSheet = { sheetId: newId(), title: draft.title.trim(), composer: draft.composer.trim() || null, currentVersionId: null, versions: [version] }
      sheets = [sheet, ...sheets]
      persist()
      return detail(sheet, version)
    },
    async createChordSheetVersion(sheetId, content, fromVersionId) {
      const sheet = findSheet(sheetId)
      const error = firstError({ title: sheet.title, composer: sheet.composer ?? '', ...content })
      if (error) throw new Error(error)
      const text = canonicalChordText(content.text)
      // Như máy chủ: trùng = cùng lời + cùng nhịp + cùng BPM với bản đang dùng hoặc một bản nháp còn hiệu lực.
      const same = sheet.versions.find(entry => entry.review !== 'rejected' && (entry.review === 'private' || entry.versionId === sheet.currentVersionId)
        && entry.text === text && sameMeter(entry.meter, content.meter) && entry.suggestedBpm === content.suggestedBpm)
      if (same) return detail(sheet, same)
      const from = sheet.versions.find(entry => entry.versionId === fromVersionId)
      const version: MockVersion = {
        versionId: newId(), versionNumber: Math.max(...sheet.versions.map(entry => entry.versionNumber)) + 1,
        text, meter: content.meter, suggestedBpm: content.suggestedBpm,
        // Vạch nhịp neo theo từng chữ của lời: đổi lời là neo cũ hết hiệu lực. Chỉ đổi nhịp/BPM thì giữ.
        hasAnchors: !!from?.hasAnchors && from.text === text, createdAt: now(), review: 'private',
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

export function createRpcChordLibrary(rpc: RpcCall): ChordLibrary {
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
    return {
      ...toSummary(row, row.draft_version_id == null ? null : String(row.draft_version_id)),
      versionNumber: Number(row.version_number), text: String(row.text),
      meter: (row.meter as ChordMeter | null) ?? null,
      suggestedBpm: row.suggested_bpm == null ? null : Number(row.suggested_bpm),
      hasSource: Array.isArray(row.sources) && row.sources.length > 0,
    }
  }
  // Lưu = ĐÓNG GÓP (bản nháp, chưa duyệt). KHÔNG tự duyệt ngầm: duyệt là hành động riêng của thầy.
  // Máy chủ báo `duplicate` = nội dung y hệt một bản đã có → trả chính bản đó, không có phiên bản rác.
  async function contribute(args: Record<string, unknown>): Promise<ChordSheetDetail> {
    const result = await call('chord_sheet_contribute', args) as Row
    return get(String(result.version_id))
  }

  return {
    mode: 'rpc',
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
    async createChordSheet(draft) {
      const error = firstError(draft)
      if (error) throw new Error(error)
      return contribute({
        p_text: draft.text, p_title: draft.title.trim(), p_composer: draft.composer.trim() || null,
        p_meter: draft.meter, p_suggested_bpm: draft.suggestedBpm,
      })
    },
    async createChordSheetVersion(sheetId, content, fromVersionId) {
      return contribute({
        p_text: content.text, p_sheet_id: sheetId, p_parent_version_id: fromVersionId,
        p_meter: content.meter, p_suggested_bpm: content.suggestedBpm,
      })
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
  }
}

// ── DISABLED (production chưa bật backend) ──────────────────────────────────────────────────
export const DISABLED_MESSAGE = 'Hợp âm chuẩn hóa chưa được bật trên máy chủ này. Chưa có gì được lưu.'

export function createDisabledChordLibrary(): ChordLibrary {
  const refuse = async (): Promise<never> => { throw new Error(DISABLED_MESSAGE) }
  return {
    mode: 'disabled',
    searchChordSheets: refuse, getChordSheet: refuse, createChordSheet: refuse, createChordSheetVersion: refuse,
    updateChordSheetInfo: refuse, approveChordSheetVersion: refuse, discardChordSheetVersion: refuse,
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
    instance = createRpcChordLibrary(async (fn, args) => {
      const { supabase } = await import('../supabase.ts')
      return supabase.rpc(fn, args)
    })
  } else if (mode === 'mock') {
    let storage: Storage | null = null
    try { storage = globalThis.localStorage ?? null } catch { /* bị chặn (chế độ riêng tư) → chỉ giữ trong phiên */ }
    instance = createMockChordLibrary({ storage })
  } else instance = createDisabledChordLibrary()
  return instance
}
