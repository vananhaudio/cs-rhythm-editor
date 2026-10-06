"""Cấu hình engine. MỌI ngưỡng là cấu hình, không phải chân lý — được ghi vào `pipeline.config` của mỗi kết quả
để sau này hiệu chuẩn bằng corpus lớn hơn."""
from dataclasses import asdict, dataclass, field


@dataclass
class FallbackConfig:
    # Chỉ có nghĩa với trang scan (OCR local). Giá trị mặc định = điểm xuất phát đo trên corpus nhỏ (Tình ca, Chuyến Tàu), CHƯA hiệu chuẩn.
    min_mean_lyric_confidence: float = 0.75   # LOW_OCR_CONFIDENCE khi trung bình độ tin cậy dòng lời OCR thấp hơn
    max_noise_ratio: float = 0.25             # HIGH_NOISE_RATIO khi tỉ lệ dòng nhiễu (không phải lời/hợp âm) cao hơn
    min_title_confidence: float = 0.5         # tiêu đề OCR dưới mức này coi như chưa có
    require_notation_fields: bool = True      # trang có khuông: nhịp + khoá là bắt buộc (local không đọc được → METADATA_MISSING)
    max_irregular_systems: int = 0            # STAFF_LYRIC_MISMATCH khi số khuông có số hàng lời khác số hàng thường gặp vượt mức này
    force_vision: bool = False                # USER_REQUESTED


@dataclass
class ExtractConfig:
    lang: str = "vie"
    tessdata_dir: str | None = None           # None = mặc định của tesseract (hoặc env CHORD_EXTRACT_TESSDATA)
    ocr_scale: float = 1.5
    ocr_psm: int = 6
    upscale_below_px: int = 1100              # ảnh rộng < ngưỡng này (~72 dpi) phóng 2× trước khi dò khuông/OCR
    min_text_chars: int = 20                  # trang có text layer khi ≥ ngần này ký tự…
    min_text_quality: float = 0.85            # …và ≥ ngần này ký tự đọc được
    max_pages: int = 20                       # hạ tầng: PDF nhiều trang hơn → too_large (không ảnh hưởng chất lượng đọc)
    force_ocr: bool = False                   # bỏ qua text layer (thử nghiệm/so sánh)
    max_vision_pages: int = 6
    vision_max_side_px: int = 2000
    metadata_prefer_local_conf: float = 0.9   # khi Vision và local khác nhau: local thắng nếu tin cậy ≥ mức này
    fallback: FallbackConfig = field(default_factory=FallbackConfig)

    def to_dict(self):
        return asdict(self)
