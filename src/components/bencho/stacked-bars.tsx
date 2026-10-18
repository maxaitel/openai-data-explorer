// Adapted from Bencho Stacked bars (MIT): baseline growth, scrub dimming,
// a single travelling ring and spring tooltip. Uses real archive data;
// horizontal and compact variants share the same interaction model.
import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { soundChart } from '@/lib/sounds'
import './stacked-bars.css'

export type ChartDatum = { label: string; value: number }
const SPRING = { type: 'spring' as const, stiffness: 380, damping: 34 }
const fmt = (value: number) => value.toLocaleString('en-NZ')

export function StackedBars({ data, label, unit = 'prompts', horizontal = false, compact = false, selected, onSelect }: {
  data: ChartDatum[]
  label: string
  unit?: string
  horizontal?: boolean
  compact?: boolean
  selected?: string
  onSelect?: (label: string) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const seen = useInView(root, { once: true, amount: .2 })
  const reduced = useReducedMotion()
  const [at, setAt] = useState<number | null>(null)
  const last = useRef<number | null>(null)
  const max = Math.max(1, ...data.map(item => item.value))
  const active = at !== null ? data[at] : undefined
  const transition = reduced ? { duration: 0 } : SPRING
  const height = compact ? 64 : 152
  const tipPosition = at === null ? 0 : Math.max(0, Math.min(100, (at + .5) / data.length * 100))

  function inspect(index: number, unlock = false) {
    setAt(index)
    if (last.current !== index || unlock) soundChart(data[index].value / max, unlock)
    last.current = index
  }
  function clear() { setAt(null); last.current = null }
  function key(event: KeyboardEvent, index: number) {
    let next = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = Math.min(data.length - 1, index + 1)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(0, index - 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = data.length - 1
    else if (event.key === 'Escape') { clear(); return }
    else return
    event.preventDefault()
    buttons.current[next]?.focus()
  }

  if (!data.length) return <p className="metric-note">No data in this selection.</p>
  return <div ref={root} className="stb archive-chart" data-scrub={active ? '' : undefined} data-horizontal={horizontal || undefined} data-compact={compact || undefined} data-chart-sound role="group" aria-label={label} onMouseLeave={() => { if (!root.current?.querySelector(':focus-visible')) clear() }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) clear() }}>
    {!horizontal && !compact && <div className="stb-scale"><span>{fmt(max)}</span><span>{fmt(Math.round(max / 2))}</span><span>0</span></div>}
    <div className="stb-plot" style={horizontal ? undefined : { height }}>
      {!horizontal && <span className="stb-base" />}
      {data.map((item, index) => {
        const ratio = item.value / max
        return <button key={item.label} ref={element => { buttons.current[index] = element }} type="button" className="stb-col" data-on={at === index || undefined} data-selected={selected === item.label || undefined} tabIndex={index === (at ?? 0) ? 0 : -1} aria-label={`${item.label}: ${fmt(item.value)} ${unit}`} aria-expanded={onSelect ? selected === item.label : undefined} onPointerEnter={event => { if (event.pointerType === 'mouse') inspect(index) }} onFocus={() => inspect(index, true)} onClick={() => { inspect(index, true); onSelect?.(item.label) }} onKeyDown={event => key(event, index)} style={{ '--i': Math.min(index, 20), '--c': 'var(--chart-1)' } as CSSProperties}>
          {horizontal && <><span className="stb-rank">{index + 1}</span><span className="stb-label">{item.label}</span></>}
          <span className="stb-track">
            <motion.span className="stb-bar" initial={false} animate={horizontal ? { width: seen ? `${ratio * 100}%` : '0%' } : { height: seen ? `${ratio * 100}%` : '0%' }} transition={reduced ? { duration: 0 } : { duration: .55, delay: Math.min(index, 20) * .012, ease: [.22, 1, .36, 1] }} />
            {at === index && <motion.span className="stb-ring" layoutId={`${label}-ring`} style={horizontal ? undefined : { top: 'auto', bottom: -3, height: `calc(${ratio * 100}% + 6px)` }} transition={transition} />}
          </span>
          {horizontal && <span className="stb-value">{fmt(item.value)}</span>}
        </button>
      })}
      {!horizontal && active && <motion.div className="stb-tip" initial={false} animate={{ left: `${tipPosition}%` }} transition={transition} style={{ transform: `translateX(-${tipPosition}%)` }} aria-hidden="true"><div className="stb-tip-head"><span>{active.label}</span><b>{fmt(active.value)}</b></div><span>{unit}</span></motion.div>}
    </div>
    {!horizontal && <div className="stb-axis"><span>{data[0].label}</span><span>{data[Math.floor((data.length - 1) / 2)].label}</span><span>{data[data.length - 1].label}</span></div>}
    <span className="sr-only" aria-live="polite">{active ? `${active.label}: ${fmt(active.value)} ${unit}` : ''}</span>
  </div>
}
