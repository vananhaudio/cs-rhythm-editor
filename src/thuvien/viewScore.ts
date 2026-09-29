import { DEFAULT_SCORE_SETTINGS } from '../musicxml-beats/renderer/types.ts'
import type { ScorePage, ScoreSettings } from '../musicxml-beats/renderer/types.ts'

/**
 * Chế độ XEM của Thư viện: cùng bộ khắc Verovio của Nhịp Phách
 * (`createAnnotatedScoreRenderer`), chỉ tắt lớp số phách — bản nhạc hiện đúng
 * như MusicXML gốc, không thêm nhãn nào.
 */
export const VIEW_SETTINGS: ScoreSettings = { ...DEFAULT_SCORE_SETTINGS, showBeats: false }

export const ZOOM_STEPS = [100, 150, 200, 250] as const
export type Zoom = typeof ZOOM_STEPS[number]

type Renderer = { render(xml: string, settings?: ScoreSettings): { pages: ScorePage[] } }

export function renderPagesForView(renderer: Renderer, xml: string): ScorePage[] {
  return renderer.render(xml, VIEW_SETTINGS).pages
}

/** Trang SVG hiện bằng <img> như chế độ xem của Nhịp Phách: không script nào của SVG chạy được. */
export const pageSrc = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** `?bai=<id>` — mở lại/chia sẻ được đúng bản đang xem; id sai dạng thì bỏ qua. */
export function scoreIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get('bai')?.trim() ?? ''
  return UUID.test(id) ? id.toLowerCase() : null
}
