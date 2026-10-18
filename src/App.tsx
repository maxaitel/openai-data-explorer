import { useState } from 'react'
import { BarChart3, MessageCircle, Code2, FileText, Globe, Files, UserRound, Database, History, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Insights } from '@/features/insights'
import { Privacy } from '@/features/privacy'
import { Explorer } from '@/features/explorer'
import { Failure } from '@/components/shared'
import { useApi } from '@/lib/api'
import type { Stats } from '@/lib/api'
const navigation = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'conversations', label: 'Conversations', icon: MessageCircle },
  { id: 'codex', label: 'Codex', icon: Code2 },
  { id: 'pages', label: 'Pages', icon: FileText },
  { id: 'sites', label: 'Sites', icon: Globe },
  { id: 'files', label: 'Files', icon: Files },
  { id: 'other', label: 'Page history', icon: History },
  { id: 'privacy', label: 'Privacy', icon: ShieldCheck },
  { id: 'account', label: 'Account', icon: UserRound },
]
export default function App() {
  const [view, setView] = useState('overview')
  const [selected, setSelected] = useState<string>()
  const { data: stats, error } = useApi<Stats>('/api/stats')
  const navigate = (id: string, record?: string) => { setView(id); setSelected(record) }
  return <div className="app-shell"><aside className="sidebar"><div className="brand">Data</div><nav aria-label="Main navigation">{navigation.map(item => <Button key={item.id} variant={view === item.id ? 'secondary' : 'ghost'} className="nav-item" aria-current={view === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><item.icon data-icon="inline-start" />{item.label}</Button>)}</nav><div className="sidebar-footer"><Separator /><div><Database className="size-4" /><span>Local archive</span></div></div></aside><main className="main-content">{error ? <div className="p-6"><Failure message={error} /></div> : view === 'overview' ? <Insights onExplore={(id, kind = 'conversations') => navigate(kind, id)} /> : view === 'privacy' ? <Privacy archiveName={stats?.archive.name} onSource={(id, kind = 'account') => navigate(kind, id)} /> : <Explorer key={view + (selected || '')} kind={view} stats={stats} initialId={selected} />}</main></div>
}
