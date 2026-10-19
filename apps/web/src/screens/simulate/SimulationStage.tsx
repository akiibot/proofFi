'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import type { SimulationRun } from '@/screens/ask/explain';
import styles from './simulate.module.css';

export type StageMode = 'idle' | 'running' | 'result';

type Props = {
  mode: StageMode;
  run: SimulationRun | null;
  floorMinor: number | null;
  dueDay: number | null;
  dueLabel: string | null;
  /** Read by screen readers instead of the drawing. */
  label: string;
  children?: ReactNode;
};

/*
 * The futures lattice: columns are points in time, nodes are possible cash levels, edges are the ways one day can lead
 * to the next. While idle a few pulses wander through it; while the server simulates, many do. When the result arrives
 * the lattice dims and the real sampled paths from the simulation are drawn on top, against the emergency floor.
 * The lattice is decoration that explains the idea; every line drawn in the result comes from the API response.
 */
const COLS = 13;
const ROWS = 7;

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

type Pulse = { rows: number[]; t: number; speed: number };

function compactUsd(minor: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(minor / 100);
}

export function SimulationStage({ mode, run, floorMinor, dueDay, dueLabel, label, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ mode, run, floorMinor, dueDay, dueLabel, resultAt: 0, hoverX: null as number | null });

  useEffect(() => {
    const prev = live.current;
    const fresh = run !== prev.run || (mode === 'result' && prev.mode !== 'result');
    live.current = { ...prev, mode, run, floorMinor, dueDay, dueLabel, resultAt: fresh ? performance.now() : prev.resultAt };
  }, [mode, run, floorMinor, dueDay, dueLabel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const css = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const PRIMARY = token('--pf-surface-primary', '#ffee6c');
    const DANGER = token('--pf-surface-danger', '#ff6b5d');
    const LOW = token('--pf-text-low', '#ffffff7a');
    const MED = token('--pf-text-med', '#ffffffa3');
    const FONT = getComputedStyle(document.body).fontFamily || 'Inter, system-ui, sans-serif';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const rand = seeded(7);
    const lattice = Array.from({ length: COLS }, (_, c) => Array.from({ length: ROWS }, (_, k) => ({ x: c / (COLS - 1), y: (k + 0.5) / ROWS + (rand() - 0.5) * 0.09 })));
    const lit = lattice.map((col) => col.map(() => 0));
    let pulses: Pulse[] = [];
    let lastSpawn = 0;
    let latticeAlpha = 1;
    let w = 0, h = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const pointer = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); live.current.hoverX = e.clientX - r.left; };
    const leave = () => { live.current.hoverX = null; };
    canvas.addEventListener('pointermove', pointer);
    canvas.addEventListener('pointerleave', leave);

    const spawn = (fast: boolean) => {
      const rows: number[] = [];
      let k = Math.floor(rand() * ROWS);
      for (let c = 0; c < COLS; c++) { rows.push(k); k = Math.min(ROWS - 1, Math.max(0, k + Math.floor(rand() * 3) - 1)); }
      pulses.push({ rows, t: 0, speed: fast ? 5 + rand() * 4 : 1.8 + rand() * 0.8 });
    };

    let frame = 0;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const { mode, run, floorMinor, dueDay, dueLabel, resultAt, hoverX } = live.current;
      const narrow = w < 560;
      const L = narrow ? 44 : 64, R = narrow ? 16 : 28, T = narrow ? 92 : 84, B = narrow ? 36 : 44;
      const pw = Math.max(1, w - L - R), ph = Math.max(1, h - T - B);
      const X = (x: number) => L + x * pw, Y = (y: number) => T + y * ph;
      ctx.clearRect(0, 0, w, h);

      // Lattice
      const INTRO = reduce ? 0 : 700;
      const converging = mode === 'result' && now - resultAt < INTRO;
      latticeAlpha += ((mode === 'result' && !converging ? 0.22 : 1) - latticeAlpha) * Math.min(1, dt * 4);
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.055 * latticeAlpha})`;
      ctx.beginPath();
      for (let c = 0; c < COLS - 1; c++) for (let k = 0; k < ROWS; k++) for (let d = -1; d <= 1; d++) {
        const n = k + d; if (n < 0 || n >= ROWS) continue;
        ctx.moveTo(X(lattice[c][k].x), Y(lattice[c][k].y)); ctx.lineTo(X(lattice[c + 1][n].x), Y(lattice[c + 1][n].y));
      }
      ctx.stroke();
      for (let c = 0; c < COLS; c++) for (let k = 0; k < ROWS; k++) {
        const p = lattice[c][k]; const glow = lit[c][k]; lit[c][k] *= reduce ? 0 : 0.94;
        ctx.fillStyle = `rgba(255,255,255,${(0.18 + glow * 0.2) * latticeAlpha})`;
        ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 1.6 + glow * 1.4, 0, Math.PI * 2); ctx.fill();
        if (glow > 0.06) { ctx.save(); ctx.globalAlpha = glow * latticeAlpha; ctx.fillStyle = PRIMARY; ctx.shadowColor = PRIMARY; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 2.4, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      }

      // Pulses: sampled futures travelling through time
      if (!reduce) {
        const fast = mode === 'running' || converging;
        const every = fast ? 45 : 1300, cap = fast ? 70 : 3;
        if ((mode !== 'result' || converging) && now - lastSpawn > every && pulses.length < cap) { spawn(fast); lastSpawn = now; }
        pulses = pulses.filter((p) => p.t < COLS - 1);
        for (const p of pulses) {
          const before = Math.floor(p.t);
          p.t = Math.min(COLS - 1, p.t + p.speed * dt);
          for (let c = before + 1; c <= Math.floor(p.t); c++) lit[c][p.rows[c]] = 1;
          const at = (t: number) => {
            const c = Math.min(COLS - 2, Math.floor(t)); const f = t - c; const s = f * f * (3 - 2 * f);
            const a = lattice[c][p.rows[c]], b = lattice[c + 1][p.rows[c + 1]];
            return { x: X(a.x + (b.x - a.x) * f), y: Y(a.y + (b.y - a.y) * s) };
          };
          const head = at(p.t);
          const tail = Math.max(0, p.t - (fast ? 1.4 : 2.2));
          const steps = 14;
          for (let i = 0; i < steps; i++) {
            const t0 = tail + ((p.t - tail) * i) / steps, t1 = tail + ((p.t - tail) * (i + 1)) / steps;
            const a = at(t0), b = at(t1);
            ctx.strokeStyle = PRIMARY; ctx.globalAlpha = ((i + 1) / steps) * 0.55 * latticeAlpha; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
          ctx.globalAlpha = latticeAlpha; ctx.fillStyle = PRIMARY; ctx.shadowColor = PRIMARY; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(head.x, head.y, 2.4, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        }
        if (fast) { // a slow scan line while the server is working
          const sx = L + (((now / 2600) % 1) * pw);
          const g = ctx.createLinearGradient(sx - 80, 0, sx, 0); g.addColorStop(0, 'rgba(255,238,108,0)'); g.addColorStop(1, 'rgba(255,238,108,0.10)');
          ctx.fillStyle = g; ctx.fillRect(sx - 80, T, 80, ph);
        }
      }

      // Result: the real sampled paths from the simulation
      if (mode === 'result' && run) {
        const paths = run.sampled_liquidity_paths_minor.filter((p) => p.length > 1);
        if (paths.length) {
          const days = Math.max(...paths.map((p) => p.length)) - 1;
          const values = paths.flat().concat(floorMinor ?? []);
          let min = Math.min(...values), max = Math.max(...values);
          const pad = (max - min || 100) * 0.12; min -= pad; max += pad;
          const xd = (d: number) => X(d / days), yv = (v: number) => Y(1 - (v - min) / (max - min));
          const since = reduce ? 1e9 : now - resultAt - INTRO;
          if (since < 0) { frame = requestAnimationFrame(draw); return; }
          const reveal = (i: number) => Math.min(1, Math.max(0, (since - i * 55) / 1300));
          const ease = (t: number) => 1 - Math.pow(1 - t, 3);

          // grid + y labels
          ctx.font = `500 11px ${FONT}`; ctx.textBaseline = 'middle';
          for (let i = 0; i <= 3; i++) {
            const v = min + ((max - min) * i) / 3, y = yv(v);
            ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + pw, y); ctx.stroke();
            ctx.fillStyle = LOW; ctx.textAlign = 'right'; ctx.fillText(compactUsd(v), L - 10, y);
          }
          // x labels
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          const stepDays = days > 90 ? 30 : days > 30 ? 15 : 5;
          for (let d = 0; d <= days; d += stepDays) { ctx.fillStyle = LOW; ctx.fillText(d === 0 ? 'Today' : `Day ${d}`, xd(d), T + ph + 14); }

          // range band
          const lo: number[] = [], hi: number[] = [];
          for (let d = 0; d <= days; d++) { const at = paths.map((p) => p[Math.min(d, p.length - 1)]); lo.push(Math.min(...at)); hi.push(Math.max(...at)); }
          const bandAlpha = ease(Math.min(1, since / 1600));
          ctx.fillStyle = `rgba(255,238,108,${0.07 * bandAlpha})`;
          ctx.beginPath(); hi.forEach((v, d) => (d ? ctx.lineTo(xd(d), yv(v)) : ctx.moveTo(xd(d), yv(v)))); for (let d = days; d >= 0; d--) ctx.lineTo(xd(d), yv(lo[d])); ctx.closePath(); ctx.fill();

          // emergency floor
          if (floorMinor !== null) {
            const y = yv(floorMinor);
            ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + pw, y); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = MED; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(`Emergency floor ${compactUsd(floorMinor)}`, L + 8, y - 6);
          }
          // obligation due
          if (dueDay !== null && dueDay <= days && dueDay > 0) {
            const x = xd(dueDay);
            ctx.setLineDash([2, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + ph); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = LOW; ctx.textAlign = x > L + pw - 120 ? 'right' : 'left'; ctx.textBaseline = 'top'; ctx.fillText(dueLabel ?? 'Due', x + (ctx.textAlign === 'right' ? -6 : 6), T + 4);
          }
          // paths
          const unique = new Map<string, { p: number[]; n: number }>();
          for (const p of paths) { const k = p.join(','); const u = unique.get(k); if (u) u.n++; else unique.set(k, { p, n: 1 }); }
          [...unique.values()].forEach(({ p, n: count }, i) => {
            const r = ease(reveal(i)); if (r <= 0) return;
            const n = Math.max(2, Math.ceil(r * p.length));
            const broke = floorMinor !== null && Math.min(...p) < floorMinor;
            ctx.strokeStyle = broke ? DANGER : PRIMARY; ctx.globalAlpha = Math.min(0.9, (broke ? 0.6 : 0.42) + count * 0.03); ctx.lineWidth = Math.min(3, 1.2 + (count - 1) * 0.12);
            ctx.shadowColor = broke ? DANGER : PRIMARY; ctx.shadowBlur = reduce ? 0 : 6;
            ctx.beginPath(); ctx.moveTo(xd(0), yv(p[0])); for (let d = 1; d < n; d++) ctx.lineTo(xd(d), yv(p[d])); ctx.stroke();
            if (r < 1) { ctx.globalAlpha = 1; ctx.fillStyle = PRIMARY; ctx.beginPath(); ctx.arc(xd(n - 1), yv(p[n - 1]), 2, 0, Math.PI * 2); ctx.fill(); }
            ctx.shadowBlur = 0; ctx.globalAlpha = 1;
          });
          // hover read-out
          if (hoverX !== null && hoverX >= L && hoverX <= L + pw && since > 1500) {
            const d = Math.round(((hoverX - L) / pw) * days), x = xd(d);
            ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + ph); ctx.stroke();
            for (const v of [lo[d], hi[d]]) { ctx.fillStyle = PRIMARY; ctx.beginPath(); ctx.arc(x, yv(v), 3, 0, Math.PI * 2); ctx.fill(); }
            const line1 = d === 0 ? 'Today' : `Day ${d}`, line2 = `${compactUsd(lo[d])} to ${compactUsd(hi[d])}`;
            ctx.font = `600 12px ${FONT}`; const bw = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 20, bh = 44;
            const bx = Math.min(Math.max(x + 10, L), L + pw - bw), by = Math.max(T, yv(hi[d]) - bh - 10);
            ctx.fillStyle = 'rgba(29,29,29,0.94)'; ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill(); ctx.stroke();
            ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = MED; ctx.fillText(line1, bx + 10, by + 7);
            ctx.font = `500 12px ${FONT}`; ctx.fillStyle = '#ffffffeb'; ctx.fillText(line2, bx + 10, by + 24);
          }
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); canvas.removeEventListener('pointermove', pointer); canvas.removeEventListener('pointerleave', leave); };
  }, []);

  return <figure className={styles.stage} role="img" aria-label={label} data-mode={mode} data-testid="sim-stage">
    <canvas ref={canvasRef} className={styles.canvas} aria-hidden />
    {children}
  </figure>;
}
