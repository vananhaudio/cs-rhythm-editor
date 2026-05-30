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

interface Tool {
  id: string; icon: string; name: string; description: string | null
  category: string; route: string; tier: string; enabled: boolean; order_index: number
}

export default function ToolsManager() {
  const [tools, setTools]     = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [filter, setFilter]   = useState('all')
  const [changed, setChanged] = useState<Set<string>>(new Set())

  useEffect(() => {
    supabase.from('edu_tools').select('*').order('order_index')
      .then(({ data }) => { setTools(data ?? []); setLoading(false) })
  }, [])

  const toggle = (id: string) => {
    setTools(prev => prev.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t))
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
      supabase.from('edu_tools').update({ enabled: t.enabled, tier: t.tier }).eq('id', t.id)
    ))
    setChanged(new Set())
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const categories = ['all', ...Array.from(new Set(tools.map(t => t.category)))]
  const filtered   = filter === 'all' ? tools : tools.filter(t => t.category === filter)
  const enabledCount = tools.filter(t => t.enabled).length

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
            {enabledCount}/{tools.length} đang bật · {changed.size > 0 ? <span style={{ color: '#D97706' }}>{changed.size} thay đổi chưa lưu</span> : 'Đã đồng bộ'}
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
                    <div key={tool.id} style={{ background: S.surface, border: `1px solid ${isChanged ? '#FCD34D' : tool.enabled ? S.border : S.borderLight}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, opacity: tool.enabled ? 1 : .55, boxShadow: S.shadow }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: tool.enabled ? S.accentLight : S.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        {tool.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: tool.enabled ? S.text1 : S.text3, marginBottom: 2 }}>{tool.name}</div>
                        <div style={{ fontSize: 12, color: S.text3 }}>{tool.description}</div>
                      </div>
                      <select value={tool.tier} onChange={e => setTier(tool.id, e.target.value)}
                        style={{ background: tier.bg, color: tier.color, border: `1px solid ${tier.color}40`, borderRadius: 8, padding: '4px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', flexShrink: 0 }}>
                        {TIERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                      <div onClick={() => toggle(tool.id)}
                        style={{ width: 44, height: 24, borderRadius: 99, background: tool.enabled ? S.accent : S.border, cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: tool.enabled ? 23 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
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
