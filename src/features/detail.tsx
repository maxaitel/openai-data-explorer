import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Choice, Failure, Loading } from '@/components/shared'
import { date, useApi } from '@/lib/api'
import type { Detail } from '@/lib/api'

function JsonTree({ value, label = 'Record', depth = 0 }: { value: unknown; label?: string; depth?: number }) {
  const [limit, setLimit] = useState(50)
  if (value === null || typeof value !== 'object') return <div className="json-value"><span className="text-muted-foreground">{label}: </span>{JSON.stringify(value)}</div>
  const entries = Object.entries(value)
  return <details className="json-node" open={depth < 1}><summary>{label} <span className="text-muted-foreground">{Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}</span></summary><div className="pl-4">{entries.slice(0, limit).map(([key, child]) => <JsonTree key={key} label={key} value={child} depth={depth + 1} />)}{entries.length > limit && <Button variant="ghost" onClick={() => setLimit(limit + 100)}>Show more</Button>}</div></details>
}
export function Prose({ children }: { children: string }) { return <div className="prose"><Markdown remarkPlugins={[remarkGfm]} components={{ img: ({ alt }) => <span className="text-muted-foreground">[Image: {alt || 'attachment'}]</span>, a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{children}</Markdown></div> }
export function RecordDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error } = useApi<Detail>(`/api/record?id=${encodeURIComponent(id)}`)
  const [branch, setBranch] = useState('active')
  const [limit, setLimit] = useState(50)
  const [role, setRole] = useState('all')
  const filtered = data?.messages.filter(m => (branch === 'all' || !m.alternate) && (role === 'all' || m.role === role)) || []
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data?.raw, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `${data?.title.replace(/[^\w -]/g, '').slice(0, 80) || 'record'}.json`; a.click(); URL.revokeObjectURL(url)
  }
  return <section className="detail-panel" aria-label="Record detail"><header className="detail-header"><div className="min-w-0"><h2>{data?.title || 'Loading…'}</h2><p className="text-xs text-muted-foreground mt-1">{data && date(data.updated)}</p></div><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label="Download JSON" disabled={!data} onClick={download}><Download /></Button><Button variant="ghost" size="icon" aria-label="Close detail" onClick={onClose}><X /></Button></div></header>
    {error ? <Failure message={error} /> : !data ? <Loading /> : <Tabs defaultValue={data.messages.length || data.text ? 'read' : 'json'} className="min-h-0 flex-1"><TabsList className="mx-6"><TabsTrigger value="read">{data.messages.length ? 'Conversation' : 'Content'}</TabsTrigger><TabsTrigger value="json">JSON</TabsTrigger></TabsList>
      <TabsContent value="read" className="detail-scroll">
        {!!data.messages.length && <><div className="flex flex-wrap gap-2 mb-6"><Choice label="Message roles" value={role} onChange={v => { setRole(v); setLimit(50) }} options={['all', 'user', 'assistant', 'tool', 'system'].map(v => ({ value: v, label: v === 'all' ? 'All roles' : v }))} /><Choice label="Conversation branches" value={branch} onChange={v => { setBranch(v); setLimit(50) }} options={[{ value: 'active', label: 'Active branch' }, { value: 'all', label: 'All branches' }]} /></div>{filtered.slice(0, limit).map(m => <article key={m.id} className="message"><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground capitalize">{m.role}{m.alternate && <Badge variant="outline">Alternate branch</Badge>}</div><div className={m.role === 'user' ? 'message-body user-message' : 'message-body'}><Prose>{m.text}</Prose></div></article>)}{filtered.length > limit && <Button variant="outline" onClick={() => setLimit(limit + 50)}>Show more messages ({filtered.length - limit})</Button>}</>}
        {data.text && <Prose>{data.text}</Prose>}{!data.messages.length && !data.text && <JsonTree value={data.raw} />}
      </TabsContent><TabsContent value="json" className="detail-scroll"><JsonTree value={data.raw} /></TabsContent></Tabs>}
  </section>
}
