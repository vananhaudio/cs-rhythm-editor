// ── RHYTHM SCROLL VIEWER — đường đi của BOUNCING BALL (thuần, không DOM) ──
// Ball là CHỈ DẪN ĐỌC, không phải karaoke: ta không biết chữ nào rơi vào phách nào và không suy ra điều đó.
// Chỉ dùng đúng hai con số của lõi:
//   segmentProgress → ball đi tới đâu trên ĐƯỜNG ĐỌC của segment (trái → phải, hết hàng thì xuống hàng kế)
//   measureProgress → một cú nảy cho MỖI Ô NHỊP (không phải mỗi phách)
// DOM chỉ cấp hình học của các chữ; mọi phép tính nằm ở đây để test được.

/** Làn trống phía trên mỗi hàng chữ (px) — ball nảy trong làn này nên không che hợp âm hay lời hàng trên. */
export const BALL_LANE = 34
export const BALL_RADIUS = 7
/** Độ cao cú nảy: từ sát mép dưới làn lên sát mép trên làn. */
export const BALL_AMPLITUDE = BALL_LANE - 2 * BALL_RADIUS - 2

/** Hộp một từ (đã gồm làn trống phía trên), đo trong hệ toạ độ của nội dung. */
export interface WordBox {
  left: number
  right: number
  top: number
}

/** Một HÀNG NHÌN THẤY trên màn hình: câu dài bị xuống hàng thì thành nhiều hàng. */
export interface ReadingRow {
  left: number
  right: number
  top: number
}

export interface BallPoint {
  /** Tâm ball, trong hệ toạ độ của nội dung (px). */
  x: number
  y: number
  /** Hàng ball đang đứng (0-based trong segment). */
  row: number
  /** 0 = sát chữ, 1 = đỉnh cú nảy. */
  lift: number
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)

/** Gom các từ THEO THỨ TỰ ĐỌC thành hàng: từ nào đổi mép trên là bắt đầu hàng mới. */
export function buildReadingRows(boxes: readonly WordBox[]): ReadingRow[] {
  return assignReadingRows(boxes).rows
}

/** Như buildReadingRows, kèm `rowOf[i]` = hàng chứa từ thứ i. */
export function assignReadingRows(boxes: readonly WordBox[]): { rows: ReadingRow[]; rowOf: number[] } {
  const rows: ReadingRow[] = []
  const rowOf: number[] = []
  for (const box of boxes) {
    const current = rows[rows.length - 1]
    if (current && Math.abs(box.top - current.top) <= 2) {
      current.left = Math.min(current.left, box.left)
      current.right = Math.max(current.right, box.right)
    } else {
      rows.push({ left: box.left, right: box.right, top: box.top })
    }
    rowOf.push(rows.length - 1)
  }
  return { rows, rowOf }
}

/** Một điểm trên đường đọc: hàng nào, x bao nhiêu. */
export interface PathPoint {
  row: number
  x: number
}

/** Quãng đường (px) từ đầu đường đọc tới điểm — các hàng nối đuôi nhau, không tính khoảng trống giữa hàng. */
export function pathOffset(rows: readonly ReadingRow[], point: PathPoint): number {
  let offset = 0
  for (let index = 0; index < point.row; index++) offset += Math.max(0, rows[index].right - rows[index].left)
  const row = rows[point.row]
  return offset + Math.min(Math.max(point.x - row.left, 0), Math.max(0, row.right - row.left))
}

/**
 * Ball đi từ neo của ô hiện tại tới neo của ô kế theo ĐƯỜNG ĐỌC: hết phần còn lại của hàng này rồi sang mép
 * trái hàng sau — không bay chéo. Hai neo trùng nhau (ô ngân) → X đứng yên, Y vẫn nảy một lần.
 */
export function ballBetweenAnchors(rows: readonly ReadingRow[], from: PathPoint, to: PathPoint, measureProgress: number, bounce = true): BallPoint | null {
  if (!rows[from.row] || !rows[to.row]) return null
  const progress = clamp01(measureProgress)
  const lift = bounce ? Math.sin(Math.PI * progress) : 0
  const point = (row: number, x: number): BallPoint => ({
    x, row, lift, y: rows[row].top + BALL_LANE - BALL_RADIUS - 1 - lift * BALL_AMPLITUDE,
  })
  const start = pathOffset(rows, from)
  const travelled = Math.max(0, pathOffset(rows, to) - start) * progress
  // Chưa rời neo (đầu ô, hoặc ô ngân): đứng ĐÚNG tại neo hiện tại, không trượt sang hàng sau.
  if (travelled === 0) return point(from.row, Math.min(Math.max(from.x, rows[from.row].left), rows[from.row].right))
  // Hàng cuối cùng (không vượt quá hàng của neo kế) có điểm đầu ≤ quãng đường đã đi.
  const target = start + travelled
  let rowStart = 0
  let index = 0
  for (let row = 0; row <= to.row; row++) {
    const width = Math.max(0, rows[row].right - rows[row].left)
    index = row
    if (row === to.row || rowStart + width > target) break
    rowStart += width
  }
  const width = Math.max(0, rows[index].right - rows[index].left)
  return point(index, rows[index].left + Math.min(Math.max(target - rowStart, 0), width))
}

/**
 * Vị trí ball. X: đi hết bề ngang hàng 1 rồi BẮT ĐẦU LẠI ở mép trái hàng 2 — quãng đường chia theo bề ngang
 * thật của từng hàng, không bao giờ bay chéo qua khoảng trống. X không reset theo ô nhịp.
 * Y: thấp ở đầu ô, cao nhất giữa ô, thấp lại ở cuối ô.
 * Trả null khi segment không có hàng chữ nào (đoạn không lời, hoặc chưa đo được).
 */
export function ballPoint(rows: readonly ReadingRow[], segmentProgress: number, measureProgress: number, bounce = true): BallPoint | null {
  if (!rows.length) return null
  const widths = rows.map(row => Math.max(0, row.right - row.left))
  const total = widths.reduce((sum, width) => sum + width, 0)
  let remaining = clamp01(segmentProgress) * total
  let index = 0
  while (index < rows.length - 1 && remaining >= widths[index]) {
    remaining -= widths[index]
    index++
  }
  const row = rows[index]
  const lift = bounce ? Math.sin(Math.PI * clamp01(measureProgress)) : 0
  return {
    x: row.left + Math.min(remaining, widths[index]),
    y: row.top + BALL_LANE - BALL_RADIUS - 1 - lift * BALL_AMPLITUDE,
    row: index,
    lift,
  }
}
