#!/usr/bin/env python3
"""Sinh sheet TỔNG HỢP (không bản quyền) cho test analyzer: khuông 5 dòng, vạch nhịp, nốt có đuôi + đầu nốt,
"chữ" = khối mực gồm vài "chữ cái" (khe nhỏ) cách nhau khe từ lớn. Biết trước đáp án → test chính xác tuyệt đối.

stdin JSON: { "out": "x.png" | "x.pdf" (ảnh nhúng) | "x.vector.pdf" (nét vẽ, "pages": N), "systems": [ { "items": ["w","w","|","w","|","|", "s", ...] } ], "tab": false, "skew": 0.0,
              "width": 900, "gap": 8 }
  "w" / "wN" = một chữ N chữ cái (mặc định 3; độ rộng theo N) có nốt phía trên; "|" = vạch nhịp; "s" = nốt có đuôi KHÔNG có chữ (đuôi nốt phủ cả khuông).
Mỗi khuông luôn kết thúc bằng vạch ở mép phải.
"""
import json
import sys
import zlib

from PIL import Image, ImageDraw


def draw(spec):
    gap = spec.get("gap", 8)
    width = spec.get("width", 900)
    left, right = 60, width - 40
    system_h = gap * 4 + gap * 9 + (gap * 8 if spec.get("tab") else 0)
    height = 80 + len(spec["systems"]) * (system_h + gap * 4)
    img = Image.new("L", (width, height), 250)
    prims = []

    class Rec:
        """Vẽ lên ảnh VÀ ghi lại nét (để xuất PDF vector cùng hình)."""
        def __init__(self, draw):
            self.draw = draw

        def line(self, xy, fill=0, width=1):
            prims.append(("line", xy)); self.draw.line(xy, fill=fill, width=width)

        def rectangle(self, xy, fill=0):
            prims.append(("rect", xy)); self.draw.rectangle(xy, fill=fill)

        def ellipse(self, xy, fill=0):
            prims.append(("rect", xy)); self.draw.ellipse(xy, fill=fill)

    d = Rec(ImageDraw.Draw(img))
    y = 60
    for system in spec["systems"]:
        lines = [y + k * gap for k in range(5)]
        for ly in lines:
            d.line([left, ly, right, ly], fill=20, width=1)
        d.line([left, lines[0], left, lines[4]], fill=20, width=1)          # nét mở đầu khuông (không phải vạch)
        items = system["items"]
        step = (right - left - 4 * gap) / (len(items) + 1)
        x = left + 3 * gap
        for item in items:
            x += step
            if item == "|":
                d.line([int(x), lines[0], int(x), lines[4]], fill=15, width=1)
            elif item[0] in ("w", "s"):
                head_y = lines[3] - gap // 2
                d.ellipse([int(x) - gap // 2 - 1, head_y - gap // 2, int(x) + gap // 2 + 1, head_y + gap // 2], fill=15)
                d.line([int(x) + gap // 2, lines[0] - 2 * gap, int(x) + gap // 2, head_y], fill=15, width=1)
                if item[0] == "w":
                    ly = lines[4] + 3 * gap
                    cx = int(x) - gap
                    for _ in range(int(item[1:] or 3)):                                       # 3 "chữ cái", khe 1 px
                        d.rectangle([cx, ly, cx + gap // 2, ly + int(1.2 * gap)], fill=25)
                        cx += gap // 2 + 2
        d.line([right, lines[0], right, lines[4]], fill=15, width=1)        # vạch cuối khuông
        y = lines[4] + gap * 9
        if spec.get("tab"):
            for k in range(6):
                d.line([left, y + k * gap, right, y + k * gap], fill=20, width=1)
            d.line([right, y, right, y + 5 * gap], fill=15, width=1)
            y += gap * 8
        y += gap * 4
    if spec.get("skew"):
        img = img.rotate(spec["skew"], fillcolor=250, resample=Image.BICUBIC)
    if spec["out"].endswith(".vector.pdf"):
        write_vector_pdf(prims, img.size, spec["out"], spec.get("pages", 1))
    elif spec["out"].endswith(".pdf"):
        write_pdf(img, spec["out"])
    else:
        img.save(spec["out"])


def write_vector_pdf(prims, size, out, pages):
    """PDF VECTOR nhiều trang (nét vẽ, không ảnh) — giống PDF xuất từ phần mềm chép nhạc. Mỗi trang lặp lại cùng hình."""
    w, h = size
    ops = [b"0 g 0 G 1 w"]
    for kind, xy in prims:
        if kind == "line":
            x1, y1, x2, y2 = xy
            ops.append(b"%.1f %.1f m %.1f %.1f l S" % (x1 + 0.5, h - y1 - 0.5, x2 + 0.5, h - y2 - 0.5))
        else:
            x1, y1, x2, y2 = xy
            ops.append(b"%.1f %.1f %.1f %.1f re f" % (x1, h - y2 - 1, x2 - x1 + 1, y2 - y1 + 1))
    content = b"\n".join(ops)
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", None]
    kids = []
    for _ in range(pages):
        objs.append(b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream")
        content_id = len(objs)
        objs.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] /Contents %d 0 R >>" % (w, h, content_id))
        kids.append(len(objs))
    objs[1] = b"<< /Type /Pages /Kids [%s] /Count %d >>" % (b" ".join(b"%d 0 R" % k for k in kids), pages)
    data, offsets = bytearray(b"%PDF-1.4\n"), []
    for i, obj in enumerate(objs, 1):
        offsets.append(len(data)); data += b"%d 0 obj\n" % i + obj + b"\nendobj\n"
    xref = len(data)
    data += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offsets)
    data += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    with open(out, "wb") as f:
        f.write(data)


def write_pdf(img, out):
    """PDF một trang nhúng ảnh xám KHÔNG mất dữ liệu (FlateDecode) — giống PDF scan; không nén JPEG lại."""
    w, h = img.size
    raw = zlib.compress(img.tobytes())
    content = b"q %d 0 0 %d 0 0 cm /Im0 Do Q" % (w, h)
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>",
            b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>" % (w, h),
            b"<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length %d >>\nstream\n" % (w, h, len(raw)) + raw + b"\nendstream",
            b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream"]
    data, offsets = bytearray(b"%PDF-1.4\n"), []
    for i, obj in enumerate(objs, 1):
        offsets.append(len(data)); data += b"%d 0 obj\n" % i + obj + b"\nendobj\n"
    xref = len(data)
    data += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offsets)
    data += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    with open(out, "wb") as f:
        f.write(data)


if __name__ == "__main__":
    draw(json.load(sys.stdin))
