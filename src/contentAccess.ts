// ════════════════════════════════════════════════════════════════════════════
// LEGACY FALLBACK — DO NOT ADD NEW ACCESS LOGIC HERE.
// Canonical access = server RPC my_learning_state() (db/learning_state_setup.sql,
// docs/SERVER_DRIVEN_ARCHITECTURE.md). File này chỉ còn phục vụ:
//   1. EMERGENCY fallback khi app_config.learning_state_mode = 'client';
//   2. hai màn desktop legacy (LessonViewerPage, StudentPortalV2) chưa chuyển.
// TODO(cleanup): sau khi build 18 ổn định production đủ lâu (không cần rollback),
// chuyển 2 màn desktop sang learningState rồi XOÁ resolver này trong release bảo trì.
// Muốn đổi luật quyền → sửa RPC + chạy db/tests/learning_state_test.sql.
// ════════════════════════════════════════════════════════════════════════════
export type EntitlementTier = 'free' | 'khoi_dau_99' | 'can_ban_396' | 'nang_cao_499'
export type LegacyTier = 'free' | 'basic' | 'standard' | 'pro'
export type ContentVisibility = 'visible' | 'hidden'
export type ContentAvailability = 'available' | 'coming_soon'
export type LessonPolicyMode = 'inherit' | 'override'

export type ContentPolicySource = 'content_policy' | 'legacy'

export interface CourseAccessPolicyFields {
  access_policy_enabled?: boolean | null
  required_tier?: string | null
  visibility?: string | null
  availability?: string | null
  allow_preview?: boolean | null
  status?: string | null
  is_free?: boolean | null
}

export interface LessonAccessPolicyFields {
  access_policy_mode?: string | null
  required_tier?: string | null
  visibility?: string | null
  availability?: string | null
  allow_preview?: boolean | null
  tier?: string | null
}

export interface ResolvedContentAccess {
  policySource: ContentPolicySource
  visible: boolean
  available: boolean
  requiredTier: EntitlementTier
  effectiveTier: EntitlementTier
  canAccess: boolean
  canPreview: boolean
  reason: 'ok' | 'hidden' | 'coming_soon' | 'requires_upgrade' | 'preview'
}

export const ENTITLEMENT_TIER_ORDER: EntitlementTier[] = ['free', 'khoi_dau_99', 'can_ban_396', 'nang_cao_499']

export const ENTITLEMENT_TIER_LABEL: Record<EntitlementTier, string> = {
  free: 'Miễn phí',
  khoi_dau_99: 'Khởi đầu',
  can_ban_396: 'Căn bản',
  nang_cao_499: 'Nâng cao',
}

export const LEGACY_TO_ENTITLEMENT_TIER: Record<string, EntitlementTier> = {
  free: 'free',
  basic: 'khoi_dau_99',
  standard: 'can_ban_396',
  pro: 'nang_cao_499',
  khoi_dau_99: 'khoi_dau_99',
  can_ban_396: 'can_ban_396',
  nang_cao_499: 'nang_cao_499',
}

export function normalizeEntitlementTier(tier?: string | null): EntitlementTier {
  return LEGACY_TO_ENTITLEMENT_TIER[tier ?? ''] ?? 'free'
}

export function hasTier(effectiveTier: EntitlementTier, requiredTier: EntitlementTier) {
  return ENTITLEMENT_TIER_ORDER.indexOf(effectiveTier) >= ENTITLEMENT_TIER_ORDER.indexOf(requiredTier)
}

