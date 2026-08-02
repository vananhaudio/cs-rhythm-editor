// ── BlockRenderer — Dynamically renders showcase page blocks ──
import type { ShowcasePageBlock } from './types'

interface Props {
  block: ShowcasePageBlock
}

export default function BlockRenderer({ block }: Props) {
  switch (block.type) {
    case 'heading': return <HeadingBlock data={block.data as any} />
    case 'paragraph': return <ParagraphBlock data={block.data as any} />
    case 'image': return <ImageBlock data={block.data as any} />
    case 'gallery': return <GalleryBlock data={block.data as any} />
    case 'youtube': return <YouTubeBlock data={block.data as any} />
    case 'video': return <VideoBlock data={block.data as any} />
    case 'quote': return <QuoteBlock data={block.data as any} />
    case 'divider': return <DividerBlock />
    case 'pdf': return <PdfBlock data={block.data as any} />
    case 'button': return <ButtonBlock data={block.data as any} />
    case 'embed': return <EmbedBlock data={block.data as any} />
    case 'callout': return <CalloutBlock data={block.data as any} />
    default: return <div className="sb-unknown">Unknown block: {block.type}</div>
  }
}

// ── Individual Block Components ──

function HeadingBlock({ data }: { data: { level?: number; text?: string } }) {
  const level = Math.min(Math.max(data.level || 2, 1), 6)
  const cn = `sb-heading sb-h${level}`
  if (level === 1) return <h1 className={cn}>{data.text || ''}</h1>
  if (level === 2) return <h2 className={cn}>{data.text || ''}</h2>
  if (level === 3) return <h3 className={cn}>{data.text || ''}</h3>
  if (level === 4) return <h4 className={cn}>{data.text || ''}</h4>
  if (level === 5) return <h5 className={cn}>{data.text || ''}</h5>
  return <h6 className={cn}>{data.text || ''}</h6>
}

function ParagraphBlock({ data }: { data: { text?: string } }) {
  if (!data.text) return null
  return <div className="sb-paragraph" dangerouslySetInnerHTML={{ __html: data.text.replace(/\n/g, '<br/>') }} />
}

function ImageBlock({ data }: { data: { url?: string; alt?: string; caption?: string; width?: string } }) {
  if (!data.url) return null
  return (
    <figure className={`sb-image ${data.width === 'contained' ? 'sb-image-contained' : 'sb-image-full'}`}>
      <img
        src={data.url}
        alt={data.alt || ''}
        loading="lazy"
        onError={(e) => {
          const el = e.currentTarget
          el.style.display = 'none'
          const wrap = el.parentElement
          if (wrap) {
            const ph = document.createElement('div')
            ph.className = 'sb-img-placeholder'
            ph.textContent = '🖼'
            wrap.appendChild(ph)
          }
        }}
      />
      {data.caption && <figcaption className="sb-image-caption">{data.caption}</figcaption>}
    </figure>
  )
}

