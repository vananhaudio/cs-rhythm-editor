import { useState, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import SheetMusic from './components/SheetMusic'
import LyricsPreview from './components/LyricsPreview'
import { parseMusicXML } from './parsers/musicxml'
import { parseGuitarPro } from './parsers/guitarPro'
import { parseLyrics, resolveChordTimings } from './parsers/lyrics'
import { autoMatch } from './logic/autoMatch'
import { exportV2, downloadJson } from './logic/exporter'
import type { Project, NoteData, WordData, ChordData, MappingData, ProjectMetadata } from './xmlTypes'

const C = {
  bg: '#0F1117', surface: '#1A1E2A', surface2: '#232838',
  border: '#2D3447', text: '#F1F5F9', text2: '#94A3B8', text3: '#64748B',
  green: '#10B981', greenDark: '#065F46', greenBg: '#0D2A1F',
  amber: '#F59E0B', blue: '#3B82F6', red: '#EF4444',
  accent: '#6366F1',
}

const defaultMeta: ProjectMetadata = {
  title: '', artist: '', tone: 'Am', tempo: 80, timeSignature: 4, totalBars: 0
}

type Step = 'upload' | 'lyrics' | 'preview' | 'done'

interface Props { onClose?: () => void }

export default function ImportPage({ onClose }: Props) {
  const [step, setStep]         = useState<Step>('upload')
  const [notes, setNotes]       = useState<NoteData[]>([])
  const [words, setWords]       = useState<WordData[]>([])
  const [chords, setChords]     = useState<ChordData[]>([])
  const [mappings, setMappings] = useState<MappingData[]>([])
  const [meta, setMeta]         = useState<ProjectMetadata>(defaultMeta)
  const [sheetSource, setSheetSource] = useState<{ type: 'gp'; buffer: ArrayBuffer } | { type: 'xml'; text: string } | null>(null)
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null)
  const [lyricsText, setLyricsText] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [savedMsg, setSavedMsg] = useState('')
  const [jsonPreview, setJsonPreview] = useState('')
  const chordWordIndexRef = useRef<Map<string, number>>(new Map())

  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    e.target.value = ''; setLoading(true); setError('')
    const isGP = /\.(gp\d?|gpx)$/i.test(file.name)
    try {
      let result: { notes: NoteData[]; chords: ChordData[]; embeddedWords?: WordData[]; metadata: Partial<ProjectMetadata> }
      if (isGP) {
        const buf = await file.arrayBuffer()
        result = await parseGuitarPro(buf)
        setSheetSource({ type: 'gp', buffer: buf })
      } else {
        const text = await file.text()
        result = parseMusicXML(text)
        setSheetSource({ type: 'xml', text })
      }
      setNotes(result.notes)
      setChords(result.chords)
      setMeta(prev => ({ ...prev, ...result.metadata, title: result.metadata.title || file.name.replace(/\.[^.]+$/, '') }))

      if ((result.embeddedWords ?? []).length > 0) {
        // Có lời embedded — match luôn
        const matched = autoMatch(result.notes, result.embeddedWords!)
        setWords(matched.updatedWords ?? result.embeddedWords!)
        setMappings(matched.mappings)
        buildPreview({ notes: result.notes, words: matched.updatedWords ?? [], chords: result.chords, mappings: matched.mappings, metadata: { ...defaultMeta, ...result.metadata } })
        setStep('preview')
      } else {
        setStep('lyrics')
      }
    } catch (err: any) {
      setError('Lỗi đọc file: ' + err.message)
    }
    setLoading(false)
  }

  const handleLyrics = () => {
    if (!lyricsText.trim()) return
    setError('')
    try {
      const r = parseLyrics(lyricsText)
      chordWordIndexRef.current = r.chordWordIndex
      const matched = autoMatch(notes, r.words)
      const resolvedChords = resolveChordTimings([...chords, ...r.chords], matched.updatedWords ?? r.words, r.chordWordIndex)
      setWords(matched.updatedWords ?? r.words)
      setChords(resolvedChords)
      setMappings(matched.mappings)
      buildPreview({ notes, words: matched.updatedWords ?? r.words, chords: resolvedChords, mappings: matched.mappings, metadata: meta })
      setStep('preview')
    } catch (err: any) {
      setError('Lỗi parse lời: ' + err.message)
    }
  }

  const buildPreview = useCallback((project: Project) => {
    const json = exportV2(project)
    setJsonPreview(json)
  }, [])

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Chưa đăng nhập')
      const project: Project = { metadata: meta, notes, words, chords, mappings }
      const json = exportV2(project)
      const songData = JSON.parse(json)

      const { error: err } = await supabase.from('timming_songs').upsert({
        title: meta.title || 'Untitled',
        artist: meta.artist || '',
        tone: meta.tone,
        tempo: meta.tempo,
        time_signature: meta.timeSignature,
        created_by: user.id,
        song_data: songData,
        youtube_url: youtubeUrl || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'title,created_by' })

      if (err) throw err
      setSavedMsg(`✅ Đã lưu "${meta.title}" vào thư viện!`)
      setStep('done')
    } catch (err: any) {
      setError('Lỗi lưu: ' + err.message)
    }
    setSaving(false)
  }

  const handleDownload = () => {
    const project: Project = { metadata: meta, notes, words, chords, mappings }
    downloadJson(exportV2(project), `${meta.title || 'song'}.json`)
  }

  const reset = () => { setStep('upload'); setNotes([]); setWords([]); setChords([]); setMappings([]); setMeta(defaultMeta); setLyricsText(''); setError(''); setSavedMsg(''); setJsonPreview('') }

  const S = {
    btn: { border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
    inp: { width: '100%', boxSizing: 'border-box' as const, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' },
  }

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.text, fontFamily: '"Inter", system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎼</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Sheet Import</div>
          <div style={{ fontSize: 11, color: C.text3 }}>Tạo file JSON chuẩn từ sheet nhạc</div>
        </div>
        {/* Steps */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          {(['upload', 'lyrics', 'preview', 'done'] as Step[]).map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: step === s ? C.green : (['upload','lyrics','preview','done'] as Step[]).indexOf(step) > i ? C.greenDark : C.surface2, color: step === s ? '#fff' : C.text3 }}>{i+1}</div>
              {i < 3 && <div style={{ width: 20, height: 1, background: C.border }} />}
            </div>
          ))}
        </div>
        {onClose && <button onClick={onClose} style={{ ...S.btn, background: C.surface2, color: C.text2, padding: '6px 12px', marginLeft: 8 }}>✕</button>}
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>

        {/* STEP 1 — Upload */}
        {step === 'upload' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Bước 1 — Nạp sheet nhạc</div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: 28 }}>Hỗ trợ MusicXML (.xml, .musicxml) và Guitar Pro (.gp, .gp3–.gp7, .gpx)</div>
            <div onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${C.border}`, borderRadius: 16, padding: '48px', textAlign: 'center', cursor: 'pointer', transition: 'border .2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = C.green)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎼</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Click để chọn file</div>
              <div style={{ fontSize: 12, color: C.text3 }}>.xml · .musicxml · .gp · .gp3 · .gp4 · .gp5 · .gp7 · .gpx</div>
            </div>
            <input ref={fileRef} type="file" accept=".xml,.musicxml,.gp,.gp3,.gp4,.gp5,.gp6,.gp7,.gp8,.gpx" style={{ display: 'none' }} onChange={handleFile} />
            {loading && <div style={{ textAlign: 'center', marginTop: 20, color: C.green }}>⏳ Đang phân tích file...</div>}
            {error && <div style={{ marginTop: 16, background: '#2A1A1A', border: `1px solid ${C.red}33`, borderRadius: 10, padding: '12px 16px', color: C.red, fontSize: 13 }}>{error}</div>}
          </div>
        )}

        {/* STEP 2 — Lyrics */}
        {step === 'lyrics' && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Bước 2 — Dán lời & hợp âm</div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: 20 }}>
              Đã nạp <span style={{ color: C.green, fontWeight: 700 }}>{notes.length} nốt</span> · {meta.tempo} BPM · {meta.timeSignature}/4 · {meta.totalBars} bars
            </div>
            {/* Meta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              {([['title','Tên bài'],['artist','Nghệ sĩ'],['tone','Giọng']] as [keyof ProjectMetadata, string][]).map(([key, label]) => (
                <div key={key}>
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: 6, fontWeight: 600 }}>{label}</div>
                  <input value={String(meta[key] ?? '')} onChange={e => setMeta(prev => ({ ...prev, [key]: e.target.value }))} style={S.inp} placeholder={label} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 6, fontWeight: 600 }}>Lời & hợp âm (format HợpÂmViệt)</div>
              <textarea value={lyricsText} onChange={e => setLyricsText(e.target.value)} rows={10} autoFocus
                placeholder={`[Am] Về thăm thành phố náo nức mùa xuân\n[Dm] Ba lô trên lưng mang theo nhánh lan rừng\n[G] Những con đường quen thuộc ngày xưa`}
                style={{ ...S.inp, resize: 'vertical', lineHeight: 1.8, fontFamily: 'monospace' }} />
            </div>
            {error && <div style={{ marginBottom: 16, background: '#2A1A1A', border: `1px solid ${C.red}33`, borderRadius: 10, padding: '12px 16px', color: C.red, fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('upload')} style={{ ...S.btn, background: C.surface2, color: C.text2 }}>← Quay lại</button>
              <button onClick={handleLyrics} disabled={!lyricsText.trim()} style={{ ...S.btn, background: C.green, color: '#fff', flex: 1, opacity: lyricsText.trim() ? 1 : 0.5 }}>⚡ Auto Match →</button>
            </div>
          </div>
        )}

        {/* STEP 3 — Preview 2 cột */}
        {step === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: 'calc(100dvh - 200px)', minHeight: 500 }}>
            {/* Meta bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              {[['Tên bài', meta.title||'—'],['Nghệ sĩ', meta.artist||'—'],['Tempo', meta.tempo+' BPM'],['Giọng', meta.tone]].map(([k,v]) => (
                <div key={k} style={{ background: C.surface, borderRadius: 8, padding: '6px 12px', border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 9, color: C.text3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{k}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginTop: 1 }}>{v}</div>
                </div>
              ))}
              <input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="Link YouTube (tuỳ chọn)..."
                style={{ ...S.inp, flex: 1, minWidth: 200, height: 36 }} />
            </div>

            {/* 2-column layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, flex: 1, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              {/* Trái — Sheet nhạc */}
              <div style={{ borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '8px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, background: C.surface2, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.text2, textTransform: 'uppercase', letterSpacing: '.06em' }}>🎼 Sheet nhạc</span>
                  <span style={{ fontSize: 10, background: '#0D2A1F', color: C.green, borderRadius: 6, padding: '2px 8px', marginLeft: 'auto' }}>{notes.length} nốt</span>
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <SheetMusic
                    source={sheetSource}
                    notes={notes}
                    words={words}
                    chords={chords}
                    mappings={mappings}
                    selectedWordId={selectedWordId}
                    isVisible={step === 'preview'}
                  />
                </div>
              </div>

              {/* Phải — Lời theo nhịp */}
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '8px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, background: C.surface2, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.text2, textTransform: 'uppercase', letterSpacing: '.06em' }}>📝 Lời theo nhịp</span>
                  <span style={{ fontSize: 10, background: '#0D2A1F', color: C.green, borderRadius: 6, padding: '2px 8px', marginLeft: 'auto' }}>
                    {mappings.length}/{words.length} từ
                  </span>
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <LyricsPreview
                    metadata={meta}
                    notes={notes}
                    words={words}
                    chords={chords}
                    mappings={mappings}
                    selectedWordId={selectedWordId}
                    onSelectWord={setSelectedWordId}
                  />
                </div>
              </div>
            </div>

            {error && <div style={{ marginTop: 10, background: '#2A1A1A', border: `1px solid ${C.red}33`, borderRadius: 10, padding: '10px 14px', color: C.red, fontSize: 12 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button onClick={() => setStep('lyrics')} style={{ ...S.btn, background: C.surface2, color: C.text2 }}>← Sửa lời</button>
              <button onClick={handleDownload} style={{ ...S.btn, background: C.surface2, color: C.text2 }}>⬇ Download JSON</button>
              <button onClick={handleSave} disabled={saving} style={{ ...S.btn, background: C.green, color: '#fff', flex: 1, opacity: saving ? 0.6 : 1 }}>
                {saving ? '⏳ Đang lưu...' : '☁️ Lưu lên thư viện'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 — Done */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>{savedMsg}</div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: 32 }}>JSON v2.1 với tick-based timing đã được lưu vào hệ thống</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={handleDownload} style={{ ...S.btn, background: C.surface2, color: C.text2 }}>⬇ Download JSON</button>
              <button onClick={reset} style={{ ...S.btn, background: C.green, color: '#fff' }}>+ Import bài khác</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
