import { useEffect, useState } from 'react'
import { fetchLearningState, type LearningState } from './learningState'
// All UI authorization comes from the same backend resolver, refreshed at expiry.
export function useLearningAccess(userKey: string) {
 const [snapshot,setSnapshot]=useState<{key:string;state:LearningState|null}|null>(null)
 useEffect(()=>{
  let live=true;let request=0;let timer:ReturnType<typeof setTimeout>
  const refresh=async()=>{
   const current=++request
   const next=await fetchLearningState(userKey)
   if(!live||current!==request)return
   setSnapshot({key:userKey,state:next})
   const remaining=next?.valid_until?Date.parse(next.valid_until)-Date.now():60000
   clearTimeout(timer);timer=setTimeout(()=>{
    if(next?.valid_until&&Date.parse(next.valid_until)<=Date.now())setSnapshot({key:userKey,state:null})
    void refresh()
   },Math.max(250,Math.min(60000,remaining+50)))
  }
  void refresh();const onFocus=()=>{void refresh()};window.addEventListener('focus',onFocus)
  return()=>{live=false;clearTimeout(timer);window.removeEventListener('focus',onFocus)}
 },[userKey])
 return snapshot?.key===userKey?snapshot.state:null
}
