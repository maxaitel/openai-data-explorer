// Bencho Upload dropzone (MIT), adapted from its demo tray to real OS files.
// Keeps spring expansion, gulp, rolling progress and the completed-file tick.
import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, Upload as UploadIcon, FileArchive } from 'lucide-react'
import { soundFeedback } from '@/lib/sounds'
import './upload.css'
function Roll({value}:{value:number}){const s=String(Math.round(value));return <span className="upl-roll" aria-label={`${s}%`}>{s.split('').map((d,i)=><span key={s.length-i} className="upl-roll-col"><span className="upl-roll-strip" style={{transform:`translateY(${-Number(d)}em)`}}>{'0123456789'.split('').map(n=><span key={n}>{n}</span>)}</span></span>)}%</span>}
export function Upload({busy,progress,status,error,onFile,onCancel}:{busy:boolean;progress:number;status:string;error:string;onFile:(file:File)=>void;onCancel:()=>void}) {
  const input=useRef<HTMLInputElement>(null)
  const depth=useRef(0)
  const [over,setOver]=useState(false)
  const reduced=useReducedMotion()
  function choose(files:FileList|null){setOver(false);depth.current=0;if(busy||!files?.length)return;soundFeedback('upload');onFile(files[0])}
  return <div className="upl import-module" style={{'--upl-r':'20px'} as React.CSSProperties}>
    <motion.div className="upl-zone-wrap" animate={error&&!reduced?{x:[0,-6,5,-3,0]}:{x:0}}>
      <div className="upl-zone" data-over={over||undefined} data-refuse={!!error||undefined} data-busy={busy||undefined} data-gulp={busy||undefined} onDragEnter={e=>{e.preventDefault();depth.current++;if(!busy)setOver(true)}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect=busy?'none':'copy'}} onDragLeave={e=>{e.preventDefault();depth.current--;if(depth.current<=0)setOver(false)}} onDrop={e=>{e.preventDefault();choose(e.dataTransfer.files)}}>
        <input ref={input} type="file" accept=".zip,.json,application/zip,application/json" className="sr-only" aria-label="Choose export file" disabled={busy} onChange={e=>{choose(e.target.files);e.target.value=''}} />
        {busy?<div className="upl-now"><FileArchive size={32}/><div className="upl-text"><span className="upl-name">{status}</span><span className="upl-meta"><Roll value={progress}/></span><span className="upl-track" role="progressbar" aria-label="Import progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span className="upl-bar" style={{transform:`scaleX(${progress/100})`}}/></span></div><span className="upl-end">{progress===100&&<span className="upl-tick"><Check size={14}/></span>}</span></div>:<><span className="upl-icon"><UploadIcon size={22}/></span><span className="upl-say"><b>{over?'Drop to explore':'Drop your export.'}</b><span>ChatGPT or Codex · ZIP or JSON</span></span><button className="import-choose" onClick={()=>input.current?.click()}>Choose file</button></>}
      </div>
    </motion.div>
    {busy&&<button className="import-secondary" onClick={onCancel}>Cancel import</button>}
    {error&&<p className="import-error" role="alert">{error}</p>}
    <p className="import-privacy" role="status">{busy?status:'Your data stays in your browser.'}</p>
  </div>
}
