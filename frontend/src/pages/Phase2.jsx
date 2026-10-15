import { useState, useEffect } from 'react';
import api, { err } from '../api';
import { useAuth } from '../App';
import { COLLEGE } from '../college';
import { useGet, useForm, useToast, Card, Table, Field, Modal, Badge, ClassPicker, FileInput, FileLink, AuthImg, photoData, printDoc, letterhead, esc, fmt } from '../ui';

const isStaff = r => ['admin', 'hod', 'teacher'].includes(r), isAdm = r => ['admin', 'hod'].includes(r);
const EXAMS = ['CT-1', 'CT-2', 'Prelim', 'Assignment', 'Practical', 'External'];
const subjOpts = l => (l || []).map(s => <option key={s._id} value={s._id}>{s.code} – {s.name} ({s.course}{s.branch ? ' ' + s.branch : ''} S{s.semester})</option>);
const run = async (toast, fn, ok) => { try { const r = await fn(); toast(ok || r?.data?.message || 'Saved'); return true; } catch (e) { toast(err(e), true); return false; } };
const grade = p => p >= 90 ? 'O' : p >= 80 ? 'A+' : p >= 70 ? 'A' : p >= 60 ? 'B+' : p >= 50 ? 'B' : p >= 40 ? 'C' : 'F';
const sessionYear = () => { const d = new Date(), y = d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1; return `${y}–${y + 1}`; };
const classLine = s => `${s.course}${s.branch ? ' · ' + s.branch : ''} · Semester ${s.semester}${s.section ? ' · Section ' + s.section : ''}`;

// ---------------- Study material ----------------
export function Materials() {
  const { user } = useAuth(), toast = useToast(), staff = isStaff(user.role), [subs] = useGet('/subjects'), [sel, setSel] = useState('');
  const [list, load] = useGet('/materials', sel ? { subject: sel } : {}), [add, setAdd] = useState(false), [f, bind, setF] = useForm({}), [file, setFile] = useState(null);
  const save = async e => { e.preventDefault(); if (await run(toast, () => api.post('/materials', { ...f, file }), 'Material shared with the class')) { setAdd(false); setF({}); setFile(null); load(); } };
  return <>
    <Card title="Study material" right={staff && <button className="btn" onClick={() => setAdd(true)}>+ Upload material</button>}>
      <Field label="Subject"><select value={sel} onChange={e => setSel(e.target.value)}><option value="">All subjects</option>{subjOpts(subs)}</select></Field>
      {list?.map(m => <div className="item" key={m._id}><b>{m.title}</b> <span className="bd">{m.subject?.name}</span> <span className="mut">{fmt(m.createdAt)} · {m.createdBy?.name}</span>
        {m.description && <div className="pre">{m.description}</div>}<div><FileLink f={m.file} />{m.link && <> {m.file?.id && '· '}<a href={m.link} target="_blank" rel="noreferrer">Open link</a></>}</div>
        {staff && (isAdm(user.role) || true) && <button className="btn r s" onClick={async () => confirm('Delete this material?') && (await run(toast, () => api.delete('/materials/' + m._id), 'Deleted')) && load()}>Delete</button>}</div>)}
      {!list?.length && <p className="empty">No study material yet.</p>}</Card>
    <Modal open={add} onClose={() => setAdd(false)} title="Upload study material"><form onSubmit={save}>
      <Field label="Subject"><select {...bind('subject')} required><option value="">Select</option>{subjOpts(subs)}</select></Field><Field label="Title"><input {...bind('title')} required /></Field>
      <Field label="Description"><textarea {...bind('description')} /></Field><FileInput kind="material" label="File (PDF, PPT, DOC… max 5 MB)" value={file} onDone={setFile} />
      <Field label="Or link (YouTube, Drive…)"><input type="url" {...bind('link')} placeholder="https://" /></Field><button className="btn">Share with class</button></form></Modal>
  </>;
}

