import { useEffect, useState } from 'react'
import { archiveQuery } from './archive/client'
export function useApi<T>(url: string) {
  const [state, setState] = useState<{ url: string; data?: T; error?: string }>({ url: '' })
  useEffect(() => {
    let active = true
    archiveQuery<T>(url).then(data => { if (active) setState({ url, data }) }).catch(error => { if (active) setState({ url, error: error.message }) })
    return () => { active = false }
  }, [url])
  return state.url === url ? state : { url }
}
export const number = (n: number) => n.toLocaleString('en-NZ')
export const date = (n: number) => n ? new Date(n * 1000).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland' }) : '—'
export const bytes = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`
export type RecordItem = { id: string; title: string; kind: string; model: string; updated: number; count: number; source: string }
export type ArchiveFile = { path: string; name: string; size: number; mime: string }
export type Detail = RecordItem & { raw: unknown; text: string; messages: { id: string; role: string; text: string; alternate: boolean; time: number }[] }
export type Stats = { counts: Record<string, number>; archive: { name: string; files: number; bytes: number }; models: string[] }
