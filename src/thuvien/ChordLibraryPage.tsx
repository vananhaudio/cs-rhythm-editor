import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { DISABLED_MESSAGE, getChordLibrary } from './chordLibrary.ts'
import type { ChordLibrary, ChordSheetDetail, ChordSheetSummary } from './chordLibrary.ts'
import { BPM_RANGE, METER_CHOICES, canonicalChordText, chordTextIssues, formatMeter, listChords, parseBpm, parseChordText, parseMeter, validateChordDraft } from './chordText.ts'
import type { ChordDraft, ChordDraftErrors } from './chordText.ts'
import { NEW_CHORD_SHEET, chordSheetFromSearch, sectionUrl } from './sections.ts'
import { MAX_SOURCE_FILES, SOURCE_ACCEPT, formatBytes, nextFreeIndex, parseSourcePath, sha256Hex, sourceErrorMessage, sourceFileProblem, sourceKindLabel, sourceMimeOf, sourcePath } from './chordSources.ts'
import type { ChordSource } from './chordSources.ts'
import { ANCHORS_STATUS_LABEL, renderAnchors } from './chordAnchors.ts'

// Mục "Hợp âm chuẩn hóa" của /thuvien — bàn làm việc của thầy: tìm, thêm, sửa lời + hợp âm.
// Mọi đọc/ghi đi qua `library` (src/thuvien/chordLibrary.ts); component không biết Supabase.
// CSS: ./ChordLibrary.css, nạp ở ThuVienPage.

type Props = { tabs?: ReactNode; library?: ChordLibrary }

