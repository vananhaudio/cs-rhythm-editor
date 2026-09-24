// Hiển thị video/link ngoài bằng component Class kiểm soát.
// - iframe src CHỈ là embedUrl do parseExternalMedia tự dựng từ ID đã kiểm tra.
// - Không autoplay, lazy-load, sandbox; không nạp SDK/script của nhà cung cấp.
// - Không nhúng được (Facebook, TikTok link rút gọn, link khác) → thẻ mở nội dung gốc.
import { ExternalLink, Link2, PlayCircle } from 'lucide-react'
import { PROVIDER_LABEL, type ExternalMedia } from './parseExternalMedia'

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

const OPEN_LABEL: Record<ExternalMedia['provider'], string> = {
  youtube: 'Mở trên YouTube',
  tiktok: 'Mở trên TikTok',
  facebook: 'Mở trên Facebook',
  external_link: 'Mở liên kết',
}

export function MediaLinkCard({ media }: { media: ExternalMedia }) {
  const isVideo = media.provider !== 'external_link'
  const Icon = isVideo ? PlayCircle : Link2
  return (
    <a className={`cs-media-card is-${media.provider}`} href={media.canonicalUrl}
      target="_blank" rel="noopener noreferrer nofollow ugc">
      <span className="cs-media-card-icon"><Icon size={26} strokeWidth={1.8} /></span>
      <span className="cs-media-card-text">
        <span className="cs-media-card-title">
          {media.provider === 'external_link' ? hostOf(media.canonicalUrl) : `Video ${PROVIDER_LABEL[media.provider]}`}
        </span>
        <span className="cs-media-card-url">{media.canonicalUrl}</span>
      </span>
      <span className="cs-media-card-open">
        {OPEN_LABEL[media.provider]} <ExternalLink size={15} />
      </span>
    </a>
  )
}

export default function ExternalMediaView({ media, title }: { media: ExternalMedia; title: string }) {
  if (!media.canEmbed || !media.embedUrl) return <MediaLinkCard media={media} />
  return (
    <div className={`cs-media-frame is-${media.aspect}`}>
      <iframe
        src={media.embedUrl}
        title={title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        allow="encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  )
}