// ---------------- Internal marks entry + publishing ----------------
export function Marks() {
  const { user } = useAuth(), toast = useToast(), [subs] = useGet('/subjects'), [sel, setSel] = useState(''), [exam, setExam] = useState('CT-1'), [max, setMax] = useState('');
  const [sheet, load, ld] = useGet('/marks/sheet', { subject: sel, exam }, !sel), [rows, setRows] = useState([]);
  useEffect(() => { setMax(''); }, [sel, exam]);
  useEffect(() => { setRows(sheet?.students || []); if (sheet?.max) setMax(sheet.max); }, [sheet]);
  const set = (id, v) => setRows(r => r.map(x => x._id === id ? { ...x, marks: v } : x));
  const save = async () => { if (await run(toast, () => api.post('/marks', { subject: sel, exam, max, rows: rows.map(x => ({ student: x._id, marks: x.marks })) }))) load(); };
  const pub = async p => { if (await run(toast, () => api.post('/marks/publish', { subject: sel, exam, publish: p }))) load(); };
  return <Card title="Internal marks"><div className="bar"><Field label="Subject"><select value={sel} onChange={e => setSel(e.target.value)}><option value="">Select</option>{subjOpts(subs)}</select></Field>
    <Field label="Exam"><select value={exam} onChange={e => setExam(e.target.value)}>{EXAMS.map(x => <option key={x}>{x}</option>)}</select></Field><Field label="Maximum marks"><input type="number" min="1" value={max} onChange={e => setMax(e.target.value)} /></Field></div>
    {sel && (ld ? <p className="empty">Loading…</p> : <>
      <p className="mut">Status: {sheet?.published ? <Badge s="Approved" /> : <Badge s="Pending" />} {sheet?.published ? 'Published, students can see these.' : 'Not published yet. Students cannot see these marks.'} Editing marks hides them again until re-published.</p>
      <Table head={['Roll', 'Student', 'Marks']} empty="No students found for this subject's class." rows={rows.map(x => [x.roll, x.name, <input type="number" min="0" style={{ width: 90 }} value={x.marks} onChange={e => set(x._id, e.target.value)} />])} />
      {rows.length > 0 && <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}><button className="btn" onClick={save}>Save marks</button>
        {isAdm(user.role) && <><button className="btn g" onClick={() => pub(true)}>Publish to students</button><button className="btn o" onClick={() => pub(false)}>Unpublish</button></>}</div>}</>)}</Card>;
}

// ---------------- Results / marksheet ----------------
function marksheetHtml(d, photo) {
  const ex = EXAMS.filter(e => d.subjects.some(s => s.marks.some(m => m.exam === e)));
  let T = 0, M = 0;
  const rows = d.subjects.map(s => { const o = s.marks.reduce((a, m) => a + m.marks, 0), m = s.marks.reduce((a, m) => a + m.max, 0); T += o; M += m; const p = m ? o / m * 100 : null;
    return `<tr><td>${esc(s.code)}</td><td>${esc(s.name)}</td>${ex.map(e => { const x = s.marks.find(y => y.exam === e); return `<td>${x ? x.marks + '/' + x.max : '–'}</td>`; }).join('')}<td>${m ? o + '/' + m : '–'}</td><td>${p == null ? '–' : p.toFixed(1) + '%'}</td><td>${p == null ? '–' : grade(p)}</td></tr>`; }).join('');
  const st = d.student, op = M ? T / M * 100 : null;
  return `${letterhead(COLLEGE)}<h3 style="text-align:center">STATEMENT OF MARKS (PROVISIONAL)</h3>${photo ? `<img src="${photo}" style="float:right;width:80px;height:100px;object-fit:cover;border:1px solid #888">` : ''}<div class="kv"><div><b>Name:</b> ${esc(st.name)}</div><div><b>Roll no.:</b> ${esc(st.roll)}</div><div><b>Course:</b> ${esc(classLine(st))}</div><div><b>Session:</b> ${sessionYear()}</div></div>
  <table><tr><th>Code</th><th>Subject</th>${ex.map(e => `<th>${e}</th>`).join('')}<th>Total</th><th>%</th><th>Grade</th></tr>${rows}</table><p><b>Overall:</b> ${op == null ? '–' : op.toFixed(1) + '% (Grade ' + grade(op) + ')'}</p>
  <p class="note">Internal assessment record issued by the institute's ERP. It is not the official university marksheet. Grades: O ≥90, A+ ≥80, A ≥70, B+ ≥60, B ≥50, C ≥40, F below 40.</p><div class="sig"><span>Class teacher</span><span>Principal / Director</span></div>`;
}
export function Results() {
  const { user } = useAuth(), adm = isAdm(user.role), [courses] = useGet('/courses'), [flt, fb, setFlt] = useForm({}), [sts] = useGet('/users', { role: 'student', ...flt }, !adm);
  const [sid, setSid] = useState(''), [d, , ld] = useGet(adm ? '/results/' + sid : '/results/me', null, adm && !sid);
  const print = async () => printDoc('Marksheet', marksheetHtml(d, await photoData(d.student.photo)));
  const ex = d ? EXAMS.filter(e => d.subjects.some(s => s.marks.some(m => m.exam === e))) : [];
  return <>
    {adm && <Card title="Find student"><div className="row"><ClassPicker f={flt} bind={fb} set={setFlt} courses={courses} all /></div><Field label="Student"><select value={sid} onChange={e => setSid(e.target.value)}><option value="">Select</option>{(sts || []).map(s => <option key={s._id} value={s._id}>{s.roll} – {s.name}</option>)}</select></Field></Card>}
    {d && <Card title={`Marksheet · ${d.student.name}`} right={<button className="btn" onClick={print}>Print / save as PDF</button>}>
      <p className="mut">{classLine(d.student)} · Only published marks are shown.</p>
      <Table head={['Subject', ...ex, 'Total', '%', 'Grade']} empty="No published marks yet." rows={d.subjects.map(s => { const o = s.marks.reduce((a, m) => a + m.marks, 0), m = s.marks.reduce((a, m) => a + m.max, 0), p = m ? o / m * 100 : null;
        return [`${s.code} – ${s.name}`, ...ex.map(e => { const x = s.marks.find(y => y.exam === e); return x ? `${x.marks}/${x.max}` : '–'; }), m ? `${o}/${m}` : '–', p == null ? '–' : p.toFixed(1) + '%', p == null ? '–' : <b>{grade(p)}</b>]; })} /></Card>}
    {!d && !ld && !adm && <p className="empty">No results yet.</p>}
  </>;
}

