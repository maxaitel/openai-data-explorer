import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Failure, Loading } from '@/components/shared'
import { bytes } from '@/lib/api'
import { archiveFile } from '@/lib/archive/client'
import type { ArchiveFile } from '@/lib/api'
export function FileDetail({ file, onClose }: { file: ArchiveFile; onClose: () => void }) {
  const [state,setState]=useState<{url?:string;text?:string;error?:string}>({})
  useEffect(()=>{let active=true;let url:string|undefined
    archiveFile(file.path).then(async blob=>{url=URL.createObjectURL(blob);const text=await blob.slice(0,200000).text();if(active)setState({url,text});else URL.revokeObjectURL(url) }).catch(error=>{if(active)setState({error:error.message})})
    return()=>{active=false;if(url)URL.revokeObjectURL(url)}
  },[file.path])
  const image=['image/png','image/jpeg','image/gif','image/webp'].includes(file.mime)
  const audio=['audio/mpeg','audio/wav','audio/ogg'].includes(file.mime)
  const video=['video/mp4','video/webm'].includes(file.mime)
  const text=file.mime.startsWith('text/')||/\.(json|md|txt|csv|js|ts|py|html|css|xml|yaml|yml)$/i.test(file.name)
  return <section className="detail-panel" aria-label="File detail"><header className="detail-header"><div className="min-w-0"><h2>{file.name}</h2><p className="text-xs text-muted-foreground mt-1">{bytes(file.size)} · {file.mime}</p></div><div className="flex gap-1">{state.url&&<Button asChild variant="ghost" size="icon"><a href={state.url} download={file.name} aria-label="Download file"><Download /></a></Button>}<Button variant="ghost" size="icon" onClick={onClose} aria-label="Close detail"><X /></Button></div></header><div className="detail-scroll"><p className="text-xs text-muted-foreground break-all mb-6">{file.path}</p>{state.error?<Failure message={state.error}/>:!state.url?<Loading/>:image?<img src={state.url} alt={file.name} className="w-full rounded-md"/>:audio?<audio controls src={state.url} className="w-full"/>:video?<video controls src={state.url} className="w-full"/>:text?<><pre className="file-text">{state.text}</pre>{file.size>200000&&<p className="metric-note">Preview: first 200 KB. Download for the complete file.</p>}</>:<p className="text-muted-foreground">Download this file to open it. Active documents and code are never executed in the preview.</p>}</div></section>
}
