"""Kiểm định PDF/PNG do trình duyệt thật tạo ra, độc lập với bộ xuất.
Chạy sau khi harness ghi artifacts vào docs/musicxml-generalized/output.
Cần pypdf, Pillow, numpy, Poppler (pdftoppm)."""
import importlib.util, json, unittest
from pathlib import Path
from pypdf import PdfReader
spec = importlib.util.spec_from_file_location(
    'approved_export_checks',
    Path(__file__).resolve().parents[1] / 'musicxml-export/verify-artifacts.py')
base = importlib.util.module_from_spec(spec); spec.loader.exec_module(base)
base.ROOT = Path(__file__).resolve().parents[2] / 'docs/musicxml-generalized/output'

# 12/8 pulse mode is the first stage with two-digit labels. Poppler renders "11"/"12"
# as two glyph runs ~5 px apart while the SVG raster keeps them joined, so the Stage 4
# component counter sees 14 marks where there are 12. Cluster components back into
# labels before comparing; the inter-label gap is ~21-28 px, so 12 px separates them
# unambiguously. Patched here only — the shared Stage 4 checker stays untouched.
_components = base.centers
def _labels(mask):
    """Merge the glyph runs of one label back together (transitive, 2-D)."""
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
NAMES = ['basic-9-8','basic-12-8','whole-rest-9-8','whole-rest-12-8','sustained-12-8',
         'syncopation-12-8','tuplet-9-8','two-voices-12-8','pickup-9-8','pickup-12-8',
         'lyrics-harmony-9-8','lyrics-harmony-12-8','mixed-meter','stress-12-8']
MODES = ['pulses','compound']
# Label totals derived from the meter, not from the artifacts being checked.
TOTALS = {'basic-9-8':(9,3),'basic-12-8':(12,4),'whole-rest-9-8':(9,3),'whole-rest-12-8':(12,4),
          'sustained-12-8':(12,4),'syncopation-12-8':(12,4),'tuplet-9-8':(9,3),
          'two-voices-12-8':(12,4),'pickup-9-8':(10,3),'pickup-12-8':(14,4),
          'lyrics-harmony-9-8':(9,3),'lyrics-harmony-12-8':(12,4),
          'mixed-meter':(40,18),'stress-12-8':(1200,400)}

class GeneralizedArtifacts(unittest.TestCase):
    def test_label_totals_and_page_coverage(self):
        for name in NAMES:
            for i, mode in enumerate(MODES):
                m = json.loads((base.ROOT/f'{name}-{mode}'/'manifest.json').read_text())
                self.assertEqual(len(m['placement']), TOTALS[name][i], f'{name}-{mode}')
                self.assertEqual(m['diagnostics'], [])
                # Every declared page really carries labels; none silently dropped.
                self.assertEqual(sorted({p['page'] for p in m['placement']}),
                                 list(range(1, m['pages']+1)), f'{name}-{mode} trang trống')

    def test_stress_multipage_1200_labels(self):
        r = PdfReader(base.ROOT/'stress-12-8-pulses'/'score.pdf')
        m = json.loads((base.ROOT/'stress-12-8-pulses'/'manifest.json').read_text())
        self.assertGreaterEqual(len(r.pages), 2)
        self.assertEqual(len(r.pages), m['pages'])
        self.assertEqual(len(m['placement']), 1200)
        self.assertEqual([p['label'] for p in m['placement']],
                         [str(k+1) for _ in range(100) for k in range(12)])

    def test_unicode_lyrics_and_harmony_survive(self):
        for name in ['lyrics-harmony-9-8','lyrics-harmony-12-8']:
            for mode in MODES:
                text = '\n'.join(p.extract_text() for p in
                                 PdfReader(base.ROOT/f'{name}-{mode}'/'score.pdf').pages)
                for word in ['Thầy Văn Anh','Âm nhạc','C']:
                    self.assertIn(word, text, f'{name}-{mode}')

for name in NAMES:
    for mode in MODES:
        key = f'{name}-{mode}'
        setattr(GeneralizedArtifacts, 'test_'+key.replace('-','_'), base.verify(key))
if __name__ == '__main__':
    unittest.main(verbosity=2)
