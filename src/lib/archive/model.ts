import type { ArchiveFile, Detail, Stats } from '../api'
// Export schemas vary over time. Normalize their untyped boundary in this module.
export type Raw = Record<string, any>
export type Message = Detail['messages'][number] & { model: string; hidden: boolean; metric: boolean }
export type ArchiveRecord = Omit<Detail, 'messages'> & { messages: Message[]; created: number; search: string }
export type Archive = { records: ArchiveRecord[]; files: ArchiveFile[]; stats: Stats; demo: boolean; warnings: string[] }
export const obj = (v: unknown): Raw => v && typeof v === 'object' && !Array.isArray(v) ? v : {}
export const list = (v: unknown): any[] => Array.isArray(v) ? v : []
export function stamp(v: unknown): number {
  const n = typeof v === 'number' ? (v > 1e11 ? v / 1000 : v) : typeof v === 'string' ? Date.parse(v) / 1000 : 0
  return Number.isFinite(n) && n > 0 && n < 4102444800 ? n : 0
}
export function content(v: unknown, depth = 0): string {
  if (depth > 30) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(x => content(x, depth + 1)).filter(Boolean).join('\n')
  const r = obj(v)
  if (typeof r.text === 'string') return r.text
  for (const k of ['parts', 'content', 'transcript', 'result', 'output']) if (k in r) return content(r[k], depth + 1)
  return r.asset_pointer ? `[Attachment: ${r.asset_pointer}]` : ''
}
export function normalize(raw: Raw, kind: string, id: string, source: string): ArchiveRecord {
  const messages: Message[] = []
  const mapping = obj(raw.mapping)
  const seen = new Set<string>(); const path: string[] = []
  let current = raw.current_node
  while (typeof current === 'string' && mapping[current] && !seen.has(current)) {
    seen.add(current); path.push(current); current = mapping[current].parent
  }
  const ordered = [...path.reverse(), ...Object.keys(mapping).filter(k => !seen.has(k)).sort((a,b) => stamp(mapping[a]?.message?.create_time) - stamp(mapping[b]?.message?.create_time))]
  for (const key of ordered) {
    const m = obj(mapping[key]?.message)
    if (!Object.keys(m).length) continue
    const text = content(m.content)
    const role = obj(m.author).role || 'unknown'
    if (!text && !obj(m.content).parts) continue
    messages.push({ id: key, role, text, time: stamp(m.create_time), alternate: path.length > 0 && !seen.has(key), model: obj(m.metadata).model_slug || raw.default_model_slug || 'Unknown', hidden: !!obj(m.metadata).is_visually_hidden_from_conversation, metric: ['user','assistant'].includes(role) })
  }
  for (const turn of list(raw.turns)) for (const item of [...list(turn.input_items), ...list(turn.output_items)]) {
    messages.push({ id: `turn-${messages.length}`, role: item.role || 'tool', text: content(item) || JSON.stringify(item), time: stamp(item.create_time || turn.create_time), alternate: false, model: item.model || turn.model || 'Unknown', hidden: false, metric: item.type === 'message' && ['user','assistant'].includes(item.role) })
  }
  const projection = obj(raw.projection)
  const title = String(raw.title || projection.title || projection.name || (['conversations','codex'].includes(kind) ? 'Untitled' : source))
  const text = kind === 'pages' ? String(projection.materialized_search_text || content(projection)) : messages.length ? '' : content(raw)
  return { id, kind, title, model: String(raw.default_model_slug || ''), updated: stamp(raw.update_time || raw.updated_at || raw.create_time), created: stamp(raw.create_time), count: messages.length || Object.keys(raw).length, source, raw, text, messages, search: `${title}\n${messages.map(m=>m.text).join('\n')}\n${text || (messages.length ? '' : JSON.stringify(raw))}`.toLowerCase() }
}
export function addJSON(records: ArchiveRecord[], name: string, value: unknown, offset = 0) {
  const base = name.split('/').at(-1) || name
  if (/^(conversations|codex)(-\d+)?\.json$/i.test(base)) {
    const rows = Array.isArray(value) ? value : list(obj(value).conversations)
    if (!rows.length) return
    const kind = base.startsWith('codex') ? 'codex' : 'conversations'
    for (const [i, record] of rows.entries()) {
      if (!record || typeof record !== 'object' || (!record.mapping && !record.turns)) continue
      records.push(normalize(record, kind, `${kind}:${record.id || record.conversation_id || `${name}-${i + offset}`}`, name))
    }
  } else {
    const kind = /pages\/.*\/content\/current\.json$/.test(name) ? 'pages' : name.startsWith('sites/') ? 'sites' : !name.includes('/') ? 'account' : 'other'
    const row = normalize(obj(value), kind, name, name)
    row.raw = value; row.count = Array.isArray(value) ? value.length : Object.keys(obj(value)).length
    records.push(row)
  }
}
export function makeArchive(records: ArchiveRecord[], files: ArchiveFile[], name: string, demo = false, warnings: string[] = []): Archive {
  records = [...new Map(records.map(r=>[r.id,r])).values()]
  const counts: Record<string, number> = {}
  for (const row of records) counts[row.kind] = (counts[row.kind] || 0) + 1
  return { records, files, demo, warnings, stats: { counts, models: [...new Set(records.map(r=>r.model).filter(Boolean))].sort(), archive: { name, files: files.length, bytes: files.reduce((sum,f)=>sum+f.size,0) } } }
}
