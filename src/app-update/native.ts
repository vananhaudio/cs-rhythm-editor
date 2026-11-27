// Cầu nối tới plugin native "AppUpdate" (AppUpdatePlugin.swift / .java) và RPC chính sách.
import { registerPlugin } from '@capacitor/core'
import { supabase } from '../supabase'
import type { UpdateDeps } from './check'
import type { Installed, StoreState } from './policy'

type AppUpdateNative = {
  getInfo: () => Promise<Installed>
  checkStore: () => Promise<StoreState>
  openStore: () => Promise<void>
}
const plugin = registerPlugin<AppUpdateNative>('AppUpdate')

const realDeps: UpdateDeps = {
  getInfo: () => plugin.getInfo(),
  checkStore: () => plugin.checkStore(),
  fetchPolicy: async platform => {
    const { data, error } = await supabase.rpc('app_update_policy_get', { p_platform: platform })
    if (error) throw error
    return data
  },
}

// BẢN THỬ NGHIỆM THU (chỉ khi build với VITE_APP_UPDATE_QA=soft|force): chính sách + câu trả lời của kho là GIẢ, nằm trong máy,
// không đụng chính sách production. Phiên bản đang cài, nút mở kho, "Để sau" là thật.
// Bản phát hành KHÔNG được đặt biến này (scripts/mobile-release.sh chặn và soi lại bundle).
const QA = import.meta.env.VITE_APP_UPDATE_QA
export const nativeUpdateDeps: UpdateDeps = QA === 'soft' || QA === 'force'
  ? {
      getInfo: realDeps.getInfo,
      checkStore: async () => ({ available: true, version: '99.0.0', build: 999999 }),
      fetchPolicy: async () => ({
        latestVersion: '99.0.0', latestBuild: 999999, force: QA === 'force', notes: 'TVA-QA: đây là thông báo thử nghiệm.',
        minVersion: QA === 'force' ? '99.0.0' : null, minBuild: QA === 'force' ? 999999 : null,
      }),
    }
  : realDeps
export const openStore = () => plugin.openStore()
