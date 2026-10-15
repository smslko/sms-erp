import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import api, { err as errMsg } from './api';

const T = createContext(() => {});
export const useToast = () => useContext(T);
export function ToastProvider({ children }) {
  const [m, setM] = useState(null);
  const show = (t, bad) => { setM({ t, bad }); setTimeout(() => setM(null), 2800); };
  return <T.Provider value={show}>{children}{m && <div className={'toast glass ' + (m.bad ? 'bad' : '')}>{m.t}</div>}</T.Provider>;
}
export function useGet(url, params, skip) {
  const [d, setD] = useState(null), [l, setL] = useState(!skip);
  const key = url + JSON.stringify(params || {}) + skip;
  const load = useCallback(() => {
    if (skip) { setD(null); return Promise.resolve(); }
    setL(true);
    return api.get(url, { params }).then(r => setD(r.data)).catch(() => setD(null)).finally(() => setL(false));
  }, [key]);
  useEffect(() => { load(); }, [load]);
  return [d, load, l];
}
export function useForm(init) {
  const [f, set] = useState(init);
  const bind = k => ({ value: f[k] ?? '', onChange: e => set(p => ({ ...p, [k]: e.target.value })) });
  return [f, bind, set];
}
export const Card = ({ title, right, children }) => (
  <section className="card clay">{(title || right) && <div className="ch"><h3>{title}</h3>{right}</div>}{children}</section>
);
export const Table = ({ head, rows, empty = 'Nothing here yet.' }) => rows.length
  ? <div className="tw"><table><thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
  : <p className="empty">{empty}</p>;
export const Field = ({ label, children }) => <label className="fld"><span>{label}</span>{children}</label>;
export const Modal = ({ open, onClose, title, children }) => open ? (
  <div className="ov" onClick={onClose}><div className="modal glass" role="dialog" onClick={e => e.stopPropagation()}>
    <div className="ch"><h3>{title}</h3><button className="x" onClick={onClose} aria-label="Close">×</button></div>{children}
  </div></div>) : null;
export const Badge = ({ s }) => <span className={'bd ' + String(s).toLowerCase()}>{s}</span>;
export const fmt = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
export const Meter = ({ v }) => <div className="meter"><i style={{ width: Math.min(100, v || 0) + '%' }} /></div>;
export const pct = (p, t) => t ? +(p / t * 100).toFixed(1) : null;
export const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN');
export const SEMS = n => Array.from({ length: n }, (_, i) => i + 1);

// Course / branch / semester pickers driven by the course master
export function ClassPicker({ f, bind, set, courses, all }) {
  const c = (courses || []).find(x => x.code === f.course);
  return <>
    <Field label="Course"><select {...bind('course')} onChange={e => set(p => ({ ...p, course: e.target.value, branch: '', semester: '' }))}>
      <option value="">{all ? 'All courses' : 'Select'}</option>{(courses || []).map(x => <option key={x.code} value={x.code}>{x.name} ({x.university})</option>)}</select></Field>
    <Field label="Branch / Specialisation"><select {...bind('branch')} disabled={!c || !c.branches.length}><option value="">{all ? 'All' : 'None'}</option>{c?.branches.map(b => <option key={b}>{b}</option>)}</select></Field>
    <Field label="Semester"><select {...bind('semester')} disabled={!c}><option value="">{all ? 'All' : 'Select'}</option>{c && SEMS(c.years * 2).map(s => <option key={s}>{s}</option>)}</select></Field>
  </>;
}

