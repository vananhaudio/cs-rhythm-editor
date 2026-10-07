// Class Universal Share — logic vòng đời trang xem artifact (BMS, Nhịp & Phách dùng CHUNG; mỗi trang tự vẽ banner theo giao diện riêng).
//   bài riêng:  "Gỡ bài" = XOÁ (tin Chat còn) · chủ bài thấy [Chia sẻ → gửi bạn | đăng cộng đồng]
//   bài đã đăng: "Gỡ khỏi cộng đồng" ≠ xoá (đã gửi bạn → bài còn, hạ về riêng tư; chưa gửi → xoá) · [Chia sẻ → chọn thẳng bạn]
//   người được gửi riêng: chỉ xem; KHÔNG chia sẻ tiếp (không forward).
import { useState } from 'react'
import { deleteArtifact, unpublishArtifact, type ArtifactVisibility } from './artifactApi'

export type Removing = 'idle' | 'confirm' | 'busy' | 'error'

/** localNote: câu trấn an về bản gốc của từng tool (vd 'Nháp trong máy bạn vẫn giữ nguyên.') */
export function useArtifactLifecycle(artifactId: string, loaded: { isMine: boolean; visibility: ArtifactVisibility } | null, onGone: () => void, localNote = 'Nháp trong máy bạn vẫn giữ nguyên.') {
  const [visOverride, setVisOverride] = useState<ArtifactVisibility | null>(null)
  const [removing, setRemoving] = useState<Removing>('idle')
  const visibility: ArtifactVisibility = visOverride ?? loaded?.visibility ?? 'class'
  const isMine = loaded?.isMine ?? false
  const isPrivate = visibility === 'shared'

  const remove = async () => {
    if (removing !== 'confirm') { setRemoving('confirm'); return }
    setRemoving('busy')
    if (isPrivate) {
      if (await deleteArtifact(artifactId)) onGone(); else setRemoving('error')
      return
    }
    const r = await unpublishArtifact(artifactId)
    if (!r.ok) { setRemoving('error'); return }
    if (r.result === 'deleted') { onGone(); return }
    setVisOverride('shared'); setRemoving('idle')
  }
  return {
    visibility, isPrivate, isMine, removing, remove,
    /** Người được gửi riêng KHÔNG chia sẻ tiếp; bài đã đăng thì ai xem cũng gửi được cho bạn */
    canShare: isMine || !isPrivate,
    /** Chủ bài và bài còn riêng tư */
    canPublish: isMine && isPrivate,
    removeLabel: isPrivate ? 'Gỡ bài' : 'Gỡ khỏi cộng đồng',
    confirmText: isPrivate
      ? `Bài sẽ không còn mở được với những người đã nhận. Tin nhắn trong Chat vẫn còn. ${localNote}`
      : `Bài sẽ biến mất khỏi cộng đồng. Nếu bạn đã gửi bài này cho bạn bè, họ vẫn mở được. ${localNote}`,
    markPublished: () => setVisOverride('class'),
  }
}
