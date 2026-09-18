#!/usr/bin/env python3
# Chuyển file Word "Ôn tập 7 ngày" (Hành trình 2027) → src/data/ht2027/buoiNN.ts (LessonDoc, section study).
# Dùng: python3 scripts/ht2027-docx-to-lesson.py <file.docx> <số buổi> "<tiêu đề>" src/data/ht2027/buoiNN.ts
import zipfile,re,sys,json
from xml.etree import ElementTree as ET
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
def ptext(p):
    out=''
    for r in p.iter():
        if r.tag==W+'t': out+=r.text or ''
        elif r.tag==W+'tab': out+=' '
        elif r.tag==W+'br': out+='\n'
    return out.strip()
def style(p):
    s=p.find(f'{W}pPr/{W}pStyle')
    if s is not None: return s.get(W+'val')
    # File không dùng style (Buổi 3): suy ra từ cỡ chữ in đậm — 32 = đầu mục lớn, 26 = mục con
    rp=p.find(f'.//{W}r/{W}rPr'); sz=rp.find(W+'sz') if rp is not None else None
    v=int(sz.get(W+'val')) if sz is not None else 0
    return 'Heading1' if v==32 else 'Heading2' if v==26 else ''
def parse(path):
    root=ET.fromstring(zipfile.ZipFile(path).read('word/document.xml'))
    body=root.find(W+'body'); items=[]
    for el in body:
        if el.tag==W+'p':
            t=ptext(el)
            if t: items.append({'t':'p','s':style(el),'x':t})
        elif el.tag==W+'tbl':
            rows=[]
            for tr in el.findall(W+'tr'):
                rows.append(['\n'.join(ptext(p) for p in tc.findall(W+'p') if ptext(p)) for tc in tr.findall(W+'tc')])
            items.append({'t':'tbl','rows':rows})
    return items

src,no,title,out=sys.argv[1],int(sys.argv[2]),sys.argv[3],sys.argv[4]
items=parse(src)
DOTS=re.compile(r'^[.…_\s]{8,}$')
secs=[]; cur={'kind':'study','tag':'Trước khi bắt đầu','title':'Tổng quan tuần ôn','blocks':[]}
head=[]; started=False
for it in items:
    if it['t']=='p' and not started:
        head.append(it['x']); continue
    started=True
    B=cur['blocks']
    if it['t']=='tbl':
        rows=it['rows']
        if len(rows)==1 and len(rows[0])==1:
            lines=rows[0][0].split('\n'); first=lines[0]
            if first==first.upper() and len(lines)>1: B.append({'b':'callout','label':first,'text':'\n'.join(lines[1:])})
            else: B.append({'b':'p','text':rows[0][0]})
        else: B.append({'b':'table','rows':rows})
        continue
    s,x=it['s'],it['x']
    if s=='Heading1':
        if cur['blocks']: secs.append(cur)
        m=re.match(r'^(Ngày \d+)\s*[—–-]\s*(.*)$',x)
        cur={'kind':'study','tag':m.group(1) if m else None,'title':m.group(2) if m else x,'blocks':[]}
        if not m: del cur['tag']
    elif s=='Heading2': B.append({'b':'h','text':x})
    elif s in('ListBullet','ListNumber'):
        k='ul' if s=='ListBullet' else 'ol'
        if B and B[-1]['b']==k: B[-1]['items'].append(x)
        else: B.append({'b':k,'items':[x]})
    elif DOTS.match(x):
        if B and B[-1]['b']=='write' : B[-1]['lines']+=1
        elif B and B[-1]['b']=='p' and len(B[-1]['text'])<160 and B[-1]['text'].rstrip().endswith((':','?')):
            B[-1]={'b':'write','label':B[-1]['text'],'lines':1}
        else: B.append({'b':'write','lines':1})
    else: B.append({'b':'p','text':x})
secs.append(cur)
sub=head[-1] if len(head)>2 else ''
if sub: secs[0]['blocks'].insert(0,{'b':'p','text':sub})
stage='Chặng 1 · Làm chủ bộ hợp âm, vòng hòa âm và màu sắc hòa âm'
doc={'meta':{'programCode':'HT2027','programName':'HÀNH TRÌNH 2027','sessionNo':no,'title':title,'stageLabel':stage+' · Tài liệu ôn tập 7 ngày','backHref':'/hanhtrinh2027'},'sections':secs}
name=f'HT2027_BUOI{no:02d}'
ts=f"""// ── HÀNH TRÌNH 2027 · BUỔI {no:02d} — Tài liệu ôn tập 7 ngày ──
// Sinh từ file Word của Thầy ({src.split('/')[-1]}); nguồn gốc là file Word,
// sửa nội dung thì sửa Word rồi chạy lại scripts/ht2027-docx-to-lesson.py.
import type {{ LessonDoc }} from '../../lesson/lessonTypes'

export const {name}: LessonDoc = {json.dumps(doc,ensure_ascii=False,indent=2)}
"""
open(out,'w').write(ts)
print(name,len(secs),[s.get('tag','')+' '+s['title'] for s in secs])
