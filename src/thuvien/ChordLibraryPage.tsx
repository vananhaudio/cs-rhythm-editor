import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DISABLED_MESSAGE, getChordLibrary } from './chordLibrary.ts'
import type { ChordLibrary, ChordSheetDetail, ChordSheetSummary } from './chordLibrary.ts'
import { BPM_RANGE, METER_CHOICES, canonicalChordText, chordTextIssues, formatMeter, listChords, parseBpm, parseChordText, parseMeter, validateChordDraft } from './chordText.ts'
import type { ChordDraft, ChordDraftErrors } from './chordText.ts'
import { NEW_CHORD_SHEET, chordSheetFromSearch, chordViewFromSearch, chordViewUrl, rhythmFromSearch, rhythmUrl, sectionUrl } from './sections.ts'
import { MAX_SOURCE_FILES, SOURCE_ACCEPT, formatBytes, nextFreeIndex, parseSourcePath, sha256Hex, sourceErrorMessage, sourceFileProblem, sourceKindLabel, sourceMimeOf, sourcePath } from './chordSources.ts'
import type { ChordSource } from './chordSources.ts'
import { ANCHORS_STATUS_LABEL, buildMeasureDisplay, uncoveredLines } from './chordAnchors.ts'
import UncoveredNotice from './UncoveredNotice.tsx'
import MeasureSheet from './MeasureSheet.tsx'
import type { ChordAnchors } from './chordAnchors.ts'
import AnchorEditor from './AnchorEditor.tsx'
import ChordSheetEditor from './ChordSheetEditor.tsx'
import ChordLyricsModal from './ChordLyricsModal.tsx'
import ChordSheetView from './ChordSheetView.tsx'
import { MoreMenu } from '../class-social/ui'
import { remapAnchorsForInsert, remapAnchorsForRemove, sameLyricStructure } from './chordEdit.ts'
import type { StructureEdit } from './ChordSheetEditor.tsx'
import type { MeasureAnalysisResult, MeasureAnalyzer } from './measureAnalysis.ts'
import type { ContentExtractor, ExtractionTarget } from './contentExtractor.ts'
import { applyProposal, buildProposal, hasSubstantialText } from './extractionProposal.ts'
import type { ExtractionProposal } from './extractionProposal.ts'

// Rhythm Scroll (dựng timeline hợp âm theo phách) chỉ tải khi mở — không làm nặng trình sửa.
const RhythmScrollPage = lazy(() => import('./RhythmScrollPage.tsx'))

// Mục "Hợp âm chuẩn hóa" của /thuvien — bàn làm việc của thầy: tìm, thêm, sửa lời + hợp âm.
// Mọi đọc/ghi đi qua `library` (src/thuvien/chordLibrary.ts); component không biết Supabase.
// CSS: ./ChordLibrary.css, nạp ở ThuVienPage.

type Props = { tabs?: ReactNode; canEdit?: boolean; library?: ChordLibrary; analyzer?: MeasureAnalyzer; extractor?: ContentExtractor; readSource?: SourceReader }
/** Đọc byte một file nguồn để đưa cho analyzer (mặc định: link xem có hạn → fetch). */
type SourceReader = (library: ChordLibrary, path: string) => Promise<Blob>
const readViaViewUrl: SourceReader = async (library, path) => (await fetch(await library.sources.viewUrl(path))).blob()

export default function ChordLibraryPage({ tabs, canEdit = true, library = getChordLibrary(), analyzer, extractor, readSource = readViaViewUrl }: Props) {
  const [open, setOpen] = useState<string | null>(() => chordSheetFromSearch(window.location.search))
  const [rhythm, setRhythm] = useState(() => rhythmFromSearch(window.location.search))
  // Trang XEM chỉ-đọc (`?xem=`); khác với `open` = trình sửa (`?hopam=`).
  const [view, setView] = useState<string | null>(() => chordViewFromSearch(window.location.search))
  const [notice, setNotice] = useState('')

  // Nút Back của trình duyệt đóng/mở bài theo `?hopam=` / `?xem=`; Header của website cũng điều hướng bằng đường này.
  useEffect(() => {
    const sync = () => {
      setOpen(chordSheetFromSearch(window.location.search)); setRhythm(rhythmFromSearch(window.location.search))
      setView(chordViewFromSearch(window.location.search))
    }
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  function go(target: string | null) {
    window.history.pushState({ thuvienChord: true }, '', sectionUrl(window.location.href, 'chords', target))
    setOpen(target)
    setRhythm(false)
    setView(null)
    window.scrollTo(0, 0)
  }

  function goView(versionId: string) {
    window.history.pushState({ thuvienChord: true }, '', chordViewUrl(window.location.href, versionId))
    setOpen(null)
    setRhythm(false)
    setView(versionId)
    window.scrollTo(0, 0)
  }

  function goRhythm(versionId: string, on: boolean) {
    window.history.pushState({ thuvienChord: true }, '', rhythmUrl(window.location.href, versionId, on))
    setRhythm(on)
  }

  // Bản production mà backend chưa bật: nói thẳng, không cho nhập — không bao giờ lặng lẽ lưu vào trình duyệt.
  if (library.mode === 'disabled') return <main className="tv-chords">
    {tabs}
    <div className="cl-wrap">
      <header className="cl-head"><h1>HỢP ÂM CHUẨN HÓA</h1></header>
      <p className="cl-notice cl-notice-bad" role="alert">{DISABLED_MESSAGE}</p>
    </div>
  </main>

  if (open && open !== NEW_CHORD_SHEET && rhythm) {
    return <Suspense fallback={<main className="tv-chords"><p className="cl-empty">Đang mở Rhythm Scroll…</p></main>}>
      <RhythmScrollPage key={open} library={library} versionId={open} onBack={() => goRhythm(open, false)} />
    </Suspense>
  }

  // Chỉ có quyền xem: địa chỉ trình sửa (?hopam=) không mở được trình sửa — rơi về trang xem chỉ-đọc / danh sách.
  // (Quyền thật vẫn do RPC quyết định ở máy chủ; đây chỉ là lớp chặn giao diện, không phải nguồn quyền.)
  const viewOnly = !canEdit && (view !== null || (open !== null && open !== NEW_CHORD_SHEET))
  if (viewOnly) {
    return <main className="tv-chords">
      {tabs}
      <ChordSheetView key={view ?? open!} library={library} versionId={(view ?? open)!} canEdit={false}
        onBack={() => go(null)} onEdit={() => undefined} onOpenVersion={id => goView(id)} onRhythm={id => goRhythm(id, true)} />
    </main>
  }

  if (view && !open) {
    return <main className="tv-chords">
      {tabs}
      <ChordSheetView key={view} library={library} versionId={view} canEdit={canEdit}
        onBack={() => go(null)} onEdit={id => go(id)} onOpenVersion={id => goView(id)} onRhythm={id => goRhythm(id, true)} />
    </main>
  }

  return <main className="tv-chords">
    {tabs}
    {open
      ? <ChordEditor key={open} library={library} analyzer={analyzer} extractor={extractor} readSource={readSource} versionId={open === NEW_CHORD_SHEET ? null : open}
          onOpenVersion={id => go(id)} onRhythm={id => goRhythm(id, true)}
          onClose={message => { setNotice(message ?? ''); go(null) }}
          // Lưu xong chỉ đổi địa chỉ (để tải lại trang vẫn mở đúng bài) — KHÔNG dựng lại editor, kẻo mất thông báo "Đã lưu".
          onSaved={detail => window.history.replaceState(window.history.state, '', sectionUrl(window.location.href, 'chords', detail.versionId))} />
      : <ChordList library={library} notice={notice} onView={id => { setNotice(''); goView(id) }} onEdit={id => { setNotice(''); go(id) }} canEdit={canEdit} />}
  </main>
}

function MockBanner({ library, onReset }: { library: ChordLibrary; onReset?: () => void }) {
  if (library.mode !== 'mock') return null
  return <p className="cl-mock" role="note">
    <strong>Dữ liệu thử — chưa lưu production.</strong> Bài bạn thêm/sửa ở đây chỉ nằm trong trình duyệt của máy này.
    {onReset && library.resetMock && <> <button type="button" className="cl-link" onClick={onReset}>Xoá dữ liệu thử</button></>}
  </p>
}

const Status = ({ label, on, yes = 'Có', no = 'Chưa có' }: { label: string; on: boolean; yes?: string; no?: string }) =>
  <span className="cl-status" data-on={on}><span className="cl-status-label">{label}</span><span className="cl-status-value">{on ? `✓ ${yes}` : `— ${no}`}</span></span>

// ── Danh sách ───────────────────────────────────────────────────────────────────────────────
function ChordList({ library, notice, onView, onEdit, canEdit }: { library: ChordLibrary; notice: string; onView: (id: string) => void; onEdit: (id: string) => void; canEdit: boolean }) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ChordSheetSummary[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    // Gõ tới đâu tìm tới đó; chờ một nhịp ngắn để không gọi máy chủ theo từng phím.
    const timer = setTimeout(() => {
      library.searchChordSheets(query).then(data => { if (active) { setItems(data); setState('ready') } })
        .catch(cause => {
          if (!active) return
          setError(cause instanceof Error ? cause.message : 'Không tải được danh sách.')
          setState('error')
        })
    }, query ? 180 : 0)
    return () => { active = false; clearTimeout(timer) }
  }, [library, query, reload])

  return <>
    <div className="cl-wrap">
      <header className="cl-head">
        <h1>HỢP ÂM CHUẨN HÓA</h1>
      </header>
      <MockBanner library={library} onReset={() => { library.resetMock?.(); setQuery(''); setState('loading'); setReload(n => n + 1) }} />
      <div className="cl-actions">
        <input type="search" value={query} onChange={event => setQuery(event.target.value)}
          placeholder="Tìm tên bài hoặc tác giả..." aria-label="Tìm tên bài hoặc tác giả" />
      </div>
      {notice && <p role="status" className="cl-notice">{notice}</p>}
      <ul className="cl-list" aria-label="Danh sách bài">
        {state === 'ready' && items.map(item => <li key={item.sheetId} className="cl-item">
          <div className="cl-item-name">
            <strong>{item.title}{item.status === 'draft' && <em className="cl-tag">Chưa duyệt</em>}{item.draftVersionId && <em className="cl-tag">Có bản nháp</em>}</strong>
            <span>{item.composer || '—'}</span>
          </div>
          <div className="cl-item-status">
            <Status label="Hợp âm" on />
            <Status label="Vạch nhịp" on={item.hasAnchors} yes="Đã có" />
          </div>
          <div className="cl-item-buttons">
            <button type="button" className="cl-open" onClick={() => onView(item.versionId)} aria-label={`Xem bài ${item.title}`}>Xem</button>
            {canEdit && <button type="button" className="cl-open cl-open-edit" onClick={() => onEdit(item.versionId)} aria-label={`Sửa bài ${item.title}`}>Sửa</button>}
          </div>
        </li>)}
        {state === 'loading' && <li className="cl-empty" aria-live="polite">Đang tải danh sách…</li>}
        {state === 'error' && <li className="cl-empty" role="alert">{error} <button type="button" className="cl-link" onClick={() => { setState('loading'); setReload(n => n + 1) }}>Thử lại</button></li>}
        {state === 'ready' && !items.length && <li className="cl-empty">{query.trim() ? 'Không tìm thấy bài phù hợp. Muốn thêm bài, dùng “Nạp hợp âm mới” trên thanh Header.' : 'Chưa có bài nào.'}</li>}
      </ul>
    </div>
  </>
}

