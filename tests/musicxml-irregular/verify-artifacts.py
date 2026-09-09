"""Kiểm định PDF/PNG do trình duyệt thật tạo ra cho nhịp lẻ, độc lập với bộ xuất.
Chạy sau khi harness ghi artifacts vào docs/musicxml-irregular/output.
Cần pypdf, Pillow, numpy, Poppler (pdftoppm)."""
import importlib.util, json, unittest
from pathlib import Path
from pypdf import PdfReader
spec = importlib.util.spec_from_file_location(
    'approved_export_checks',
    Path(__file__).resolve().parents[1] / 'musicxml-export/verify-artifacts.py')
base = importlib.util.module_from_spec(spec); spec.loader.exec_module(base)
base.ROOT = Path(__file__).resolve().parents[2] / 'docs/musicxml-irregular/output'

# Nhãn hai chữ số (7/8 phách nhỏ ở bản dài) khiến Poppler tách một nhãn thành
# nhiều vệt; gộp lại trước khi so, y như Giai đoạn 7. File dùng chung không đổi.
_components = base.centers
def _labels(mask):
    import numpy as _np
    pts = _components(mask)
    n = len(pts)
    if not n: return pts
    parent = list(range(n))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]; i = parent[i]
        return i
    for i in range(n):
        for j in range(i + 1, n):
            if abs(pts[i][1] - pts[j][1]) <= 14 and abs(pts[i][0] - pts[j][0]) <= 10:
                a, b_ = find(i), find(j)
                if a != b_: parent[a] = b_
    groups = {}
    for i in range(n): groups.setdefault(find(i), []).append(i)
    return _np.array([_np.mean([pts[i] for i in g], axis=0) for g in groups.values()])
base.centers = _labels

# (thư mục, số nhãn) — suy từ nhịp và cách chia, không lấy từ artifact đang kiểm.
EXPECT = {
 'five-2-3-pulses':5,'five-2-3-compound':2,'five-3-2-pulses':5,'five-3-2-compound':2,
 'five-plain-pulses':5,'five-plain-compound':0,
 'five-plain-user-pulses':5,'five-plain-user-compound':2,
 'seven-2-2-3-pulses':7,'seven-2-2-3-compound':3,'seven-2-3-2-pulses':7,'seven-2-3-2-compound':3,
 'seven-3-2-2-pulses':7,'seven-3-2-2-compound':3,'seven-plain-pulses':7,'seven-plain-compound':0,
 'five-plain-whole-rest-user-pulses':5,'five-plain-whole-rest-user-compound':2,
 'seven-plain-whole-rest-user-pulses':7,'seven-plain-whole-rest-user-compound':3,
 'five-2-3-sustained-pulses':5,'five-2-3-sustained-compound':2,
 'five-2-3-syncopation-pulses':5,'five-2-3-syncopation-compound':2,
 'five-2-3-two-voices-pulses':5,'five-2-3-two-voices-compound':2,
 'five-2-3-tuplet-pulses':5,'five-2-3-tuplet-compound':2,
 'five-2-3-lyrics-pulses':5,'five-2-3-lyrics-compound':2,
 'seven-2-2-3-lyrics-pulses':7,'seven-2-2-3-lyrics-compound':3,
 'pickup-five-2-2-3-pulses':7,'pickup-five-2-2-3-compound':2,
 'pickup-five-2-3-2-pulses':7,'pickup-five-2-3-2-compound':3,
 'pickup-seven-2-2-3-pulses':11,'pickup-seven-2-2-3-compound':4,
 'pickup-seven-2-3-2-pulses':11,'pickup-seven-2-3-2-compound':4,
 'pickup-seven-3-2-2-pulses':11,'pickup-seven-3-2-2-compound':5,
 'grouping-change-pulses':14,'grouping-change-compound':6,
 'mixed-meter-pulses':49,'mixed-meter-compound':23,
 'stress-seven-pulses':700,'stress-seven-compound':300,
}
# Vị trí phách lớn viết tay theo đặc tả (đơn vị: móc đơn thứ mấy trong ô, 0-based).
LARGE = {'2+3':[0,2],'3+2':[0,3],'2+2+3':[0,2,4],'2+3+2':[0,2,5],'3+2+2':[0,3,5]}

