export type Session = { name:string; demo:boolean; warnings:string[] }
type Pending = {resolve:(value:any)=>void;reject:(error:Error)=>void;progress?:(value:number,label:string)=>void}
let worker:Worker|undefined
let next=0
const pending=new Map<number,Pending>()
function getWorker(){
  if(!worker){worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});worker.onmessage=event=>{const {id,result,error,progress,label}=event.data;const job=pending.get(id);if(!job)return;if(progress!==undefined){job.progress?.(progress,label);return}pending.delete(id);if(error)job.reject(new Error(error));else job.resolve(result)};worker.onerror=()=>{for(const job of pending.values())job.reject(new Error('The archive worker stopped. Try a smaller export.'));pending.clear();worker?.terminate();worker=undefined}}
  return worker
}
function request<T>(payload:Record<string,unknown>,progress?:Pending['progress']):Promise<T>{return new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject,progress});getWorker().postMessage({id,...payload})})}
export const loadArchive=(file:File,progress:Pending['progress'])=>request<Session>({action:'load',file},progress)
export const loadDemo=()=>request<Session>({action:'demo'})
export const archiveQuery=<T>(url:string)=>request<T>({action:'query',url})
export const archiveFile=(path:string)=>request<Blob>({action:'file',path})
export function closeArchive(){worker?.terminate();worker=undefined;for(const job of pending.values())job.reject(new Error('Archive closed.'));pending.clear()}
const DB='openai-data-explorer-browser'
async function database(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('archive');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export async function savedArchive():Promise<File|undefined>{const db=await database();try{return await new Promise((resolve,reject)=>{const r=db.transaction('archive').objectStore('archive').get('file');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}finally{db.close()}}
export async function saveArchive(file:File|null){const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('archive','readwrite');if(file)tx.objectStore('archive').put(file,'file');else tx.objectStore('archive').clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}finally{db.close()}}
