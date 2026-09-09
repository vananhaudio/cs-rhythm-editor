import { useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
export default function ToolRouteGate({children}:{children:ReactNode}) {
 const [allowed,setAllowed]=useState<boolean|null>(null)
 const [error,setError]=useState(false)
 // Quyền tốt gần nhất GẮN VỚI MỘT TÀI KHOẢN cụ thể. Đổi tài khoản hay đăng xuất
 // là phải quên ngay, nếu không người mới sẽ dùng quyền của người cũ khi mạng lỗi.
 const lastGood=useRef<{uid:string|null;allowed:boolean}|null>(null)
 useEffect(()=>{
  let live=true;let request=0
  const forget=()=>{lastGood.current=null;setAllowed(null);setError(false)}
  const refresh=async()=>{
   const current=++request
   // getSession() đọc phiên TỪ MÁY, không gọi mạng. Dùng getUser() ở đây là sai:
   // nó gọi mạng, nên mất mạng sẽ bị hiểu nhầm thành "đã đổi sang không ai",
   // xoá quyền và gỡ mất cả công cụ đang dùng.
   const {data:{session}}=await supabase.auth.getSession().catch(()=>({data:{session:null}}))
   const uid=session?.user?.id??null
   // Phiên đã đổi so với lần xác định thành công gần nhất → bỏ quyền cũ trước khi hỏi lại.
   if(lastGood.current && lastGood.current.uid!==uid){lastGood.current=null;setAllowed(null)}
   const {data,error}=await supabase.rpc('my_tool_route_access',{p_path:window.location.pathname.replace(/\/$/,'')||'/'})
   if(!live || current!==request)return
   if(error){
    // CHỈ lỗi mạng/tạm thời mới được giữ quyền cũ, và chỉ khi vẫn đúng tài khoản đó.
    const keep=lastGood.current && lastGood.current.uid===uid
    if(keep)setAllowed(lastGood.current!.allowed)
    else{lastGood.current=null;setAllowed(null);setError(true)}
    return
   }
   // Máy chủ trả lời hợp lệ — kể cả khi là "không cho" — thì tuân theo ngay.
   setError(false);lastGood.current={uid,allowed:data===true};setAllowed(data===true)
  }
  void refresh()
  const timer=setInterval(refresh,60000)
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
   // Đăng xuất / đổi người dùng: quên quyền cũ NGAY, không chờ tới lượt poll sau.
   if(event==='SIGNED_OUT'||event==='SIGNED_IN'||event==='USER_UPDATED')forget()
   void refresh()
  })
  return()=>{live=false;clearInterval(timer);subscription.unsubscribe()}
 },[])
 if(allowed===true)return <>{children}</>
 return <div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',padding:24,boxSizing:'border-box',fontFamily:'Inter,system-ui,sans-serif',background:'#F4F4F5',textAlign:'center'}}><div>
  <h2>{error?'Chưa tải được quyền truy cập':allowed===false?'Công cụ chưa được mở':'Đang tải…'}</h2>
  {error?<button onClick={()=>window.location.reload()}>Thử lại</button>:allowed===false?<><p>Vui lòng kiểm tra gói học hoặc đăng nhập tài khoản của bạn.</p><a href="/start">Về trang học</a></>:null}
 </div></div>
}
