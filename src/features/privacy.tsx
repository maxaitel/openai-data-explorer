import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Failure, Loading } from '@/components/shared'
import { useApi } from '@/lib/api'

type DeepPrivacy = {
  memory: { messages: number; conversations: number; types: Record<string, number>; examples: { id: string; title: string; snippet: string; reason?: string }[] };
  files: { total: number; linkedToMessages: number; fingerprints: number; renamed: number; deleted: number; trashed: number };
  shares: { total: number; anonymous: number };
  suggestions: { messages: number; conversations: number; examples: { id: string; title: string; scope: string; label?: string }[] };
}
type Ads = { ads_profile?: { inferred_profile?: { user_interests?: { interest: string }[] } }[]; ad_history?: unknown[]; ad_hides?: unknown[]; reported_ads?: unknown[] }
type Settings = {
  training_allowed?: boolean; codex_training_allowed_v2?: boolean; voice_training_allowed?: boolean; video_training_allowed?: boolean;
  precise_location_device_settings?: { devices?: Record<string, { status?: string; last_updated?: string }> };
  atlas_engagement_settings?: Record<string, unknown>;
  last_used_model_config?: { slugs?: Record<string, string> };
}
type AccountSettings = { settings?: Settings; announcements?: Record<string, unknown> }
const flags = [
  ['ChatGPT', 'training_allowed'], ['Codex', 'codex_training_allowed_v2'],
  ['Voice', 'voice_training_allowed'], ['Video', 'video_training_allowed'],
] as const

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="privacy-row"><dt>{label}</dt><dd>{children}</dd></div>
}
function recorded(value: unknown): string {
  if (value === undefined || value === null) return 'Not recorded'
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  return String(value)
}
function recordedDate(value: unknown) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return 'Not recorded'
  return new Date(value).toLocaleString('en-NZ', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Pacific/Auckland' })
}

