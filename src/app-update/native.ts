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

export const nativeUpdateDeps: UpdateDeps = {
  getInfo: () => plugin.getInfo(),
  checkStore: () => plugin.checkStore(),
  fetchPolicy: async platform => {
    const { data, error } = await supabase.rpc('app_update_policy_get', { p_platform: platform })
    if (error) throw error
    return data
  },
}
export const openStore = () => plugin.openStore()
