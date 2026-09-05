// Notification is only a revalidation hint: NEVER grant/revoke from its payload.
// Even a forged/replayed notification can only refresh an already-owned subscription
// against Apple's/Google's authenticated server API. Unknown subscriptions are ignored.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const url=Deno.env.get('SUPABASE_URL')!
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin=createClient(url,key)
function payload(jws:string){const part=jws.split('.')[1];return JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')))}
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405})
 try{
  const raw=await req.text()
  if(raw.length>65536)return new Response('Too large',{status:413})
  const body=JSON.parse(raw)
  let provider:string;let ref:string
  if(body.signedPayload){
   const notification=payload(body.signedPayload)
   if(!notification.data?.signedTransactionInfo)return Response.json({received:true,processed:false})
   const tx=payload(notification.data.signedTransactionInfo)
   provider='apple';ref=String(tx.originalTransactionId??'')
  }else if(body.message?.data){
   const notification=JSON.parse(atob(body.message.data))
   provider='google';ref=notification.subscriptionNotification?.purchaseToken??notification.voidedPurchaseNotification?.purchaseToken??''
  }else return new Response('Invalid notification',{status:400})
  if(!ref)return Response.json({received:true,processed:false})
  const {data:owner,error}=await admin.from('student_entitlements').select('id').eq('source',`${provider}_subscription`).eq('source_ref',`${provider}:${ref}`).maybeSingle()
  if(error)return new Response('Lookup failed',{status:500})
  if(!owner)return Response.json({received:true,processed:false})
  const response=await fetch(`${url}/functions/v1/${provider}-subscription-sync`,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(provider==='apple'?{transactionId:ref}:{purchaseToken:ref}),signal:AbortSignal.timeout(20000)})
  return Response.json({received:true,processed:response.ok},{status:response.ok?200:502})
 }catch{return new Response('Cannot process notification',{status:400})}
})
