import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const S = {
  bg: '#F4F4F5', surface: '#FFFFFF', surface2: '#FAFAFA',
  border: '#E4E4E7', borderLight: '#F0F0F2',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  accent: '#4F46E5', accentLight: '#EEF2FF',
  success: '#16A34A',
  shadow: '0 1px 3px rgba(0,0,0,0.06)',
}

const TIERS = [
  { id: 'free',     label: 'Miễn phí',   color: '#16A34A', bg: '#F0FDF4' },
  { id: 'basic',    label: 'Cơ bản',     color: '#2563EB', bg: '#EFF6FF' },
  { id: 'standard', label: 'Chuẩn',      color: '#D97706', bg: '#FFFBEB' },
  { id: 'pro',      label: 'Hành trình', color: '#7C3AED', bg: '#F5F3FF' },
]

type ToolStatus = 'on' | 'off' | 'coming_soon'
const TOOL_STATUS_CFG: Record<ToolStatus, { label: string; color: string; bg: string }> = {
  on:          { label: '● Bật',         color: '#16A34A', bg: '#F0FDF4' },
  coming_soon: { label: '🔜 Sắp ra mắt', color: '#D97706', bg: '#FFFBEB' },
  off:         { label: '✕ Tắt',         color: '#71717A', bg: '#F4F4F5' },
}

interface Tool {
  id: string; icon: string; name: string; description: string | null
  category: string; route: string; tier: string; enabled: boolean; status: ToolStatus; order_index: number
}

// 5 bài luyện mặc định — tự upsert vào edu_tools nếu chưa có
const EXERCISE_DEFAULTS: Omit<Tool, 'enabled'>[] = [
  { id: 'bai-luyen-ngon',      name: 'Luyện ngón',  icon: '🖐', description: 'Tập ngón tay từng bước',  category: 'Bài luyện', route: '#', tier: 'free',  status: 'on',  order_index: 100 },
  { id: 'bai-luyen-am-giai',   name: 'Âm giai',     icon: '🎼', description: 'Âm giai trưởng và thứ',  category: 'Bài luyện', route: '#', tier: 'free',  status: 'on',  order_index: 101 },
  { id: 'bai-luyen-arpeggio',  name: 'Arpeggio',    icon: '🎸', description: 'Bài luyện arpeggio',      category: 'Bài luyện', route: '#', tier: 'free',  status: 'on',  order_index: 102 },
  { id: 'bai-luyen-metronome', name: 'Metronome',   icon: '🥁', description: 'Luyện nhịp metronome',    category: 'Bài luyện', route: '#', tier: 'free',  status: 'on',  order_index: 103 },
  { id: 'bai-luyen-cam-am',    name: 'Cảm âm',      icon: '👂', description: 'Luyện tai nghe',          category: 'Bài luyện', route: '#', tier: 'basic', status: 'off', order_index: 104 },
]

