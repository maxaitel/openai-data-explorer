import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Choice, Failure, Loading, NoResults } from '@/components/shared'
import { RecordDetail } from './detail'
import { FileDetail } from './files'
import { bytes, date, number, useApi } from '@/lib/api'
import type { ArchiveFile, RecordItem, Stats } from '@/lib/api'

const labels: Record<string, string> = { conversations: 'Conversations', codex: 'Codex', pages: 'Pages', sites: 'Sites', files: 'Files', account: 'Account', other: 'Page history' }
export function Explorer({ kind, stats, initialId }: { kind: string; stats?: Stats; initialId?: string }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [model, setModel] = useState('all')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(initialId || '')
  const [file, setFile] = useState<ArchiveFile>()
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(0) }, 250); return () => clearTimeout(timer) }, [search])
  const isFiles = kind === 'files'
  const params = new URLSearchParams({ kind, q: query, page: String(page), sort, ...(model !== 'all' ? { model } : {}) })
  const { data, error } = useApi<{ items: (RecordItem & ArchiveFile)[]; total: number }>(`/api/${isFiles ? 'files' : 'records'}?${params}`)
  const chatting = kind === 'conversations' || kind === 'codex'
  return <div className="explorer"><section className="list-panel"><header className="list-heading"><h1>{labels[kind]}</h1><span className="text-muted-foreground tabular-nums">{data ? number(data.total) : '…'}</span></header><div className="list-filters"><div className="relative flex-1 min-w-36"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="h-9 pl-9" aria-label={`Search ${labels[kind].toLowerCase()}`} placeholder={`Search ${labels[kind].toLowerCase()}`} value={search} onChange={e => setSearch(e.target.value)} /></div>{kind === 'conversations' && <Choice label="Model filter" value={model} onChange={v => { setModel(v); setPage(0) }} options={[{ value: 'all', label: 'All models' }, ...(stats?.models || []).map(m => ({ value: m, label: m }))]} />}{!isFiles && <Choice label="Sort order" value={sort} onChange={v => { setSort(v); setPage(0) }} options={[{ value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }, { value: 'title', label: 'Title A–Z' }, ...(chatting ? [{ value: 'messages', label: 'Most messages' }] : [])]} />}</div>
      <div className="results-scroll">{error ? <Failure message={error} /> : !data ? <Loading /> : !data.items.length ? <NoResults /> : <Table><TableHeader><TableRow><TableHead>{isFiles ? 'Name' : 'Title'}</TableHead>{kind === 'conversations' && <TableHead>Model</TableHead>}<TableHead className="text-right">{isFiles ? 'Size' : chatting ? 'Messages' : 'Items'}</TableHead>{!isFiles && <TableHead>Updated</TableHead>}</TableRow></TableHeader><TableBody>{data.items.map(row => <TableRow key={isFiles ? row.path : row.id} data-state={selected === row.id || file?.path === row.path && isFiles ? 'selected' : undefined}><TableCell className="max-w-72"><button className="row-button" onClick={() => { if (isFiles) { setFile(row); setSelected('') } else { setSelected(row.id); setFile(undefined) } }}>{isFiles ? row.name : row.title}</button>{isFiles && <div className="truncate text-xs text-muted-foreground max-w-64">{row.path}</div>}</TableCell>{kind === 'conversations' && <TableCell className="text-xs text-muted-foreground">{row.model || '—'}</TableCell>}<TableCell className="text-right tabular-nums text-muted-foreground">{isFiles ? bytes(row.size) : number(row.count)}</TableCell>{!isFiles && <TableCell className="text-xs text-muted-foreground">{date(row.updated)}</TableCell>}</TableRow>)}</TableBody></Table> }</div>
      <footer className="pagination"><span>{data?.total ? `${number(page * 50 + 1)}–${number(Math.min((page + 1) * 50, data.total))} of ${number(data.total)}` : '0 results'}</span><div className="flex gap-1"><Button variant="outline" size="icon" aria-label="Previous page" disabled={page === 0 || !data} onClick={() => setPage(page - 1)}><ChevronLeft /></Button><Button variant="outline" size="icon" aria-label="Next page" disabled={!data || (page + 1) * 50 >= data.total} onClick={() => setPage(page + 1)}><ChevronRight /></Button></div></footer>
    </section>{selected && <RecordDetail key={selected} id={selected} onClose={() => setSelected('')} />}{file && <FileDetail key={file.path} file={file} onClose={() => setFile(undefined)} />}</div>
}
