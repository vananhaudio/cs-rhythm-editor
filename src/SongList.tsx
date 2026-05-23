import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { RhythmSong } from './types'

type SongRow = {
  id: string
  title: string
  artist: string
  tone: string
  tempo: number
  time_signature: number
  song_data: RhythmSong
}

export function SongList({ onSelect, onClose }: {
  onSelect: (song: RhythmSong) => void
  onClose: () => void
}) {
  const [songs, setSongs] = useState<SongRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase
      .from('timming_songs')
      .select('id, title, artist, tone, tempo, time_signature, song_data')
      .order('title', { ascending: true })
      .then(({ data }) => {
        setSongs(data ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = songs.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    (s.artist ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }} onClick={onClose}>
      <div style={{
        background: '#16213E', borderRadius: 16, padding: 24,
        width: '90%', maxWidth: 500, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', gap: 16
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 800 }}>🎵 Chọn bài hát</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        {/* Search */}
        <input
          placeholder="Tìm kiếm bài hát..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
          style={{
            padding: '10px 14px', background: '#0F1117', border: '1px solid #1E2533',
            borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none'
          }}
        />

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {loading && <div style={{ color: '#6B7280', textAlign: 'center', padding: 20 }}>Đang tải...</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ color: '#6B7280', textAlign: 'center', padding: 20 }}>Không tìm thấy bài nào</div>
          )}
          {filtered.map(s => (
            <button key={s.id} onClick={() => { onSelect(s.song_data); onClose(); }}
              style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid #1E2533',
                borderRadius: 8, padding: '12px 16px', cursor: 'pointer',
                textAlign: 'left', color: '#fff', transition: 'background 0.15s'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
            >
              <div style={{ fontWeight: 700, fontSize: 15 }}>{s.title}</div>
              <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
                {s.artist && <span>{s.artist} · </span>}
                <span>{s.tone} · {s.tempo} BPM · {s.time_signature}/4</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
