// Một lượt kiểm tra. Mọi lỗi / quá giờ → { kind: 'none' }: máy chủ hay kho trục trặc không bao giờ chặn việc học.
import { behindPolicy, decide, toPolicy, type Decision, type Installed, type Platform, type StoreState } from './policy'

export type UpdateDeps = {
  getInfo: () => Promise<Installed>
  fetchPolicy: (platform: Platform) => Promise<unknown>
  checkStore: () => Promise<StoreState>
}

const TIMEOUT_MS = 10_000
function within<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('quá giờ')), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

export async function checkForUpdate(deps: UpdateDeps, timeoutMs = TIMEOUT_MS): Promise<Decision> {
  try {
    const me = await within(deps.getInfo(), timeoutMs)
    if (me.platform !== 'ios' && me.platform !== 'android') return { kind: 'none' }
    const policy = toPolicy(await within(deps.fetchPolicy(me.platform), timeoutMs))
    if (!behindPolicy(me, policy)) return { kind: 'none' }
    return decide(me, policy, await within(deps.checkStore(), timeoutMs))
  } catch {
    return { kind: 'none' }
  }
}
