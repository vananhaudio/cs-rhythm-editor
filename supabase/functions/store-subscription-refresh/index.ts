// Server-only reconciliation. Scheduler invokes using service role from Vault.
// Poll existing subscriptions even when the app is closed; verifies Store API via existing sync.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const url=Deno.env.get('SUPABASE_URL')!
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin=createClient(url,key)
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405})
 if(!Deno.env.get('STORE_REFRESH_SECRET') || req.headers.get('x-store-refresh-secret')!==Deno.env.get('STORE_REFRESH_SECRET'))return new Response('Unauthorized',{status:401})
 const {data,error}=await admin.from('student_entitlements').select('id,source,source_ref,metadata').in('source',['apple_subscription','google_subscription']).order('updated_at').limit(100)
 if(error)return Response.json({error:'lookup_failed'},{status:500})
 const results=[]
 // Sequential bounded calls prevent provider bursts; oldest first gives fair rotation.
 for(const row of data??[]){
  const apple=row.source==='apple_subscription'
  const ref=row.source_ref?.replace(/^(apple|google):/,'')
  if(!ref){results.push({id:row.id,ok:false});continue}
  try{
   const response=await fetch(`${url}/functions/v1/${apple?'apple':'google'}-subscription-sync`,{
    method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify(apple?{transactionId:ref}:{purchaseToken:ref}),signal:AbortSignal.timeout(15000)
   })
   results.push({id:row.id,ok:response.ok,status:response.status})
  }catch{results.push({id:row.id,ok:false})}
 }
 return Response.json({ok:results.every(r=>r.ok),results},{status:results.every(r=>r.ok)?200:502})
})
