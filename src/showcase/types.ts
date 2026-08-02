// ── Showcase CMS — Shared Types ──

// ── Enums ──
export const BLOCK_TYPES = [
  'heading',
  'paragraph',
  'image',
  'gallery',
  'youtube',
  'video',
  'quote',
  'divider',
  'pdf',
  'button',
  'embed',
  'callout',
] as const

export type BlockType = typeof BLOCK_TYPES[number]

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  heading: 'Tiêu đề',
  paragraph: 'Đoạn văn',
  image: 'Ảnh',
  gallery: 'Bộ sưu tập',
  youtube: 'YouTube',
  video: 'Video',
  quote: 'Trích dẫn',
  divider: 'Đường phân cách',
  pdf: 'PDF',
  button: 'Nút bấm',
  embed: 'Nhúng (Embed)',
  callout: 'Callout',
}

export const BLOCK_TYPE_ICONS: Record<BlockType, string> = {
  heading: 'H1',
  paragraph: '¶',
  image: '🖼',
  gallery: '🖼🖼',
  youtube: '▶',
  video: '🎬',
  quote: '❝',
  divider: '—',
  pdf: '📄',
  button: '🔘',
  embed: '📦',
  callout: '💡',
}

// ── Block Data shapes (stored in showcase_page_blocks.data JSONB) ──
export interface HeadingBlockData {
  level: 1 | 2 | 3 | 4
  text: string
}

export interface ParagraphBlockData {
  text: string
}

export interface ImageBlockData {
  url: string
  alt?: string
  caption?: string
  width?: 'full' | 'contained'
}

export interface GalleryBlockData {
  images: { url: string; alt?: string; caption?: string }[]
  layout?: 'grid' | 'masonry' | 'carousel'
}

export interface YouTubeBlockData {
  videoId: string
  caption?: string
}

export interface VideoBlockData {
  url: string
  caption?: string
  poster?: string
}

export interface QuoteBlockData {
  text: string
  author?: string
  style?: 'default' | 'large'
}

export interface DividerBlockData {
  // no data needed — presence = divider
}

export interface PdfBlockData {
  url: string
  title?: string
}

export interface ButtonBlockData {
  text: string
  url: string
  style?: 'primary' | 'secondary' | 'outline'
  openInNewTab?: boolean
}

export interface EmbedBlockData {
  html: string
  caption?: string
}

export interface CalloutBlockData {
  icon?: string
  text: string
  color?: 'info' | 'warning' | 'success' | 'danger' | 'default'
}

export type BlockData =
  | HeadingBlockData
  | ParagraphBlockData
  | ImageBlockData
  | GalleryBlockData
  | YouTubeBlockData
  | VideoBlockData
  | QuoteBlockData
  | DividerBlockData
  | PdfBlockData
  | ButtonBlockData
  | EmbedBlockData
  | CalloutBlockData

// ── Database rows ──
export interface ShowcaseCategory {
  id: string
  name: string
  slug: string
  sort_order: number
  is_active: boolean
}

export interface ShowcasePage {
  id: string
  category_id: string | null
  title: string
  slug: string
  summary: string | null
  cover_image: string | null
  published: boolean
  featured: boolean
  sort_order: number
  seo_title: string | null
  seo_description: string | null
  created_at: string
  updated_at: string
}

export interface ShowcasePageBlock {
  id: string
  page_id: string
  type: BlockType
  sort_order: number
  data: BlockData
}

// ── Joined types for views ──
export interface ShowcasePageWithCategory extends ShowcasePage {
  category: ShowcaseCategory | null
}

export interface ShowcasePageWithBlocks extends ShowcasePage {
  blocks: ShowcasePageBlock[]
  category: ShowcaseCategory | null
}

// ── Default block data factories ──
export function defaultBlockData(type: BlockType): BlockData {
  switch (type) {
    case 'heading': return { level: 2, text: '' }
    case 'paragraph': return { text: '' }
    case 'image': return { url: '', alt: '', width: 'full' }
    case 'gallery': return { images: [], layout: 'grid' }
    case 'youtube': return { videoId: '' }
    case 'video': return { url: '' }
    case 'quote': return { text: '', author: '', style: 'default' }
    case 'divider': return {}
    case 'pdf': return { url: '' }
    case 'button': return { text: '', url: '', style: 'primary', openInNewTab: false }
    case 'embed': return { html: '' }
    case 'callout': return { icon: '💡', text: '', color: 'default' }
    default: return {}
  }
}
