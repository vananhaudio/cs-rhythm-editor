// /me/classes/<id>(/space) và /me/classes/<id>/sessions/<n>.
// Buổi chỉ công khai khi buổi CÓ THẬT (class_sessions) và lớp công khai.
import { defineAdapter, first, UUID_RE } from '../adapter.ts'
import { hidden, publicMeta, SITE } from '../contract.ts'
import { canonicalUrl } from '../render.ts'
import { classDescription, classTitle, loadClass } from './classes.ts'

const CLASS_RE = /^\/me\/classes\/([0-9a-f-]{36})(\/space)?$/i
const SESSION_RE = /^\/me\/classes\/([0-9a-f-]{36})\/sessions\/([1-9][0-9]{0,3})$/i

export const sessionAdapter = defineAdapter<{ classId: string; sessionNo: number }>({
  type: 'session',
  match(path) {
    const m = SESSION_RE.exec(path)
    return m && UUID_RE.test(m[1]) ? { classId: m[1].toLowerCase(), sessionNo: Number(m[2]) } : null
  },
  async load({ classId, sessionNo }, ctx) {
    const url = canonicalUrl(ctx.origin, `/me/classes/${classId}/sessions/${sessionNo}`)
    const [cls, ses] = await Promise.all([
      loadClass(ctx, `id=eq.${classId}`),
      first(ctx, `/rest/v1/class_sessions?select=session_number&class_id=eq.${classId}&session_number=eq.${sessionNo}&limit=1`),
    ])
    if (!cls || !ses) return null
    if (!cls.isPublic) return hidden('private', url)
    return publicMeta({
      title: `${classTitle(cls.name, sessionNo)} · ${SITE}`, description: classDescription(cls.name, sessionNo),
      image: cls.image, canonicalUrl: url,
    })
  },
})

export const classAdapter = defineAdapter<{ classId: string; space: boolean }>({
  type: 'class',
  match(path) {
    const m = CLASS_RE.exec(path)
    return m && UUID_RE.test(m[1]) ? { classId: m[1].toLowerCase(), space: !!m[2] } : null
  },
  async load({ classId, space }, ctx) {
    const url = canonicalUrl(ctx.origin, `/me/classes/${classId}${space ? '/space' : ''}`)
    const cls = await loadClass(ctx, `id=eq.${classId}`)
    if (!cls) return null
    if (!cls.isPublic) return hidden('private', url)
    return publicMeta({ title: `${classTitle(cls.name)} · ${SITE}`, description: classDescription(cls.name), image: cls.image, canonicalUrl: url })
  },
})
