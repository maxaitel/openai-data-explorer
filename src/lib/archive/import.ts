import { BlobReader, ZipReader, configure, type Entry } from '@zip.js/zip.js'
import { makeArchive, type ArchiveRecord } from './model'
import { jsonSink, isConversationFile } from './json-stream'
configure({useWebWorkers:false}) // Already inside our dedicated archive worker.
const mimeFor=(name:string)=>({json:'application/json',txt:'text/plain',md:'text/plain',csv:'text/csv',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',mp4:'video/mp4',webm:'video/webm',pdf:'application/pdf'}[name.split('.').at(-1)?.toLowerCase()||'']||'application/octet-stream')
// Enforce actual decompressed byte limits, not just untrusted ZIP metadata.
export async function entryBlob(entry: Entry, max: number, mime: string) {
  if(entry.directory || !entry.getData) throw new Error('This entry is not a file.')
  if(entry.uncompressedSize>max) throw new Error('This file is too large to preview or index in the browser.')
  let size=0; const parts:BlobPart[]=[]
  await entry.getData(new WritableStream<Uint8Array>({write(chunk){size+=chunk.byteLength;if(size>max)throw new Error('Decompressed file exceeds the browser limit.');parts.push(new Uint8Array(chunk))}}),{checkSignature:true})
  return new Blob(parts,{type:mime})
}
export async function importFile(file:File, progress:(value:number,label:string)=>void) {
  const records:ArchiveRecord[]=[]
  const warnings:string[]=[]
  if(file.name.toLowerCase().endsWith('.json')) {
    progress(15,'Reading conversations')
    await file.stream().pipeTo(jsonSink(records, file.name.toLowerCase().startsWith('codex')?'codex.json':'conversations.json', bytes => progress(10 + Math.round(bytes / Math.max(1,file.size) * 75), `Reading conversations · ${records.length.toLocaleString()} indexed`)))
    if(!records.length) throw new Error('No conversations found. Choose a ChatGPT conversations.json or an OpenAI export ZIP.')
    progress(85,'Building your archive')
    return {archive:makeArchive(records,[{path:file.name,name:file.name,size:file.size,mime:'application/json'}],file.name),getFile:async()=>file}
  }
  if(!file.name.toLowerCase().endsWith('.zip')) throw new Error('Choose a .zip or .json export file.')
  const reader=new ZipReader(new BlobReader(file))
  try {
    progress(5,'Opening archive')
    const entries=await reader.getEntries()
    const actual=entries.filter(e=>!e.directory)
    // Some exports include a single enclosing folder. Strip it consistently.
    const first=actual[0]?.filename.split('/')[0]
    const prefix=first && actual.every(e=>e.filename.startsWith(first+'/')) ? first+'/' : ''
    const byName=new Map(actual.map(e=>[e.filename.slice(prefix.length),e]))
    const json=[...byName].filter(([name])=>name.endsWith('.json')&&!name.startsWith('__MACOSX/'))
    const totalBytes=json.reduce((sum,[,entry])=>sum+entry.uncompressedSize,0)
    let completedBytes=0
    let lastProgress=0
    for(const [name,entry] of json){
      const start=records.length
      try {
        if(!entry.getData) throw new Error('This entry is not a file.')
        await entry.getData(jsonSink(records,name,bytes=>{
          if(performance.now()-lastProgress<100)return
          lastProgress=performance.now()
          progress(Math.min(84,10+Math.round((completedBytes+bytes)/Math.max(1,totalBytes)*75)),`Indexing ${name} · ${records.length.toLocaleString()} records`)
        }),{checkSignature:true})
      } catch(error){
        records.length=start
        if(isConversationFile(name))throw new Error(`Could not read ${name}: ${error instanceof Error?error.message:'Invalid JSON'}`)
        warnings.push(`Skipped unreadable JSON: ${name}`)
      }
      completedBytes+=entry.uncompressedSize
      progress(10+Math.round(completedBytes/Math.max(1,totalBytes)*75),'Indexing archive')
    }
    if(!records.some(r=>['conversations','codex','pages'].includes(r.kind)))throw new Error('This ZIP does not contain a supported OpenAI export. Look for conversations.json or conversations-0.json.')
    const assetNames=records.find(r=>r.id==='conversation_asset_file_names.json')?.raw as Record<string,string>|undefined
    const files=[...byName].map(([path,e])=>{const name=typeof assetNames?.[path]==='string'?assetNames[path]:path.split('/').at(-1)!;return {path,name,size:e.uncompressedSize,mime:mimeFor(name)}})
    return {archive:makeArchive(records,files,file.name,false,warnings),getFile:async(path:string)=>{const entry=byName.get(path);if(!entry)throw new Error('File not found.');return entryBlob(entry,128*1024*1024,files.find(f=>f.path===path)!.mime)}}
  } catch(error) { await reader.close(); throw error }
}