// ── Bàn làm việc ────────────────────────────────────────────────────────────────────────────
type Form = { title: string; composer: string; meter: string; bpm: string; text: string }
const EMPTY: Form = { title: '', composer: '', meter: '', bpm: '', text: '' }
const formOf = (detail: ChordSheetDetail): Form => ({
  title: detail.title, composer: detail.composer ?? '', meter: formatMeter(detail.meter),
  bpm: detail.suggestedBpm == null ? '' : String(detail.suggestedBpm), text: detail.text,
})
const draftOf = (form: Form): ChordDraft => ({
  title: form.title, composer: form.composer, meter: parseMeter(form.meter), suggestedBpm: parseBpm(form.bpm), text: form.text,
})

function ChordEditor({ library, analyzer, extractor, readSource, versionId, onClose, onSaved, onOpenVersion, onRhythm }: {
  library: ChordLibrary
  analyzer: MeasureAnalyzer | undefined
  extractor: ContentExtractor | undefined
  readSource: SourceReader
  versionId: string | null
  onClose: (message?: string) => void
  onSaved: (detail: ChordSheetDetail) => void
  onOpenVersion: (versionId: string) => void
  onRhythm: (versionId: string) => void
}) {
  const [detail, setDetail] = useState<ChordSheetDetail | null>(null)
  const [saved, setSaved] = useState<Form>(EMPTY)
  const [form, setForm] = useState<Form>(EMPTY)
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>(versionId ? 'loading' : 'ready')
  const [loadError, setLoadError] = useState('')
  const [errors, setErrors] = useState<ChordDraftErrors>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState('')
  // File nguồn cho phiên bản SẮP lưu: bản đã gắn (giữ lại sẽ được CHÉP sang phiên bản mới) + file mới nạp vào
  // thư mục {uid}/{draftId}/. draftId = version_id của phiên bản sắp tạo, sinh sẵn để tải file trước khi lưu.
  const [plan, setPlan] = useState<PlanItem[]>([])
  const [draftId, setDraftId] = useState(() => library.newVersionId())
  const [sourceBusy, setSourceBusy] = useState(false)
  const [sourceError, setSourceError] = useState('')
  const [anchorEditing, setAnchorEditing] = useState(false)
  // Cửa sổ "Nạp lời & hợp âm": soạn riêng, chỉ Áp dụng mới đổi bản nhạc (chưa ghi DB).
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  // "Nạp hợp âm mới" = một luồng: dán lời → (tuỳ chọn) ảnh/PDF → biên tập. Bài đã có mở thẳng bước biên tập.
  const [step, setStep] = useState<'paste' | 'media' | 'edit'>(versionId ? 'edit' : 'paste')
  const fileInput = useRef<HTMLInputElement>(null)
  const [liveAnchors, setLiveAnchors] = useState<ChordAnchors | null>(null)
  // Phân tích tự động (5B): analyzer chỉ có ở dev/trang thử. Đề xuất nạp VÀO trình sửa 5A — không tự lưu, không tự duyệt.
  const [analyzerReady, setAnalyzerReady] = useState(false)
  const [analysis, setAnalysis] = useState<{ state: 'idle' | 'running' | 'choose' | 'failed'; result?: Extract<MeasureAnalysisResult, { ok: true }>; message?: string }>({ state: 'idle' })
  // Phân tích NỘI DUNG sheet (lời + hợp âm). Chỉ ĐỀ XUẤT — "Dùng kết quả này" điền vào form (form thành dirty), không tự lưu/duyệt.
  const [extractorReady, setExtractorReady] = useState(false)
  const [extraction, setExtraction] = useState<{ state: 'idle' | 'running' | 'failed' | 'done'; label?: string; message?: string; proposal?: ExtractionProposal }>({ state: 'idle' })
  const [seed, setSeed] = useState<{ anchors: ChordAnchors | null; flagged: number[]; notes: string[]; key: number }>({ anchors: null, flagged: [], notes: [], key: 0 })
  // Bộ vạch nhịp đang hiện trên bản nhạc: LUÔN hợp lệ cho `form.text` hiện tại (đã dời qua mọi lần chèn/xoá "(-)", đổi hợp âm).
  // Khác `detail.anchors` = vạch chưa lưu (nằm trong bộ nhớ trang). Lưu lời vẫn tạo bản nháp chưa có vạch (giới hạn M3).
  const [bars, setBars] = useState<ChordAnchors | null>(null)
  const [layoutNote, setLayoutNote] = useState('')

  useEffect(() => {
    let active = true
    if (analyzer) analyzer.available().then(ok => { if (active) setAnalyzerReady(ok) }, () => { if (active) setAnalyzerReady(false) })
    return () => { active = false }
  }, [analyzer])
  useEffect(() => {
    let active = true
    if (extractor) extractor.available().then(ok => { if (active) setExtractorReady(ok) }, () => { if (active) setExtractorReady(false) })
    return () => { active = false }
  }, [extractor])

  useEffect(() => {
    if (!versionId) return
    let active = true
    library.getChordSheet(versionId).then(data => {
      if (!active) return
      setDetail(data); setSaved(formOf(data)); setForm(formOf(data)); setPlan(planOf(data)); setBars(data.anchors); setLoad('ready')
    }).catch(cause => {
      if (!active) return
      setLoadError(cause instanceof Error ? cause.message : 'Không mở được bài.')
      setLoad('error')
    })
    return () => { active = false }
  }, [library, versionId])

  const set = (patch: Partial<Form>) => { setForm(current => ({ ...current, ...patch })); setMessage(''); setFailed('') }
  const infoChanged = form.title.trim() !== saved.title.trim() || form.composer.trim() !== saved.composer.trim()
  const contentChanged = canonicalChordText(form.text) !== canonicalChordText(saved.text) || form.meter !== saved.meter || form.bpm.trim() !== saved.bpm.trim()
  const pending = plan.filter(item => item.kind === 'pending')
  const sourcesChanged = pending.length > 0 || plan.length !== (detail?.sources.length ?? 0)
  const dirty = infoChanged || contentChanged || sourcesChanged
  const lines = useMemo(() => parseChordText(form.text), [form.text])
  const chords = useMemo(() => listChords(form.text), [form.text])
  const issues = useMemo(() => chordTextIssues(form.text), [form.text])
  const hasText = canonicalChordText(form.text).trim().length > 0
  const textChanged = canonicalChordText(form.text) !== canonicalChordText(saved.text)
  // Lời đổi tới mức vạch cũ không còn ánh xạ được (đã bỏ vạch) — nói rõ, không âm thầm.
  const anchorsWillReset = !!detail?.hasAnchors && textChanged && !bars
  const sameBars = (a: ChordAnchors | null, b: ChordAnchors | null) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  const barsDirty = !sameBars(bars, detail?.anchors ?? null)
  const unsaved = dirty || barsDirty

  /**
   * MỌI thay đổi lời đi qua đây: giữ vạch nhịp đúng chỗ nếu cấu trúc chữ không đổi (chỉ đổi hợp âm), ánh xạ qua việc
   * chèn/xoá "(-)", còn lại (đổi lời thật) thì bỏ — và báo, không âm thầm làm sai.
   */
  function changeText(next: string, structure?: StructureEdit) {
    const base = bars
    let nextBars: ChordAnchors | null = null
    let note = ''
    if (base && structure) {
      const remap = structure.kind === 'insert' ? remapAnchorsForInsert(base, structure.line, structure.at, structure.side) : remapAnchorsForRemove(base, structure.line, structure.at)
      nextBars = remap.anchors
      if (remap.merged.length) note = `Ô ${remap.merged.map(i => i + 1).join(', ')} giờ trùng vị trí ô liền trước (thành ô ngân) — hãy xem lại.`
    } else if (base && sameLyricStructure(form.text, next)) nextBars = base
    setBars(nextBars)
    setLayoutNote(note)
    setAnchorEditing(false)
    set({ text: next })
  }
  const mock = library.mode === 'mock'

  /** Rời bài: còn thay đổi → hỏi; file đã nạp mà chưa lưu → xoá luôn (không để file mồ côi chiếm hạn mức). */
  async function leave(then: () => void) {
    const ask = pending.length
      ? `Có ${pending.length} file nguồn đã nạp nhưng chưa lưu — rời khỏi sẽ xoá các file này. Rời khỏi bài?`
      : barsDirty && !dirty ? 'Vạch nhịp chưa lưu — rời khỏi sẽ mất. Rời khỏi bài này?' : 'Có thay đổi chưa lưu. Rời khỏi bài này?'
    if (unsaved && !window.confirm(ask)) return
    for (const item of pending) { try { await library.sources.remove(item.source.path) } catch { /* đã gắn hoặc đã mất: bỏ qua */ } }
    then()
  }
  const close = () => void leave(() => onClose())

  // Bảo vệ chỉnh sửa chưa lưu khi đóng tab / tải lại (điều hướng trong app đã có `leave`).
  useEffect(() => {
    if (!unsaved) return
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [unsaved])

  const adopt = (next: ChordSheetDetail) => {
    setDetail(next); setSaved(formOf(next)); setForm(formOf(next)); setPlan(planOf(next)); setSourceError('')
    setDraftId(library.newVersionId())
    setBars(next.anchors); setLayoutNote('')
  }
  const suffix = mock ? ' (Dữ liệu thử — chưa lưu production.)' : ''

  // Lưu: tên bài/tác giả → sửa BÀI (có hiệu lực ngay). Lời/nhịp/BPM → PHIÊN BẢN MỚI ở dạng bản nháp;
  // bản đang dùng không đổi cho tới khi bấm Duyệt. Không đổi gì → không gọi máy chủ, không có phiên bản rác.
  // Sau mỗi lần lưu, form nạp lại từ đúng dữ liệu máy chủ trả về. Lỗi → báo lỗi, không báo "đã lưu".
  /** Đưa mọi file "đã gắn" còn giữ trong danh sách sang thư mục phiên bản sắp tạo (CHÉP qua Storage, không dời). */
  async function carryAttached(owner: string): Promise<PlanItem[]> {
    let current = plan
    for (const item of plan) {
      if (item.kind !== 'attached') continue
      const used = current.filter(entry => entry.kind === 'pending').map(entry => parseSourcePath(entry.source.path)!.index)
      const index = nextFreeIndex(used)
      if (index === null) throw new Error(`Một phiên bản tối đa ${MAX_SOURCE_FILES} file nguồn.`)
      const to = sourcePath(owner, draftId, index, item.source.mime)
      await library.sources.copy(item.source.path, to)
      current = current.map(entry => entry.key === item.key ? { ...entry, kind: 'pending', source: { ...entry.source, path: to } } : entry)
      setPlan(current)
    }
    return current
  }

  // Lưu: tên bài/tác giả → sửa BÀI (có hiệu lực ngay). Lời/nhịp/BPM/file nguồn → PHIÊN BẢN MỚI ở dạng bản nháp
  // (version_id = draftId, file nguồn đã nằm sẵn trong thư mục của nó); bản đang dùng không đổi cho tới khi bấm
  // Duyệt. Không đổi gì → không gọi máy chủ. Lỗi → báo lỗi, không báo "đã lưu"; file đã nạp vẫn còn để lưu lại/xoá.
  async function save() {
    if (busy || sourceBusy) return
    const draft = draftOf(form)
    const found = validateChordDraft(draft)
    setErrors(found)
    setMessage(''); setFailed('')
    if (Object.keys(found).length) { setFailed('Chưa lưu được — xem các ô được đánh dấu.'); return }
    if (detail && !unsaved) { setMessage('Chưa có thay đổi nào để lưu.'); return }
    setBusy(true)
    try {
      // MỘT lần lưu: lời + hợp âm + vạch nhịp đang hiện đi cùng nhau trong một lời gọi → một phiên bản.
      const needsVersion = !detail || contentChanged || sourcesChanged || barsDirty
      let sources: ChordSource[] = []
      if (needsVersion && plan.length) {
        const owner = await library.sources.ownerId()
        sources = (await carryAttached(owner)).map((item, at) => ({ ...item.source, page: at + 1 }))
      }
      const options = { versionId: draftId, sources, anchors: bars }
      if (!detail) {
        const next = await library.createChordSheet(draft, options)
        await afterVersion(next, sources)
        adopt(next); onSaved(next)
        setMessage(`Đã lưu bản nháp (phiên bản ${next.versionNumber}${sources.length ? `, ${sources.length} file nguồn` : ''}) — bấm “Duyệt bản này” để đặt làm bản đang dùng.${suffix}`)
        return
      }
      if (infoChanged) {
        await library.updateChordSheetInfo(detail.sheetId, draft)
        // Tên đã lưu thật rồi: ghi nhận ngay, để nếu bước sau lỗi thì lần bấm Lưu kế không gửi lại tên.
        setSaved(current => ({ ...current, title: form.title, composer: form.composer }))
        setDetail(current => current && { ...current, title: form.title.trim(), composer: form.composer.trim() || null })
      }
      const next = needsVersion
        ? await library.createChordSheetVersion(detail.sheetId, draft, detail.versionId, options)
        : await library.getChordSheet(detail.versionId)
      const duplicate = needsVersion && next.versionId !== draftId
      if (needsVersion) await afterVersion(next, sources)
      adopt(next); onSaved(next)
      setMessage((needsVersion
        ? !duplicate
          ? `Đã lưu bản nháp (phiên bản ${next.versionNumber}${sources.length ? `, ${sources.length} file nguồn` : ''}). Bản đang dùng chưa đổi — bấm “Duyệt bản này” để dùng bản mới.`
          : `Nội dung này trùng phiên bản ${next.versionNumber} đã có — đã mở phiên bản đó, không tạo thêm.`
        : 'Đã lưu tên bài / tác giả.') + suffix)
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : ''
      // Có vạch mà không đủ quyền → máy chủ từ chối CẢ lần lưu (adapter đã đổi thành VANH_FORBIDDEN); giữ nguyên mọi thứ đang soạn.
      setFailed(cause instanceof Error ? sourceErrorMessage(text) : 'Không lưu được.')
    } finally { setBusy(false) }
  }

  /** Máy chủ báo trùng (trả phiên bản khác draftId) → file vừa đưa vào thư mục draftId không gắn vào đâu: dọn. */
  async function afterVersion(next: ChordSheetDetail, sources: ChordSource[]) {
    if (next.versionId === draftId) return
    for (const source of sources) { try { await library.sources.remove(source.path) } catch { /* bỏ qua */ } }
  }

  async function addFiles(files: File[]): Promise<boolean> {
    if (!files.length || sourceBusy) return false
    setSourceBusy(true); setSourceError(''); setMessage('')
    const problems: string[] = []
    const before = plan.length
    let current = plan
    try {
      const owner = await library.sources.ownerId()
      for (const file of files) {
        const problem = sourceFileProblem(file, current.length)
        if (problem) { problems.push(problem); continue }
        const mime = sourceMimeOf(file)!
        const used = current.filter(entry => entry.kind === 'pending').map(entry => parseSourcePath(entry.source.path)!.index)
        // Chỗ trống phải chừa đủ cho các file "đã gắn" sẽ được chép sang khi lưu.
        const reserved = current.filter(entry => entry.kind === 'attached').length
        const index = nextFreeIndex(used)
        if (index === null || used.length + reserved >= MAX_SOURCE_FILES) { problems.push(`Một phiên bản tối đa ${MAX_SOURCE_FILES} file nguồn.`); break }
        const path = sourcePath(owner, draftId, index, mime)
        try {
          const sha256 = await sha256Hex(await file.arrayBuffer())
          await library.sources.upload(path, file, mime)
          current = [...current, { key: path, kind: 'pending', name: file.name, source: { path, mime, sha256, sizeBytes: file.size, page: current.length + 1 } }]
          setPlan(current)
        } catch (cause) {
          problems.push(`“${file.name}”: ${sourceErrorMessage(cause instanceof Error ? cause.message : '')}`)
        }
      }
    } catch (cause) {
      problems.push(sourceErrorMessage(cause instanceof Error ? cause.message : ''))
    } finally {
      setSourceError(problems.join(' '))
      setSourceBusy(false)
    }
    return current.length > before
  }

  async function removeItem(item: PlanItem) {
    if (sourceBusy) return
    setSourceError('')
    if (item.kind === 'attached') { setPlan(current => current.filter(entry => entry.key !== item.key)); return }
    setSourceBusy(true)
    try {
      await library.sources.remove(item.source.path)
      setPlan(current => current.filter(entry => entry.key !== item.key))
    } catch (cause) {
      setSourceError(sourceErrorMessage(cause instanceof Error ? cause.message : ''))
    } finally { setSourceBusy(false) }
  }

  async function viewItem(item: PlanItem) {
    setSourceError('')
    try {
      const url = await library.sources.viewUrl(item.source.path)
      window.open(url, '_blank', 'noopener')
    } catch (cause) {
      setSourceError(sourceErrorMessage(cause instanceof Error ? cause.message : ''))
    }
  }

  /** Chấp nhận vạch nhịp → máy chủ tạo PHIÊN BẢN MỚI (cùng nội dung + nguồn). Mở phiên bản đó, không tự duyệt. */
  async function acceptAnchors(anchors: ChordAnchors) {
    if (busy || !detail) return
    setBusy(true); setMessage(''); setFailed('')
    try {
      const next = await library.acceptAnchors(detail.versionId, anchors)
      const fresh = next.versionNumber > detail.versionNumber && next.versionId !== detail.versionId
      adopt(next); onSaved(next); setAnchorEditing(false)
      setMessage((fresh
        ? `Đã lưu vạch nhịp thành phiên bản ${next.versionNumber} (bản nháp) — phiên bản ${detail.versionNumber} giữ nguyên. Bấm “Duyệt bản này” để dùng bản mới.`
        : `Bộ vạch nhịp này đã có ở phiên bản ${next.versionNumber} — đã mở phiên bản đó, không tạo thêm.`) + suffix)
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message.replace(/^CHORDLIB_INVALID: /, '') : 'Không lưu được vạch nhịp.')
    } finally { setBusy(false) }
  }

  function adoptProposal(result: Extract<MeasureAnalysisResult, { ok: true }>) {
    setSeed(current => ({ anchors: result.anchors, flagged: result.review.measures, notes: result.review.notes, key: current.key + 1 }))
    setAnchorEditing(true); setAnalysis({ state: 'idle' })
    setMessage(`Máy đã điền ${result.anchors.measures.length} ô${result.anchors.pickup ? ' + nhịp lấy đà' : ''} — xem bản bên phải, sửa nếu sai rồi bấm “Chấp nhận vạch nhịp”.`)
  }

  async function analyze() {
    if (!analyzer || !detail || busy || analysis.state === 'running') return
    setAnalysis({ state: 'running' }); setMessage(''); setFailed('')
    try {
      const sources = detail.sources
      const result = await analyzer.analyze({
        versionId: detail.versionId, text: detail.text, meter: detail.meter, traceId: detail.versionId,
        loadFiles: () => Promise.all(sources.map(async source => ({ name: source.path.split('/').pop()!, mime: source.mime, data: await readSource(library, source.path) }))),
      })
      if (!result.ok) { setAnalysis({ state: 'failed', message: result.error.message }); return }
      // Đang có vạch (đang sửa dở hoặc đã lưu) → KHÔNG ghi đè: hỏi thầy dùng đề xuất hay giữ vạch hiện tại.
      const current = anchorEditing ? liveAnchors : detail.anchors
      if (current && current.measures.length) setAnalysis({ state: 'choose', result })
      else adoptProposal(result)
    } catch (cause) {
      setAnalysis({ state: 'failed', message: cause instanceof Error ? cause.message : 'Phân tích không thành công.' })
    }
  }

  /** Phân tích một hay nhiều file nguồn (theo thứ tự trong danh sách). File chưa lưu → staged; file đã gắn phiên bản → persisted. */
  async function runExtraction(items: PlanItem[], label: string) {
    if (!extractor || !items.length || extraction.state === 'running') return
    setExtraction({ state: 'running', label }); setMessage(''); setFailed('')
    const documents: unknown[] = []
    for (const item of items) {
      let target: ExtractionTarget
      if (item.kind === 'pending') {
        const parsed = parseSourcePath(item.source.path)
        if (!parsed) { setExtraction({ state: 'failed', label, message: 'Đường dẫn file nguồn không hợp lệ.' }); return }
        target = { kind: 'staged', draftId, sourceIndex: parsed.index, mime: item.source.mime }
      } else {
        const index = detail?.sources.findIndex(source => source.path === item.source.path) ?? -1
        if (!detail || index < 0) { setExtraction({ state: 'failed', label, message: 'Không tìm thấy file nguồn trong phiên bản đã lưu.' }); return }
        target = { kind: 'persisted', versionId: detail.versionId, sourceIndex: index }
      }
      const outcome = await extractor.extract(target)
      if (!outcome.ok) { setExtraction({ state: 'failed', label, message: `${item.name}: ${outcome.error.message}` }); return }
      documents.push(outcome.document)
    }
    setExtraction({ state: 'done', label, proposal: buildProposal(documents) })
  }

  function useExtraction() {
    const proposal = extraction.proposal
    if (!proposal) return
    if (hasSubstantialText(form.text) && proposal.text.trim()
        && !window.confirm('Ô lời + hợp âm đang có nội dung. Thay bằng kết quả máy đọc? (Chưa lưu — thầy vẫn xem lại và bấm Lưu.)')) return
    setForm(current => ({ ...current, ...applyProposal(current, proposal) }))
    setMessage('Đã điền kết quả máy đọc vào form — xem lại, chọn Nhịp/BPM rồi bấm Lưu. Máy chưa lưu hay duyệt gì.'); setFailed('')
    setExtraction({ state: 'idle' })
  }

  async function approve() {
    if (busy || !detail) return
    setBusy(true); setMessage(''); setFailed('')
    try {
      adopt(await library.approveChordSheetVersion(detail.versionId))
      setMessage(`Đã duyệt — phiên bản ${detail.versionNumber} là bản đang dùng.${suffix}`)
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message : 'Không duyệt được.')
    } finally { setBusy(false) }
  }

  async function discard() {
    if (busy || !detail || !window.confirm(`Bỏ bản nháp (phiên bản ${detail.versionNumber})? Bản đang dùng không bị ảnh hưởng.`)) return
    setBusy(true); setMessage(''); setFailed('')
    try {
      await library.discardChordSheetVersion(detail.versionId)
      onClose(`Đã bỏ bản nháp của “${detail.title}”.${suffix}`)
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message : 'Không bỏ được bản nháp.')
      setBusy(false)
    }
  }

  if (load === 'loading') return <div className="cl-wrap"><p className="cl-empty" aria-live="polite">Đang mở bài…</p></div>
  if (load === 'error') return <div className="cl-wrap">
    <p className="cl-empty" role="alert">{loadError}</p>
    <button type="button" className="cl-back" onClick={() => onClose()}>← Danh sách</button>
  </div>

  const meterChoices = form.meter && !METER_CHOICES.includes(form.meter as typeof METER_CHOICES[number]) ? [form.meter, ...METER_CHOICES] : METER_CHOICES
  const uploadLocked = sourceBusy || busy || plan.length >= MAX_SOURCE_FILES || library.mode === 'disabled'

  // Chọn file (dùng chung cho bước hỏi ảnh/PDF và thao tác phụ "Thêm ảnh/PDF"): cùng đường tải nguồn sẵn có.
  const sourcePicker = <input ref={fileInput} type="file" multiple accept={SOURCE_ACCEPT} className="cl-sr-only" aria-label="Chọn ảnh hoặc PDF bản nhạc" disabled={uploadLocked}
    onChange={event => {
      const files = [...(event.target.files ?? [])]
      event.target.value = ''
      const fromMediaStep = step === 'media'
      void addFiles(files).then(added => {
        if (!added) return
        if (fromMediaStep) setStep('edit')
        else setAdvancedOpen(true)
        setMessage(`Đã nạp ${files.length} file. Bấm Lưu, rồi dùng “⋯ → Phân tích vạch nhịp” để máy đề xuất vạch nhịp (chỉ đề xuất, bạn kiểm tra và chỉnh lại).`)
      })
    }} />

  // Bước 1 — dán lời + hợp âm (chính ô nhập hiện có, đặt thẳng trong trang). Không tiêu đề "Thêm bài", không thanh công cụ.
  if (step === 'paste') {
    return <div className="cl-wrap">
      <header className="cl-editor-head cl-editor-head-lite"><button type="button" className="cl-back" onClick={close}>← Danh sách</button></header>
      <MockBanner library={library} />
      <ChordLyricsModal inline initial={form.text} onClose={() => undefined}
        onApply={text => { changeText(text); setStep('media') }} />
    </div>
  }

  // Bước 2 — hỏi về ảnh/PDF. Tuỳ chọn: bỏ qua là đi tiếp bình thường.
  if (step === 'media') {
    return <div className="cl-wrap">
      <header className="cl-editor-head cl-editor-head-lite"><button type="button" className="cl-back" onClick={() => setStep('paste')}>← Sửa lời</button></header>
      <MockBanner library={library} />
      <section className="cl-card cl-media-step" aria-label="Ảnh hoặc PDF bản nhạc">
        <h2>Bạn có ảnh chụp hoặc PDF bản nhạc không?</h2>
        <p className="cl-lead">Hãy tải lên nếu có. Hệ thống hỗ trợ xác định vị trí vạch nhịp tạm thời (không chính xác 100%). Bạn có thể kiểm tra và chỉnh sửa lại sau.</p>
        {sourceError && <p className="cl-error" role="alert">{sourceError}</p>}
        <div className="cl-media-actions">
          <button type="button" className="cl-primary" disabled={uploadLocked} onClick={() => fileInput.current?.click()}>{sourceBusy ? 'Đang nạp…' : 'Tải ảnh/PDF'}</button>
          <button type="button" className="cl-secondary" onClick={() => setStep('edit')}>Bỏ qua, làm sau</button>
        </div>
        {sourcePicker}
      </section>
    </div>
  }

  return <div className="cl-wrap cl-wrap-wide">
    <header className="cl-editor-head">
      <button type="button" className="cl-back" onClick={close}>← Danh sách</button>
      {form.title.trim() && <h1>{form.title.trim()}</h1>}
      <button type="button" className="cl-primary" onClick={() => void save()} disabled={busy || sourceBusy}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
    </header>
    <MockBanner library={library} />
    {detail && <button type="button" className="cl-status-chip" data-status={detail.status} onClick={() => setAdvancedOpen(true)}
      title="Xem / duyệt phiên bản">
      {detail.status === 'current' && (detail.draftVersionId ? 'Đang dùng · có bản nháp mới hơn' : 'Đang dùng')}
      {detail.status === 'draft' && 'Bản nháp — chưa dùng chính thức'}
      {detail.status === 'old' && 'Bản cũ — hiện không dùng'}
      {detail.status === 'discarded' && 'Bản nháp đã bỏ'}
      <span aria-hidden="true"> ›</span>
    </button>}
    {message && <p role="status" className="cl-notice">{message}</p>}
    {failed && <p role="alert" className="cl-notice cl-notice-bad">{failed}</p>}

    <div className="cl-editor">
      <div className="cl-col">
        <section className="cl-info" aria-label="Thông tin bài">
          <div className="cl-info-grid">
            <label className="cl-field cl-field-title">Tên bài *
              <input value={form.title} onChange={event => set({ title: event.target.value })} aria-invalid={!!errors.title} maxLength={220} />
              {errors.title && <span className="cl-error">{errors.title}</span>}
            </label>
            <label className="cl-field cl-field-author">Tác giả
              <input value={form.composer} onChange={event => set({ composer: event.target.value })} aria-invalid={!!errors.composer} maxLength={220} />
              {errors.composer && <span className="cl-error">{errors.composer}</span>}
            </label>
            <label className="cl-field cl-field-meter">Nhịp
              <select value={form.meter} onChange={event => set({ meter: event.target.value })}>
                <option value="">— Chưa rõ</option>
                {meterChoices.map(meter => <option key={meter} value={meter}>{meter}</option>)}
              </select>
            </label>
            <label className="cl-field cl-field-bpm">BPM gợi ý
              <input value={form.bpm} onChange={event => set({ bpm: event.target.value })} inputMode="numeric" placeholder={`${BPM_RANGE.min}–${BPM_RANGE.max}`} aria-invalid={!!errors.suggestedBpm} />
              {errors.suggestedBpm && <span className="cl-error">{errors.suggestedBpm}</span>}
            </label>
          </div>
        </section>

        {errors.text && <p className="cl-error">{errors.text}</p>}
        <section className="cl-card cl-preview" aria-label="Xem thử">
          <div className="cl-sheet-head">
            <h2>Bản nhạc <span className="cl-h2-note">— chạm chữ hoặc khe giữa hai chữ</span></h2>
            <MoreMenu className="cl-sheet-more" label="Thao tác khác của bài" items={[
              { label: 'Dán lại lời & hợp âm', onSelect: () => setLyricsOpen(true) },
              { label: 'Thêm ảnh/PDF tham khảo', onSelect: () => { if (!uploadLocked) fileInput.current?.click() } },
              { label: 'Phân tích vạch nhịp, phiên bản…', onSelect: () => setAdvancedOpen(true) },
            ]} />
          </div>
          {sourcePicker}
          {hasText
            ? <>
              {issues.length > 0 && <p className="cl-warn" role="note">Dòng {issues.join(', ')}: còn ngoặc vuông chưa thành hợp âm (thiếu ngoặc đóng, hoặc để trống).</p>}
              {anchorsWillReset && <p className="cl-warn" role="note">Bài này đã có vạch nhịp theo lời cũ. Lưu lời mới thì vạch nhịp phải làm lại.</p>}
              {layoutNote && <p className="cl-warn" role="note">{layoutNote}</p>}
              <ChordSheetEditor text={form.text} bars={bars} onBars={setBars} onChange={text => changeText(text)} onStructure={edit => changeText(edit.text, edit)} />
              {barsDirty && !dirty && <p className="cl-sheet-note" role="note">Vạch nhịp chưa lưu — bấm Lưu.</p>}
            </>
            : <p className="cl-placeholder">Chưa có lời. Dùng “⋯ → Dán lại lời & hợp âm”.</p>}
        </section>
        {/* Phần kỹ thuật (nguồn sheet, phân tích/sửa vạch theo dòng thời gian, phiên bản, Rhythm Scroll) — vẫn ở đây, chỉ hiện khi
            người dùng chủ động mở (nhãn trạng thái, hoặc "⋯"). Không có thanh tiêu đề thường trực. */}
        <details className="cl-fold cl-fold-advanced" open={advancedOpen} onToggle={event => setAdvancedOpen(event.currentTarget.open)}>
          <summary className="cl-sr-only">Nguồn sheet, vạch nhịp, phiên bản</summary>
          <p className="cl-adv-bar"><strong>Nguồn sheet · vạch nhịp · phiên bản</strong> <button type="button" className="cl-link" onClick={() => setAdvancedOpen(false)}>Thu gọn</button></p>
          {detail?.anchors && <p><button type="button" className="cl-secondary" disabled={busy || dirty} title={dirty ? 'Lưu thay đổi trước' : 'Chạy lời + hợp âm theo nhịp'} onClick={() => onRhythm(detail.versionId)}>▶ Rhythm Scroll</button></p>}
        {detail && <div className="cl-state" data-status={detail.status} role="group" aria-label="Trạng thái phiên bản">
      <p>
        {detail.status === 'current' && <><strong>Bản đang dùng</strong> · phiên bản {detail.versionNumber}.</>}
        {detail.status === 'draft' && <><strong>Bản nháp</strong> · phiên bản {detail.versionNumber} — chưa duyệt, chưa phải bản đang dùng.</>}
        {detail.status === 'old' && <><strong>Bản cũ</strong> · phiên bản {detail.versionNumber} — đã duyệt trước đây, hiện không dùng.</>}
        {detail.status === 'discarded' && <><strong>Bản nháp đã bỏ</strong> · phiên bản {detail.versionNumber}.</>}
        {detail.draftVersionId && <> Bài này có bản nháp mới hơn chưa duyệt.</>}
        {(detail.status === 'draft' || detail.status === 'old') && dirty && <> Lưu thay đổi trước khi duyệt.</>}
      </p>
      <div className="cl-state-actions">
        {detail.draftVersionId && <button type="button" className="cl-secondary" disabled={busy} onClick={() => void leave(() => onOpenVersion(detail.draftVersionId!))}>Mở bản nháp</button>}
        {(detail.status === 'draft' || detail.status === 'old') && <button type="button" className="cl-secondary cl-approve" disabled={busy || dirty} onClick={() => void approve()}>{detail.status === 'draft' ? 'Duyệt bản này' : 'Dùng lại bản này'}</button>}
        {detail.status === 'draft' && <button type="button" className="cl-secondary" disabled={busy} onClick={() => void discard()}>Bỏ bản nháp</button>}
      </div>
    </div>}
          <section className="cl-card" aria-label="Nguồn sheet">
            <h2>Nguồn sheet</h2>
            <p className="cl-help">PDF, JPEG, PNG hoặc WebP · tối đa 20 MB/file · tối đa {MAX_SOURCE_FILES} file. File gắn với phiên bản khi bấm <strong>Lưu</strong>; phiên bản đã lưu thì bộ nguồn không đổi được nữa — thay nguồn là lưu thành phiên bản mới.</p>
            {plan.length > 0
              ? <ol className="cl-sources" aria-label="Danh sách file nguồn">
                {plan.map((item, at) => <li key={item.key} className="cl-src" data-kind={item.kind}>
                  <div className="cl-src-main">
                    <strong>{item.source.mime === 'application/pdf' ? `PDF ${at + 1}` : `Trang ${at + 1}`}</strong>
                    <span>{item.name} · {sourceKindLabel(item.source.mime)} · {formatBytes(item.source.sizeBytes)}</span>
                    <em className="cl-src-tag">{item.kind === 'attached' ? `Đã gắn với phiên bản ${detail?.versionNumber}` : 'Chưa lưu'}</em>
                  </div>
                  <div className="cl-src-actions">
                    <button type="button" className="cl-secondary" onClick={() => void viewItem(item)}>Xem</button>
                    <button type="button" className="cl-secondary" disabled={sourceBusy || busy} onClick={() => void removeItem(item)}
                      aria-label={`${item.kind === 'attached' ? 'Bỏ khỏi phiên bản mới' : 'Xoá'} ${item.name}`}>{item.kind === 'attached' ? 'Bỏ khỏi bản mới' : 'Xoá'}</button>
                  </div>
                </li>)}
              </ol>
              : <p className="cl-placeholder">{detail?.sources.length ? 'Đã bỏ hết file nguồn khỏi phiên bản mới.' : 'Chưa có file nguồn.'}</p>}
            {detail && detail.sources.length > 0 && sourcesChanged && <p className="cl-warn" role="note">Phiên bản {detail.versionNumber} giữ nguyên bộ nguồn cũ (đã gắn, không sửa được). Bấm Lưu để tạo phiên bản mới với bộ nguồn này.</p>}
            {detail && detail.sources.length > 0 && !sourcesChanged && <p className="cl-placeholder">File đã gắn với phiên bản — muốn thay nguồn: thêm/bỏ file rồi Lưu thành phiên bản mới.</p>}
            <label className="cl-secondary cl-upload" data-disabled={sourceBusy || busy || plan.length >= MAX_SOURCE_FILES || library.mode === 'disabled'}>
              {sourceBusy ? 'Đang nạp…' : '+ Nạp PDF / ảnh'}
              <input type="file" multiple accept={SOURCE_ACCEPT} aria-label="Chọn file PDF hoặc ảnh sheet"
                disabled={sourceBusy || busy || plan.length >= MAX_SOURCE_FILES || library.mode === 'disabled'}
                onChange={event => { const files = [...(event.target.files ?? [])]; event.target.value = ''; void addFiles(files) }} />
            </label>
            {sourceError && <p className="cl-error" role="alert">{sourceError}</p>}
            <p className="cl-help">Sheet dùng để xác định <strong>khuông và ô nhịp</strong>. Sau khi <strong>Lưu</strong>, bấm <strong>Phân tích vạch nhịp</strong> ở mục bên dưới.</p>
            {extractor && plan.length > 0 && <details className="cl-advanced">
              <summary>Công cụ nâng cao</summary>
              <p className="cl-help">OCR dùng để kiểm tra kỹ thuật, không phải nguồn lời chuẩn. Kết quả không thay thế ô Lời + hợp âm trừ khi thầy tự bấm “Dùng kết quả này”.</p>
              {!extractorReady && <p className="cl-help">Máy phân tích chưa chạy trên máy này.</p>}
              <div className="cl-src-actions">
                {plan.map(item => <button key={item.key} type="button" className="cl-secondary" disabled={!extractorReady || extraction.state === 'running' || sourceBusy || busy}
                  title={extractorReady ? 'Đọc chữ trên file này (tham khảo)' : 'Máy phân tích chưa chạy.'}
                  aria-label={`Phân tích nội dung sheet (tham khảo): ${item.name}`} onClick={() => void runExtraction([item], item.name)}>Phân tích nội dung sheet (tham khảo): {item.name}</button>)}
                {plan.length > 1 && <button type="button" className="cl-secondary" disabled={!extractorReady || extraction.state === 'running' || sourceBusy || busy}
                  onClick={() => void runExtraction(plan, `${plan.length} file`)}>Phân tích nội dung cả {plan.length} file (tham khảo)</button>}
              </div>
              <ExtractionPanel state={extraction} onUse={useExtraction} onDismiss={() => setExtraction({ state: 'idle' })} />
            </details>}
          </section>

          <AnchorSection detail={detail} willReset={anchorsWillReset} sourceCount={plan.length} sourcesSaved={!sourcesChanged}
            editing={anchorEditing} dirty={unsaved} onLive={setLiveAnchors} busy={busy || sourceBusy}
            onEdit={() => { setMessage(''); setFailed(''); setSeed(current => ({ anchors: null, flagged: [], notes: [], key: current.key + 1 })); setAnchorEditing(true) }}
            onCancel={() => { setAnchorEditing(false); setSeed(current => ({ ...current, anchors: null, flagged: [], notes: [] })) }} onAccept={anchors => void acceptAnchors(anchors)}
            analyzer={!hasText ? { enabled: false, reason: 'Cần dán lời + hợp âm trước.' }
              : !analyzer ? { enabled: false, reason: 'Chưa bật ở bản này.' }
              : !analyzerReady ? { enabled: false, reason: 'Máy phân tích chưa chạy trên máy này.' }
              : !detail ? { enabled: false, reason: 'Lưu bài (kèm sheet) trước, rồi phân tích vạch nhịp.' }
              : !detail.sources.length ? { enabled: false, reason: 'Cần sheet nguồn (đã lưu) để phân tích.' }
              : dirty ? { enabled: false, reason: 'Lưu các thay đổi trước, rồi mới phân tích.' }
              : { enabled: true, reason: '' }}
            analysis={analysis} seed={seed} onAnalyze={() => void analyze()}
            onUseProposal={() => analysis.result && adoptProposal(analysis.result)} onKeepCurrent={() => setAnalysis({ state: 'idle' })} />
        </details>
      </div>
    </div>
    {lyricsOpen && <ChordLyricsModal initial={form.text} onClose={() => setLyricsOpen(false)}
      onApply={text => { if (text !== form.text) changeText(text); setLyricsOpen(false) }} />}
  </div>
}

