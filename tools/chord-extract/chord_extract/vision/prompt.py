"""Lời nhắc trung lập nhà cung cấp. Dùng chung cho mọi adapter để kết quả so sánh được."""

SCHEMA_TEXT = """{
 "title": string|null, "author": string|null,
 "timeSignature": {"beats":int,"beatType":int}|null,
 "key": {"fifths": int (âm = số dấu giáng, dương = số dấu thăng), "evidence": string}|null,
 "directions": [string],
 "chords": "DETECTED"|"NO_CHORDS_DETECTED",
 "chordSymbols": [string],
 "pages": [ {"printedPageNumber": string|null, "systems": [ [ "dòng lời 1 của khuông", "dòng lời 2 của khuông" ] ] } ]
}"""


def build_prompt(request, image_names):
    order = ", ".join(f"{n} = trang {p.index}" for n, p in zip(image_names, request.pages))
    return (
        "Bạn là bộ đọc bản nhạc (sheet music) cho thư viện hợp âm. Đọc các ảnh trang theo thứ tự: " + order + ".\n"
        "CHỈ trả về MỘT khối JSON, không giải thích, theo đúng khuôn:\n" + SCHEMA_TEXT + "\n"
        "Quy tắc: giữ ĐÚNG chữ in và dấu tiếng Việt trên trang, không sửa chính tả, không đoán chữ không nhìn thấy. "
        "Mảng \"pages\" phải có đúng một phần tử cho mỗi ảnh, theo thứ tự ảnh. "
        "\"systems\" là danh sách khuông từ trên xuống; mỗi khuông liệt kê các hàng lời dưới nó từ trên xuống. "
        "Chỉ liệt kê hợp âm (Am, G7...) nếu chúng được IN trên trang; tuyệt đối không suy hợp âm từ giai điệu hay hoà âm."
    )