export default function ChordLibraryPage({ tabs, library = getChordLibrary() }: Props) {
  const [open, setOpen] = useState<string | null>(() => chordSheetFromSearch(window.location.search))
  const [notice, setNotice] = useState('')

  // Nút Back của trình duyệt đóng/mở bài theo `?hopam=`.
  useEffect(() => {
    const sync = () => setOpen(chordSheetFromSearch(window.location.search))
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  function go(target: string | null) {
    window.history.pushState({ thuvienChord: true }, '', sectionUrl(window.location.href, 'chords', target))
    setOpen(target)
    window.scrollTo(0, 0)
  }

  // Bản production mà backend chưa bật: nói thẳng, không cho nhập — không bao giờ lặng lẽ lưu vào trình duyệt.
  if (library.mode === 'disabled') return <main className="tv-chords">
    {tabs}
    <div className="cl-wrap">
      <header className="cl-head"><h1>HỢP ÂM CHUẨN HÓA</h1><a href="/admin">Quản trị</a></header>
      <p className="cl-notice cl-notice-bad" role="alert">{DISABLED_MESSAGE}</p>
    </div>
  </main>

  return <main className="tv-chords">
    {open
      ? <ChordEditor key={open} library={library} versionId={open === NEW_CHORD_SHEET ? null : open}
          onOpenVersion={id => go(id)}
          onClose={message => { setNotice(message ?? ''); go(null) }}
          // Lưu xong chỉ đổi địa chỉ (để tải lại trang vẫn mở đúng bài) — KHÔNG dựng lại editor, kẻo mất thông báo "Đã lưu".
          onSaved={detail => window.history.replaceState(window.history.state, '', sectionUrl(window.location.href, 'chords', detail.versionId))} />
      : <ChordList tabs={tabs} library={library} notice={notice} onOpen={id => { setNotice(''); go(id) }} />}
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
function ChordList({ tabs, library, notice, onOpen }: { tabs?: ReactNode; library: ChordLibrary; notice: string; onOpen: (id: string) => void }) {
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
    {tabs}
    <div className="cl-wrap">
      <header className="cl-head">
        <h1>HỢP ÂM CHUẨN HÓA</h1>
        <a href="/admin">Quản trị</a>
      </header>
      <MockBanner library={library} onReset={() => { library.resetMock?.(); setQuery(''); setState('loading'); setReload(n => n + 1) }} />
      <div className="cl-actions">
        <button type="button" className="cl-primary" onClick={() => onOpen(NEW_CHORD_SHEET)}>+ Thêm bài</button>
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
          <button type="button" className="cl-open" onClick={() => onOpen(item.versionId)} aria-label={`Mở bài ${item.title}`}>Mở</button>
        </li>)}
        {state === 'loading' && <li className="cl-empty" aria-live="polite">Đang tải danh sách…</li>}
        {state === 'error' && <li className="cl-empty" role="alert">{error} <button type="button" className="cl-link" onClick={() => { setState('loading'); setReload(n => n + 1) }}>Thử lại</button></li>}
        {state === 'ready' && !items.length && <li className="cl-empty">{query.trim() ? 'Không tìm thấy bài phù hợp. Bấm “+ Thêm bài” để thêm.' : 'Chưa có bài nào.'}</li>}
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

function ChordEditor({ library, versionId, onClose, onSaved, onOpenVersion }: {
  library: ChordLibrary
  versionId: string | null
  onClose: (message?: string) => void
  onSaved: (detail: ChordSheetDetail) => void
  onOpenVersion: (versionId: string) => void
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

  useEffect(() => {
    if (!versionId) return
    let active = true
    library.getChordSheet(versionId).then(data => {
      if (!active) return
      setDetail(data); setSaved(formOf(data)); setForm(formOf(data)); setPlan(planOf(data)); setLoad('ready')
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
  // Sửa lời là neo vạch nhịp cũ hết hiệu lực — báo trước khi lưu, không để mất trong im lặng.
  const anchorsWillReset = !!detail?.hasAnchors && canonicalChordText(form.text) !== canonicalChordText(saved.text)
  const mock = library.mode === 'mock'

  /** Rời bài: còn thay đổi → hỏi; file đã nạp mà chưa lưu → xoá luôn (không để file mồ côi chiếm hạn mức). */
  async function leave(then: () => void) {
    const ask = pending.length
      ? `Có ${pending.length} file nguồn đã nạp nhưng chưa lưu — rời khỏi sẽ xoá các file này. Rời khỏi bài?`
      : 'Có thay đổi chưa lưu. Rời khỏi bài này?'
    if (dirty && !window.confirm(ask)) return
    for (const item of pending) { try { await library.sources.remove(item.source.path) } catch { /* đã gắn hoặc đã mất: bỏ qua */ } }
    then()
  }
  const close = () => void leave(() => onClose())

  const adopt = (next: ChordSheetDetail) => {
    setDetail(next); setSaved(formOf(next)); setForm(formOf(next)); setPlan(planOf(next)); setSourceError('')
    setDraftId(library.newVersionId())
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
    if (detail && !dirty) { setMessage('Chưa có thay đổi nào để lưu.'); return }
    setBusy(true)
    try {
      const needsVersion = !detail || contentChanged || sourcesChanged
      let sources: ChordSource[] = []
      if (needsVersion && plan.length) {
        const owner = await library.sources.ownerId()
        sources = (await carryAttached(owner)).map((item, at) => ({ ...item.source, page: at + 1 }))
      }
      const options = { versionId: draftId, sources }
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
      setFailed(cause instanceof Error ? sourceErrorMessage(cause.message) : 'Không lưu được.')
    } finally { setBusy(false) }
  }

  /** Máy chủ báo trùng (trả phiên bản khác draftId) → file vừa đưa vào thư mục draftId không gắn vào đâu: dọn. */
  async function afterVersion(next: ChordSheetDetail, sources: ChordSource[]) {
    if (next.versionId === draftId) return
    for (const source of sources) { try { await library.sources.remove(source.path) } catch { /* bỏ qua */ } }
  }

  async function addFiles(files: File[]) {
    if (!files.length || sourceBusy) return
    setSourceBusy(true); setSourceError(''); setMessage('')
    const problems: string[] = []
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

  return <div className="cl-wrap cl-wrap-wide">
    <header className="cl-editor-head">
      <button type="button" className="cl-back" onClick={close}>← Danh sách</button>
      <h1>{detail ? detail.title : 'Thêm bài'}</h1>
      <button type="button" className="cl-primary" onClick={() => void save()} disabled={busy || sourceBusy}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
    </header>
    <MockBanner library={library} />
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
    {message && <p role="status" className="cl-notice">{message}</p>}
    {failed && <p role="alert" className="cl-notice cl-notice-bad">{failed}</p>}

    <div className="cl-editor">
      <div className="cl-col">
        <section className="cl-card" aria-label="Thông tin bài">
          <h2>Hợp âm chuẩn hóa</h2>
          <div className="cl-fields">
            <label className="cl-field cl-field-wide">Tên bài *
              <input value={form.title} onChange={event => set({ title: event.target.value })} aria-invalid={!!errors.title} maxLength={220} />
              {errors.title && <span className="cl-error">{errors.title}</span>}
            </label>
            <label className="cl-field cl-field-wide">Tác giả
              <input value={form.composer} onChange={event => set({ composer: event.target.value })} aria-invalid={!!errors.composer} maxLength={220} />
              {errors.composer && <span className="cl-error">{errors.composer}</span>}
            </label>
            <label className="cl-field">Nhịp
              <select value={form.meter} onChange={event => set({ meter: event.target.value })}>
                <option value="">— Chưa rõ</option>
                {meterChoices.map(meter => <option key={meter} value={meter}>{meter}</option>)}
              </select>
            </label>
            <label className="cl-field">BPM gợi ý
              <input value={form.bpm} onChange={event => set({ bpm: event.target.value })} inputMode="numeric" placeholder={`${BPM_RANGE.min}–${BPM_RANGE.max}`} aria-invalid={!!errors.suggestedBpm} />
              {errors.suggestedBpm && <span className="cl-error">{errors.suggestedBpm}</span>}
            </label>
          </div>
        </section>

        <section className="cl-card" aria-label="Lời và hợp âm">
          <h2>Lời + hợp âm *</h2>
          <p className="cl-help">Đặt hợp âm trong ngoặc vuông, ngay trước chữ đổi hợp âm: <code>Chiều [Am] nao, tiễn nhau [E7] đi</code>. Mỗi câu một dòng. Nhãn như <code>1.</code> hay <code>ĐK:</code> viết ở đầu dòng.</p>
          <textarea value={form.text} onChange={event => set({ text: event.target.value })} aria-label="Ô soạn lời và hợp âm" aria-invalid={!!errors.text}
            spellCheck={false} rows={14} placeholder={'1. [C] Câu hát đầu [Am] tiên\n[F] Câu tiếp [G] theo'} />
          {errors.text && <span className="cl-error">{errors.text}</span>}
          {issues.length > 0 && <p className="cl-warn" role="note">Dòng {issues.join(', ')}: còn ngoặc vuông chưa thành hợp âm (thiếu ngoặc đóng, hoặc để trống).</p>}
          {anchorsWillReset && <p className="cl-warn" role="note">Bài này đã có vạch nhịp theo lời cũ. Lưu lời mới thì vạch nhịp phải làm lại.</p>}
        </section>

        <AnchorSection detail={detail} willReset={anchorsWillReset} sourceCount={plan.length} sourcesSaved={!sourcesChanged} />

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
        </section>
      </div>

      <section className="cl-card cl-preview" aria-label="Xem thử">
        <h2>Xem thử</h2>
        {hasText
          ? <>
            {chords.length > 0 && <p className="cl-chordset">Hợp âm trong bài: {chords.map(chord => <span key={chord}>{chord}</span>)}</p>}
            <div className="cl-sheet">
              {lines.map((line, index) => line.length
                ? <p key={index} className="cl-line" data-chords={line.some(segment => segment.chord !== null)}>{line.map((segment, at) =>
                    <span key={at} className="cl-seg"><span className="cl-chord">{segment.chord ?? '\u00a0'}</span><span className="cl-lyric">{segment.text || '\u00a0'}</span></span>)}</p>
                : <p key={index} className="cl-line cl-line-gap" aria-hidden="true" />)}
            </div>
          </>
          : <p className="cl-placeholder">Nhập lời + hợp âm để xem thử.</p>}
      </section>
    </div>
  </div>
}

type PlanItem = { key: string; kind: 'attached' | 'pending'; name: string; source: ChordSource }
const planOf = (detail: ChordSheetDetail): PlanItem[] =>
  detail.sources.map(source => ({ key: source.path, kind: 'attached', name: `sheet-${String(source.page).padStart(2, '0')}.${source.path.split('.').pop()}`, source }))

/** Vạch nhịp — khung cho lát phân tích sau: trạng thái, nguồn, nút Phân tích (chưa bật), xem lại vạch nhịp đã có. */
function AnchorSection({ detail, willReset, sourceCount, sourcesSaved }: { detail: ChordSheetDetail | null; willReset: boolean; sourceCount: number; sourcesSaved: boolean }) {
  const status = willReset || !detail ? 'none' : detail.anchorsStatus
  const anchors = willReset ? null : detail?.anchors ?? null
  const lines = anchors && detail ? renderAnchors(detail.text, anchors) : []
  return <section className="cl-card" aria-label="Vạch nhịp">
    <h2>Vạch nhịp</h2>
    <Status label="Trạng thái" on={status === 'ready'} yes={ANCHORS_STATUS_LABEL.ready} no={ANCHORS_STATUS_LABEL[status]} />
    <p className="cl-help cl-anchor-src">Nguồn: {sourceCount ? `${sourceCount} file sheet${sourcesSaved ? '' : ' (chưa lưu)'}` : 'chưa có file sheet'}</p>
    <button type="button" className="cl-secondary cl-analyze" disabled title="Sẽ có ở bước tiếp theo">Phân tích vạch nhịp</button>
    <p className="cl-help">Tính năng phân tích sẽ đọc các vạch nhịp trên bản nhạc và ghép chúng với lời + hợp âm.</p>
    <div className="cl-anchor-view" aria-label="Xem vạch nhịp">
      {lines.length
        ? lines.map((line, at) => <p key={at} className="cl-anchor-line">{line.label && <span className="cl-anchor-label">{line.label}</span>}{line.text}</p>)
        : <p className="cl-placeholder">{willReset ? 'Lời đã đổi — vạch nhịp cũ không còn khớp, cần phân tích lại sau khi lưu.' : detail?.hasAnchors && !anchors ? 'Dữ liệu vạch nhịp không đọc được theo lời hiện tại.' : 'Chưa có dữ liệu vạch nhịp.'}</p>}
    </div>
  </section>
}