export function Privacy({ onSource, archiveName }: { onSource: (id: string, kind?: string) => void; archiveName?: string }) {
  const deeper = useApi<DeepPrivacy>('/api/privacy')
  const ads = useApi<{ raw: Ads }>('/api/record?id=ads.json')
  const settings = useApi<{ raw: AccountSettings[] }>('/api/record?id=user_settings.json')
  const feedback = useApi<{ raw: unknown[] }>('/api/record?id=message_feedback.json')
  const error = deeper.error || ads.error || settings.error || feedback.error
  if (error) return <div className="overview"><Failure message={error} /></div>
  if (!deeper.data || !ads.data || !settings.data || !feedback.data) return <div className="overview"><Loading /></div>
  const deep = deeper.data
  const a = ads.data.raw
  const account = settings.data.raw[0] || {}
  const s = account.settings || {}
  const announcements = account.announcements || {}
  const interests = [...new Set((a.ads_profile || []).flatMap(p => p.inferred_profile?.user_interests?.map(i => i.interest) || []))]
  const devices = Object.values(s.precise_location_device_settings?.devices || {})
  const atlas = s.atlas_engagement_settings || {}
  const snapshot = archiveName?.match(/\d{4}-\d{2}-\d{2}/)?.[0]
  const source = (file: string) => <Button variant="outline" size="sm" onClick={() => onSource(file)}>View {file}</Button>
  return <div className="overview privacy-page">
    <header><h1>Privacy</h1><p className="mt-2 text-sm text-muted-foreground">Export snapshot{snapshot ? ` · ${snapshot}` : ''} · Saved values, not live settings</p></header>
    <div className="privacy-grid">
      <section className="insight-section" aria-labelledby="ad-profile-title">
        <h2 id="ad-profile-title">Inferred ad profile</h2>
        <p className="metric-note">Interests assigned to your account</p>
        <div className="flex flex-wrap gap-2 my-5">{interests.length ? interests.map(i => <Badge variant="secondary" key={i}>{i}</Badge>) : <p>No inferred interests recorded.</p>}</div>
        <dl><Row label="Ad history">{recorded(a.ad_history?.length)} entries</Row><Row label="Hidden / reported ads">{recorded(a.ad_hides?.length)} / {recorded(a.reported_ads?.length)}</Row></dl>
        <p className="privacy-note">This file does not establish that ads were shown or the profile was shared with advertisers.</p>
        {source('ads.json')}
      </section>
      <section className="insight-section" aria-labelledby="training-title">
        <h2 id="training-title">Training settings</h2><p className="metric-note">Raw flags saved in the export</p>
        <dl className="mt-3">{flags.map(([label, key]) => <div className="privacy-row" key={key}><dt>{label}<code>{key}</code></dt><dd><Badge variant="outline">{recorded(s[key])}</Badge></dd></div>)}</dl>
        <p className="privacy-note">These flags alone do not establish effective permissions or whether content was used for training. The main opt-out covers ChatGPT and Codex tasks; Codex environment sharing is a separate control.</p>
        <div className="flex flex-wrap items-center gap-3">{source('user_settings.json')}<a className="privacy-link" href="https://help.openai.com/en/articles/7730893-data-controls-in-chatgpt" target="_blank" rel="noreferrer">Data controls ↗</a></div>
      </section>
      <section className="insight-section" aria-labelledby="tracking-title">
        <h2 id="tracking-title">Tracking & engagement</h2>
        <dl className="mt-3">
          <Row label="Onboarding & announcement records">{Object.keys(announcements).length}</Row>
          <Row label="Homepage promotion impressions">{recorded(announcements['paid-sticker-homepage-promotion-impressions'])}</Row>
          <Row label="Joined Atlas">{recordedDate(atlas.date_joined_atlas)}</Row>
          <Row label="Last opened Atlas sidechat">{recordedDate(atlas.last_opened_sidechat)}</Row>
          <Row label="Last Atlas new-tab submission">{recordedDate(atlas.last_submitted_via_ntp)}</Row>
        </dl>
        <details className="privacy-details"><summary>Saved models by platform</summary><dl>{Object.entries(s.last_used_model_config?.slugs || {}).map(([platform, model]) => <Row key={platform} label={platform.replaceAll('_', ' ')}>{model}</Row>)}</dl></details>
        <p className="privacy-note">Records include feature views, dismissals, and impression counts. Atlas entries show engagement timestamps, not browsing history. Times are Pacific/Auckland.</p>
        {source('user_settings.json')}
      </section>
      <section className="insight-section" aria-labelledby="location-title">
        <h2 id="location-title">Precise location</h2>
        <dl className="mt-3"><Row label="Devices with a saved setting">{devices.length}</Row>{devices.map((device, i) => <Row key={i} label={`Device ${i + 1}`}><span>{device.status || 'Not recorded'}</span><span className="block text-xs text-muted-foreground mt-1">{recordedDate(device.last_updated)}</span></Row>)}</dl>
        <p className="privacy-note">This object records location permission. It contains no coordinates and does not establish continuous tracking.</p>
        {source('user_settings.json')}
      </section>
    </div>
    <div className="privacy-grid">
      <section className="insight-section" aria-labelledby="memory-title">
        <h2 id="memory-title">Memory carried between chats</h2>
        <dl className="mt-3"><Row label="Messages with context citations">{deep.memory.messages}</Row><Row label="Conversations containing them">{deep.memory.conversations}</Row><Row label="General-memory references">{deep.memory.types.general_memory || 0}</Row><Row label="Past-chat references">{deep.memory.types.past_conversation || 0}</Row><Row label="Custom-instruction references">{deep.memory.types.user_instructions || 0}</Row></dl>
        <p className="privacy-note">Some messages store personal memory snippets, source-chat references, and reasons the context was relevant. Counts include alternate branches and repeated references; this is not a list of unique or currently saved memories.</p>
        <details className="privacy-details"><summary>See stored memory examples</summary><div className="flex flex-col gap-4 mt-3">{deep.memory.examples.map(e => <article key={e.id + e.snippet} className="privacy-example"><p className="whitespace-pre-wrap">{e.snippet}</p>{e.reason && <p className="privacy-note">Stored reason: {e.reason}</p>}<Button variant="outline" size="sm" onClick={() => onSource(e.id, 'conversations')}>Open source chat</Button><p className="metric-note">{e.title} · citation metadata in JSON</p></article>)}</div></details>
      </section>
      <section className="insight-section" aria-labelledby="file-trail-title">
        <h2 id="file-trail-title">File history & fingerprints</h2>
        <dl className="mt-3"><Row label="Library file records">{deep.files.total}</Row><Row label="Linked to a source chat and message">{deep.files.linkedToMessages}</Row><Row label="With SHA-256 content fingerprints">{deep.files.fingerprints}</Row><Row label="With a user-renamed timestamp">{deep.files.renamed}</Row></dl>
        <p className="privacy-note">File records preserve upload and processing times, ownership IDs, and links to where files came from. A content fingerprint can identify identical bytes; it is not the file itself.</p>
        <p className="privacy-note">{deep.files.deleted} records have deletion timestamps; {deep.files.trashed} have trash timestamps. This export does not establish what happens to files deleted elsewhere.</p>
        {source('library_files.json')}
      </section>
      <section className="insight-section" aria-labelledby="shares-title">
        <h2 id="shares-title">Anonymous shares still linked internally</h2>
        <dl className="mt-3"><Row label="Shared-conversation records">{deep.shares.total}</Row><Row label="Marked anonymous">{deep.shares.anonymous}</Row></dl>
        <p className="privacy-note">These records retain conversation IDs and titles alongside the anonymous flag. Anonymous sharing does not remove the link in your account export. This file does not show whether the links are still live.</p>
        {source('shared_conversations.json')}
      </section>
      <section className="insight-section" aria-labelledby="routing-title">
        <h2 id="routing-title">Context suggestions</h2>
        <dl className="mt-3"><Row label="Messages with a suggested context">{deep.suggestions.messages}</Row><Row label="Conversations">{deep.suggestions.conversations}</Row></dl>
        <div className="flex flex-col gap-3 mt-3">{deep.suggestions.examples.map(e => <div key={e.id + e.scope}><p className="text-sm">{e.label || e.scope} <Badge variant="outline">{e.scope}</Badge></p><button className="privacy-link mt-1 text-left" onClick={() => onSource(e.id, 'conversations')}>{e.title}</button></div>)}</div>
        <p className="privacy-note">These message fields record a suggested destination in the product. They are not evidence of a diagnosis or a separate medical profile. See the source chat’s JSON metadata.</p>
      </section>
    </div>
    <section className="insight-section" aria-labelledby="feedback-title">
      <h2 id="feedback-title">Feedback & training</h2>
      <p className="mt-3">{feedback.data.raw.length} saved feedback records</p>
      <p className="privacy-note">OpenAI says conversations submitted with thumbs-up/down feedback may be used for model improvement even after opting out. These records do not show whether that happened.</p>
      <div className="flex flex-wrap items-center gap-3">{source('message_feedback.json')}<a className="privacy-link" href="https://help.openai.com/en/articles/5722486-how-your-data-is-used-to-improve-model-performance" target="_blank" rel="noreferrer">Feedback policy ↗</a></div>
    </section>
  </div>
}
