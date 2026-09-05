import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from './supabase'
import { loadStudentPackages, PACKAGE_SOURCE, PACKAGE_STATUS, packageDate, type PackageSnapshot, type StudentPackage } from './studentPackages'
const input: CSSProperties={padding:'9px 12px',border:'1px solid #E4E4E7',borderRadius:8,fontFamily:'inherit',fontSize:14,maxWidth:'100%',boxSizing:'border-box'}
const button: CSSProperties={...input,background:'#FFFFFF',color:'#2D6A4F',cursor:'pointer',fontWeight:600}
export default function StudentPackagePanel({studentId}:{studentId:string}) {
 const [snapshot,setSnapshot]=useState<PackageSnapshot|null>(null)
 const [error,setError]=useState('');const [busy,setBusy]=useState(false)
 const [form,setForm]=useState<{action:'grant'|'renew'|'change'|'end';record?:StudentPackage}|null>(null)
 const [packageId,setPackageId]=useState('');const [months,setMonths]=useState('1');const [source,setSource]=useState('admin')
 const [courses,setCourses]=useState<{code:string;name:string}[]>([])
 const [codes,setCodes]=useState<string[]>([])
 useEffect(()=>{supabase.from('edu_courses').select('code,name').eq('status','on').not('code','is',null).then(({data})=>setCourses(data??[]))},[])
 const [requestId,setRequestId]=useState(()=>crypto.randomUUID())
 async function refresh(){try{setSnapshot(await loadStudentPackages(studentId));setError('')}catch(e){setError(e instanceof Error?e.message:'Lỗi tải gói')}}
 useEffect(()=>{let live=true;setSnapshot(null);loadStudentPackages(studentId).then(d=>{if(live)setSnapshot(d)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[studentId])
 function open(action:'grant'|'renew'|'change'|'end',record?:StudentPackage,m='1'){
  setForm({action,record});setPackageId(record?.package_id??'');setMonths(m);setSource(record?.source??'admin');setError('');setCodes([]);setRequestId(crypto.randomUUID())
 }
 async function submit(){
  if(!form)return
  setBusy(true);setError('')
  try{
   const {error:e}=await supabase.rpc('manage_student_package',{p_student:studentId,p_action:form.action,p_record_id:form.record?.id??null,
    p_course_codes:codes.length?codes:null,p_package_id:packageId||null,p_months:months?Number(months):null,p_source:source,p_request_id:requestId})
   if(e)throw e
   setForm(null);await refresh()
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 return <section style={{background:'#fff',border:'1px solid #E4E4E7',borderRadius:12,padding:18,marginBottom:20}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'center'}}><h3 style={{margin:0,color:'#2D6A4F'}}>Gói học / Quyền học</h3><button style={button} disabled={busy||!snapshot} onClick={()=>open('grant')}>Cấp gói mới</button></div>
  <p style={{fontSize:12,color:'#71717A'}}>Ngày giờ Việt Nam (UTC+7). Hết hạn đúng thời điểm hiển thị; tiến độ học luôn được giữ.</p>
  {error&&<div role="alert" style={{color:'#B91C1C',margin:'10px 0'}}>{error} <button style={button} onClick={refresh}>Tải lại</button></div>}
  {!snapshot&&!error&&<p>Đang tải gói học…</p>}
  {snapshot?.records.length===0&&<p style={{color:'#71717A'}}>Chưa có gói học.</p>}
  {snapshot?.records.filter(r=>r.status!=='superseded').map(r=>{
   const store=r.source==='apple'||r.source==='google_play';const managed=r.id>0&&!store&&r.entitlement_id===null
   const days=r.renews_at?Math.max(0,Math.ceil((Date.parse(r.renews_at)-Date.parse(snapshot.now))/86400000)):null
   return <article key={r.id} style={{borderTop:'1px solid #E4E4E7',padding:'14px 0'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><b>{r.name}</b><span style={{color:r.display_status==='expiring'?'#B45309':r.is_active?'#2D6A4F':'#71717A'}}>{PACKAGE_STATUS[r.display_status]??r.display_status}</span></div>
    <div style={{display:'flex',gap:'8px 24px',flexWrap:'wrap',fontSize:13,lineHeight:1.8,marginTop:6}}>
     <span>Bắt đầu: {packageDate(r.starts_at)}</span><span>Hết hạn: <b>{packageDate(r.renews_at)}</b></span>
     {days!==null&&<span>Còn {days} ngày</span>}<span>Nguồn: {PACKAGE_SOURCE[r.source]??r.source}</span>
     <span>Tự gia hạn: {r.auto_renew===null?'Chưa có xác nhận từ Store':r.auto_renew?'Có':'Không'}</span>
    </div>
    {store&&<p style={{fontSize:13,color:'#52525B'}}>Quyền do {PACKAGE_SOURCE[r.source]} quản lý. Gia hạn hoặc hủy subscription trong tài khoản Store.</p>}
    {r.legacy_unclassified&&<p style={{color:'#B45309'}}>Legacy chưa xác định thời hạn — giữ quyền cũ, cần kiểm tra hồ sơ trước khi đổi gói.</p>}
    {managed&&<div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10}}>
     {['active','expired'].includes(r.status)&&r.renews_at&&<><button disabled={busy} style={button} onClick={()=>open('renew',r)}>Gia hạn 1 tháng</button><button disabled={busy} style={button} onClick={()=>open('renew',r,'')}>Gia hạn theo gói</button></>}
     <button disabled={busy} style={button} onClick={()=>open('change',r)}>Đổi gói</button>
     {['active','trialing'].includes(r.status)&&<button disabled={busy} style={{...button,color:'#B91C1C'}} onClick={()=>open('end',r)}>Kết thúc gói</button>}
    </div>}
   </article>
  })}
  {form&&<div style={{background:'#F4F4F5',borderRadius:8,padding:14,marginTop:12}}>
   <b>{form.action==='grant'?'Cấp gói mới':form.action==='renew'?'Gia hạn gói':form.action==='change'?'Đổi gói':'Kết thúc gói'}</b>
   <p style={{fontSize:13}}>{form.action==='end'?`Kết thúc quyền từ gói ${form.record?.name} ngay khi xác nhận. Tiến độ học được giữ nguyên.`:form.action==='renew'?'Nếu còn hạn, cộng tiếp từ ngày hết hạn. Nếu đã hết, tính từ thời điểm xác nhận.':form.action==='change'?'Gói cũ kết thúc và gói mới bắt đầu cùng thời điểm xác nhận.':'Gói bắt đầu ngay khi xác nhận.'}</p>
   <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
    {(form.action==='grant'||form.action==='change')&&<><select aria-label="Gói học" style={input} value={packageId} onChange={e=>{setPackageId(e.target.value);setCodes(snapshot?.packages.find(p=>p.id===e.target.value)?.config.default_course_codes??[])}}><option value="">Chọn gói học</option>{snapshot?.packages.filter(p=>!p.config.store_only).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
     <select aria-label="Nguồn cấp gói" style={input} value={source} onChange={e=>setSource(e.target.value)}><option value="admin">Admin cấp thủ công</option><option value="web">Web / chuyển khoản</option></select></>}
    {form.action!=='end'&&<label style={{fontSize:13}}>Số tháng (trống = chu kỳ gói)<input aria-label="Số tháng" type="number" min="1" max="120" value={months} onChange={e=>setMonths(e.target.value)} style={{...input,width:90,marginLeft:8}}/></label>}
   </div>
   {(form.action==='grant'||form.action==='change')&&<label style={{display:'block',marginTop:12,fontSize:13}}>Khoá học được mở (chọn theo nhu cầu học sinh)<div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:8}}>{courses.map(c=><label key={c.code}><input type="checkbox" checked={codes.includes(c.code)} onChange={e=>setCodes(prev=>e.target.checked?[...prev,c.code]:prev.filter(x=>x!==c.code))}/>{c.code} · {c.name}</label>)}</div></label>}
   <div style={{display:'flex',gap:10,marginTop:12}}><button style={{...button,background:'#2D6A4F',color:'#fff'}} disabled={busy||(['grant','change'].includes(form.action)&&!packageId)} onClick={submit}>{busy?'Đang lưu…':'Xác nhận'}</button><button disabled={busy} style={button} onClick={()=>setForm(null)}>Hủy</button></div>
  </div>}
  {!!snapshot?.history.length&&<details style={{marginTop:14}}><summary style={{cursor:'pointer',fontWeight:600}}>Lịch sử gói ({snapshot.history.length})</summary>{snapshot.history.map(h=><div key={h.id} style={{padding:'8px 0',fontSize:13,borderBottom:'1px solid #E4E4E7'}}>{packageDate(h.created_at)} · {PACKAGE_STATUS[h.action]??(h.action==='grant'?'Cấp gói':'Cập nhật')} · Hết hạn: {packageDate(h.before_state?.renews_at??null)} → {packageDate(h.after_state.renews_at)}</div>)}</details>}
 </section>
}
