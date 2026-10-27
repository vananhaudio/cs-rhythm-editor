// Gắn lớp API với Supabase client dùng chung của Class (JWT người dùng đăng nhập — không service role).
import { supabase } from '../supabase'
import { createStudent360Api, type RpcFn } from './api'

export const student360Api = createStudent360Api(((name, args) => supabase.rpc(name, args)) as RpcFn)
