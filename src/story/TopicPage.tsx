// ── /story/topic/:slug — Stories by topic ──
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

interface StoryItem {
  id: string; title: string; slug: string | null
  pen_name: string | null; photos: { url: string }[] | null; published_at: string
}

const TOPIC_LABELS: Record<string, string> = {
  'dam-bat-dau': 'Dám bắt đầu', 'khong-bo-cuoc': 'Không bỏ cuộc',
  'theo-duoi-dam-me': 'Theo đuổi đam mê', 'tin-vao-ban-than': 'Tin vào bản thân',
  'chua-lanh': 'Chữa lành', 'yeu-thuong': 'Yêu thương',
  'biet-on': 'Biết ơn', 'ket-noi': 'Kết nối',
  'cho-di': 'Cho đi', 'can-bang-cuoc-song': 'Cân bằng cuộc sống',
}

function firstPhoto(photos: { url: string }[] | null) {
  if (!photos || photos.length === 0) return null
  return photos[0]?.url ?? null
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function TopicPage() {
  const slug = window.location.pathname.replace('/story/topic/', '')
  const [stories, setStories] = useState<StoryItem[]>([])
  const [catName, setCatName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try new categories table first, fall back to old topic field
    supabase.from('categories').select('name').eq('slug', slug).maybeSingle()
      .then(({ data }) => {
        if (data) setCatName((data as any).name)
        else setCatName(TOPIC_LABELS[slug] || slug)
      })

    Promise.all([
      // Old system: stories with matching topic
      supabase.from('stories').select('id, title, slug, pen_name, photos, published_at')
        .eq('status', 'published').eq('topic', slug)
        .order('published_at', { ascending: false }).limit(20),
      // New system: stories via story_categories junction
      supabase.from('story_categories')
        .select('stories!inner(id, title, slug, pen_name, photos, published_at)')
        .eq('category_id', supabase.from('categories').select('id').eq('slug', slug).single() as any)
        .order('stories(published_at)', { ascending: false }).limit(20),
    ]).then(([oldRes, newRes]) => {
      const oldStories = (oldRes.data as StoryItem[]) || []
      const newStories = ((newRes.data as any[]) || []).map((r: any) => r.stories).filter(Boolean) as StoryItem[]
      // Merge dedup
      const seen = new Set<string>()
      const merged: StoryItem[] = []
      for (const s of [...newStories, ...oldStories]) {
        if (!seen.has(s.id)) { seen.add(s.id); merged.push(s) }
      }
      setStories(merged)
      setLoading(false)
    }).catch(() => {
      // Graceful: just use old system
      supabase.from('stories').select('id, title, slug, pen_name, photos, published_at')
        .eq('status', 'published').eq('topic', slug)
        .order('published_at', { ascending: false }).limit(20)
        .then(({ data }) => {
          setStories((data as StoryItem[]) || [])
          setLoading(false)
        })
    })
  }, [slug])

  return (
    <div style={{ minHeight: '100dvh', background: '#F2EEE7', fontFamily: '"Be Vietnam Pro", system-ui, sans-serif' }}>
      <style>{`
        .tp-root { max-width: 720px; margin: 0 auto; padding: 40px 20px; }
        .tp-back { text-decoration: none; color: #5A5470; font-size: 14px; font-weight: 500; display: inline-block; margin-bottom: 20px; }
        .tp-back:hover { color: #4338CA; }
        .tp-title { font-size: 28px; font-weight: 800; color: #211C32; margin: 0 0 8px; }
        .tp-count { font-size: 14px; color: #8A8499; margin: 0 0 28px; }
        .tp-list { display: flex; flex-direction: column; gap: 12px; }
        .tp-item { display: flex; align-items: center; gap: 16px; text-decoration: none; padding: 16px; border-radius: 12px; background: #FFFFFF; border: 1px solid #E4DED4; transition: box-shadow .15s; }
        .tp-item:hover { box-shadow: 0 4px 16px rgba(33,28,50,.08); }
        .tp-item-img { width: 80px; height: 54px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: #F2EEE7; }
        .tp-item-body { flex: 1; min-width: 0; }
        .tp-item-title { font-size: 16px; font-weight: 600; color: #211C32; margin: 0 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tp-item-meta { font-size: 13px; color: #8A8499; }
        .tp-item-author { font-weight: 500; color: #5A5470; }
        .tp-loading { text-align: center; padding: 60px 20px; color: #8A8499; }
        .tp-empty { text-align: center; padding: 60px 20px; color: #8A8499; }
        @media (max-width: 640px) { .tp-root { padding: 28px 16px; } .tp-item-img { width: 60px; height: 40px; } }
      `}</style>
      <div className="tp-root">
        <a href="/story" className="tp-back">← Tạp chí</a>
        {loading ? (
          <div className="tp-loading">Đang tải...</div>
        ) : (
          <>
            <h1 className="tp-title">{catName || slug}</h1>
            <p className="tp-count">{stories.length} câu chuyện</p>
            {stories.length === 0 ? (
              <div className="tp-empty">Chưa có câu chuyện nào trong chủ đề này.</div>
            ) : (
              <div className="tp-list">
                {stories.map(s => {
                  const img = firstPhoto(s.photos)
                  return (
                    <a key={s.id} href={`/story/${s.slug || s.id}`} className="tp-item">
                      {img && <img src={img} alt="" className="tp-item-img" />}
                      {!img && <div className="tp-item-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, opacity: 0.3 }}>🎸</div>}
                      <div className="tp-item-body">
                        <h3 className="tp-item-title">{s.title}</h3>
                        <div className="tp-item-meta">
                          <span className="tp-item-author">{s.pen_name || 'Ẩn danh'}</span>
                          <span> · {s.published_at ? fmtDate(s.published_at) : ''}</span>
                        </div>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
