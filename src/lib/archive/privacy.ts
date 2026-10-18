import { list, obj, type ArchiveRecord } from './model'
export function buildPrivacy(records: ArchiveRecord[]) {
  const account=(name:string)=>list(records.find(r=>r.id===name)?.raw)
  let messages=0
  const chats=new Set<string>(), types:Record<string,number>={}, examples:{id:string;title:string;snippet:string;reason?:string}[]=[], snippets=new Set<string>()
  const suggestions:{id:string;title:string;scope:string;label?:string}[]=[]
  for(const row of records.filter(r=>r.kind==='conversations')) for(const node of Object.values(obj(obj(row.raw).mapping))) {
    const meta=obj(obj(obj(node).message).metadata), citations=list(meta.conversation_context_citation_metadata)
    if(citations.length){messages++;chats.add(row.id)}
    for(const entry of citations){ const c=obj(entry.citation); const kind=c.conversation_context_type || (c.category==='memory' && c.attribution==='Past chat'?'past_conversation':'other'); types[kind]=(types[kind]||0)+1
      if(kind==='general_memory' && typeof c.snippet==='string' && !snippets.has(c.snippet) && examples.length<6){snippets.add(c.snippet); examples.push({id:row.id,title:row.title,snippet:c.snippet,reason:c.reason})}
    }
    if(meta.suggested_context_scope) suggestions.push({id:row.id,title:row.title,scope:meta.suggested_context_scope,label:meta.suggested_context_scope_action_label})
  }
  const files=account('library_files.json'), shares=account('shared_conversations.json')
  return {memory:{messages,conversations:chats.size,types,examples},files:{total:files.length,linkedToMessages:files.filter(f=>f.origination_message_id&&f.origination_thread_id).length,fingerprints:files.filter(f=>f.sha256_digest).length,renamed:files.filter(f=>f.user_renamed_at).length,deleted:files.filter(f=>f.deleted_at).length,trashed:files.filter(f=>f.trashed_at).length},shares:{total:shares.length,anonymous:shares.filter(s=>s.is_anonymous===true).length},suggestions:{messages:suggestions.length,conversations:new Set(suggestions.map(s=>s.id)).size,examples:[...new Map(suggestions.map(s=>[s.id+s.scope,s])).values()].slice(0,6)}}
}
