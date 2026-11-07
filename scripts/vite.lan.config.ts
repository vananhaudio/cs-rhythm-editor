// Chỉ cho môi trường xem tay trong LAN (scripts/feed-comments-preview.sh): cấu hình Vite gốc + cho phép tên miền LAN (class.<ip>.nip.io).
import { mergeConfig, type ConfigEnv } from 'vite'
import base from '../vite.config'
export default (env: ConfigEnv) => mergeConfig(typeof base === 'function' ? base(env) : base, { server: { allowedHosts: true } })