// ---------------- Exam schedule + admit card ----------------
async function admitHtml(st, exams) {
  const photo = await photoData(st.photo);
  return `${letterhead(COLLEGE)}<h3 style="text-align:center">ADMIT CARD · ${sessionYear()}</h3>${photo ? `<img src="${photo}" style="float:right;width:80px;height:100px;object-fit:cover;border:1px solid #888">` : ''}<div class="kv"><div><b>Name:</b> ${esc(st.name)}</div><div><b>Roll no.:</b> ${esc(st.roll)}</div><div><b>Course:</b> ${esc(classLine(st))}</div></div>
  <table><tr><th>Date</th><th>Time</th><th>Exam</th><th>Subject</th><th>Room</th></tr>${exams.map(e => `<tr><td>${fmt(e.date)}</td><td>${esc(e.start)} – ${esc(e.end)}</td><td>${esc(e.name)}</td><td>${esc(e.subject?.code)} ${esc(e.subject?.name)}</td><td>${esc(e.room || '')}</td></tr>`).join('')}</table>
  <p class="note">Carry this admit card and your college ID card to every exam. Mobile phones are not allowed in the exam hall.</p><div class="sig"><span>Student signature</span><span>Controller of Examinations</span></div>`;
}
export function Exams() {
  const { user } = useAuth(), toast = useToast(), adm = isAdm(user.role), [courses] = useGet('/courses'), [flt, fb, setFlt] = useForm({}), [sts] = useGet('/users', { role: 'student', ...flt }, !adm);
  const [sid, setSid] = useState(''), [list, load] = useGet('/exams', adm ? (sid ? { student: sid } : flt) : null), [subs] = useGet('/subjects', null, !adm);
  const [add, setAdd] = useState(false), [f, bind, setF] = useForm({});
  const create = async e => { e.preventDefault(); if (await run(toast, () => api.post('/exams', f), 'Exam added')) { setAdd(false); load(); } };
  const printCard = async () => { const st = adm ? (sts || []).find(s => s._id === sid) : user; if (!st) return toast('Select a student first', true); if (!list?.length) return toast('No exams scheduled for this class', true); printDoc('Admit card', await admitHtml(st, list)); };
  return <>
    {adm && <Card title="Exam schedule" right={<button className="btn" onClick={() => { setF({ course: flt.course, branch: flt.branch, semester: flt.semester }); setAdd(true); }}>+ Add exam</button>}>
      <div className="row"><ClassPicker f={flt} bind={fb} set={setFlt} courses={courses} all /></div><Field label="Student (for admit card)"><select value={sid} onChange={e => setSid(e.target.value)}><option value="">Select</option>{(sts || []).map(s => <option key={s._id} value={s._id}>{s.roll} – {s.name}</option>)}</select></Field></Card>}
    <Card title={adm ? 'Scheduled exams' : 'My exam schedule'} right={((user.role === 'student') || (adm && sid)) && <button className="btn y" onClick={printCard}>🖨 Print admit card</button>}>
      <Table head={['Date', 'Time', 'Exam', 'Subject', 'Room', adm ? '' : null].filter(x => x !== null)} empty="No exams scheduled." rows={(list || []).map(e => [fmt(e.date), `${e.start} – ${e.end}`, e.name, e.subject ? `${e.subject.code} ${e.subject.name}` : '–', e.room || '', ...(adm ? [<button className="btn r s" onClick={async () => (await run(toast, () => api.delete('/exams/' + e._id), 'Removed')) && load()}>✕</button>] : [])])} /></Card>
    <Modal open={add} onClose={() => setAdd(false)} title="Add exam"><form onSubmit={create}>
      <Field label="Exam name"><input {...bind('name')} placeholder="Mid-term / CT-1 / University exam" required /></Field><div className="row"><ClassPicker f={f} bind={bind} set={setF} courses={courses} /></div>
      <Field label="Subject"><select {...bind('subject')} required><option value="">Select</option>{subjOpts((subs || []).filter(s => (!f.course || s.course === f.course) && (!f.semester || s.semester == f.semester)))}</select></Field>
      <div className="row"><Field label="Date"><input type="date" {...bind('date')} required /></Field><Field label="Start"><input type="time" {...bind('start')} required /></Field><Field label="End"><input type="time" {...bind('end')} required /></Field></div>
      <Field label="Room"><input {...bind('room')} /></Field><button className="btn">Add exam</button></form></Modal>
  </>;
}

