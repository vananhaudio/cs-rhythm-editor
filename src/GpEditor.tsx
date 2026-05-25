import { useState, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import type { RhythmSong, LyricEvent, ChordEvent } from './types'
import { genId } from './utils'

declare const alphaTab: any

type NoteEvent = { time: number; bar: number }
type GpChord = { time: number; name: string }

type ParseResult = {
  title: string
  artist: string
  tempo: number
  timeSignature: number
  totalBars: number
  noteEvents: NoteEvent[]
  gpChords: GpChord[]
  lyricsStartBar: number
}

const TICKS_PER_BEAT = 960

function parseGpFile(score: any): ParseResult {
  const BPM = score.tempo
  const beatDurSec = 60 / BPM
  const timeSigNum = score.masterBars[0].timeSignatureNumerator
  const staff = score.tracks[0].staves[0]
  const noteEvents: NoteEvent[] = []
  const gpChords: GpChord[] = []
  let globalTick = 0

  score.masterBars.forEach((mb: any, bi: number) => {
    const tsNum = mb.timeSignatureNumerator
    const barTicks = tsNum * TICKS_PER_BEAT
    const bar = staff.bars[bi]
    if (!bar) { globalTick += barTicks; return }

    const voice = bar.voices[0]
    let beatTick = globalTick

    voice.beats.forEach((beat: any) => {
      const hasNotes = beat.notes.length > 0
      const isTied = hasNotes && beat.notes[0].isTieDestination
      const timeSec = (beatTick / TICKS_PER_BEAT) * beatDurSec

      if (beat.chord?.name) {
        gpChords.push({ time: +timeSec.toFixed(3), name: beat.chord.name })
      }

      if (hasNotes && !isTied) {
        noteEvents.push({ time: +timeSec.toFixed(3), bar: bi + 1 })
      }

      beatTick += beat.playbackDuration
    })

    globalTick += barTicks
  })

  return {
    title: score.title || '',
    artist: score.artist || '',
    tempo: BPM,
    timeSignature: timeSigNum,
    totalBars: score.masterBars.length,
    noteEvents,
    gpChords,
    lyricsStartBar: 1,
  }
}

function parseHopAmViet(text: string): { words: string[]; chords: { text: string; wordIndex: number }[] } {
  const words: string[] = []
  const chords: { text: string; wordIndex: number }[] = []
  const regex = /\[([^\]]+)\]|([^\[\]\s]+)/g
  let match
  let pendingChord: string | null = null

  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      pendingChord = match[1]
    } else if (match[2]) {
      if (pendingChord) {
        chords.push({ text: pendingChord, wordIndex: words.length })
        pendingChord = null
      }
      words.push(match[2])
    }
  }
  return { words, chords }
}

