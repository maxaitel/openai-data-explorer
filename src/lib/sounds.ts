import { useEffect, useState } from 'react'

type Cue = 'hover' | 'press' | 'select' | 'type' | 'close' | 'scroll'
const tones: Record<Cue, [number, number, number, number]> = {
  hover: [720, 860, .025, .015],
  press: [480, 680, .07, .045],
  select: [650, 980, .09, .04],
  type: [1100, 800, .018, .012],
  close: [580, 340, .075, .035],
  scroll: [260, 230, .025, .008],
}
let context: AudioContext | undefined
let lastPlayed = 0
const preferenceKey = 'archive-sounds'

function play(cue: Cue, unlock = false) {
  try {
    if (!context && unlock) context = new AudioContext()
    const audio = context
    if (!audio) return
    if (audio.state === 'suspended') {
      if (unlock) void audio.resume().then(() => play(cue)).catch(() => {})
      return
    }
    if (audio.state !== 'running') return
    const now = audio.currentTime
    if (now - lastPlayed < .025) return
    lastPlayed = now
    const [start, end, duration, volume] = tones[cue]
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(start, now)
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(volume, now + .004)
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration)
    oscillator.connect(gain)
    gain.connect(audio.destination)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    oscillator.start(now)
    oscillator.stop(now + duration + .01)
  } catch { /* Audio is optional: unsupported/blocked playback must never interrupt the UI. */ }
}

const interactive = 'button, a[href], summary, input, select, textarea, [role="button"], [role="tab"], [role="option"], [role="combobox"], [role="menuitem"]'
function control(target: EventTarget | null) {
  const element = target instanceof Element ? target.closest(interactive) : null
  return element && !element.matches(':disabled, [aria-disabled="true"]') && !element.closest('[data-sound-toggle]') ? element : null
}

export function useInteractionSounds() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(preferenceKey) !== 'off' } catch { return true }
  })

  useEffect(() => {
    if (!enabled) return
    let lastHover = 0
    let lastScroll = 0
    const click = (event: MouseEvent) => {
      const element = control(event.target)
      if (!element) return
      const label = element.getAttribute('aria-label') || element.textContent || ''
      const cue = /close|previous|cancel/i.test(label) ? 'close' : element.matches('[role="option"], [role="tab"], [aria-pressed], [role="menuitem"]') ? 'select' : 'press'
      play(cue, true)
    }
    const hover = (event: PointerEvent) => {
      const element = control(event.target)
      if (!element || event.pointerType !== 'mouse' || (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))) return
      if (performance.now() - lastHover < 100) return
      lastHover = performance.now()
      play('hover')
    }
    const input = (event: Event) => { if (control(event.target)) play('type', true) }
    const key = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.key === 'Escape') play('close', true)
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && control(event.target)) play('select', true)
      else if (event.key === 'Tab') play('hover', true)
    }
    const scroll = () => {
      if (performance.now() - lastScroll < 180) return
      lastScroll = performance.now()
      play('scroll')
    }
    document.addEventListener('click', click, true)
    document.addEventListener('pointerover', hover, true)
    document.addEventListener('input', input, true)
    document.addEventListener('keydown', key, true)
    document.addEventListener('scroll', scroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener('click', click, true)
      document.removeEventListener('pointerover', hover, true)
      document.removeEventListener('input', input, true)
      document.removeEventListener('keydown', key, true)
      document.removeEventListener('scroll', scroll, true)
    }
  }, [enabled])

  function toggle() {
    const next = !enabled
    setEnabled(next)
    try { localStorage.setItem(preferenceKey, next ? 'on' : 'off') } catch { /* Storage may be unavailable. */ }
    if (next) play('select', true)
    else if (context?.state === 'running') void context.suspend().catch(() => {})
  }
  return { enabled, toggle }
}
