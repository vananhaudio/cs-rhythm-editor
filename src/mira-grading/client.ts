import { supabase } from '../supabase'
import { createMiraGradingApi, type RpcFn } from './api'

export const miraGradingApi = createMiraGradingApi(((name, args) => supabase.rpc(name, args)) as RpcFn)
