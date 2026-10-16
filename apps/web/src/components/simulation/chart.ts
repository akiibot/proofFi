// Pure geometry for the Time Machine chart, so it can be checked without a browser.
// Paths are the backend's sampled_liquidity_paths_minor: one array of liquidity (USD cents) per sampled future, one value per day.

export type ChartGeometry = {
  width: number; height: number; padding: { top: number; right: number; bottom: number; left: number };
  lines: string[]; // SVG polyline "x,y x,y" strings, one per path
  yTicks: { y: number; value: number }[]; // value in cents
  xTicks: { x: number; day: number }[];
  zeroY: number | null; // where liquidity is $0, when it is inside the plotted range
  min: number; max: number; days: number;
};

function niceStep(range: number, target: number): number {
  const raw = range / Math.max(1, target);
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

export function buildChart(paths: number[][], width = 720, height = 280): ChartGeometry | null {
  const usable = paths.filter((p) => p.length > 0);
  if (!usable.length) return null;
  const padding = { top: 12, right: 12, bottom: 28, left: 72 };
  const values = usable.flat();
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 100; max += 100; } // a flat line still gets a visible band
  const days = Math.max(...usable.map((p) => p.length)) - 1;
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const x = (day: number) => padding.left + (days === 0 ? plotW / 2 : (day / days) * plotW);
  const y = (value: number) => padding.top + (1 - (value - min) / (max - min)) * plotH;
  const round = (n: number) => Math.round(n * 10) / 10;

  const lines = usable.map((path) => path.map((value, day) => `${round(x(day))},${round(y(value))}`).join(' '));
  const step = niceStep(max - min, 4);
  const yTicks: { y: number; value: number }[] = [];
  // Integer steps (no accumulated float error); `+ 0` turns -0 into 0 so the label never reads "-$0".
  for (let i = Math.ceil(min / step); i * step <= max; i++) { const v = i * step + 0; yTicks.push({ y: round(y(v)), value: v }); }
  const dayStep = days <= 0 ? 1 : niceStep(days, 6);
  const xTicks: { x: number; day: number }[] = [];
  for (let d = 0; d <= days; d += dayStep) xTicks.push({ x: round(x(d)), day: d });
  const zeroY = min <= 0 && max >= 0 ? round(y(0)) : null;
  return { width, height, padding, lines, yTicks, xTicks, zeroY, min, max, days };
}