type PlanItem = { key: string; kind: 'attached' | 'pending'; name: string; source: ChordSource }
const planOf = (detail: ChordSheetDetail): PlanItem[] =>
  detail.sources.map(source => ({ key: source.path, kind: 'attached', name: `sheet-${String(source.page).padStart(2, '0')}.${source.path.split('.').pop()}`, source }))

/** Vạch nhịp — trạng thái, nút Phân tích (CHƯA bật), trình sửa thủ công, xem lại vạch nhịp đã có. */
function AnchorSection({ detail, willReset, sourceCount, sourcesSaved, editing, dirty, busy, onEdit, onCancel, onAccept, onLive, analyzer, analysis, seed, onAnalyze, onUseProposal, onKeepCurrent }: {
  detail: ChordSheetDetail | null; willReset: boolean; sourceCount: number; sourcesSaved: boolean
  editing: boolean; dirty: boolean; busy: boolean; onEdit: () => void; onCancel: () => void; onAccept: (anchors: ChordAnchors) => void
  onLive: (anchors: ChordAnchors | null) => void
  analyzer: { enabled: boolean; reason: string }
  analysis: { state: 'idle' | 'running' | 'choose' | 'failed'; result?: Extract<MeasureAnalysisResult, { ok: true }>; message?: string }
  seed: { anchors: ChordAnchors | null; flagged: number[]; notes: string[]; key: number }
  onAnalyze: () => void; onUseProposal: () => void; onKeepCurrent: () => void
}) {
  const status = willReset || !detail ? 'none' : detail.anchorsStatus
  const anchors = willReset ? null : detail?.anchors ?? null
  const lines = anchors && detail ? buildMeasureDisplay(detail.text, anchors) : []
  const uncovered = anchors && detail ? uncoveredLines(detail.text, anchors) : []
  const canEdit = !!detail && !dirty && detail.status !== 'discarded'
  return <section className="cl-card" aria-label="Vạch nhịp">
    <h2>Vạch nhịp</h2>
    <Status label="Trạng thái" on={status === 'ready'} yes={ANCHORS_STATUS_LABEL.ready} no={ANCHORS_STATUS_LABEL[status]} />
    <p className="cl-help cl-anchor-src">Nguồn: {sourceCount ? `${sourceCount} file sheet${sourcesSaved ? '' : ' (chưa lưu)'}` : 'chưa có file sheet'}</p>
    <div className="cl-anchor-entry">
      <button type="button" className="cl-secondary cl-analyze" disabled={!analyzer.enabled || busy || analysis.state === 'running' || analysis.state === 'choose'}
        title={analyzer.reason || 'Máy đọc vạch nhịp trên sheet nguồn và điền sẵn vào trình sửa'} onClick={onAnalyze}>
        {analysis.state === 'running' ? 'Đang phân tích…' : 'Phân tích vạch nhịp'}
      </button>
      {!editing && <button type="button" className="cl-secondary" disabled={!canEdit || busy} onClick={onEdit}>Sửa vạch nhịp thủ công</button>}
    </div>
    {!editing && !detail && <p className="cl-placeholder">Lưu bài trước, rồi mới đặt vạch nhịp.</p>}
    {!editing && detail && dirty && <p className="cl-placeholder">Lưu các thay đổi trước, rồi mới sửa vạch nhịp.</p>}
    <p className="cl-help">{analyzer.enabled ? 'Phân tích: máy đọc vạch nhịp trên sheet nguồn, ghép với lời + hợp âm và điền sẵn vào trình sửa — thầy xem bản bên phải, sửa nếu sai rồi mới Chấp nhận.' : `Tính năng phân tích sẽ đọc các vạch nhịp trên bản nhạc và ghép chúng với lời + hợp âm.${analyzer.reason ? ` (${analyzer.reason})` : ''}`}</p>
    {analysis.state === 'failed' && <p className="cl-error" role="alert">Phân tích không thành công: {analysis.message} — vẫn đặt vạch thủ công được như bình thường.</p>}
    {analysis.state === 'choose' && analysis.result && <div className="cl-analysis-choice" role="group" aria-label="Kết quả phân tích">
      <p className="cl-warn" role="note"><strong>{analysis.result.review.needsReview ? 'Phân tích cần kiểm tra' : 'Đã có đề xuất mới'}</strong> — máy đề xuất {analysis.result.anchors.measures.length} ô{analysis.result.anchors.pickup ? ' + nhịp lấy đà' : ''}.
        {analysis.result.review.measures.length > 0 && ` Cần kiểm: ô ${analysis.result.review.measures.join(', ')}.`} Vạch hiện tại chưa bị thay đổi.</p>
      {detail && <UncoveredNotice ranges={uncoveredLines(detail.text, analysis.result.anchors)} where="trong đề xuất" />}
      {analysis.result.review.notes.map(note => <p key={note} className="cl-help">{note}</p>)}
      <div className="cl-anchor-buttons">
        <button type="button" className="cl-secondary cl-approve" onClick={onUseProposal}>Dùng đề xuất</button>
        <button type="button" className="cl-secondary" onClick={onKeepCurrent}>Giữ vạch hiện tại</button>
      </div>
    </div>}
    {editing && detail
      ? <AnchorEditor key={seed.key} text={detail.text} initial={seed.anchors ?? detail.anchors} flagged={seed.anchors ? seed.flagged : []} notes={seed.anchors ? seed.notes : []}
          busy={busy} onAccept={onAccept} onCancel={onCancel} onChange={onLive} />
      : <div className="cl-anchor-view" aria-label="Xem vạch nhịp">
        {lines.length
          ? <><UncoveredNotice ranges={uncovered} where="đã lưu" /><MeasureSheet rows={lines} label="Vạch nhịp theo ô" /></>
          : <p className="cl-placeholder">{willReset ? 'Lời đã đổi — vạch nhịp cũ không còn khớp, cần đặt lại sau khi lưu.' : detail?.hasAnchors && !anchors ? 'Dữ liệu vạch nhịp không đọc được theo lời hiện tại.' : 'Chưa có dữ liệu vạch nhịp.'}</p>}
      </div>}
  </section>
}

