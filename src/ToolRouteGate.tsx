import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
export default function ToolRouteGate({children}:{children:ReactNode}) {
 const [allowed,setAllowed]=useState<boolean|null>(null)
 const [error,setError]=useState(false)
 useEffect(()=>{
  let live=true;let request=0
  const refresh=async()=>{
   const current=++request
   const {data,error}=await supabase.rpc('my_tool_route_access',{p_path:window.location.pathname.replace(/\/$/,'')||'/'})
   if(live && current===request){setAllowed(error?null:data===true);setError(!!error)}
  }
  void refresh()
  const timer=setInterval(refresh,60000)
  const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{void refresh()})
  return()=>{live=false;clearInterval(timer);subscription.unsubscribe()}
 },[])
 if(allowed===true)return <>{children}</>
 return <div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',padding:24,boxSizing:'border-box',fontFamily:'Inter,system-ui,sans-serif',background:'#F4F4F5',textAlign:'center'}}><div>
  <h2>{error?'Chưa tải được quyền truy cập':allowed===false?'Công cụ chưa được mở':'Đang tải…'}</h2>
  {error?<button onClick={()=>window.location.reload()}>Thử lại</button>:allowed===false?<><p>Vui lòng kiểm tra gói học hoặc đăng nhập tài khoản của bạn.</p><a href="/start">Về trang học</a></>:null}
 </div></div>
}
