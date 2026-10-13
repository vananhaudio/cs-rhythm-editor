import { NO_BAND_CHOICE, NO_BAND_LABEL, sortedBands } from './libraryBands.ts'
import type { BandChoices } from './libraryBands.ts'

/** "Lưu vào Band" — chọn Band sở hữu khi LƯU BÀI MỚI. Không hiện nếu tài khoản không có Band hợp lệ (luồng lưu cũ). */
export default function BandOwnerField({ choices, value, onChange, disabled = false, className = 'cl-field cl-field-band', invalid = false }: {
  choices: BandChoices
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  invalid?: boolean
}) {
  if (!choices.bands.length) return null
  return <label className={className}>Lưu vào Band *
    <select value={value} onChange={event => onChange(event.target.value)} disabled={disabled} aria-invalid={invalid} data-testid="band-owner">
      {(choices.admin || !value) && <option value="">— Chọn Band</option>}
      {sortedBands(choices.bands).map(band => <option key={band.id} value={band.id}>{band.name}</option>)}
      {choices.admin && <option value={NO_BAND_CHOICE}>{NO_BAND_LABEL}</option>}
    </select>
  </label>
}
