// Khu bình luận của thẻ Learning Thread / bài TeamLab (Feed Comments V2): tải khi mở, gốc + trả lời MỘT cấp, sửa/xoá của mình,
// Thầy ẩn/bỏ ẩn. Lỗi → GIỮ nguyên chữ đang gõ; chống gửi đúp. Một tay trên iPhone: ô nhập + nút gửi ≥ 44px, không che trình phát (nằm dưới thẻ).
import { useCallback, useEffect, useRef, useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import { MAX_COMMENT } from '../../comments/commentModel'
import { setCommentCount } from '../../comments/commentCountStore'
import { checkTargetBody, countComments, type CommentKind, type CommentNode, type TargetComment } from '../../comments/targetCommentModel'
import { supabaseTargetCommentsApi, type TargetCommentsApi } from '../../comments/targetCommentsApi'
import { relativeTime } from '../../posts/postModel'
import type { ClassIdentity } from '../../useClassSession'
import { Avatar, MoreMenu, PersonLink } from '../../ui'
import ExpandableText from '../ExpandableText'
import SafetyMenu from '../../../class-safety/SafetyMenu'
import { useIsBlocked } from '../../../class-safety/blockedStore'

const api: TargetCommentsApi = supabaseTargetCommentsApi

export function Composer({ idBase, placeholder, initial = '', submitLabel, me, autoFocus, onSubmit, onCancel }: {
  idBase: string; placeholder: string; initial?: string; submitLabel: string; me: ClassIdentity | null; autoFocus?: boolean
  onSubmit: (body: string) => Promise<string | null>; onCancel?: () => void
}) {
  const [body, setBody] = useState(initial)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const submit = async () => {
    if (inFlight.current) return
    const chk = checkTargetBody(body)
    if (!chk.ok) { setError(chk.error); return }
    inFlight.current = true; setSending(true); setError(null)
    const err = await onSubmit(chk.body)
    inFlight.current = false; setSending(false)
    if (err) { setError(err); return }                 // giữ nguyên nội dung để gửi lại
    setBody('')
  }
  return (
    <div className="cs-cmt-composer">
      {me && <Avatar name={me.name} url={me.avatarUrl} size={32} />}
      <form className="cs-cmt-form" onSubmit={e => { e.preventDefault(); void submit() }}>
        <label htmlFor={idBase} className="cs-sr-only">{submitLabel}</label>
        <div className="cs-cmt-inputwrap">
          <textarea id={idBase} className="cs-cmt-input" rows={1} maxLength={MAX_COMMENT} placeholder={placeholder} value={body}
            disabled={sending} autoFocus={autoFocus}
            onChange={e => { setBody(e.target.value); if (error) setError(null) }}
            onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 180) + 'px' }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit() } }} />
          <button type="submit" className="cs-cmt-send" disabled={sending || !body.trim()} aria-label={submitLabel}><SendHorizontal size={18} /></button>
        </div>
        {onCancel && <button type="button" className="cs-link-btn cs-cmt-cancel" onClick={onCancel}>Huỷ</button>}
        {error && <p className="cs-form-error" role="alert">{error}</p>}
      </form>
    </div>
  )
}

