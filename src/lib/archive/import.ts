import { BlobReader, ZipReader, configure, type Entry } from '@zip.js/zip.js'
import { addJSON, makeArchive, type ArchiveRecord } from './model'
configure({useWebWorkers:false}) // Already inside our dedicated archive worker.
const MAX_JSON = 128 * 1024 * 1024
const MAX_INDEX = 384 * 1024 * 1024
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
    if(file.size>MAX_JSON) throw new Error('JSON files must be under 128 MB.')
    progress(15,'Reading conversations')
    const raw=JSON.parse(await file.text())
    addJSON(records,file.name.toLowerCase().startsWith('codex')?'codex.json':'conversations.json',raw)
    if(!records.length) throw new Error('No conversations found. Choose a ChatGPT conversations.json or an OpenAI export ZIP.')
    progress(85,'Building your archive')
    return {archive:makeArchive(records,[{path:file.name,name:file.name,size:file.size,mime:'application/json'}],file.name),getFile:async()=>file}
  }
  if(!file.name.toLowerCase().endsWith('.zip')) throw new Error('Choose a .zip or .json export file.')
  const reader=new ZipReader(new BlobReader(file))
  try {
    progress(5,'Opening archive')
    const entries=await reader.getEntries()
    if(entries.length>50000) throw new Error('This archive has too many files. Upload conversations.json instead.')
    const actual=entries.filter(e=>!e.directory)
    // Some exports include a single enclosing folder. Strip it consistently.
    const first=actual[0]?.filename.split('/')[0]
    const prefix=first && actual.every(e=>e.filename.startsWith(first+'/')) ? first+'/' : ''
    const byName=new Map(actual.map(e=>[e.filename.slice(prefix.length),e]))
    const json=[...byName].filter(([name])=>name.endsWith('.json')&&!name.startsWith('__MACOSX/'))
    let bytes=0
    for(const [index,[name,entry]] of json.entries()){bytes+=entry.uncompressedSize;if(entry.uncompressedSize>MAX_JSON||bytes>MAX_INDEX)throw new Error('The JSON data is too large to index in this browser. Try a smaller export.')
      try { addJSON(records,name,JSON.parse(await (await entryBlob(entry,MAX_JSON,'application/json')).text())) }
      catch(error){if(/conversations|codex/.test(name))throw new Error(`Could not read ${name}: ${error instanceof Error?error.message:'Invalid JSON'}`);warnings.push(`Skipped unreadable JSON: ${name}`)}
      progress(10+Math.round((index+1)/Math.max(1,json.length)*75),'Indexing archive')
    }
    if(!records.some(r=>['conversations','codex','pages'].includes(r.kind)))throw new Error('This ZIP does not contain a supported OpenAI export. Look for conversations.json or conversations-0.json.')
    const assetNames=records.find(r=>r.id==='conversation_asset_file_names.json')?.raw as Record<string,string>|undefined
    const files=[...byName].map(([path,e])=>{const name=typeof assetNames?.[path]==='string'?assetNames[path]:path.split('/').at(-1)!;return {path,name,size:e.uncompressedSize,mime:mimeFor(name)}})
    return {archive:makeArchive(records,files,file.name,false,warnings),getFile:async(path:string)=>{const entry=byName.get(path);if(!entry)throw new Error('File not found.');return entryBlob(entry,128*1024*1024,files.find(f=>f.path===path)!.mime)}}
  } catch(error) { await reader.close(); throw error }
}