class IrregularArtifacts(unittest.TestCase):
    def test_label_totals_and_page_coverage(self):
        for key, n in EXPECT.items():
            m = json.loads((base.ROOT/key/'manifest.json').read_text())
            self.assertEqual(len(m['placement']), n, key)
            self.assertEqual(m['diagnostics'], [], key)
            if n:
                self.assertEqual(sorted({p['page'] for p in m['placement']}),
                                 list(range(1, m['pages']+1)), f'{key} trang trống')

    def test_unresolved_has_no_large_beat_and_says_why(self):
        for key in ['five-plain-compound','seven-plain-compound']:
            m = json.loads((base.ROOT/key/'manifest.json').read_text())
            self.assertEqual(m['placement'], [], key)
            self.assertIn('IRREGULAR_GROUPING_REQUIRED',
                          [n['code'] for n in m['notices']], key)
            self.assertEqual(m['groupingSource'], ['unresolved'], key)
        # cùng file đó, phách nhỏ vẫn đủ nhãn
        self.assertEqual(len(json.loads((base.ROOT/'five-plain-pulses'/'manifest.json')
                                        .read_text())['placement']), 5)

    def test_grouping_moves_the_large_beat(self):
        a = json.loads((base.ROOT/'five-2-3-compound'/'manifest.json').read_text())
        b = json.loads((base.ROOT/'five-3-2-compound'/'manifest.json').read_text())
        xa = [p['x'] for p in a['placement']]; xb = [p['x'] for p in b['placement']]
        self.assertEqual(len(xa), len(xb))
        self.assertEqual(xa[0], xb[0], 'phách 1 luôn ở đầu ô')
        self.assertNotEqual(xa[1], xb[1], '2+3 và 3+2 phải đặt phách lớn 2 ở chỗ khác nhau')

    def test_adjacent_measures_keep_their_own_grouping(self):
        m = json.loads((base.ROOT/'grouping-change-compound'/'manifest.json').read_text())
        self.assertEqual(m['groups'], [[2,2,3],[3,2,2]])
        self.assertEqual([p['label'] for p in m['placement']], ['1','2','3','1','2','3'])

    def test_stress_multipage_and_cycle(self):
        m = json.loads((base.ROOT/'stress-seven-compound'/'manifest.json').read_text())
        r = PdfReader(base.ROOT/'stress-seven-compound'/'score.pdf')
        self.assertGreaterEqual(len(r.pages), 2)
        self.assertEqual(len(r.pages), m['pages'])
        self.assertEqual(len(m['placement']), 300)
        cyc = [[2,2,3],[2,3,2],[3,2,2]]
        self.assertEqual(m['groups'], [cyc[i%3] for i in range(100)])
        self.assertEqual([p['label'] for p in m['placement']],
                         [str(k+1) for _ in range(100) for k in range(3)])
        p = json.loads((base.ROOT/'stress-seven-pulses'/'manifest.json').read_text())
        self.assertEqual(len(p['placement']), 700)

    def test_unicode_lyrics_and_harmony_survive(self):
        for key in ['five-2-3-lyrics-pulses','five-2-3-lyrics-compound',
                    'seven-2-2-3-lyrics-pulses','seven-2-2-3-lyrics-compound']:
            text = '\n'.join(pg.extract_text() for pg in
                             PdfReader(base.ROOT/key/'score.pdf').pages)
            for word in ['Thầy Văn Anh','Âm nhạc','C']:
                self.assertIn(word, text, key)

for key, n in EXPECT.items():
    if n:  # verify() cần ít nhất một nhãn đỏ để đối chiếu
        setattr(IrregularArtifacts, 'test_'+key.replace('-','_'), base.verify(key))
if __name__ == '__main__':
    unittest.main(verbosity=2)
