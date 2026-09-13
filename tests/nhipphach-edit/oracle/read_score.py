"""Oracle độc lập: đọc MusicXML bằng music21 rồi in ra JSON.

Không nằm trong sản phẩm — chỉ để đối chiếu trong test. Ý nghĩa: nếu một thư
viện hoàn toàn khác cũng đọc ra đúng cao độ / dấu hoá / trường độ mà công cụ
định ghi, thì chỗ vá không chỉ "Verovio chấp nhận" mà là đúng chuẩn.
"""
import json
import sys

from music21 import converter, chord as m21chord


def mo_ta(n, pitch):
    a = pitch.accidental
    return {
        "ten": pitch.nameWithOctave,
        "alter": int(a.alter) if a else 0,
        # music21 tự tính dấu nào PHẢI hiện: đây là phép kiểm độc lập cho luật
        # bộ khoá + dấu hoá trong ô nhịp mà công cụ tự viết.
        "hienDau": bool(a.displayStatus) if a and a.displayStatus is not None else False,
        "phach": float(n.duration.quarterLength),
        "hinh": n.duration.type,
        "cham": n.duration.dots,
    }


def main(path, part_index, measure_number):
    score = converter.parse(path)
    part = score.parts[int(part_index) - 1]
    measure = part.measure(int(measure_number))
    out = []
    for n in measure.recurse().notesAndRests:
        if isinstance(n, m21chord.Chord):
            out.extend(mo_ta(n, p) for p in n.pitches)
        elif n.isRest:
            out.append({"ten": "rest", "alter": 0, "hienDau": False,
                        "phach": float(n.duration.quarterLength),
                        "hinh": n.duration.type, "cham": n.duration.dots})
        else:
            out.append(mo_ta(n, n.pitch))
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main(*sys.argv[1:4])
