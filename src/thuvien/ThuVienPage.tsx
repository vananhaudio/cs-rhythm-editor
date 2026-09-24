import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { importMusicXml, listLibrary, prepareMusicXml } from './masterLibrary.ts'
import type { LibraryItem } from './masterLibrary.ts'
import './ThuVienPage.css'

type Prepared = ReturnType<typeof prepareMusicXml>

export default function ThuVienPage() {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [query, setQuery] = useState('')
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [title, setTitle] = useState('')
  const [composer, setComposer] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    listLibrary().then(data => { if (active) setItems(data) })
      .catch(error => { if (active) setMessage(error instanceof Error ? error.message : 'Không tải được thư viện.') })
    return () => { active = false }
  }, [])

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setMessage('')
    setPrepared(null)
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('File phải có dung lượng từ 1 byte đến 5 MB.')
      const next = prepareMusicXml(file.name, await file.text())
      setPrepared(next)
      setTitle(next.metadata.title)
      setComposer(next.metadata.composer ?? '')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không đọc được file MusicXML.')
    } finally { setBusy(false) }
  }

  async function save() {
    if (!prepared || busy) return
    setBusy(true)
    setMessage('')
    try {
      const item = await importMusicXml(prepared, title, composer)
      setItems(current => [item, ...current])
      setPrepared(null)
      setMessage(`Đã thêm “${item.title}” vào thư viện.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thêm được bản nhạc.')
    } finally { setBusy(false) }
  }

  const shown = items.filter(item => item.title.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')))
  return <main className="thu-vien min-h-screen bg-[#f7f5ef] px-4 py-8 text-[#26352d] sm:px-8">
    <div className="mx-auto max-w-4xl">
      <div className="mb-7 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">THƯ VIỆN BẢN NHẠC</h1>
        <a href="/admin" className="text-sm underline">Quản trị</a>
      </div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}
          className="rounded-lg bg-[#32664a] px-5 py-3 font-semibold text-white disabled:opacity-50">+ Thêm bản nhạc</button>
        <input ref={fileInput} type="file" accept=".musicxml,.xml" onChange={event => void chooseFile(event)} className="sr-only" aria-label="Chọn file MusicXML" />
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên bài..." aria-label="Tìm tên bài"
          className="min-w-0 flex-1 rounded-lg border border-[#ccd5ca] bg-white px-4 py-3" />
      </div>
      {message && <p role="status" className="mb-5 rounded-lg bg-white p-3">{message}</p>}
      {prepared && <section className="mb-6 rounded-xl border border-[#ccd5ca] bg-white p-5" aria-label="Thông tin bản nhạc">
        <h2 className="mb-4 text-lg font-semibold">Thông tin bản nhạc</h2>
        <p className="mb-4 text-sm text-[#526456]">{prepared.filename}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="font-medium">Tên bài<input value={title} onChange={event => setTitle(event.target.value)} className="mt-1 block w-full rounded-lg border border-[#ccd5ca] px-3 py-2" /></label>
          <label className="font-medium">Tác giả<input value={composer} onChange={event => setComposer(event.target.value)} className="mt-1 block w-full rounded-lg border border-[#ccd5ca] px-3 py-2" /></label>
        </div>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={() => void save()} disabled={busy || !title.trim()} className="rounded-lg bg-[#32664a] px-5 py-2 font-semibold text-white disabled:opacity-50">Thêm vào thư viện</button>
          <button type="button" onClick={() => setPrepared(null)} disabled={busy} className="rounded-lg px-4 py-2">Hủy</button>
        </div>
      </section>}
      <div className="overflow-hidden rounded-xl border border-[#d8dfd6] bg-white">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3 bg-[#e9eee7] px-4 py-3 text-sm font-semibold sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_8rem]"><span>Tên bài</span><span>Tác giả</span><span className="hidden sm:block">Ngày thêm</span></div>
        {shown.map(item => <div key={item.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3 border-t border-[#edf0eb] px-4 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_8rem]">
          <span className="break-words font-medium">{item.title}</span><span className="break-words">{item.composer || '—'}</span><time className="hidden sm:block" dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString('vi-VN')}</time>
        </div>)}
        {!shown.length && <p className="px-4 py-8 text-center text-[#526456]">{query ? 'Không tìm thấy bản nhạc.' : 'Thư viện chưa có bản nhạc.'}</p>}
      </div>
    </div>
  </main>
}
