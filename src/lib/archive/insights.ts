import type { ArchiveRecord, Message } from './model'
const timezone = 'Pacific/Auckland'
const dayFormatter = new Intl.DateTimeFormat('en-CA',{ timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit' })
const hourFormatter = new Intl.DateTimeFormat('en-GB',{ timeZone:timezone, hour:'2-digit', hourCycle:'h23' })
const day = (time: number) => dayFormatter.format(time * 1000)
const patterns: Record<string, RegExp> = {
  'Code & development': /\b(code|coding|python|javascript|typescript|react|api|debug|github|git|sql|app|website|software|programming|swift|css|html|server|database|deploy|bug)\b/i,
  'Learning & research': /\b(learn|learning|study|math|calculus|explain|research|exam|course|physics|science|quiz|lesson)\b/i,
  'Writing & communication': /\b(write|writing|rewrite|email|draft|essay|translate|resume|summary|message)\b/i,
  'Travel & places': /\b(travel|trip|flight|hotel|itinerary|visa|vacation|restaurant|auckland|sydney)\b/i,
  'Design & creativity': /\b(design|image|photo|logo|illustration|art|color|colour|font|animation|figma|ui|ux|video|music)\b/i,
  'Everyday questions': /\b(food|cook|recipe|buy|shopping|weather|phone|laptop|car|coffee|clean|repair|fix|best|compare)\b/i,
}
const increment = (map: Map<string,number>, key: string) => map.set(key,(map.get(key)||0)+1)
const ranked = (map: Map<string,number>) => [...map].sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count}))
type MetricRecord = { row: ArchiveRecord; messages: Message[]; created: number }
export function buildInsights(records: ArchiveRecord[], source: string) {
  const chats = records.filter(r=>source === 'both' ? ['conversations','codex'].includes(r.kind) : r.kind === (source === 'chatgpt' ? 'conversations' : 'codex'))
  const groups = new Map<string,MetricRecord[]>([['all',[]]])
  for (const row of chats) {
    const messages = row.messages.filter(m=>m.metric && !m.alternate && !m.hidden)
    const created = row.created || messages.find(m=>m.time)?.time || 0
    groups.get('all')!.push({row,messages,created})
    const years = new Set(messages.filter(m=>m.time).map(m=>day(m.time).slice(0,4)))
    if (created) years.add(day(created).slice(0,4))
    for (const year of years) {
      if (!groups.has(year)) groups.set(year,[])
      groups.get(year)!.push({row,created,messages: messages.filter(m=>m.time && day(m.time).startsWith(year))})
    }
  }
  return { years:[...groups.keys()].filter(k=>k!=='all').sort().reverse(), timezone, undatedConversations:groups.get('all')!.filter(r=>!r.created && !r.messages.some(m=>m.time)).length, periods:Object.fromEntries([...groups].map(([period,rows])=>[period,aggregate(rows)])) }
}
function aggregate(rows: MetricRecord[]) {
  const daily = new Map<string,number>(), monthly = new Map<string,number>(), hours = new Map<string,number>(), weekdays = new Map<string,number>(), models = new Map<string,number>(), topics = new Map<string,number>()
  const examples: Record<string,{id:string;kind:string;title:string}[]> = {}
  const longest: {id:string;kind:string;title:string;count:number;prompts:number}[] = []
  let prompts=0,responses=0,words=0,undatedPrompts=0,first=Infinity,last=0
  for (const {row,messages} of rows) {
    longest.push({id:row.id,kind:row.kind,title:row.title,count:messages.length,prompts:messages.filter(m=>m.role==='user').length})
    for (const [topic,pattern] of Object.entries(patterns)) if (pattern.test(row.title)) {
      increment(topics,topic); (examples[topic] ||= []).push({id:row.id,kind:row.kind,title:row.title})
    }
    for (const m of messages) {
      if (m.role === 'assistant') { responses++; increment(models,m.model) }
      else { prompts++; words += m.text.trim() ? m.text.trim().split(/\s+/).length : 0; if (!m.time) undatedPrompts++ }
      if (!m.time) continue
      first=Math.min(first,m.time); last=Math.max(last,m.time)
      if (m.role !== 'user') continue
      const date=day(m.time)
      increment(daily,date); increment(monthly,date.slice(0,7)); increment(hours,hourFormatter.format(m.time*1000))
      increment(weekdays,String((new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7))
    }
  }
  let streak=0,run=0,previous=0
  for (const date of [...daily.keys()].sort()) { const current=Date.parse(`${date}T00:00:00Z`); run=current-previous===86400000?run+1:1; streak=Math.max(streak,run); previous=current }
  const months=[...monthly.keys()].sort()
  if (months.length) {
    const date=new Date(`${months[0]}-01T00:00:00Z`), end=months.at(-1)!
    while (date.toISOString().slice(0,7)<=end) { const key=date.toISOString().slice(0,7); if (!monthly.has(key)) monthly.set(key,0); date.setUTCMonth(date.getUTCMonth()+1) }
  }
  const peak=ranked(daily)[0]
  return { conversations:rows.length,messages:prompts+responses,prompts,responses,words,activeDays:daily.size,streak,undatedPrompts,first:Number.isFinite(first)?first:0,last,peakHour:hours.size?Number(ranked(hours)[0].name):null,peakWeekday:weekdays.size?Number(ranked(weekdays)[0].name):null,peakDay:peak?{date:peak.name,count:peak.count}:null,monthly:[...monthly].sort(([a],[b])=>a.localeCompare(b)).map(([month,count])=>({month,count})),hours:Array.from({length:24},(_,hour)=>({hour,count:hours.get(String(hour).padStart(2,'0'))||0})),models:ranked(models).slice(0,8),topics:ranked(topics).map(t=>({...t,examples:examples[t.name].slice(0,10)})),wordsUsed:[],longest:longest.sort((a,b)=>b.count-a.count).slice(0,5) }
}