// ---------------- ID card ----------------
async function idCardHtml(u) {
  const p = await photoData(u.photo);
  return `<div class="idc"><div class="t"><b>${esc(COLLEGE.name)}</b><br>${esc(COLLEGE.accreditation)} · Est. ${COLLEGE.est}</div><div class="b">${p ? `<img class="p" src="${p}">` : '<div class="p" style="width:80px;height:100px;background:#dfe3ff"></div>'}<div><b style="font-size:14px">${esc(u.name)}</b><br>Roll: ${esc(u.roll)}<br>${esc(u.course)}${u.branch ? ' · ' + esc(u.branch) : ''}<br>Semester ${u.semester || ''}${u.section ? ' · Sec ' + esc(u.section) : ''}<br>Phone: ${esc(u.phone || '–')}<br>Session: ${sessionYear()}</div></div><div class="f">${esc(COLLEGE.address)} · ${esc(COLLEGE.phone)}</div></div>`;
}
export function IdCards() {
  const { user } = useAuth(), adm = isAdm(user.role), [courses] = useGet('/courses'), [flt, fb, setFlt] = useForm({}), [list] = useGet('/users', { role: 'student', ...flt }, !adm);
  const print = async us => printDoc('ID cards', `<div class="cards">${(await Promise.all(us.map(idCardHtml))).join('')}</div>`);
  const Preview = ({ u }) => <div className="clay" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'center', maxWidth: 420 }}><AuthImg id={u.photo} style={{ width: 90, height: 112, objectFit: 'cover', borderRadius: 18 }} />
    <div><b>{u.name}</b><div className="mut">Roll {u.roll}<br />{classLine(u)}</div></div></div>;
  return adm ? <Card title="ID cards" right={<button className="btn" disabled={!list?.length} onClick={() => print(list)}>🖨 Print {list?.length || 0} card(s)</button>}>
      <div className="row"><ClassPicker f={flt} bind={fb} set={setFlt} courses={courses} all /></div><p className="mut">Photos are added from People (Photo button) or by students in their profile. Cards without a photo print with an empty box.</p>
      <Table head={['Roll', 'Name', 'Photo']} rows={(list || []).map(u => [u.roll, u.name, u.photo ? <span className="ok">✔</span> : <span className="no">Missing</span>])} /></Card> :
    <Card title="My ID card" right={<button className="btn" onClick={() => print([user])}>🖨 Print</button>}><Preview u={user} />{!user.photo && <p className="mut">Add your photo in Profile so it appears on the card.</p>}</Card>;
}