export default function ToolsManager() {
  const [tools, setTools]     = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [filter, setFilter]   = useState('all')
  const [changed, setChanged] = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('edu_tools').select('*').order('order_index')
      const existing = (data ?? []) as any[]
      // Tự upsert các bài luyện nếu chưa có trong DB
      const missing = EXERCISE_DEFAULTS.filter(ex => !existing.some(t => t.id === ex.id))
      if (missing.length) {
        const rows = missing.map(ex => ({ ...ex, enabled: ex.status === 'on' }))
        await supabase.from('edu_tools').upsert(rows, { onConflict: 'id' })
        const { data: refreshed } = await supabase.from('edu_tools').select('*').order('order_index')
        setTools((refreshed ?? []).map((t: any) => ({ ...t, status: t.status ?? (t.enabled ? 'on' : 'off') })))
      } else {
        setTools(existing.map((t: any) => ({ ...t, status: t.status ?? (t.enabled ? 'on' : 'off') })))
      }
      setLoading(false)
    }
    load()
  }, [])

  const setStatus = (id: string, status: ToolStatus) => {
    setTools(prev => prev.map(t => t.id === id ? { ...t, status, enabled: status === 'on' } : t))
    setChanged(prev => new Set([...prev, id]))
  }

  const setTier = (id: string, tier: string) => {
    setTools(prev => prev.map(t => t.id === id ? { ...t, tier } : t))
    setChanged(prev => new Set([...prev, id]))
  }

  const handleSave = async () => {
    setSaving(true)
    const toUpdate = tools.filter(t => changed.has(t.id))
    await Promise.all(toUpdate.map(t =>
      supabase.from('edu_tools').update({ status: t.status, enabled: t.status === 'on', tier: t.tier }).eq('id', t.id)
    ))
    setChanged(new Set())
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const categories  = ['all', ...Array.from(new Set(tools.map(t => t.category)))]
  const filtered    = filter === 'all' ? tools : tools.filter(t => t.category === filter)
  const enabledCount = tools.filter(t => t.status === 'on').length
  const comingCount  = tools.filter(t => t.status === 'coming_soon').length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: S.text3 }}>
      Đang tải...
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: S.bg }}>

      {/* Header */}
      <div style={{ background: S.surface, borderBottom: `1px solid ${S.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>🛠 Quản lý công cụ</div>
          <div style={{ fontSize: 12, color: S.text3, marginTop: 2 }}>
            {enabledCount} bật · {comingCount} sắp ra mắt · {tools.length - enabledCount - comingCount} tắt
            {changed.size > 0 && <span style={{ color: '#D97706', marginLeft: 8 }}>· {changed.size} thay đổi chưa lưu</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && <span style={{ fontSize: 12, color: S.success, fontWeight: 600 }}>✓ Đã lưu</span>}
          <button onClick={handleSave} disabled={saving || changed.size === 0}
            style={{ background: changed.size > 0 ? S.accent : S.border, color: changed.size > 0 ? '#fff' : S.text3, border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: changed.size > 0 ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      {/* Filter */}
      <div style={{ background: S.surface, borderBottom: `1px solid ${S.border}`, padding: '10px 24px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            style={{ background: filter === cat ? S.accent : S.surface2, color: filter === cat ? '#fff' : S.text2, border: `1px solid ${filter === cat ? S.accent : S.border}`, borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: filter === cat ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
            {cat === 'all' ? `Tất cả (${tools.length})` : `${cat} (${tools.filter(t => t.category === cat).length})`}
          </button>
        ))}
      </div>

      {/* Tier legend */}
      <div style={{ background: S.surface2, borderBottom: `1px solid ${S.border}`, padding: '8px 24px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: S.text3, fontWeight: 600 }}>TIER:</span>
        {TIERS.map(t => (
          <span key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, display: 'inline-block' }} />
            <span style={{ color: t.color, fontWeight: 600 }}>{t.label}</span>
          </span>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {(() => {
          const grouped = filtered.reduce<Record<string, Tool[]>>((acc, t) => {
            if (!acc[t.category]) acc[t.category] = []
            acc[t.category].push(t)
            return acc
          }, {})
          return Object.entries(grouped).map(([cat, catTools]) => (
            <div key={cat} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: S.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, paddingLeft: 4 }}>
                {cat} <span style={{ fontWeight: 400, color: S.text3 }}>({catTools.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {catTools.map(tool => {
                  const tier = TIERS.find(t => t.id === tool.tier) ?? TIERS[0]
                  const isChanged = changed.has(tool.id)
                  return (
                    <div key={tool.id} style={{ background: S.surface, border: `1px solid ${isChanged ? '#FCD34D' : S.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, opacity: tool.status === 'off' ? .5 : 1, boxShadow: S.shadow }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: tool.status === 'on' ? S.accentLight : S.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        {tool.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: tool.status !== 'off' ? S.text1 : S.text3, marginBottom: 2 }}>{tool.name}</div>
                        <div style={{ fontSize: 12, color: S.text3 }}>{tool.description}</div>
                      </div>
                      <a href={tool.route} target="_blank" rel="noopener noreferrer"
                        title={tool.route}
                        style={{ background: S.accentLight, color: S.accent, border: `1px solid ${S.accent}30`, borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        Mở →
                      </a>
                      <select value={tool.tier} onChange={e => setTier(tool.id, e.target.value)}
                        style={{ background: tier.bg, color: tier.color, border: `1px solid ${tier.color}40`, borderRadius: 8, padding: '4px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', flexShrink: 0 }}>
                        {TIERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                      {/* 3-state toggle */}
                      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${S.border}`, flexShrink: 0 }}>
                        {(['on','coming_soon','off'] as ToolStatus[]).map(s => {
                          const cfg = TOOL_STATUS_CFG[s]
                          const active = tool.status === s
                          return (
                            <button key={s} onClick={() => setStatus(tool.id, s)}
                              style={{ padding: '4px 7px', fontSize: 10, fontWeight: active ? 700 : 400, cursor: 'pointer', border: 'none', borderRight: s !== 'off' ? `1px solid ${S.border}` : 'none', fontFamily: 'inherit', background: active ? cfg.bg : S.surface, color: active ? cfg.color : S.text3, transition: 'all .12s', whiteSpace: 'nowrap' }}>
                              {cfg.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        })()}
        {filtered.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: S.text3 }}>Chưa có công cụ nào</div>
        )}
      </div>
    </div>
  )
}