// ---------- Phase 2 helpers: files, images, printing ----------
export const localDate = (d = new Date()) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD in the user's own timezone
export const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Upload one file (max 5 MB). Calls onDone({ id, name }).
export function FileInput({ kind, label = 'Attach file (optional, max 5 MB)', value, onDone, accept, fields }) {
  const toast = useToast(), [busy, setBusy] = useState(false);
  const pick = async e => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('File is too large (max 5 MB)', true); e.target.value = ''; return; }
    const fd = new FormData(); fd.append('file', file); fd.append('kind', kind); Object.entries(fields || {}).forEach(([k, v]) => fd.append(k, v)); setBusy(true);
    try { const r = await api.post('/files', fd); onDone({ id: r.data._id, name: r.data.name }); toast('File uploaded'); }
    catch (x) { toast(errMsg(x), true); } finally { setBusy(false); e.target.value = ''; }
  };
  return <Field label={label}><input type="file" accept={accept} onChange={pick} disabled={busy} />
    {busy && <span className="mut"> Uploading…</span>}{value?.name && <div className="mut">✔ {value.name} <a href="#" onClick={e => { e.preventDefault(); onDone(null); }}>remove</a></div>}</Field>;
}
export async function download(id, name) {
  try { const r = await api.get('/files/' + id, { responseType: 'blob' }); const u = URL.createObjectURL(r.data), a = document.createElement('a'); a.href = u; a.download = name || 'file'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 3000); }
  catch (x) { alert('Could not download this file.'); }
}
export const FileLink = ({ f }) => f?.id ? <a href="#" onClick={e => { e.preventDefault(); download(f.id, f.name); }}>📎 {f.name}</a> : null;
export function AuthImg({ id, alt = '', className, style }) {
  const [src, setSrc] = useState(null);
  useEffect(() => { let u; setSrc(null); if (id) api.get('/files/' + id, { responseType: 'blob' }).then(r => { u = URL.createObjectURL(r.data); setSrc(u); }).catch(() => {}); return () => u && URL.revokeObjectURL(u); }, [id]);
  return src ? <img src={src} alt={alt} className={className} style={style} /> : <div className={className} style={{ ...style, background: '#dfe3ff', display: 'grid', placeItems: 'center', color: '#6b7094' }}>👤</div>;
}
export async function photoData(id) {
  if (!id) return '';
  try { const r = await api.get('/files/' + id, { responseType: 'blob' }); return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(r.data); }); } catch { return ''; }
}
const PRINT_CSS = `*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;padding:20px}h1,h2,h3{margin:4px 0}.hd{display:flex;align-items:center;gap:14px;border-bottom:3px solid #1b2170;padding-bottom:10px;margin-bottom:14px}.hd img{height:70px}.hd div{flex:1;text-align:center}.hd h2{color:#1b2170}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #888;padding:6px 8px;text-align:left;font-size:13px}th{background:#e8ebff}.kv{display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin:8px 0}.note{font-size:11px;color:#555;margin-top:14px}.sig{display:flex;justify-content:space-between;margin-top:60px}.sig span{border-top:1px solid #000;padding-top:4px;min-width:160px;text-align:center}.cards{display:flex;flex-wrap:wrap;gap:10px}.idc{width:300px;border:2px solid #1b2170;border-radius:12px;overflow:hidden;page-break-inside:avoid}.idc .t{background:#1b2170;color:#fff;text-align:center;padding:6px;font-size:12px}.idc .b{display:flex;gap:10px;padding:10px;font-size:12px}.idc img.p{width:80px;height:100px;object-fit:cover;border:1px solid #888}.idc .f{background:#f3b73a;text-align:center;font-size:10px;padding:3px}@media print{body{padding:0}}`;
export function printDoc(title, html) {
  const w = window.open('', '_blank'); if (!w) { alert('Please allow pop-ups to print.'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${html}<script>setTimeout(function(){print()},500)<\/script></body></html>`); w.document.close();
}
export const letterhead = c => `<div class="hd"><img src="${location.origin}/logo.jpg" alt=""><div><h2>${esc(c.name)}</h2><div style="font-size:12px">${esc(c.address)} · ${esc(c.phone)}</div><div style="font-size:12px">Affiliated: ${esc(c.affiliations)} · ${esc(c.accreditation)}</div></div></div>`;
