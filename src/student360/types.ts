// Student 360° — kiểu dữ liệu khớp RPC student_360_* (db/student_360_p1_setup.sql, db/student_360_p2_setup.sql).
export type Category = 'goal' | 'music_taste' | 'difficulty' | 'support_need' | 'key_topic' | 'commitment'
export type Origin = 'self_reported' | 'class_confirmed' | 'inferred'
export type Verification = 'unverified' | 'student_confirmed' | 'teacher_verified'
export type SourceKind = 'student' | 'teacher' | 'class' | 'crm_zalo' | 'mira'
export type Visibility = 'teacher' | 'student_and_teacher'

export interface Fact {
  id: string
  category: Category
  content: string
  origin: Origin
  verification: Verification
  source_kind: SourceKind
  visibility: Visibility
  status: 'active' | 'revoked'
  created_at: string
  updated_at: string
  verified_at?: string
  // Chỉ Thầy nhận được các trường dưới. Giao diện KHÔNG hiển thị source_ref (con trỏ nội bộ tới CRM).
  source_ref?: string
  created_by?: string
  verified_by?: string
  revoked_at?: string
  revoked_by?: string
  revoke_reason?: string
}

export interface Student360 {
  user_id: string
  profile: { student_id: string; display_name: string | null; level: string | null; enrolled_at: string | null; is_active: boolean | null;
             goals: string | null; learning_style: string | null; instruments: string | null } | null
  facts: Fact[]
  learning_sources: string[]
  generated_at: string
}

export interface HistoryEntry {
  at: string
  action: string
  actor: string | null
  before: Partial<Fact> | null
  after: Partial<Fact> | null
}

export interface NewFactInput {
  userId: string
  category: Category
  content: string
  origin: Origin
  sourceKind: SourceKind
  visibility?: Visibility   // gửi tường minh; bỏ trống thì máy chủ tự chọn theo origin
}

export interface Student360Api {
  get(userId: string, includeRevoked: boolean): Promise<Student360>
  add(input: NewFactInput): Promise<Fact>
  edit(factId: string, content: string): Promise<Fact>
  setVerification(factId: string, level: Verification): Promise<Fact>
  setVisibility(factId: string, visibility: Visibility): Promise<Fact>
  revoke(factId: string, reason: string | null): Promise<Fact>
  history(factId: string): Promise<HistoryEntry[]>
}
