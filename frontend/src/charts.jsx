// Dependency-free SVG charts for attendance
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const mlabel = m => MON[+m.slice(5, 7) - 1] + " '" + m.slice(2, 4);
const colour = (p, min) => p == null ? '#c5cae9' : p < min ? '#e5484d' : p < min + 10 ? '#f3b73a' : '#3f4be0';
const Grid = ({ W, pad, y, min }) => <>
  {[0, 25, 50, 75, 100].map(v => <g key={v}><line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="currentColor" opacity=".12" /><text x={pad.l - 6} y={y(v) + 4} fontSize="10" textAnchor="end" fill="currentColor" opacity=".6">{v}</text></g>)}
  <line x1={pad.l} x2={W - pad.r} y1={y(min)} y2={y(min)} stroke="#e5484d" strokeDasharray="5 4" />
  <text x={W - pad.r} y={y(min) - 4} fontSize="10" textAnchor="end" fill="#e5484d">min {min}%</text></>;

export function AttBars({ rows, min = 75 }) {
  if (!rows.length) return <p className="empty">No attendance data yet.</p>;
  const pad = { l: 30, r: 8, t: 14, b: 40 }, W = Math.max(340, rows.length * 62 + pad.l + pad.r), H = 230, ih = H - pad.t - pad.b, step = (W - pad.l - pad.r) / rows.length, bw = Math.min(34, step - 14), y = v => pad.t + ih * (1 - v / 100);
  return <div className="tw"><svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: Math.min(W, 560), height: 'auto' }} role="img" aria-label="Subject-wise attendance percentage">
    <Grid W={W} pad={pad} y={y} min={min} />
    {rows.map((r, i) => { const x = pad.l + (i + .5) * step, v = r.pct ?? 0;
      return <g key={i}><rect x={x - bw / 2} y={y(v)} width={bw} height={Math.max(0, ih * v / 100)} rx="9" fill={colour(r.pct, min)} />
        <text x={x} y={y(v) - 4} fontSize="10" textAnchor="middle" fontWeight="700" fill="currentColor">{r.pct ?? '–'}</text>
        <text x={x} y={H - pad.b + 15} fontSize="10" textAnchor="middle" fill="currentColor" opacity=".75">{String(r.label).slice(0, 9)}</text></g>; })}
  </svg></div>;
}

export function AttLine({ monthly, min = 75 }) {
  if (!monthly.length) return <p className="empty">No attendance data yet.</p>;
  const pad = { l: 30, r: 14, t: 14, b: 30 }, W = Math.max(340, monthly.length * 70 + pad.l + pad.r), H = 210, ih = H - pad.t - pad.b, y = v => pad.t + ih * (1 - v / 100);
  const x = i => monthly.length === 1 ? (W + pad.l - pad.r) / 2 : pad.l + 14 + i * ((W - pad.l - pad.r - 28) / (monthly.length - 1));
  const pts = monthly.map((m, i) => [x(i), y(m.pct ?? 0), m]);
  return <div className="tw"><svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: Math.min(W, 560), height: 'auto' }} role="img" aria-label="Monthly attendance trend">
    <Grid W={W} pad={pad} y={y} min={min} />
    {pts.length > 1 && <polyline points={pts.map(p => p[0] + ',' + p[1]).join(' ')} fill="none" stroke="#3f4be0" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
    {pts.map(([px, py, m], i) => <g key={i}><circle cx={px} cy={py} r="6" fill={colour(m.pct, min)} stroke="#fff" strokeWidth="2" />
      <text x={px} y={py - 11} fontSize="10" textAnchor="middle" fontWeight="700" fill="currentColor">{m.pct ?? '–'}%</text>
      <text x={px} y={H - 10} fontSize="10" textAnchor="middle" fill="currentColor" opacity=".75">{mlabel(m.month)}</text></g>)}
  </svg></div>;
}
