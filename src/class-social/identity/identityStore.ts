// Nạp danh tính học tập theo LÔ: mọi nhãn trên màn hình gom user_id trong cùng một nhịp → MỘT lần gọi
// social_learning_identities (không N+1). Cache theo phiên (danh tính hiếm khi đổi). Chưa có hàm / lỗi mạng
// → coi như không có nhãn (không hiện lỗi, không thử lại liên tục).
import { useEffect, useSyncExternalStore } from 'react'
import { NO_IDENTITY, buildIdentities, type LearningIdentities, type MembershipRow } from './learningIdentity'

const cache = new Map<string, LearningIdentities>()
const pending = new Set<string>()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null
const BATCH = 200

async function flush() {
  timer = null
  const ids = [...pending]
  pending.clear()
  // Nạp client ĐỘNG (như comments/lazyApi): component lá không kéo supabase vào lúc import (test render trên Node)
  const { supabase } = await import('../../supabase')
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH)
    try {
      const { data, error } = await supabase.rpc('social_learning_identities', { p_users: chunk })
      if (error && import.meta.env.DEV) console.warn('[class-social] social_learning_identities:', error.code, error.message)
      const rows = (error ? [] : data ?? []) as { user_id: string; memberships: MembershipRow[]; ht_member?: boolean }[]
      for (const r of rows) cache.set(r.user_id, buildIdentities(r.memberships, undefined, r.ht_member === true))
    } catch { /* coi như không có nhãn */ }
    for (const id of chunk) if (!cache.has(id)) cache.set(id, NO_IDENTITY)
  }
  listeners.forEach(l => l())
}

function request(userId: string) {
  if (cache.has(userId) || pending.has(userId)) return
  pending.add(userId)
  if (!timer) timer = setTimeout(() => void flush(), 0)
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

/** Danh tính học tập của một người (null = đang tải / chưa biết). */
export function useLearningIdentity(userId: string | null | undefined): LearningIdentities | null {
  const value = useSyncExternalStore(subscribe, () => (userId ? cache.get(userId) ?? null : NO_IDENTITY), () => null)
  useEffect(() => { if (userId) request(userId) }, [userId])
  return value
}
