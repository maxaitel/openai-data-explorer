import { useEffect, useRef, useState } from 'react'
import { useInteractionSounds, soundFeedback } from '@/lib/sounds'
import { loadArchive, loadDemo, closeArchive, savedArchive, saveArchive, type Session } from '@/lib/archive/client'
import { Welcome } from './welcome'
import Workspace from '@/App'
export default function ArchiveApp(){
  const sounds=useInteractionSounds()
  const [session,setSession]=useState<Session>()
  const [busy,setBusy]=useState(true),[progress,setProgress]=useState(0),[status,setStatus]=useState('Checking this browser'),[error,setError]=useState(''),[remember,setRemember]=useState(true)
  const started=useRef(false),generation=useRef(0)
  const progressUpdate=(value:number,label:string)=>{setProgress(value);setStatus(label)}
  useEffect(()=>{if(started.current)return;started.current=true
    const version=++generation.current
    void (async()=>{try{
      const mode=sessionStorage.getItem('archive-mode')
      if(mode==='demo'){const result=await loadDemo();if(generation.current===version)setSession(result)}
      else {const file=await savedArchive();if(file){const result=await loadArchive(file,progressUpdate);if(generation.current===version)setSession(result)}}
    }catch(e){if(generation.current===version)setError(e instanceof Error?e.message:'Could not restore your archive.')}
    finally{if(generation.current===version)setBusy(false)}})()
  },[])
  async function open(file?:File){const version=++generation.current;setBusy(true);setError('');setProgress(0);setStatus(file?'Opening your export':'Preparing demo');closeArchive()
    try{const result=file?await loadArchive(file,progressUpdate):await loadDemo();if(version!==generation.current)return
      if(file){try{await saveArchive(remember?file:null)}catch{result.warnings.push('Browser storage is unavailable or full. This archive is available for this visit only.')}}
      if(version!==generation.current)return
      try{sessionStorage.setItem('archive-mode',result.demo?'demo':'archive')}catch{/* Storage may be unavailable. */}
      setProgress(100);setSession(result);soundFeedback('success')
    }catch(e){if(version===generation.current){setError(e instanceof Error?e.message:'Could not open this export.');soundFeedback('error')}}
    finally{if(version===generation.current)setBusy(false)}
  }
  function cancel(){generation.current++;closeArchive();setBusy(false);setProgress(0);setError('')}
  function change(){generation.current++;closeArchive();setSession(undefined);setError('');setBusy(false);try{sessionStorage.removeItem('archive-mode')}catch{/* Optional storage. */}}
  async function forget(){try{await saveArchive(null);change()}catch{setSession(s=>s?{...s,warnings:[...s.warnings,'Could not remove the saved archive. Clear this site’s browser data to remove it.']}:s)}}
  return session?<Workspace key={session.name+session.demo} session={session} sounds={sounds} onChange={change} onForget={forget}/>:<Welcome sounds={sounds} busy={busy} progress={progress} status={status} error={error} remember={remember} onRemember={setRemember} onFile={file=>void open(file)} onDemo={()=>void open()} onCancel={cancel}/>
}