export function resolveCourseAccess(
  courseInput: CourseAccessPolicyFields | null | undefined,
  effectiveTier: EntitlementTier,
  options: { legacyUnlocked?: boolean; preview?: boolean } = {},
): ResolvedContentAccess {
  // Dữ liệu legacy có thể có enrollment mồ côi (khoá đã xoá → join null). Null = khoá legacy mặc định.
  const course: CourseAccessPolicyFields = courseInput ?? {}
  const policyEnabled = course.access_policy_enabled === true
  const legacyHidden = (course.status ?? 'on') === 'off'
  const legacyComingSoon = (course.status ?? 'on') === 'coming_soon'
  const visible = policyEnabled ? (course.visibility ?? 'visible') === 'visible' : !legacyHidden
  const available = policyEnabled ? (course.availability ?? 'available') === 'available' : !legacyComingSoon
  const requiredTier = policyEnabled
    ? normalizeEntitlementTier(course.required_tier)
    : (course.is_free === false ? 'khoi_dau_99' : 'free')
  const canPreview = policyEnabled ? course.allow_preview === true : requiredTier === 'free'
  const tierAccess = hasTier(effectiveTier, requiredTier)
  const canAccess = !!options.preview || (visible && available && (tierAccess || !!options.legacyUnlocked || canPreview))

  return {
    policySource: policyEnabled ? 'content_policy' : 'legacy',
    visible,
    available,
    requiredTier,
    effectiveTier,
    canAccess,
    canPreview,
    reason: !visible ? 'hidden' : !available ? 'coming_soon' : tierAccess || options.legacyUnlocked || options.preview ? 'ok' : canPreview ? 'preview' : 'requires_upgrade',
  }
}

export function resolveLessonAccess(
  lessonInput: LessonAccessPolicyFields | null | undefined,
  courseInput: CourseAccessPolicyFields | null | undefined,
  effectiveTier: EntitlementTier,
  options: { courseLegacyUnlocked?: boolean; preview?: boolean } = {},
): ResolvedContentAccess {
  const lesson: LessonAccessPolicyFields = lessonInput ?? {}
  const course: CourseAccessPolicyFields = courseInput ?? {}
  const courseAccess = resolveCourseAccess(course, effectiveTier, {
    legacyUnlocked: options.courseLegacyUnlocked,
    preview: options.preview,
  })
  const mode = lesson.access_policy_mode ?? 'inherit'
  const coursePolicyEnabled = course.access_policy_enabled === true
  const lessonOverrides = coursePolicyEnabled && mode === 'override'

  if (!lessonOverrides) {
    if (courseAccess.policySource === 'legacy') {
      const legacyRequiredTier = normalizeEntitlementTier(lesson.tier ?? (course.is_free === false ? 'basic' : 'free'))
      const lessonPreview = legacyRequiredTier === 'free'
      const tierAccess = hasTier(effectiveTier, legacyRequiredTier)
      const canAccess = !!options.preview || (courseAccess.visible && courseAccess.available && (tierAccess || !!options.courseLegacyUnlocked || lessonPreview))
      return {
        policySource: 'legacy',
        visible: courseAccess.visible,
        available: courseAccess.available,
        requiredTier: legacyRequiredTier,
        effectiveTier,
        canAccess,
        canPreview: lessonPreview,
        reason: !courseAccess.visible ? 'hidden' : !courseAccess.available ? 'coming_soon' : tierAccess || options.courseLegacyUnlocked || options.preview ? 'ok' : lessonPreview ? 'preview' : 'requires_upgrade',
      }
    }
    return courseAccess
  }

  const visible = courseAccess.visible && (lesson.visibility ?? 'visible') === 'visible'
  const available = courseAccess.available && (lesson.availability ?? 'available') === 'available'
  const requiredTier = normalizeEntitlementTier(lesson.required_tier ?? course.required_tier)
  const canPreview = lesson.allow_preview === true
  const tierAccess = hasTier(effectiveTier, requiredTier)
  const canAccess = !!options.preview || (visible && available && (tierAccess || canPreview))

  return {
    policySource: 'content_policy',
    visible,
    available,
    requiredTier,
    effectiveTier,
    canAccess,
    canPreview,
    reason: !visible ? 'hidden' : !available ? 'coming_soon' : tierAccess || options.preview ? 'ok' : canPreview ? 'preview' : 'requires_upgrade',
  }
}
