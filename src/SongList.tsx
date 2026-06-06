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

export function SongList({ onSelect, onClose, isTeacher, defaultSearch }: {
  onSelect: (song: RhythmSong) => void
  onClose: () => void
  isTeacher?: boolean
  defaultSearch?: string
}) {
  const [songs, setSongs] = useState<SongRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(defaultSearch ?? '')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingSong, setEditingSong] = useState<SongRow | null>(null)
  const [editForm, setEditForm] = useState({ title: '', artist: '', tone: '', tempo: 0, time_signature: 4 })
  const [saving, setSaving] = useState(false)

  const loadSongs = () => {
    setLoading(true)
    supabase
      .from('timming_songs')
      .select('id, title, artist, tone, tempo, time_signature, song_data')
      .order('title', { ascending: true })
      .then(({ data }) => {
        setSongs(data ?? [])
        setLoading(false)
      })
  }

  useEffect(() => { loadSongs() }, [])

  const filtered = songs.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    (s.artist ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (song: SongRow) => {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xoá bài "${song.title}"?\n\nHành động này không thể hoàn tác.`
    )
    if (!confirmed) return
    setDeletingId(song.id)
    await supabase.from('timming_songs').delete().eq('id', song.id)
    setSongs(prev => prev.filter(s => s.id !== song.id))
    setDeletingId(null)
  }

  const handleEditOpen = (song: SongRow) => {
    setEditingSong(song)
    setEditForm({
      title: song.title,
      artist: song.artist ?? '',
      tone: song.tone ?? '',
      tempo: song.tempo,
      time_signature: song.time_signature,
    })
  }

  const handleEditSave = async () => {
    if (!editingSong) return
    setSaving(true)
    await supabase.from('timming_songs').update({
      title: editForm.title.trim(),
      artist: editForm.artist.trim(),
      tone: editForm.tone.trim(),
      tempo: Number(editForm.tempo),
      time_signature: Number(editForm.time_signature),
    }).eq('id', editingSong.id)
    setSaving(false)
    setEditingSong(null)
    loadSongs()
  }

  // ── Shared styles ──
  const modalStyle: React.CSSProperties = {
    background: '#F5F2EA', borderRadius: 16, padding: 24,
    width: '90%', maxWidth: 500, maxHeight: '85vh',
    display: 'flex', flexDirection: 'column', gap: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  }

  // ── Edit modal ──
  if (editingSong) return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1001 }}
      onClick={() => setEditingSong(null)}>
      <div style={{ ...modalStyle, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ margin:0, color:'#1F2A1F', fontSize:17, fontWeight:800 }}>✏️ Sửa thông tin bài</h2>
          <button onClick={() => setEditingSong(null)} style={{ background:'none', border:'none', color:'#8A8070', cursor:'pointer', fontSize:20 }}>✕</button>
        </div>

        {[
          { label: 'Tên bài', key: 'title', type: 'text' },
          { label: 'Nghệ sĩ', key: 'artist', type: 'text' },
          { label: 'Giọng', key: 'tone', type: 'text' },
          { label: 'Tempo (BPM)', key: 'tempo', type: 'number' },
        ].map(({ label, key, type }) => (
          <div key={key} style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:12, fontWeight:600, color:'#5A4A30' }}>{label}</label>
            <input
              type={type}
              value={(editForm as any)[key]}
              onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
              style={{ padding:'9px 12px', border:'1px solid #D8C8A8', borderRadius:8, fontSize:14, color:'#1F2A1F', outline:'none', background:'#fff' }}
            />
          </div>
        ))}

        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <label style={{ fontSize:12, fontWeight:600, color:'#5A4A30' }}>Nhịp</label>
          <div style={{ display:'flex', gap:8 }}>
            {[2,3,4,6].map(n => (
              <button key={n} onClick={() => setEditForm(prev => ({ ...prev, time_signature: n }))}
                style={{ flex:1, padding:'8px 0', borderRadius:8, border:`1px solid ${editForm.time_signature===n?'#3F7D3A':'#D8C8A8'}`,
                  background: editForm.time_signature===n?'#3F7D3A':'#fff',
                  color: editForm.time_signature===n?'#fff':'#2A2018', fontWeight:600, cursor:'pointer', fontSize:13 }}>
                {n}/4
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
          <button onClick={() => setEditingSong(null)}
            style={{ padding:'9px 20px', borderRadius:9, border:'1px solid #D8C8A8', background:'#fff', color:'#5A4A30', fontWeight:600, cursor:'pointer', fontSize:13 }}>
            Huỷ
          </button>
          <button onClick={handleEditSave} disabled={saving || !editForm.title.trim()}
            style={{ padding:'9px 24px', borderRadius:9, border:'none', background:'#3F7D3A', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:13, opacity: saving?0.7:1 }}>
            {saving ? 'Đang lưu...' : '💾 Lưu'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
      onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ margin:0, color:'#1F2A1F', fontSize:18, fontWeight:800 }}>🎵 Chọn bài hát</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#8A8070', cursor:'pointer', fontSize:20 }}>✕</button>
        </div>

        {/* Search */}
        <input
          placeholder="Tìm kiếm bài hát..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
          style={{ padding:'10px 14px', background:'#fff', border:'1px solid #D8C8A8', borderRadius:8, color:'#1F2A1F', fontSize:14, outline:'none' }}
        />

        {/* List */}
        <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:6 }}>
          {loading && <div style={{ color:'#8A8070', textAlign:'center', padding:20 }}>Đang tải...</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ color:'#8A8070', textAlign:'center', padding:20 }}>Không tìm thấy bài nào</div>
          )}
          {filtered.map(s => (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:6 }}>
              {/* Nút chọn bài */}
              <button onClick={() => { onSelect(s.song_data); onClose() }}
                style={{ flex:1, background:'#fff', border:'1px solid #D8C8A8', borderRadius:10,
                  padding:'11px 14px', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background='#EEF5E6'; e.currentTarget.style.borderColor='#A8C880' }}
                onMouseLeave={e => { e.currentTarget.style.background='#fff'; e.currentTarget.style.borderColor='#D8C8A8' }}>
                <div style={{ fontWeight:700, fontSize:14, color:'#1F2A1F' }}>{s.title}</div>
                <div style={{ color:'#8A8070', fontSize:11, marginTop:2 }}>
                  {s.artist && <span>{s.artist} · </span>}
                  <span>{s.tone && s.tone+' · '}{s.tempo} BPM · {s.time_signature}/4</span>
                </div>
              </button>

              {/* Nút teacher */}
              {isTeacher && (
                <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                  <button onClick={() => handleEditOpen(s)}
                    title="Sửa thông tin"
                    style={{ width:32, height:32, borderRadius:8, border:'1px solid #D8C8A8', background:'#fff',
                      color:'#5A7D3A', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    ✏️
                  </button>
                  <button onClick={() => handleDelete(s)}
                    title="Xoá bài"
                    disabled={deletingId === s.id}
                    style={{ width:32, height:32, borderRadius:8, border:'1px solid #F0D0C8', background:'#FFF5F3',
                      color:'#C0392B', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center',
                      opacity: deletingId===s.id ? 0.5 : 1 }}>
                    🗑
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {isTeacher && (
          <div style={{ fontSize:11, color:'#B0A898', textAlign:'center', paddingTop:4, borderTop:'1px solid #E8E0D0' }}>
            Thầy có thể sửa thông tin hoặc xoá bài
          </div>
        )}
      </div>
    </div>
  )
}