function buildSong(parsed: ParseResult, hopAmText: string, lyricsStartBar: number): RhythmSong {
  const { words, chords: hopAmChords } = parseHopAmViet(hopAmText)
  const { noteEvents, gpChords, tempo, timeSignature, totalBars, title, artist } = parsed

  const filteredNotes = noteEvents.filter(n => n.bar >= lyricsStartBar)

  const lyrics: LyricEvent[] = words.map((text, i) => ({
    id: genId(),
    text,
    time: filteredNotes[i]?.time ?? (i * 60 / tempo),
  }))

  // Chords: ưu tiên HợpÂmViệt, fallback GP
  let chordEntries: ChordEvent[]

  if (hopAmChords.length > 0) {
    chordEntries = hopAmChords.map(c => ({
      id: genId(),
      name: c.text,
      time: filteredNotes[c.wordIndex]?.time ?? 0,
    }))
  } else {
    chordEntries = gpChords.map(c => ({
      id: genId(),
      name: c.name,
      time: c.time,
    }))
  }

  chordEntries.sort((a, b) => a.time - b.time)

  return {
    title,
    artist,
    tone: '',
    tempo,
    timeSignature: timeSignature as 2 | 3 | 4 | 6,
    totalBars,
    lyrics,
    chords: chordEntries,
    beats: [],
    version: '2.0' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function GpEditor({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'upload' | 'lyrics' | 'preview' | 'done'>('upload')
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [hopAmText, setHopAmText] = useState('')
  const [lyricsStartBar, setLyricsStartBar] = useState(1)
  const [song, setSong] = useState<RhythmSong | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadAlphaTab = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).alphaTab) { resolve(); return }
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/alphaTab.min.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Không load được AlphaTab'))
      document.head.appendChild(script)
    })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setError('')
    try {
      await loadAlphaTab()
      const buffer = await file.arrayBuffer()
      const uint8 = new Uint8Array(buffer)
      const settings = new (window as any).alphaTab.Settings()
      const score = (window as any).alphaTab.importer.ScoreLoader.loadScoreFromBytes(uint8, settings)
      const result = parseGpFile(score)
      setParsed(result)
      setStep('lyrics')
    } catch (err: any) {
      setError('Lỗi đọc file: ' + err.message)
    } finally {
      setLoading(false); e.target.value = ''
    }
  }

  const handlePreview = useCallback(() => {
    if (!parsed) return
    const s = buildSong(parsed, hopAmText, lyricsStartBar)
    setSong(s); setStep('preview')
  }, [parsed, hopAmText, lyricsStartBar])

  const handleUpload = async () => {
    if (!song) return
    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploadMsg('Chưa đăng nhập!'); setUploading(false); return }

    const { error } = await supabase.from('timming_songs').upsert({
      title: song.title,
      artist: song.artist || '',
      tone: song.tone || '',
      tempo: song.tempo,
      time_signature: song.timeSignature,
      created_by: user.id,
      song_data: song,
      youtube_url: youtubeUrl || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'title,created_by' })

    setUploading(false)
    if (error) { setUploadMsg('❌ ' + error.message) }
    else { setUploadMsg('✅ Upload thành công!'); setStep('done') }
  }

  const filteredNoteCount = parsed ? parsed.noteEvents.filter(n => n.bar >= lyricsStartBar).length : 0
  const wordCount = parsed ? parseHopAmViet(hopAmText).words.length : 0

  return (
    <div style={{ position:'fixed', inset:0, background:'#0A0E1A', display:'flex', flexDirection:'column', zIndex:300, fontFamily:'Inter, sans-serif', overflow:'auto' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderBottom:'1px solid #1E2533', flexShrink:0 }}>
        <span style={{ fontSize:20 }}>🎸</span>
        <span style={{ color:'#fff', fontWeight:800, fontSize:16 }}>GP Editor — Import từ Guitar Pro</span>
        <div style={{ display:'flex', gap:8, marginLeft:16 }}>
          {['upload','lyrics','preview','done'].map((s, i) => (
            <div key={s} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{
                width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, fontWeight:700,
                background: step===s ? '#10B981' : ['upload','lyrics','preview','done'].indexOf(step)>i ? '#065F46' : '#1E2533',
                color: step===s ? '#fff' : ['upload','lyrics','preview','done'].indexOf(step)>i ? '#10B981' : '#6B7280',
              }}>{i+1}</div>
              <span style={{ fontSize:11, color: step===s?'#10B981':'#6B7280' }}>
                {['Upload GP','Nhập lời','Xem trước','Xong'][i]}
              </span>
              {i < 3 && <span style={{ color:'#374151', fontSize:11 }}>→</span>}
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'1px solid #374151', borderRadius:6, color:'#9CA3AF', cursor:'pointer', padding:'4px 12px' }}>✕</button>
      </div>

      <div style={{ flex:1, padding:24, maxWidth:800, width:'100%', margin:'0 auto' }}>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20, paddingTop:40 }}>
            <div style={{ fontSize:56 }}>🎸</div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:22 }}>Upload file Guitar Pro</div>
            <div style={{ color:'#6B7280', fontSize:14, textAlign:'center' }}>
              Hỗ trợ: <span style={{ color:'#10B981' }}>.gpx · .gp · .gp3 · .gp4 · .gp5 · .gp7</span>
            </div>
            <input ref={fileInputRef} type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx,.gp7" style={{ display:'none' }} onChange={handleFileChange} />
            <button onClick={() => fileInputRef.current?.click()} disabled={loading}
              style={{ padding:'16px 48px', background: loading?'#1E2533':'#10B981', border:'none', borderRadius:12, color:'#fff', fontWeight:800, fontSize:18, cursor: loading?'default':'pointer', boxShadow: loading?'none':'0 0 24px rgba(16,185,129,0.4)' }}>
              {loading ? '⏳ Đang đọc file...' : '📂 Chọn file Guitar Pro'}
            </button>
            {error && <div style={{ color:'#EF4444', fontSize:13, padding:'10px 16px', background:'rgba(239,68,68,0.1)', borderRadius:8 }}>{error}</div>}
            <div style={{ background:'#0F1117', border:'1px solid #1E2533', borderRadius:12, padding:'16px 20px', maxWidth:440, width:'100%' }}>
              {[
                'Track 1 = giai điệu chính (melody)',
                'Nhịp trống đầu bài (intro) sẽ tự tạo',
                'Nốt luyến chỉ tính là 1 từ',
                'Hợp âm lấy từ HợpÂmViệt hoặc GP',
              ].map((t, i) => (
                <div key={i} style={{ display:'flex', gap:8, marginBottom:8 }}>
                  <span style={{ color:'#10B981', fontSize:12 }}>✓</span>
                  <span style={{ color:'#9CA3AF', fontSize:13 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Nhập lời */}
        {step === 'lyrics' && parsed && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            {/* Info */}
            <div style={{ background:'#0F1117', border:'1px solid #1E2533', borderRadius:12, padding:'16px 20px', display:'flex', gap:20, flexWrap:'wrap' }}>
              <div><div style={{ color:'#6B7280', fontSize:10, textTransform:'uppercase' }}>Bài hát</div><div style={{ color:'#fff', fontWeight:700 }}>{parsed.title||'(chưa có tên)'}</div></div>
              <div><div style={{ color:'#6B7280', fontSize:10, textTransform:'uppercase' }}>Tempo</div><div style={{ color:'#10B981', fontWeight:700 }}>{parsed.tempo} BPM · {parsed.timeSignature}/4</div></div>
              <div><div style={{ color:'#6B7280', fontSize:10, textTransform:'uppercase' }}>Tổng bars</div><div style={{ color:'#9CA3AF' }}>{parsed.totalBars} bars</div></div>
              <div><div style={{ color:'#6B7280', fontSize:10, textTransform:'uppercase' }}>Hợp âm GP</div><div style={{ color:'#F59E0B', fontWeight:700 }}>{parsed.gpChords.length} chords</div></div>
            </div>

            {/* Bar bắt đầu lời */}
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', background:'rgba(245,158,11,0.08)', borderRadius:8, border:'1px solid rgba(245,158,11,0.2)' }}>
              <span style={{ color:'#F59E0B', fontSize:13 }}>🎵 Lời bắt đầu từ ô nhịp:</span>
              <input type="number" min={1} max={parsed.totalBars} value={lyricsStartBar}
                onChange={e => setLyricsStartBar(parseInt(e.target.value)||1)}
                style={{ width:60, padding:'4px 8px', background:'#0F1117', border:'1px solid #F59E0B', borderRadius:6, color:'#F59E0B', fontSize:14, fontWeight:700, outline:'none', textAlign:'center' }} />
              <span style={{ color:'#6B7280', fontSize:12 }}>/ {parsed.totalBars} bars · <strong style={{ color:'#fff' }}>{filteredNoteCount}</strong> nốt sẽ có lời</span>
            </div>

            {/* Nhập lời */}
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>📝 Nhập lời (dạng HợpÂmViệt)</div>
                <div style={{ fontSize:12, color: wordCount<=filteredNoteCount?'#10B981':'#EF4444', fontWeight:600 }}>
                  {wordCount}/{filteredNoteCount} từ {wordCount<=filteredNoteCount?'✓':`(thừa ${wordCount-filteredNoteCount})`}
                </div>
              </div>
              <div style={{ color:'#6B7280', fontSize:12, marginBottom:8 }}>
                Dán lời dạng <code style={{ color:'#10B981', background:'rgba(16,185,129,0.1)', padding:'1px 6px', borderRadius:3 }}>[Am]Lời bài hát [F]tiếp theo...</code>
                <br/>Nếu không có HợpÂmViệt, hợp âm sẽ lấy từ file GP.
              </div>
              <textarea value={hopAmText} onChange={e => setHopAmText(e.target.value)}
                placeholder={'[Am]Cỏ dại [F]nở hoa [C]dành dành [G]trắng ngần\n[Am]Em ơi [F]có nghe...'}
                style={{ width:'100%', minHeight:180, padding:'12px 16px', background:'#0F1117', border:'1px solid #374151', borderRadius:10, color:'#fff', fontSize:14, outline:'none', resize:'vertical', lineHeight:1.7, boxSizing:'border-box' }}
                autoFocus />
            </div>

            {/* YouTube */}
            <div>
              <div style={{ color:'#fff', fontWeight:700, fontSize:14, marginBottom:6 }}>▶ Link YouTube (tuỳ chọn)</div>
              <input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://youtu.be/..."
                style={{ width:'100%', padding:'10px 14px', background:'#0F1117', border:'1px solid #374151', borderRadius:8, color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }} />
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setStep('upload')} style={{ padding:'10px 20px', background:'#1E2533', border:'1px solid #374151', borderRadius:8, color:'#9CA3AF', cursor:'pointer', fontWeight:600 }}>← Quay lại</button>
              <button onClick={handlePreview} style={{ flex:1, padding:'12px 20px', background:'#10B981', border:'none', borderRadius:8, color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer' }}>
                Xem trước kết quả →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && song && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ color:'#fff', fontWeight:800, fontSize:18 }}>Xem trước — {song.title}</div>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              {[
                { label:'Lời', value: song.lyrics.length+' từ', color:'#60A5FA' },
                { label:'Chord', value: song.chords.length+' hợp âm', color:'#F59E0B' },
                { label:'Tempo', value: song.tempo+' BPM', color:'#10B981' },
                { label:'Nhịp', value: song.timeSignature+'/4', color:'#A78BFA' },
                { label:'Bars', value: song.totalBars+'', color:'#34D399' },
              ].map(s => (
                <div key={s.label} style={{ background:'#0F1117', border:'1px solid #1E2533', borderRadius:8, padding:'10px 16px', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#6B7280', textTransform:'uppercase' }}>{s.label}</div>
                  <div style={{ fontSize:16, fontWeight:700, color:s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Preview lời */}
            <div style={{ background:'#0F1117', border:'1px solid #1E2533', borderRadius:10, padding:16 }}>
              <div style={{ color:'#6B7280', fontSize:11, marginBottom:10, fontWeight:600, textTransform:'uppercase' }}>Lời + thời gian</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {song.lyrics.slice(0,40).map((l,i) => (
                  <div key={i} style={{ background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.2)', borderRadius:6, padding:'3px 8px', fontSize:12 }}>
                    <span style={{ color:'#60A5FA', fontWeight:600 }}>{l.text}</span>
                    <span style={{ color:'#374151', fontSize:10, marginLeft:4 }}>{l.time.toFixed(1)}s</span>
                  </div>
                ))}
                {song.lyrics.length>40 && <span style={{ color:'#374151', fontSize:12 }}>...+{song.lyrics.length-40} từ</span>}
              </div>
            </div>

            {/* Preview chord */}
            {song.chords.length > 0 && (
              <div style={{ background:'#0F1117', border:'1px solid #1E2533', borderRadius:10, padding:16 }}>
                <div style={{ color:'#6B7280', fontSize:11, marginBottom:10, fontWeight:600, textTransform:'uppercase' }}>Hợp âm</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {song.chords.map((c,i) => (
                    <div key={i} style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:6, padding:'3px 10px', fontSize:13, color:'#F59E0B', fontWeight:700 }}>
                      {c.name}<span style={{ color:'#374151', fontSize:10, marginLeft:4, fontWeight:400 }}>{c.time.toFixed(1)}s</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setStep('lyrics')} style={{ padding:'10px 20px', background:'#1E2533', border:'1px solid #374151', borderRadius:8, color:'#9CA3AF', cursor:'pointer', fontWeight:600 }}>← Sửa lời</button>
              <button onClick={handleUpload} disabled={uploading}
                style={{ flex:1, padding:'12px 20px', background: uploading?'#1E2533':'#10B981', border:'none', borderRadius:8, color:'#fff', fontWeight:800, fontSize:15, cursor: uploading?'default':'pointer' }}>
                {uploading ? '⏳ Đang upload...' : '☁️ Upload lên Supabase'}
              </button>
            </div>
            {uploadMsg && <div style={{ textAlign:'center', color: uploadMsg.startsWith('✅')?'#10B981':'#EF4444', fontWeight:600 }}>{uploadMsg}</div>}
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && song && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20, paddingTop:40, textAlign:'center' }}>
            <div style={{ fontSize:56 }}>🎉</div>
            <div style={{ color:'#10B981', fontWeight:900, fontSize:26 }}>Upload thành công!</div>
            <div style={{ color:'#9CA3AF', fontSize:15 }}>
              <strong style={{ color:'#fff' }}>{song.title}</strong> đã có trên Supabase
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => {
                try { localStorage.setItem('csre-player-song', JSON.stringify(song)); localStorage.setItem('csre-open-editor','1') } catch {}
                window.location.href = '/'
              }} style={{ padding:'12px 24px', background:'#3B82F6', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer' }}>
                ✏️ Mở trong Editor
              </button>
              <button onClick={() => { setStep('upload'); setParsed(null); setHopAmText(''); setSong(null); setUploadMsg('') }}
                style={{ padding:'12px 24px', background:'#1E2533', border:'1px solid #374151', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer' }}>
                🎸 Import bài khác
              </button>
              <button onClick={onClose}
                style={{ padding:'12px 24px', background:'#10B981', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer' }}>
                ✓ Xong
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
