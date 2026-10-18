import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
export function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent></Select>
}
export function Loading() { return <div role="status" aria-label="Loading" className="flex flex-col gap-4 p-6"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div> }
export function Failure({ message }: { message: string }) { return <Alert variant="destructive"><AlertTitle>Unable to load data</AlertTitle><AlertDescription>{message}</AlertDescription></Alert> }
export function NoResults({ label = 'No results' }: { label?: string }) { return <Empty className="py-20"><EmptyHeader><EmptyTitle>{label}</EmptyTitle></EmptyHeader></Empty> }
