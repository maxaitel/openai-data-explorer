import { useState } from 'react'
import { BarChart3, MessageCircle, Code2, FileText, Globe, Files, UserRound, Database, History, ShieldCheck, ChevronRight, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Insights } from '@/features/insights'
import { Privacy } from '@/features/privacy'
import { Explorer } from '@/features/explorer'
import { Failure } from '@/components/shared'
import { number, useApi } from '@/lib/api'
import { useInteractionSounds } from '@/lib/sounds'
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
  const sounds = useInteractionSounds()
  const [view, setView] = useState('overview')
  const [selected, setSelected] = useState<string>()
  const { data: stats, error } = useApi<Stats>('/api/stats')
  const navigate = (id: string, record?: string) => { setView(id); setSelected(record) }
  return <div className="app-shell"><aside className="sidebar"><nav aria-label="Main navigation">{navigation.map(item => <Button key={item.id} variant={view === item.id ? 'secondary' : 'ghost'} className="nav-item" title={item.label} aria-label={item.label} aria-current={view === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><item.icon data-icon="inline-start" /><span>{item.label}</span>{stats?.counts[item.id] !== undefined && <span className="nav-count">{number(stats.counts[item.id])}</span>}</Button>)}</nav><div className="sidebar-footer"><Separator /><div><Database className="size-4" /><span>Local archive<small>Stored on this device</small></span></div></div></aside><main className="main-content"><header className="workspace-bar"><span>Workspace <ChevronRight size={13} /><strong>{navigation.find(item => item.id === view)?.label}</strong></span><div className="workspace-actions"><span className="local-indicator"><i />Stored on this device</span><Button data-sound-toggle variant="ghost" size="icon-sm" aria-label={sounds.enabled ? 'Mute sound effects' : 'Enable sound effects'} aria-pressed={sounds.enabled} title={sounds.enabled ? 'Mute sound effects' : 'Enable sound effects'} onClick={sounds.toggle}>{sounds.enabled ? <Volume2 /> : <VolumeX />}</Button></div></header>{error ? <div className="p-6"><Failure message={error} /></div> : view === 'overview' ? <Insights onExplore={(id, kind = 'conversations') => navigate(kind, id)} /> : view === 'privacy' ? <Privacy archiveName={stats?.archive.name} onSource={(id, kind = 'account') => navigate(kind, id)} /> : <Explorer key={view + (selected || '')} kind={view} stats={stats} initialId={selected} />}</main></div>
}
