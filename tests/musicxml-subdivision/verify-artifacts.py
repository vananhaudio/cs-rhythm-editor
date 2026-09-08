"""Reuse the APPROVED Stage 4 artifact checks without editing them.
Run after extracting musicxml-subdivision-acceptance.zip into the output folder.
"""
import importlib.util
from pathlib import Path
import unittest
from pypdf import PdfReader
spec = importlib.util.spec_from_file_location('stage4_verification', Path(__file__).resolve().parents[1]/'musicxml-export/verify-artifacts.py')
stage4 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage4)
stage4.ROOT = Path(__file__).resolve().parents[2]/'docs/musicxml-subdivision/output'
CASES = ['whole-note-beats','whole-note-eighths','whole-note-sixteenths',
 'whole-measure-rest-sixteenths','syncopation-sixteenths','triplet-sixteenths',
 'pickup-eighth-beats','pickup-eighth-eighths','pickup-eighth-sixteenths',
 'lyrics-harmony-beats','lyrics-harmony-eighths','lyrics-harmony-sixteenths','page-bottom-sixteenths']
class SubdivisionArtifacts(unittest.TestCase):
    def test_vietnamese_and_chords_all_levels(self):
        for level in ['beats','eighths','sixteenths']:
            reader=PdfReader(stage4.ROOT/f'lyrics-harmony-{level}/score.pdf')
            text='\n'.join(page.extract_text() for page in reader.pages)
            for word in ['Thầy Văn Anh','Âm nhạc','C']: self.assertIn(word,text)
    def test_sixteenths_multipage(self):
        self.assertGreaterEqual(len(PdfReader(stage4.ROOT/'page-bottom-sixteenths/score.pdf').pages),2)
for case in CASES:
    setattr(SubdivisionArtifacts,'test_'+case.replace('-','_'),stage4.verify(case))
if __name__=='__main__': unittest.main(verbosity=2)
