import { useState } from 'react'

const S = {
  bg: '#F4F4F5', surface: '#FFFFFF', surface2: '#FAFAFA',
  border: '#E4E4E7', borderLight: '#F0F0F2',
  text1: '#18181B', text2: '#52525B', text3: '#A1A1AA',
  accent: '#4F46E5', accentLight: '#EEF2FF',
  success: '#16A34A', successBg: '#F0FDF4',
  shadow: '0 1px 3px rgba(0,0,0,0.06)',
}

const TIERS = [
  { id: 'free',     label: 'Miễn phí',   color: '#16A34A', bg: '#F0FDF4' },
  { id: 'basic',    label: 'Cơ bản',     color: '#2563EB', bg: '#EFF6FF' },
  { id: 'standard', label: 'Chuẩn',      color: '#D97706', bg: '#FFFBEB' },
  { id: 'pro',      label: 'Hành trình', color: '#7C3AED', bg: '#F5F3FF' },
]

interface Tool {
  id: string; icon: string; name: string; desc: string
  category: string; route: string
  tier: string; enabled: boolean
}

const INITIAL_TOOLS: Tool[] = [
  // Luyện nhịp
  { id:'tap-tempo',     icon:'🎵', name:'Tap Tempo',     desc:'Gõ tìm BPM',              category:'Luyện nhịp', route:'/tap',          tier:'free',     enabled:true  },
  { id:'tap-beat',      icon:'🥁', name:'Tap Beat',      desc:'Gõ theo nhịp bài hát',    category:'Luyện nhịp', route:'/tap',          tier:'free',     enabled:true  },
  { id:'tap-beam',      icon:'🎼', name:'Tap Beam',      desc:'Nối phách nâng cao',       category:'Luyện nhịp', route:'/tap',          tier:'basic',    enabled:true  },
  { id:'tap-sing',      icon:'🎤', name:'Tap & Sing',    desc:'Gõ nhịp và hát theo',     category:'Luyện nhịp', route:'/tap',          tier:'basic',    enabled:true  },
  { id:'tap-strum',     icon:'🎸', name:'Tap & Strum',   desc:'Gõ nhịp và đệm guitar',   category:'Luyện nhịp', route:'/tap',          tier:'standard', enabled:true  },
  // Player
  { id:'scroll-kara',   icon:'📜', name:'Scroll Kara',   desc:'Lời cuộn + hợp âm',       category:'Player',     route:'/tap',          tier:'basic',    enabled:true  },
  { id:'chord-seeing',  icon:'👁', name:'Chord Seeing',  desc:'Karaoke cho nhạc sĩ',     category:'Player',     route:'/tap',          tier:'standard', enabled:true  },
  { id:'backing-track', icon:'🎧', name:'Backing Track', desc:'Nhạc nền luyện tập',       category:'Player',     route:'/tap',          tier:'standard', enabled:true  },
  // Nhạc lý
  { id:'note-sheet',    icon:'📖', name:'Note Sheet',    desc:'Đọc và viết nốt nhạc',    category:'Nhạc lý',    route:'/guitarboard',  tier:'standard', enabled:true  },
  { id:'hoa-am',        icon:'🎹', name:'Hòa âm',        desc:'Diatonic · Triad',         category:'Nhạc lý',    route:'/guitarboard',  tier:'standard', enabled:true  },
  { id:'scale-lead',    icon:'🎶', name:'Scale – Lead',  desc:'Gam & giai điệu',          category:'Nhạc lý',    route:'/guitarboard',  tier:'pro',      enabled:true  },
  // Sáng tác
  { id:'editor',        icon:'✏️', name:'Editor',        desc:'Soạn bài + YouTube sync',  category:'Sáng tác',   route:'/editor',       tier:'pro',      enabled:true  },
  { id:'guitar-board',  icon:'🎸', name:'GuitarBoard',   desc:'Bảng hợp âm trực quan',   category:'Sáng tác',   route:'/guitarboard',  tier:'pro',      enabled:true  },
  { id:'lyric-sheet',   icon:'📝', name:'Lyric Sheet',   desc:'Biên tập lời + hợp âm',   category:'Sáng tác',   route:'/editor',       tier:'pro',      enabled:false },
  // Studio & AI
  { id:'m-record',      icon:'🎬', name:'M-Record',      desc:'Ghi âm & video',           category:'Studio',     route:'/tap',          tier:'pro',      enabled:false },
  { id:'mj-chat',       icon:'🤖', name:'MJ Chat Bot',   desc:'Trợ lý học nhạc AI',      category:'Studio',     route:'/tap',          tier:'pro',      enabled:false },
  { id:'book-tools',    icon:'📚', name:'Book & Tools',  desc:'Tài liệu & giáo trình',   category:'Studio',     route:'/tap',          tier:'pro',      enabled:false },
]