function GalleryBlock({ data }: { data: { images?: { url: string; alt?: string; caption?: string }[]; layout?: string } }) {
  if (!data.images || data.images.length === 0) return null
  const cols = data.layout === 'masonry' ? 2 : data.layout === 'carousel' ? 1 : 3
  return (
    <div className="sb-gallery">
      <div className={`sb-gallery-grid sb-gallery-cols-${cols}`}>
        {data.images.map((img, i) => (
          <figure key={i} className="sb-gallery-item">
            <img
              src={img.url}
              alt={img.alt || ''}
              loading="lazy"
              onError={(e) => {
                const el = e.currentTarget
                el.parentElement!.style.display = 'none'
              }}
            />
            {img.caption && <figcaption>{img.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </div>
  )
}

function YouTubeBlock({ data }: { data: { videoId?: string; caption?: string } }) {
  if (!data.videoId) return null
  return (
    <figure className="sb-youtube">
      <div className="sb-youtube-wrap">
        <iframe
          src={`https://www.youtube.com/embed/${data.videoId}`}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="sb-youtube-iframe"
        />
      </div>
      {data.caption && <figcaption className="sb-media-caption">{data.caption}</figcaption>}
    </figure>
  )
}

function VideoBlock({ data }: { data: { url?: string; caption?: string; poster?: string } }) {
  if (!data.url) return null
  return (
    <figure className="sb-video">
      <video
        src={data.url}
        controls
        poster={data.poster || undefined}
        className="sb-video-player"
        preload="metadata"
      />
      {data.caption && <figcaption className="sb-media-caption">{data.caption}</figcaption>}
    </figure>
  )
}

function QuoteBlock({ data }: { data: { text?: string; author?: string; style?: string } }) {
  if (!data.text) return null
  return (
    <blockquote className={`sb-quote ${data.style === 'large' ? 'sb-quote-large' : ''}`}>
      <p className="sb-quote-text">"{data.text}"</p>
      {data.author && <cite className="sb-quote-author">— {data.author}</cite>}
    </blockquote>
  )
}

function DividerBlock() {
  return <hr className="sb-divider" />
}

function PdfBlock({ data }: { data: { url?: string; title?: string } }) {
  if (!data.url) return null
  return (
    <div className="sb-pdf">
      {data.title && <div className="sb-pdf-title">{data.title}</div>}
      <iframe src={data.url} className="sb-pdf-iframe" title={data.title || 'PDF'} />
    </div>
  )
}

function ButtonBlock({ data }: { data: { text?: string; url?: string; style?: string; openInNewTab?: boolean } }) {
  if (!data.url) return null
  const target = data.openInNewTab ? '_blank' : undefined
  const rel = data.openInNewTab ? 'noopener noreferrer' : undefined
  return (
    <div className="sb-button-wrap">
      <a
        href={data.url}
        target={target}
        rel={rel}
        className={`sb-button sb-btn-${data.style || 'primary'}`}
      >
        {data.text || data.url}
      </a>
    </div>
  )
}

function EmbedBlock({ data }: { data: { html?: string; caption?: string } }) {
  if (!data.html) return null
  return (
    <figure className="sb-embed">
      <div className="sb-embed-wrap" dangerouslySetInnerHTML={{ __html: data.html }} />
      {data.caption && <figcaption className="sb-media-caption">{data.caption}</figcaption>}
    </figure>
  )
}

function CalloutBlock({ data }: { data: { icon?: string; text?: string; color?: string } }) {
  if (!data.text) return null
  return (
    <div className={`sb-callout sb-callout-${data.color || 'default'}`}>
      {data.icon && <span className="sb-callout-icon">{data.icon}</span>}
      <div className="sb-callout-text" dangerouslySetInnerHTML={{ __html: data.text.replace(/\n/g, '<br/>') }} />
    </div>
  )
}

// ── CSS (scoped via class prefix) ──
export const BLOCK_RENDERER_CSS = `
/* ── Block Renderer Styles ── */

/* Heading */
.sb-heading { margin: 0 0 0.5em; color: #211C32; line-height: 1.3; font-weight: 700; }
.sb-h1 { font-size: 32px; letter-spacing: -0.5px; }
.sb-h2 { font-size: 26px; }
.sb-h3 { font-size: 20px; }
.sb-h4 { font-size: 17px; }

/* Paragraph */
.sb-paragraph { font-size: 17px; line-height: 1.8; color: #211C32; margin: 0 0 1.2em; }
.sb-paragraph:last-child { margin-bottom: 0; }

/* Image */
.sb-image { margin: 24px 0; }
.sb-image img { width: 100%; border-radius: 12px; display: block; }
.sb-image-contained { max-width: 600px; margin-left: auto; margin-right: auto; }
.sb-image-contained img { max-width: 100%; }
.sb-img-placeholder {
  width: 100%; aspect-ratio: 16/9; display: flex; align-items: center;
  justify-content: center; background: #F2EEE7; border-radius: 12px;
  font-size: 48px; opacity: 0.3;
}
.sb-image-caption, .sb-media-caption {
  font-size: 13px; color: #8A8499; text-align: center; margin-top: 8px; font-style: italic;
}

/* Gallery */
.sb-gallery { margin: 24px 0; }
.sb-gallery-grid { display: grid; gap: 12px; }
.sb-gallery-cols-1 { grid-template-columns: 1fr; }
.sb-gallery-cols-2 { grid-template-columns: 1fr 1fr; }
.sb-gallery-cols-3 { grid-template-columns: repeat(3, 1fr); }
.sb-gallery-item { margin: 0; }
.sb-gallery-item img { width: 100%; border-radius: 10px; display: block; }
.sb-gallery-item figcaption { font-size: 12px; color: #8A8499; text-align: center; margin-top: 4px; }

/* YouTube */
.sb-youtube { margin: 24px 0; }
.sb-youtube-wrap { position: relative; padding-bottom: 56.25%; border-radius: 12px; overflow: hidden; }
.sb-youtube-iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }

/* Video */
.sb-video { margin: 24px 0; }
.sb-video-player { width: 100%; border-radius: 12px; display: block; }

/* Quote */
.sb-quote { margin: 28px 0; padding: 20px 24px; border-left: 4px solid #C9711E; background: #FFFBF5; border-radius: 0 12px 12px 0; }
.sb-quote-text { font-size: 18px; font-style: italic; color: #4A4458; line-height: 1.7; margin: 0; }
.sb-quote-author { display: block; margin-top: 10px; font-size: 14px; font-weight: 600; color: #C9711E; font-style: normal; }
.sb-quote-large .sb-quote-text { font-size: 24px; }

/* Divider */
.sb-divider { border: none; border-top: 1px solid #E4DED4; margin: 32px 0; }

/* PDF */
.sb-pdf { margin: 24px 0; }
.sb-pdf-title { font-size: 14px; font-weight: 600; color: #5A5470; margin-bottom: 8px; }
.sb-pdf-iframe { width: 100%; height: 500px; border: 1px solid #E4DED4; border-radius: 12px; }

/* Button */
.sb-button-wrap { margin: 24px 0; }
.sb-button {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 24px; border-radius: 12px; font-size: 15px;
  font-weight: 600; text-decoration: none; transition: all .15s;
  font-family: inherit;
}
.sb-btn-primary { background: #4338CA; color: #fff; }
.sb-btn-primary:hover { background: #352BA3; }
.sb-btn-secondary { background: #5A5470; color: #fff; }
.sb-btn-secondary:hover { background: #4A4458; }
.sb-btn-outline { background: transparent; color: #4338CA; border: 1.5px solid #4338CA; }
.sb-btn-outline:hover { background: #EEEBFB; }

/* Embed */
.sb-embed { margin: 24px 0; }
.sb-embed-wrap { border-radius: 12px; overflow: hidden; }
.sb-embed-wrap iframe { width: 100%; border: none; }

/* Callout */
.sb-callout { margin: 24px 0; padding: 16px 20px; border-radius: 12px; display: flex; gap: 12px; align-items: flex-start; }
.sb-callout-icon { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
.sb-callout-text { font-size: 16px; line-height: 1.7; color: #211C32; flex: 1; }
.sb-callout-default { background: #F2EEE7; border: 1px solid #E4DED4; }
.sb-callout-info { background: #EFF6FF; border: 1px solid #BFDBFE; }
.sb-callout-warning { background: #FFFBEB; border: 1px solid #FDE68A; }
.sb-callout-success { background: #F0FDF4; border: 1px solid #BBF7D0; }
.sb-callout-danger { background: #FEF2F2; border: 1px solid #FECACA; }

/* Unknown */
.sb-unknown { padding: 12px; background: #FEF2F2; border: 1px dashed #FCA5A5; border-radius: 8px; font-size: 13px; color: #DC2626; }

@media (max-width: 640px) {
  .sb-h1 { font-size: 26px; }
  .sb-h2 { font-size: 22px; }
  .sb-h3 { font-size: 18px; }
  .sb-paragraph { font-size: 16px; }
  .sb-gallery-cols-2, .sb-gallery-cols-3 { grid-template-columns: 1fr; }
  .sb-quote { padding: 16px 18px; }
  .sb-quote-text { font-size: 16px; }
  .sb-quote-large .sb-quote-text { font-size: 20px; }
  .sb-pdf-iframe { height: 350px; }
}
`
