import { demoArchive } from './demo'
import { buildInsights } from './insights'
import { buildPrivacy } from './privacy'
import { importFile } from './import'
import type { Archive } from './model'
let archive:Archive|undefined
let fileReader:((path:string)=>Promise<Blob>)|undefined
let insights:unknown
let privacy:unknown
function query(url:string) {
  if(!archive)throw new Error('Choose an archive first.')
  const u=new URL(url,'https://archive.local'), q=u.searchParams
  if(u.pathname==='/api/stats')return archive.stats
  if(u.pathname==='/api/insights')return insights ||= {sources:Object.fromEntries(['both','chatgpt','codex'].map(source=>[source,buildInsights(archive!.records,source)]))}
  if(u.pathname==='/api/privacy')return privacy ||= buildPrivacy(archive.records)
  if(u.pathname==='/api/record') {
    const record=archive.records.find(r=>r.id===q.get('id'))
    if(!record)throw new Error('This record is not included in the export.')
    const { search:_, ...detail }=record
    return detail
  }
  const terms=(q.get('q')||'').toLowerCase().split(/\s+/).filter(Boolean)
  const page=Math.max(0,Number(q.get('page'))||0)
  if(u.pathname==='/api/files') {const items=archive.files.filter(f=>terms.every(t=>(f.name+' '+f.path).toLowerCase().includes(t)));return {items:items.slice(page*50,page*50+50),total:items.length}}
  if(u.pathname==='/api/records') {
    const sort=q.get('sort')
    const items=archive.records.filter(r=>r.kind===q.get('kind')&&(!q.get('model')||r.model===q.get('model'))&&terms.every(t=>r.search.includes(t))).sort((a,b)=>sort==='title'?a.title.localeCompare(b.title):sort==='messages'?b.count-a.count:sort==='oldest'?a.updated-b.updated:b.updated-a.updated)
    return {items:items.slice(page*50,page*50+50).map(r=>({id:r.id,kind:r.kind,title:r.title,model:r.model,updated:r.updated,count:r.count,source:r.source})),total:items.length}
  }
  throw new Error('Unsupported archive request.')
}
self.onmessage=async(event:MessageEvent)=>{
  const {id,action,file,url,path}=event.data
  try {
    if(action==='load') {
      const result=await importFile(file,(progress,label)=>self.postMessage({id,progress,label}))
      archive=result.archive;fileReader=result.getFile;insights=undefined;privacy=undefined
      // Build aggregates in the worker before displaying the dashboard.
      self.postMessage({id,progress:90,label:'Calculating insights'})
      query('/api/insights')
      self.postMessage({id,result:{name:archive.stats.archive.name,demo:false,warnings:archive.warnings}})
    } else if(action==='demo') {
      archive=demoArchive(); insights=undefined;privacy=undefined
      fileReader=async(path)=>{const row=archive!.records.find(r=>r.source===path);if(!row)throw new Error('Demo file not found.');return new Blob([JSON.stringify(row.raw,null,2)],{type:'application/json'})}
      query('/api/insights')
      self.postMessage({id,result:{name:archive.stats.archive.name,demo:true,warnings:[]}})
    } else if(action==='file') { if(!fileReader)throw new Error('Choose an archive first.'); self.postMessage({id,result:await fileReader(path)}) }
    else self.postMessage({id,result:query(url)})
  } catch(error) {self.postMessage({id,error:error instanceof Error?error.message:'Unable to read this export.'})}
}
