import type { RhythmScrollData } from '../../../src/rhythm-scroll/index.ts'

/**
 * "Chuyến Tàu Hoàng Hôn — fixture only".
 *
 * SỐ Ô NHỊP Ở ĐÂY LÀ GIẢ ĐỊNH để thử hợp đồng dữ liệu, CHƯA đối chiếu với bản nhạc thật — đừng dùng
 * làm dữ liệu bài hát. Không chứa lời: `line` chỉ là chỉ số dòng trong một văn bản lời + hợp âm giả định.
 * Chỉ nằm trong tests/, không vào bundle production.
 */
export const CHUYEN_TAU_HOANG_HON_FIXTURE: RhythmScrollData = {
  version: 1,
  songId: 'fixture:chuyen-tau-hoang-hon',
  lyricsHash: 'fixture-lyrics-hash',
  meter: { beats: 4, beatType: 4 },
  totalMeasures: 52,
  segments: [
    { line: null, measureCount: 4, label: 'Dạo' },
    { line: 0, measureCount: 4 },
    { line: 1, measureCount: 4 },
    { line: 2, measureCount: 4 },
    { line: 3, measureCount: 4, confidence: 0.62 },
    { line: 4, lineCount: 2, measureCount: 8, label: 'ĐK' },
    { line: 6, lineCount: 2, measureCount: 8 },
    { line: null, measureCount: 4, label: 'Gian tấu' },
    // Điệp khúc hát lại: trải phẳng theo thứ tự biểu diễn, nên chỉ số dòng quay về 4.
    { line: 4, lineCount: 2, measureCount: 8, label: 'ĐK' },
    { line: 8, measureCount: 4, label: 'Kết' },
  ],
  provenance: {
    sourceType: 'manual',
    sourceHash: 'fixture-source-hash',
    generator: 'tests/rhythm-scroll fixture',
    generatedAt: '2026-10-03T00:00:00.000Z',
  },
}
