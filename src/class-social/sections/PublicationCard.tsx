// Thẻ "Bài mới phát hành" của Band (TeamLab) trên Feed /me. Một publication = một thẻ. Chỉ dữ liệu công khai của
// teamlab_public_song (tên Band, tên bài, ảnh Team, thời điểm, slug) — KHÔNG take/track/người tham gia.
// Nghe ngay: nhúng NGUYÊN Published Player công khai của TeamLab (iframe /teamlab/song/<slug>?embed=1), chỉ nạp khi bấm,
// mỗi lúc một bài, đóng/đổi bài/rời Feed → gỡ iframe. Không tự phát. Không copy audio hay logic player.
import { useEffect, useRef, useState } from 'react'
import { relativeTime, type PublicationEntry } from '../posts/postModel'
import { Avatar } from '../ui'
import {
  EMBED_DEFAULT_H, EMBED_NATIVE_H, bandPath, embedOrigin, isNativeShell, webBase, closeEmbed, embedSrc, heightFromMessage, openEmbed, publicSongUrl, songPath, useActiveEmbed,
} from './publicationEmbed'

const LOAD_TIMEOUT_MS = 15000

function useShare(title: string, url: string) {
  const [note, setNote] = useState<string | null>(null)
  const share = async () => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, url })
        return
      }
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(url)
      setNote('Đã sao chép liên kết')
    } catch {
      setNote(url)
    }
    setTimeout(() => setNote(null), 4000)
  }
  return { note, share }
}

function EmbeddedPlayer({ slug, onClose }: { slug: string; onClose: () => void }) {
  const native = isNativeShell()
  const [height, setHeight] = useState(native ? EMBED_NATIVE_H : EMBED_DEFAULT_H)
  const [failed, setFailed] = useState(false)
  const loaded = useRef(false)
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const h = heightFromMessage(ev, embedOrigin(window.location.origin, native), slug)
      if (h === null) return
      loaded.current = true
      setHeight(h)
    }
    window.addEventListener('message', onMsg)
    const t = setTimeout(() => { if (!loaded.current) setFailed(true) }, LOAD_TIMEOUT_MS)
    return () => { window.removeEventListener('message', onMsg); clearTimeout(t) }
  }, [slug, native])
  return (
    <div className="cs-pub-player">
      {failed ? (
        <p className="cs-pub-err" role="alert">Chưa tải được trình phát. <a href={webBase(native) + songPath(slug)}>Mở trang bài hát</a></p>
      ) : (
        <iframe className="cs-pub-frame" src={embedSrc(slug)} title="Trình phát bài hát" style={{ height }}
          allow="autoplay" referrerPolicy={native ? 'strict-origin-when-cross-origin' : 'same-origin'}
          onLoad={() => { loaded.current = true }} />
      )}
      <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-pub-close" onClick={onClose}>Đóng trình phát</button>
    </div>
  )
}

export default function PublicationCard({ entry, now }: { entry: PublicationEntry; now?: Date }) {
  const who = entry.bandName ?? entry.projectName
  const [coverBroken, setCoverBroken] = useState(false)
  const active = useActiveEmbed()
  const open = active === entry.id
  const band = bandPath(entry.projectSlug)
  const { note, share } = useShare(entry.title, publicSongUrl(entry.slug))
  // Rời Feed / thẻ bị gỡ khỏi cây → nhả vị trí "đang mở" (iframe tự bị gỡ cùng thẻ).
  useEffect(() => () => closeEmbed(entry.id), [entry.id])
  return (
    <article className="cs-card cs-post lt-feed-card cs-pub-card" aria-label={`Bài mới phát hành của ${who}: ${entry.title}`}>
      <header className="cs-post-head">
        <Avatar name={who} url={entry.avatarUrl} size={40} />
        <div className="cs-post-meta">
          <div className="cs-post-line"><span className="cs-post-author">{who}</span></div>
          <div className="cs-post-sub">
            <span className="cs-pub-announce">Vừa phát hành bài hát · </span>
            <time className="cs-post-time" dateTime={entry.createdAt}>{relativeTime(entry.createdAt, now)}</time>
          </div>
        </div>
      </header>
      <div className="lt-feed-body">
        <div className="lt-feed-kind">Bài mới phát hành</div>
        <div className="lt-feed-lesson">{entry.title}</div>
        {entry.coverUrl && !coverBroken && (
          <img className="cs-pub-cover" src={entry.coverUrl} alt="" loading="lazy" onError={() => setCoverBroken(true)} />
        )}
        {open && <EmbeddedPlayer slug={entry.slug} onClose={() => closeEmbed(entry.id)} />}
        <div className="lt-feed-foot cs-pub-actions">
          {!open && <button type="button" className="lt-btn lt-feed-open cs-pub-listen" onClick={() => openEmbed(entry.id)}>Nghe ngay</button>}
          <button type="button" className="cs-btn cs-btn-ghost cs-btn-sm cs-pub-share" onClick={share}>Chia sẻ</button>
          <a className="cs-btn cs-btn-ghost cs-btn-sm cs-pub-open" href={webBase() + songPath(entry.slug)}>Xem bài hát</a>
          {band && <a className="cs-btn cs-btn-ghost cs-btn-sm cs-pub-band" href={band}>Khám phá Band</a>}
        </div>
        {note && <div className="cs-pub-note" role="status">{note}</div>}
      </div>
    </article>
  )
}
