// Adapted from Bencho Tab bar (Pro licence) for controlled archive filters.
import { type CSSProperties, type KeyboardEvent, useEffect, useLayoutEffect, useRef } from "react";
import { type LucideIcon } from "lucide-react";

const PAD = 5;

export function TabBar({ options: TABS, value, onChange, label = 'Sections', corner = 12, bounce = 30 }: { options: { value: string; label: string; Icon: LucideIcon }[]; value: string; onChange: (value: string) => void; label?: string; corner?: number; bounce?: number }) {
  const on = Math.max(0, TABS.findIndex(tab => tab.value === value));
  const initial = useRef(on);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const tile = useRef<HTMLSpanElement | null>(null);
  const pos = useRef({ x: 0, w: 0, vx: 0, vw: 0 });
  const zeta = 1 - Math.max(0, Math.min(100, bounce)) * 0.0055; 

  useLayoutEffect(() => {
    const t = tabs.current[initial.current];
    if (!t || !tile.current) return;
    pos.current = { x: t.offsetLeft, w: t.offsetWidth, vx: 0, vw: 0 };
    tile.current.style.transform = `translateX(${t.offsetLeft}px)`;
    tile.current.style.width = `${t.offsetWidth}px`;

  }, []);

  useEffect(() => {
    const el = tile.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      const t = tabs.current[on];
      if (t) { el.style.transform = `translateX(${t.offsetLeft}px)`; el.style.width = `${t.offsetWidth}px`; }
      return;
    }
    const k = 260;
    const c = 2 * Math.sqrt(k) * zeta;
    let raf = 0;
    let last = 0;
    let quiet = 0;
    const step = (now: number) => {
      const t = tabs.current[on];
      if (!t) return;
      const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
      last = now;
      const p = pos.current;
      const tx = t.offsetLeft, tw = t.offsetWidth;
      p.vx += (k * (tx - p.x) - c * p.vx) * dt;
      p.vw += (k * (tw - p.w) - c * p.vw) * dt;
      p.x += p.vx * dt;
      p.w += p.vw * dt;
      el.style.transform = `translateX(${p.x.toFixed(2)}px)`;
      el.style.width = `${p.w.toFixed(2)}px`;
      const still = Math.abs(tx - p.x) < 0.2 && Math.abs(tw - p.w) < 0.2 && Math.abs(p.vx) < 2 && Math.abs(p.vw) < 2;
      quiet = still ? quiet + 1 : 0;
      if (quiet < 6) raf = requestAnimationFrame(step);
      else { el.style.transform = `translateX(${tx}px)`; el.style.width = `${tw}px`; p.x = tx; p.w = tw; p.vx = p.vw = 0; }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [on, zeta]);

  useEffect(() => {
    const sync = () => {
      const target = tabs.current[on];
      if (!target || !tile.current) return;
      pos.current = { x: target.offsetLeft, w: target.offsetWidth, vx: 0, vw: 0 };
      tile.current.style.transform = `translateX(${target.offsetLeft}px)`;
      tile.current.style.width = `${target.offsetWidth}px`;
    };
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [on]);

  const pick = (i: number) => {
    if (i === on) return;
    onChange(TABS[i].value);
  };

  const key = (e: KeyboardEvent) => {
    const by = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!by) return;
    e.preventDefault();
    const next = (on + by + TABS.length) % TABS.length;
    pick(next);
    tabs.current[next]?.focus();
  };

  return (
    <div
      className="tbb"
      role="group"
      aria-label={label}
      style={{ ["--tbb-r" as string]: `${corner}px`, ["--tbb-pad" as string]: `${PAD}px` } as CSSProperties}
    >
      <span ref={tile} className="tbb-tile" aria-hidden="true" />
      {TABS.map(({ label, Icon }, i) => (
        <button
          key={label}
          ref={(el) => { tabs.current[i] = el; }}
          type="button"

          className="tbb-tab"
          aria-pressed={i === on}
          aria-label={label}
          tabIndex={0}
          data-on={i === on || undefined}
          onClick={() => pick(i)}
          onKeyDown={key}
        >
          <Icon className="tbb-icon" size={16} strokeWidth={2} aria-hidden="true" />
          <span className="tbb-name">
            <span>{label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