function Row({ c, isReply, me, now, editing, onReply, onEdit, onEditDone, onDelete, onHide, onOpenProfile, saveEdit }: {
  c: TargetComment; isReply: boolean; me: ClassIdentity | null; now?: Date; editing: boolean
  onReply?: () => void; onEdit: () => void; onEditDone: () => void; onDelete: () => void; onHide: (h: boolean) => void
  onOpenProfile?: (userId: string) => void; saveEdit: (body: string) => Promise<string | null>
}) {
  const blocked = useIsBlocked(c.author.userId)
  if (blocked && !c.isMine) return null
  const menu = [
    ...(c.isMine ? [{ label: 'Sửa bình luận', onSelect: onEdit }, { label: 'Xoá bình luận', danger: true, onSelect: onDelete }] : []),
    ...(me?.isTeacher && !c.isMine ? [{ label: c.isHidden ? 'Bỏ ẩn bình luận' : 'Ẩn bình luận', onSelect: () => onHide(!c.isHidden) }] : []),
  ]
  return (
    <li className={'cs-cmt' + (c.author.isTeacher ? ' is-teacher' : '') + (c.isHidden ? ' is-hidden' : '') + (isReply ? ' is-reply' : '')} data-comment-id={c.id}>
      <PersonLink userId={c.author.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${c.author.name}`}>
        <Avatar name={c.author.name} url={c.author.avatarUrl} size={isReply ? 26 : 32} />
      </PersonLink>
      <div className="cs-cmt-main">
        {editing ? (
          <Composer idBase={`cs-edit-${c.id}`} placeholder="Sửa bình luận…" initial={c.body} submitLabel="Lưu bình luận" me={null} autoFocus
            onSubmit={async b => { const e = await saveEdit(b); if (!e) onEditDone(); return e }} onCancel={onEditDone} />
        ) : (
          <div className="cs-cmt-bubble">
            <div className="cs-cmt-head">
              <PersonLink userId={c.author.userId} onOpen={onOpenProfile} label={`Trang cá nhân của ${c.author.name}`} className="cs-cmt-author">{c.author.name}</PersonLink>
              {c.author.isTeacher && <span className="cs-cmt-badge" title="Nhận xét của giáo viên">Thầy</span>}
              {c.isHidden && <span className="cs-cmt-hidden">Đã ẩn · học sinh không thấy</span>}
            </div>
            <ExpandableText text={c.body} className="cs-cmt-body" lines={4} />
          </div>
        )}
        {!editing && (
          <div className="cs-cmt-meta">
            <time dateTime={c.createdAt}>{relativeTime(c.createdAt, now)}</time>
            {c.edited && <span>· đã sửa</span>}
            {onReply && me && <button type="button" className="cs-link-btn cs-cmt-reply" onClick={onReply}>Trả lời</button>}
            {c.isMine
              ? (menu.length > 0 && <MoreMenu label="Tuỳ chọn bình luận" items={menu} />)
              : <SafetyMenu label="Tuỳ chọn bình luận" kind="comment" via="feed_comment" targetId={c.id} userId={c.author.userId} userName={c.author.name} extraItems={menu} />}
          </div>
        )}
      </div>
    </li>
  )
}

export default function TargetComments({ kind, id, me, now, onOpenProfile }: {
  kind: CommentKind; id: string; me: ClassIdentity | null; now?: Date; onOpenProfile?: (userId: string) => void
}) {
  const [nodes, setNodes] = useState<CommentNode[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const apply = useCallback((r: Awaited<ReturnType<TargetCommentsApi['list']>>) => {
    if (!r.ok) { setLoadError(r.message); return }
    setLoadError(null); setNodes(r.value); setCommentCount(kind, id, countComments(r.value))
  }, [kind, id])
  const reload = useCallback(async () => { apply(await api.list(kind, id)) }, [apply, kind, id])
  useEffect(() => {
    let alive = true
    void api.list(kind, id).then(r => { if (alive) apply(r) })
    return () => { alive = false }
  }, [apply, kind, id])

  const send = (parent: string | null) => async (body: string): Promise<string | null> => {
    const r = await api.add(kind, id, body, parent)
    if (!r.ok) return r.message
    setReplyTo(null); await reload(); return null
  }
  const del = async (c: TargetComment) => {
    if (!window.confirm(c.parentId ? 'Xoá trả lời này?' : 'Xoá bình luận này? Các trả lời của nó cũng bị xoá.')) return
    const r = await api.remove(kind, c.id)
    if (!r.ok) { setActionError(r.message); return }
    setActionError(null); await reload()
  }
  const hide = async (c: TargetComment, h: boolean) => {
    const r = await api.hide(c.id, h)
    if (!r.ok) { setActionError(r.message); return }
    setActionError(null); await reload()
  }
  const saveEdit = (c: TargetComment) => async (body: string): Promise<string | null> => {
    const r = await api.edit(kind, c.id, body)
    if (!r.ok) return r.message
    await reload(); return null
  }

  const row = (c: TargetComment, isReply: boolean) => (
    <Row key={c.id} c={c} isReply={isReply} me={me} now={now} editing={editing === c.id} onOpenProfile={onOpenProfile}
      onReply={isReply ? undefined : () => setReplyTo(replyTo === c.id ? null : c.id)}
      onEdit={() => setEditing(c.id)} onEditDone={() => setEditing(null)} onDelete={() => void del(c)} onHide={h => void hide(c, h)} saveEdit={saveEdit(c)} />
  )
  return (
    <section className="cs-cmts cs-target-cmts" aria-label="Bình luận" data-kind={kind}>
      {nodes === null && !loadError && <p className="cs-cmts-loading" role="status">Đang tải bình luận…</p>}
      {loadError && <p className="cs-cmts-error" role="alert">{loadError}{' '}<button type="button" className="cs-link-btn" onClick={() => void reload()}>Thử lại</button></p>}
      {nodes !== null && nodes.length === 0 && <p className="cs-cmts-empty">Chưa có bình luận nào.</p>}
      {nodes !== null && nodes.length > 0 && (
        <ul className="cs-cmt-list">
          {nodes.map(n => (
            <li key={n.comment.id} className="cs-cmt-node">
              <ul className="cs-cmt-list cs-cmt-solo">{row(n.comment, false)}</ul>
              {(n.replies.length > 0 || replyTo === n.comment.id) && (
                <ul className="cs-cmt-list cs-cmt-replies">
                  {n.replies.map(r => row(r, true))}
                  {replyTo === n.comment.id && (
                    <li className="cs-cmt-replybox">
                      <Composer idBase={`cs-reply-${n.comment.id}`} placeholder={`Trả lời ${n.comment.author.name}…`} submitLabel="Gửi trả lời" me={me} autoFocus
                        onSubmit={send(n.comment.id)} onCancel={() => setReplyTo(null)} />
                    </li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {actionError && <p className="cs-cmts-error" role="alert">{actionError}</p>}
      {me && <Composer idBase={`cs-cmt-input-${kind}-${id}`} placeholder="Viết bình luận..." submitLabel="Gửi bình luận" me={me} onSubmit={send(null)} />}
    </section>
  )
}
