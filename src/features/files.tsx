import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Failure, Loading } from '@/components/shared'
import { bytes, useApi } from '@/lib/api'
import type { ArchiveFile } from '@/lib/api'
export function FileDetail({ file, onClose }: { file: ArchiveFile; onClose: () => void }) {
  const url = `/api/file?path=${encodeURIComponent(file.path)}`
  const image = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.mime)
  const audio = ['audio/mpeg', 'audio/wav', 'audio/ogg'].includes(file.mime)
  const video = ['video/mp4', 'video/webm'].includes(file.mime)
  const pdf = file.mime === 'application/pdf'
  return <section className="detail-panel" aria-label="File detail"><header className="detail-header"><div className="min-w-0"><h2>{file.name}</h2><p className="text-xs text-muted-foreground mt-1">{bytes(file.size)} · {file.mime}</p></div><div className="flex gap-1"><Button asChild variant="ghost" size="icon"><a href={url} aria-label="Download file"><Download /></a></Button><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close detail"><X /></Button></div></header><div className="detail-scroll"><p className="text-xs text-muted-foreground break-all mb-6">{file.path}</p>{image ? <img src={url + '&preview=1'} alt={file.name} className="w-full rounded-md" /> : audio ? <audio controls src={url + '&preview=1'} className="w-full" /> : video ? <video controls src={url + '&preview=1'} className="w-full" /> : pdf ? <iframe title={file.name} src={url + '&preview=1'} className="h-[70vh] w-full" /> : <TextPreview url={url + '&preview=1'} />}</div></section>
}
function TextPreview({ url }: { url: string }) {
  const { data, error } = useApi<{ text: string; truncated: boolean }>(url)
  if (error) return <Failure message={error} />
  if (!data) return <Loading />
  return <><pre className="file-text">{data.text}</pre>{data.truncated && <p className="text-xs text-muted-foreground mt-4">Preview: first 200 KB. Download for the complete file.</p>}</>
}
