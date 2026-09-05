import { supabase } from './supabase'
export interface PackageDefinition { id: string; name: string; package_code: string; config: { renew_months?: number; store_only?: boolean; default_course_codes?: string[] } }
export interface StudentPackage {
 id: number; student_id: string; package_id: string | null; name: string; package_code: string
 starts_at: string; renews_at: string | null; source: string; status: string; display_status: string
 is_active: boolean; auto_renew: boolean | null; entitlement_id: number | null; legacy_unclassified: boolean
}
export interface PackageHistory { id: number; action: string; created_at: string; before_state: StudentPackage | null; after_state: StudentPackage }
export interface PackageSnapshot { now: string; packages: PackageDefinition[]; records: StudentPackage[]; history: PackageHistory[] }
export async function loadStudentPackages(studentId?: string): Promise<PackageSnapshot> {
 const { data, error } = await supabase.rpc('admin_student_packages', { p_student: studentId ?? null })
 if (error) throw new Error(error.message)
 if (!data || !Array.isArray(data.records)) throw new Error('Chưa tải được gói học')
 return data as PackageSnapshot
}
export const PACKAGE_SOURCE: Record<string,string> = { apple:'Apple', google_play:'Google Play', web:'Web', admin:'Admin' }
export const PACKAGE_STATUS: Record<string,string> = {active:'Đang hiệu lực',expiring:'Sắp hết hạn',expired:'Đã hết hạn',cancelled:'Đã kết thúc',revoked:'Đã thu hồi',superseded:'Đã gia hạn',scheduled:'Chưa bắt đầu',past_due:'Tạm ngưng',trialing:'Dùng thử'}
export const packageDate = (s: string | null) => s ? new Date(s).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Vĩnh viễn / legacy'
export function packageSummary(rows: StudentPackage[]) {
 const active=rows.filter(r=>r.is_active)
 return active.length ? active : rows.filter(r=>r.status!=='superseded').slice(0,1)
}