const READING_LABEL: Record<ExtractionProposal['reading'], string> = {
  text_layer: 'đọc từ lớp chữ của PDF', ocr: 'đọc bằng OCR (nhận dạng ảnh)', mixed: 'lẫn lớp chữ PDF và OCR', vision: 'đọc bằng AI thị giác', unknown: 'không rõ cách đọc',
}
/** Kết quả phân tích nội dung — chỉ đề xuất; nút "Dùng kết quả này" điền form, không lưu. */
function ExtractionPanel({ state, onUse, onDismiss }: { state: { state: 'idle' | 'running' | 'failed' | 'done'; label?: string; message?: string; proposal?: ExtractionProposal }; onUse: () => void; onDismiss: () => void }) {
  if (state.state === 'idle') return null
  if (state.state === 'running') return <p className="cl-help" role="status" aria-live="polite">Đang phân tích {state.label}… (vài chục giây)</p>
  if (state.state === 'failed') return <div className="cl-card cl-extract" role="alert"><p className="cl-error">Phân tích không thành công. {state.message}</p>
    <button type="button" className="cl-secondary" onClick={onDismiss}>Đóng</button></div>
  const p = state.proposal!
  return <section className="cl-card cl-extract" aria-label="Kết quả đọc nội dung sheet (tham khảo)">
    <h3>Kết quả đọc nội dung sheet (tham khảo)</h3>
    <p className="cl-help">Chữ OCR có thể sai chính tả — chỉ để tham khảo, không phải lời chuẩn.</p>
    <ul className="cl-extract-facts">
      <li>Cách đọc: {READING_LABEL[p.reading]} · {p.pageCount} trang</li>
      <li>Hợp âm: {p.chords === 'DETECTED' ? `thấy ${p.chordCount} hợp âm` : p.chords === 'NO_CHORDS_DETECTED' ? 'KHÔNG thấy hợp âm in trên sheet' : 'chưa rõ'}</li>
      <li>Tên bài: {p.title ?? '(không nhận ra)'} · Tác giả: {p.author ?? '(không nhận ra)'} · BPM: {p.bpm ?? '(không thấy)'}</li>
      <li>Nhịp: máy không đọc được — thầy tự chọn.</li>
    </ul>
    {p.warnings.filter(w => w.code !== 'METER_UNREADABLE').length > 0 && <ul className="cl-warn" aria-label="Cảnh báo của máy">
      {p.warnings.filter(w => w.code !== 'METER_UNREADABLE').map(w => <li key={w.code}>{w.message}</li>)}
    </ul>}
    {p.text.trim() ? <pre className="cl-extract-text" aria-label="Bản nháp máy đọc">{p.text}</pre> : <p className="cl-placeholder">Máy không đọc được lời nào.</p>}
    <div className="cl-src-actions">
      <button type="button" className="cl-primary" disabled={!p.text.trim() && p.title === null && p.author === null && p.bpm === null} onClick={onUse}>Dùng kết quả này</button>
      <button type="button" className="cl-secondary" onClick={onDismiss}>Bỏ qua</button>
    </div>
  </section>
}
