"""Verify actual browser-produced PDFs/PNGs, independently of the exporter.
Requires pypdf, Pillow, numpy, and pdftoppm. Run after browser.html downloads its ZIP.
"""
from pathlib import Path
import json, subprocess, tempfile, unittest, re
import numpy as np
from PIL import Image
from pypdf import PdfReader
ROOT = Path(__file__).resolve().parents[2] / 'docs/musicxml-print/output'
NAMES = ['short','whole-note','whole-measure-rest','syncopation','pickup-quarter','lyrics-harmony','two-lyrics','long-a4','page-bottom']

def red_mask(image):
    a = np.asarray(image.convert('RGB')).astype(int)
    return (a[:,:,0] > 120) & (a[:,:,1] < 110) & (a[:,:,2] < 110)

def centers(mask):
    # Tiny connected components isolate individual red beat glyphs without OCR.
    from PIL import ImageFilter
    mask = np.asarray(Image.fromarray(mask).filter(ImageFilter.MaxFilter(3)))
    seen = np.zeros(mask.shape, bool); found = []
    for y,x in zip(*np.where(mask)):
        if seen[y,x]: continue
        todo=[(y,x)]; seen[y,x]=True; pixels=[]
        while todo:
            yy,xx=todo.pop(); pixels.append((yy,xx))
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    ny,nx=yy+dy,xx+dx
                    if 0<=ny<mask.shape[0] and 0<=nx<mask.shape[1] and mask[ny,nx] and not seen[ny,nx]:
                        seen[ny,nx]=True; todo.append((ny,nx))
        if len(pixels)>=2: found.append(np.mean(pixels,axis=0))
    return np.array(found)

class PrintedArtifacts(unittest.TestCase):
    pass

def verify(name):
    def run(self):
        folder=ROOT/name; manifest=json.loads((folder/'manifest.json').read_text())
        reader=PdfReader(folder/'score.pdf')
        self.assertEqual(len(reader.pages),manifest['pages'])
        if name=='long-a4': self.assertGreaterEqual(len(reader.pages),2)
        extracted='\n'.join(p.extract_text() for p in reader.pages)
        if name in ['lyrics-harmony','two-lyrics','long-a4','page-bottom']:
            self.assertIn('Thầy Văn Anh',extracted); self.assertIn('Âm nhạc',extracted); self.assertIn('C',extracted)
        for n,page in enumerate(reader.pages,1):
            self.assertAlmostEqual(float(page.mediabox.width),210/25.4*72,places=2)
            self.assertAlmostEqual(float(page.mediabox.height),297/25.4*72,places=2)
            self.assertEqual(len(page.images),0,'PDF must remain vector')
            fonts=page['/Resources']['/Font'].get_object()
            for ref in fonts.values():
                font=ref.get_object()
                self.assertIn('/ToUnicode',font,'All used text fonts have Unicode mapping')
                self.assertIn('/FontFile2',font['/DescendantFonts'][0].get_object()['/FontDescriptor'].get_object())
            placements=[]; state={'red':False, 'font':None}; stack=[]
            def operand(op,args,cm,tm):
                if op==b'q': stack.append(state.copy())
                elif op==b'Q' and stack: state.update(stack.pop())
                elif op==b'rg': state['red'] = float(args[0])>.5 and float(args[1])<.5 and float(args[2])<.5
                elif op in [b'g',b'k']: state['red']=False
                elif op==b'Tf': state['font']=str(args[0])
                elif op==b'Tj' and state['red']:
                    cmap=fonts[state['font']].get_object()['/ToUnicode'].get_object().get_data().decode()
                    pairs=dict(re.findall(r'<([0-9a-fA-F]{4})>\s*<([0-9a-fA-F]{4})>',cmap))
                    label=''.join(chr(int(pairs[bytes(args[0])[i:i+2].hex()],16)) for i in range(0,len(args[0]),2))
                    x=tm[4]*cm[0]+tm[5]*cm[2]+cm[4]
                    y=float(page.mediabox.height)-(tm[4]*cm[1]+tm[5]*cm[3]+cm[5])
                    placements.append((label,x,y))
            page.extract_text(visitor_operand_before=operand)
            expected=[a for a in manifest['placement'] if a['page']==n]
            self.assertEqual([p[0] for p in placements],[a['label'] for a in expected])
            for actual,want in zip(placements,expected):
                self.assertAlmostEqual(actual[1],want['x']/5/25.4*72,places=3)
                self.assertAlmostEqual(actual[2],want['y']/5/25.4*72,places=3)
            png=Image.open(folder/f'page-{n}.png'); self.assertEqual(png.size,(794,1123))
            with tempfile.TemporaryDirectory() as tmp:
                dest=Path(tmp)/'page'
                subprocess.run(['pdftoppm','-f',str(n),'-l',str(n),'-scale-to-x','794','-scale-to-y','1123','-singlefile','-png',str(folder/'score.pdf'),str(dest)],check=True,capture_output=True)
                pdf=Image.open(dest.with_suffix('.png'))
                a,b=centers(red_mask(png)),centers(red_mask(pdf))
                self.assertEqual(len(a),len(b),f'{name}/{n}: all beat glyphs in PDF and PNG')
                self.assertGreater(len(a),0)
                # Anti-aliasing differs, but every beat must be within 2 px at 96 dpi.
                distance=np.sqrt(((a[:,None,:]-b[None,:,:])**2).sum(axis=2))
                self.assertLess(float(distance.min(axis=1).max()),2,f'{name}/{n}: musical placement changed')
                # Verify black notation/lyrics occupy the same areas, not only red beats.
                aa=np.asarray(png.convert('RGB')); bb=np.asarray(pdf.convert('RGB'))
                am=(aa.min(axis=2)<245); bm=(bb.min(axis=2)<245)
                for mask in [am,bm]:
                    ys,xs=np.where(mask); self.assertGreater(xs.min(),5); self.assertGreater(ys.min(),5)
                    self.assertLess(xs.max(),788); self.assertLess(ys.max(),1117)
                # Allow antialiasing by dilating each mask by two pixels (Poppler minimum stroke width).
                from PIL import ImageFilter
                ad=np.asarray(Image.fromarray(am).filter(ImageFilter.MaxFilter(5)))
                bd=np.asarray(Image.fromarray(bm).filter(ImageFilter.MaxFilter(5)))
                self.assertGreater((am & bd).sum()/am.sum(),.97,'Notation differs between SVG raster and PDF')
                self.assertGreater((bm & ad).sum()/bm.sum(),.97,'Extra/moved notation in PDF')
    return run
for name in NAMES: setattr(PrintedArtifacts,'test_'+name.replace('-','_'),verify(name))
if __name__=='__main__': unittest.main(verbosity=2)
