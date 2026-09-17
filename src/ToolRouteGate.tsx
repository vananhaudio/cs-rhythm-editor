import { useEffect, useState, type ReactNode } from 'react'
import { taoBoTheoDoiQuyen } from './authCapabilityGate'
import { supabase } from './supabase'
export default function ToolRouteGate({children}:{children:ReactNode}) {
 const [allowed,setAllowed]=useState<boolean|null>(null)
 const [error,setError]=useState(false)
 useEffect(()=>{
  // Luật giữ/quên quyền theo phiên nằm ở authCapabilityGate: đăng xuất hoặc ĐỔI
  // người thì quên ngay; cùng người (SIGNED_IN lặp lại khi tab lấy lại focus,
  // TOKEN_REFRESHED…) thì GIỮ công cụ đang mở và kiểm lại ngầm — không gỡ công cụ
  // khỏi DOM, không làm mất bản nháp chưa lưu.
  const bo=taoBoTheoDoiQuyen<boolean>({
   // getSession() đọc phiên TỪ MÁY, không gọi mạng. Dùng getUser() ở đây là sai:
   // nó gọi mạng, nên mất mạng sẽ bị hiểu nhầm thành "đã đổi sang không ai",
   // xoá quyền và gỡ mất cả công cụ đang dùng.
   docUid:async()=>{const {data:{session}}=await supabase.auth.getSession();return session?.user?.id??null},
   hoi:async()=>{
    const {data,error}=await supabase.rpc('my_tool_route_access',{p_path:window.location.pathname.replace(/\/$/,'')||'/'})
    // Máy chủ trả lời hợp lệ — kể cả khi là "không cho" — thì tuân theo ngay.
    // CHỈ lỗi mạng/tạm thời mới được giữ quyền cũ (bộ theo dõi lo, và chỉ khi cùng tài khoản).
    return error?{ok:false}:{ok:true,value:data===true}
   },
   dat:(s)=>{setAllowed(s.phase==='ready'?s.value:null);setError(s.phase==='error')},
  })
  void bo.lamMoi()
  const timer=setInterval(()=>void bo.lamMoi(),60000)
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>bo.suKien(event,session?.user?.id??null))
  return()=>{bo.huy();clearInterval(timer);subscription.unsubscribe()}
 },[])
 if(allowed===true)return <>{children}</>
 return <div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',padding:24,boxSizing:'border-box',fontFamily:'Inter,system-ui,sans-serif',background:'#F4F4F5',textAlign:'center'}}><div>
  <h2>{error?'Chưa tải được quyền truy cập':allowed===false?'Công cụ chưa được mở':'Đang tải…'}</h2>
  {error?<button onClick={()=>window.location.reload()}>Thử lại</button>:allowed===false?<><p>Vui lòng kiểm tra gói học hoặc đăng nhập tài khoản của bạn.</p><a href="/start">Về trang học</a></>:null}
 </div></div>
}
