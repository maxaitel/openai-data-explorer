import { addJSON, makeArchive, type ArchiveRecord } from './model'
const subjects = [
  ['Design a reading app', 'Help me design a calm reading app.', 'Start with a comfortable reading width, clear type hierarchy, and a simple library. Keep the reading view focused on the text.'],
  ['Plan a weekend trip', 'Plan a relaxed weekend trip with a short walk.', 'Try a morning walk, a local café, and one museum. Leave the afternoon open so the trip feels unhurried.'],
  ['Debug a React component', 'How can I prevent stale state in a React callback?', 'Use a functional update when the next value depends on the previous one. For example: `setCount(value => value + 1)`.'],
  ['Learn orbital physics', 'Explain why satellites stay in orbit.', 'An orbit is continuous free fall. A satellite moves sideways fast enough that the surface curves away beneath it as gravity pulls it inward.'],
  ['Write a project update', 'Draft a concise update for a fictional project.', 'The prototype is ready for feedback. This week we improved navigation and tested the main flow. Next, we will refine the details.'],
  ['Coffee brewing recipe', 'Suggest a starting recipe for filter coffee.', 'Try 15 grams of coffee with 250 grams of water. Adjust the grind and ratio to suit your beans and taste.'],
  ['Create a colour palette', 'Create a quiet palette for an imaginary journal.', 'Combine a deep charcoal surface with warm white text and a restrained mint accent. Reserve the accent for actions and selected states.'],
  ['Compare database designs', 'Explain the tradeoff between one table and several related tables.', 'Separate entities when they have independent lifecycles. Relationships help prevent duplicate data, while a simpler schema can be useful for small prototypes.'],
]
export function demoArchive() {
  let seed=42
  const random=()=>{ seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296 }
  const records: ArchiveRecord[]=[]
  for(let i=0;i<240;i++) {
    const [title,prompt,reply]=subjects[i%subjects.length]
    const created=Date.UTC(2025+Math.floor(i/160),Math.floor(i/20)%12,1+(i*7)%27,8+Math.floor(random()*12))/1000
    const model=['gpt-4o','o3','gpt-5','gpt-5-mini'][Math.floor(random()*4)]
    const mapping: Record<string,unknown>={}
    const length=2+Math.floor(random()*8)*2
    for(let j=0;j<length;j++) mapping[`m${j}`]={parent:j?`m${j-1}`:null,message:{author:{role:j%2?'assistant':'user'},create_time:created+j*90,content:{parts:[j%2?reply:j===0?prompt:'Could you give a practical example?']},metadata:{model_slug:model}}}
    const raw={id:`demo-${i}`,title:`${title}${i>=subjects.length?` · ${Math.floor(i/subjects.length)+1}`:''}`,create_time:created,update_time:created+length*90,default_model_slug:model,mapping,current_node:`m${length-1}`}
    if(i%9===0) {
      const turns=[{create_time:created,model,input_items:[{type:'message',role:'user',content:prompt}],output_items:[{type:'message',role:'assistant',content:reply}]}]
      addJSON(records,'codex-0.json',[{...raw,mapping:undefined,turns}])
    } else addJSON(records,'conversations.json',[raw])
  }
  addJSON(records,'pages/demo-journal/content/current.json',{projection:{title:'A small creative journal',materialized_search_text:'# A small creative journal\n\nThis fictional page is part of the demo archive.\n\n- Collect ideas\n- Make a prototype\n- Reflect on what worked'}})
  addJSON(records,'sites/demo-site.json',{title:'Fictional portfolio',description:'A demo site export. No live site or personal data.'})
  addJSON(records,'user_settings.json',[{settings:{training_allowed:false,codex_training_allowed_v2:false},announcements:{}}])
  addJSON(records,'ads.json',{ads_profile:[],ad_history:[],ad_hides:[],reported_ads:[]})
  for(const name of ['message_feedback.json','library_files.json','shared_conversations.json']) addJSON(records,name,[])
  const files=records.filter(r=>['account','pages','sites'].includes(r.kind)).map(r=>({path:r.source,name:r.source.split('/').at(-1)!,size:new TextEncoder().encode(JSON.stringify(r.raw,null,2)).length,mime:'application/json'}))
  return makeArchive(records,files,'Demo archive · fictional data',true)
}