export default function ToolsManager() {
  const [tools, setTools] = useState<Tool[]>(INITIAL_TOOLS)
  const [filter, setFilter] = useState<string>('all')
  const [saved, setSaved] = useState(false)

  const categories = ['all', ...Array.from(new Set(INITIAL_TOOLS.map(t => t.category)))]

  const toggle = (id: string) =>
    setTools(prev => prev.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t))

  const setTier = (id: string, tier: string) =>
    setTools(prev => prev.map(t => t.id === id ? { ...t, tier } : t))

  const handleSave = () => {
    // In production: save to Supabase edu_tools table
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const filtered = filter === 'all' ? tools : tools.filter(t => t.category === filter)
  const enabledCount = tools.filter(t => t.enabled).length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: S.bg, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: S.surface, borderBottom: `1px solid ${S.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: S.text1 }}>🛠 Quản lý công cụ</div>
          <div style={{ fontSize: 12, color: S.text3, marginTop: 2 }}>
            {enabledCount}/{tools.length} công cụ đang bật · Phân cấp unlock cho học sinh
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && <span style={{ fontSize: 12, color: S.success, fontWeight: 600 }}>✓ Đã lưu</span>}
          <button onClick={handleSave}
            style={{ background: S.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Lưu thay đổi
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ background: S.surface, borderBottom: `1px solid ${S.border}`, padding: '10px 24px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            style={{ background: filter === cat ? S.accent : S.surface2, color: filter === cat ? '#fff' : S.text2, border: `1px solid ${filter === cat ? S.accent : S.border}`, borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: filter === cat ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
            {cat === 'all' ? `Tất cả (${tools.length})` : cat}
          </button>
        ))}
      </div>

      {/* Tier legend */}
      <div style={{ background: S.surface2, borderBottom: `1px solid ${S.border}`, padding: '8px 24px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: S.text3, fontWeight: 600 }}>UNLOCK TIER:</span>
        {TIERS.map(t => (
          <span key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, display: 'inline-block' }} />
            <span style={{ color: t.color, fontWeight: 600 }}>{t.label}</span>
          </span>
        ))}
      </div>

      {/* Tools list */}
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
                {cat} <span style={{ fontWeight: 400 }}>({catTools.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {catTools.map(tool => {
                  const tier = TIERS.find(t => t.id === tool.tier) ?? TIERS[0]
                  return (
                    <div key={tool.id} style={{ background: S.surface, border: `1px solid ${tool.enabled ? S.border : S.borderLight}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, opacity: tool.enabled ? 1 : .55, boxShadow: S.shadow }}>

                      {/* Icon */}
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: tool.enabled ? S.accentLight : S.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        {tool.icon}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: tool.enabled ? S.text1 : S.text3, marginBottom: 2 }}>{tool.name}</div>
                        <div style={{ fontSize: 12, color: S.text3 }}>{tool.desc}</div>
                      </div>

                      {/* Tier selector */}
                      <div style={{ flexShrink: 0 }}>
                        <select value={tool.tier} onChange={e => setTier(tool.id, e.target.value)}
                          style={{ background: tier.bg, color: tier.color, border: `1px solid ${tier.color}40`, borderRadius: 8, padding: '4px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}>
                          {TIERS.map(t => (
                            <option key={t.id} value={t.id}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Toggle */}
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
      </div>
    </div>
  )
}
