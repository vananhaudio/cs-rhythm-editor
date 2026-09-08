"""Run after browser-generated ZIP extraction; reuse unchanged Stage 4 parity checks."""
import importlib.util
from pathlib import Path
import unittest
from pypdf import PdfReader
spec=importlib.util.spec_from_file_location('approved_export_checks',Path(__file__).resolve().parents[1]/'musicxml-export/verify-artifacts.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
base.ROOT=Path(__file__).resolve().parents[2]/'docs/musicxml-compound/output'
NAMES=['sustained','whole-rest','pickup-one','pickup-three','lyrics-harmony','meter-change','long-lyrics']
class CompoundArtifacts(unittest.TestCase):
 def test_unicode_and_multipage(self):
  for mode in ['pulses','compound']:
   reader=PdfReader(base.ROOT/f'long-lyrics-{mode}/score.pdf')
   self.assertGreaterEqual(len(reader.pages),2)
   text='\n'.join(page.extract_text() for page in reader.pages)
   for word in ['Thầy Văn Anh','Âm nhạc','C']:self.assertIn(word,text)
for name in NAMES:
 for mode in ['pulses','compound']:
  key=f'{name}-{mode}';setattr(CompoundArtifacts,'test_'+key.replace('-','_'),base.verify(key))
if __name__=='__main__':unittest.main(verbosity=2)
