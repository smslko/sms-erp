import { useState, useEffect } from 'react';
import api, { err } from '../api';
import { useAuth } from '../App';
import { useGet, useForm, useToast, Card, Table, Field, Modal, Badge, ClassPicker, FileInput, FileLink, localDate, fmt } from '../ui';
import { AttBars, AttLine } from '../charts';

const isStaff = r => ['admin', 'hod', 'teacher'].includes(r);
const isAdm = r => ['admin', 'hod'].includes(r);
const subjOpts = l => (l || []).map(s => <option key={s._id} value={s._id}>{s.code} – {s.name} ({s.course}{s.branch ? ' ' + s.branch : ''} S{s.semester})</option>);
const run = async (toast, fn, ok) => { try { const r = await fn(); toast(ok || r?.data?.message || 'Saved'); return true; } catch (e) { toast(err(e), true); return false; } };

// ---------------- Assignments ----------------
export function Assignments() {
  const { user } = useAuth(), toast = useToast(), staff = isStaff(user.role);
  const [list, load] = useGet('/assignments'), [subs] = useGet('/subjects');
  const [add, setAdd] = useState(false), [f, bind, setF] = useForm({ maxMarks: 10 });
  const [view, setView] = useState(null), [sl, loadSl] = useGet(view ? `/assignments/${view._id}/submissions` : '', null, !view);
  const [sub, setSub] = useState(null), [sf, sbind, setSf] = useForm({});
  const [marks, setMarks] = useState({}), [af, setAf] = useState(null), [sfile, setSfile] = useState(null);
  const create = async e => { e.preventDefault(); if (await run(toast, () => api.post('/assignments', { ...f, file: af }), 'Assignment published to students')) { setAdd(false); setF({ maxMarks: 10 }); setAf(null); load(); } };
  const submit = async e => { e.preventDefault(); if (await run(toast, () => api.post(`/assignments/${sub._id}/submit`, { ...sf, file: sfile }), 'Submitted')) { setSub(null); setSf({}); setSfile(null); load(); } };
  const grade = async s => { const m = marks[s._id] || {}; if (await run(toast, () => api.put(`/submissions/${s._id}`, { marks: m.marks ?? s.marks, remark: m.remark ?? s.remark }), 'Grade saved')) loadSl(); };
  return <>
    <Card title="Assignments" right={staff && <button className="btn" onClick={() => setAdd(true)}>+ New assignment</button>}>
      {!list ? <p className="empty">Loading…</p> : !list.length ? <p className="empty">{staff ? 'No assignments yet. Create one and students in that class will see it.' : 'No assignments right now.'}</p> :
        list.map(a => <div className="item" key={a._id}>
          <b>{a.title}</b> <span className="bd">{a.subject?.name}</span> <span className="mut">Due {fmt(a.dueDate)} · {a.maxMarks} marks · by {a.createdBy?.name}</span>
          {a.description && <div className="pre">{a.description}</div>}{a.file?.id && <div><FileLink f={a.file} /></div>}{a.link && <div><a href={a.link} target="_blank" rel="noreferrer">Open reference link</a></div>}
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {staff ? <><span className="mut">{a.submissions} submitted</span><button className="btn o s" onClick={() => setView(a)}>Submissions & grading</button>
              <button className="btn r s" onClick={async () => confirm('Delete this assignment and its submissions?') && (await run(toast, () => api.delete('/assignments/' + a._id), 'Deleted')) && load()}>Delete</button></> :
              a.mine ? <><Badge s={a.mine.marks != null ? 'Approved' : 'Pending'} /> <span>{a.mine.marks != null ? `Marks: ${a.mine.marks}/${a.maxMarks} ${a.mine.remark || ''}` : 'Submitted, awaiting grade'}{a.mine.late ? ' (late)' : ''}</span>{a.mine.marks == null && <button className="btn o s" onClick={() => { setSub(a); setSf({ text: a.mine.text, link: a.mine.link }); setSfile(a.mine.file?.id ? a.mine.file : null); }}>Edit</button>}</> :
                <button className="btn s" onClick={() => setSub(a)}>Submit</button>}
          </div></div>)}
    </Card>
    <Modal open={add} onClose={() => setAdd(false)} title="New assignment"><form onSubmit={create}>
      <Field label="Subject"><select {...bind('subject')} required><option value="">Select</option>{subjOpts(subs)}</select></Field>
      <Field label="Title"><input {...bind('title')} required /></Field><Field label="Instructions"><textarea {...bind('description')} /></Field>
      <div className="row"><Field label="Due date"><input type="date" {...bind('dueDate')} required /></Field><Field label="Max marks"><input type="number" min="1" {...bind('maxMarks')} /></Field></div>
      <FileInput kind="assignment" label="Attach question paper / file (optional, max 5 MB)" value={af} onDone={setAf} /><Field label="Reference link (optional)"><input type="url" {...bind('link')} placeholder="https://" /></Field><button className="btn">Publish to students</button></form></Modal>
    <Modal open={!!sub} onClose={() => setSub(null)} title={'Submit: ' + (sub?.title || '')}><form onSubmit={submit}>
      <Field label="Your answer"><textarea {...sbind('text')} /></Field><FileInput kind="submission" label="Attach your file (PDF, DOC, ZIP, image — max 5 MB)" value={sfile} onDone={setSfile} /><Field label="Or a link (Drive, GitHub…)"><input type="url" {...sbind('link')} placeholder="https://" /></Field><button className="btn">Submit assignment</button></form></Modal>
    <Modal open={!!view} onClose={() => setView(null)} title={'Submissions: ' + (view?.title || '')}>
      <Table head={['Student', 'Answer', `Marks /${view?.maxMarks}`, 'Remark', '']} empty="No submissions yet."
        rows={(sl || []).map(s => [<>{s.student?.name}<div className="mut">{s.student?.roll}{s.late && ' · late'}</div></>, <>{s.text}{s.file?.id && <div><FileLink f={s.file} /></div>}{s.link && <div><a href={s.link} target="_blank" rel="noreferrer">link</a></div>}</>,
          <input style={{ width: 70 }} type="number" defaultValue={s.marks} onChange={e => setMarks(m => ({ ...m, [s._id]: { ...m[s._id], marks: e.target.value } }))} />,
          <input defaultValue={s.remark} onChange={e => setMarks(m => ({ ...m, [s._id]: { ...m[s._id], remark: e.target.value } }))} />, <button className="btn s" onClick={() => grade(s)}>Save</button>])} /></Modal>
  </>;
}

// ---------------- Syllabus & outcomes ----------------
export function Syllabus() {
  const { user } = useAuth(), toast = useToast(), canEdit = isStaff(user.role);
  const [subs, load] = useGet('/subjects'), [sel, setSel] = useState(''), [txt, setTxt] = useState(''), [co, setCo] = useState(''), [edit, setEdit] = useState(false);
  const s = (subs || []).find(x => x._id === sel);
  useEffect(() => { if (s) { setTxt(s.syllabus || ''); setCo((s.outcomes || []).join('\n')); setEdit(false); } }, [sel, subs]);
  const save = async () => { if (await run(toast, () => api.put(`/subjects/${s._id}/syllabus`, { syllabus: txt, outcomes: co.split('\n').map(x => x.trim()).filter(Boolean) }), 'Syllabus updated. Students can see it now.')) { setEdit(false); load(); } };
  return <>
    <Card title="Syllabus & course outcomes"><Field label="Subject"><select value={sel} onChange={e => setSel(e.target.value)}><option value="">Select a subject</option>{subjOpts(subs)}</select></Field>
      {!subs?.length && <p className="empty">{canEdit ? 'No subjects assigned to you yet. Ask the admin to assign subjects.' : 'No subjects found for your class yet.'}</p>}</Card>
    {s && <Card title={`${s.code} – ${s.name}`} right={canEdit && !edit && <button className="btn" onClick={() => setEdit(true)}>Edit</button>}>
      {edit ? <><Field label="Syllabus (units, topics, books)"><textarea style={{ minHeight: 200 }} value={txt} onChange={e => setTxt(e.target.value)} /></Field>
        <Field label="Course outcomes (one per line)"><textarea value={co} onChange={e => setCo(e.target.value)} /></Field>
        <button className="btn g" onClick={save}>Save & notify class</button> <button className="btn o" onClick={() => setEdit(false)}>Cancel</button></> :
        <><p className="mut">Teacher: {s.teacher?.name || 'Not assigned'}</p><h3>Syllabus</h3><div className="pre">{s.syllabus || 'Not uploaded yet.'}</div><h3 style={{ marginTop: 16 }}>Course outcomes</h3>
          {s.outcomes?.length ? <ol>{s.outcomes.map((o, i) => <li key={i}>{o}</li>)}</ol> : <p className="mut">Not added yet.</p>}</>}</Card>}
  </>;
}

// ---------------- Attendance ----------------
export function Attendance() {
  const { user } = useAuth();
  return isStaff(user.role) ? <Mark /> : <Mine />;
}
const low = (p, min) => p != null && p < min;
const tip = (r, min) => r.total === 0 ? '–' : r.need != null ? <span className="no">Attend the next {r.need} class{r.need > 1 ? 'es' : ''} without a miss to reach {min}%</span> : <span className="ok">Safe. You can miss {r.canMiss} more class{r.canMiss === 1 ? '' : 'es'}</span>;
export function AttendanceView({ d }) {
  const o = d.overall, min = d.min;
  return <>
    <div className="hero"><span className="tg">{o.pct == null ? 'No classes marked yet' : o.pct >= min ? 'On track' : `Below ${min}%`}</span>Overall attendance<b>{o.pct ?? '–'}{o.pct != null && '%'}</b>{o.total > 0 && <div>{o.present} of {o.total} classes counted as present</div>}</div>
    <div className="grid"><Card title="Subject-wise attendance"><AttBars rows={d.subjects.map(s => ({ label: s.subject.code, pct: s.pct }))} min={min} /></Card>
      <Card title="Monthly trend"><AttLine monthly={d.monthly} min={min} /></Card></div>
    <Card title="Details"><p className="mut">Present = P, Absent = A, Leave = L (approved leave, counted as present). Percentage = counted present ÷ classes held.</p>
      <Table head={['Subject', 'P', 'A', 'L', 'Total', '%', 'What to do']} empty="No subjects for this class yet." rows={d.subjects.map(s => [`${s.subject.code} – ${s.subject.name}`, s.present, s.absent, s.leave, s.total, <b className={low(s.pct, min) ? 'no' : 'ok'}>{s.pct ?? '–'}{s.pct != null && '%'}</b>, tip(s, min)])} /></Card>
  </>;
}
function Mine() { const [d] = useGet('/attendance/summary'); return d ? <AttendanceView d={d} /> : <p className="empty">Loading…</p>; }
const NEXT = { P: 'A', A: 'L', L: 'P' }, LAB = { P: 'Present', A: 'Absent', L: 'Leave' }, CLS = { P: 'g', A: 'r', L: 'y' };
function Mark() {
  const toast = useToast(), [subs] = useGet('/subjects'), [hol] = useGet('/holidays'), [sel, setSel] = useState(''), [slot, setSlot] = useState(1), [date, setDate] = useState(localDate());
  const [sheet, , ld] = useGet('/attendance/sheet', { subject: sel, date, slot }, !sel), [rows, setRows] = useState([]), [rep, loadRep] = useGet('/attendance/report', { subject: sel }, !sel);
  const [courses] = useGet('/courses'), [flt, fb, setFlt] = useForm({}), [def] = useGet('/attendance/defaulters', flt, !(flt.course && flt.semester));
  useEffect(() => setRows(sheet?.students || []), [sheet]);
  const cycle = id => setRows(r => r.map(x => x._id === id ? { ...x, status: NEXT[x.status] } : x));
  const save = async () => { if (await run(toast, () => api.post('/attendance', { subject: sel, date, slot, records: rows.map(x => ({ student: x._id, status: x.status })) }))) loadRep(); };
  const sunday = new Date(date + 'T00:00:00').getDay() === 0, holiday = (hol || []).find(h => date >= h.from && date <= h.to);
  const count = k => rows.filter(x => x.status === k).length;
  return <>
    <Card title="Mark attendance"><div className="bar"><Field label="Subject"><select value={sel} onChange={e => setSel(e.target.value)}><option value="">Select</option>{subjOpts(subs)}</select></Field>
      <Field label="Date"><input type="date" value={date} max={localDate()} onChange={e => setDate(e.target.value)} /></Field>
      <Field label="Period"><select value={slot} onChange={e => setSlot(+e.target.value)}>{[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>Period {n}</option>)}</select></Field></div>
      {(sunday || holiday) && <p className="no">⚠ {holiday ? `${holiday.name} is a holiday.` : 'This date is a Sunday.'} Mark attendance only if a class was actually held.</p>}
      {sel && (ld ? <p className="empty">Loading…</p> : <>
        {sheet?.saved && <p className="mut">Attendance for this date and period is already saved. Saving again updates it.</p>}
        {sheet && !sheet.editable && <p className="no">This date is outside the edit window. Only the HOD/admin can change it.</p>}
        <p className="mut">Tap a status to change it: Present → Absent → Leave. Students with an approved leave are pre-set to Leave.</p>
        <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><button className="btn o s" onClick={() => setRows(r => r.map(x => ({ ...x, status: 'P' })))}>All present</button><button className="btn o s" onClick={() => setRows(r => r.map(x => ({ ...x, status: 'A' })))}>All absent</button>
          <span className="mut">Present {count('P')} · Absent {count('A')} · Leave {count('L')}</span></div>
        <Table head={['Roll', 'Student', 'Status']} empty="No students found for this subject's class." rows={rows.map(x => [x.roll, x.name, <button className={'btn s ' + CLS[x.status]} onClick={() => cycle(x._id)}>{LAB[x.status]}</button>])} />
        {rows.length > 0 && <button className="btn" style={{ marginTop: 14 }} disabled={sheet && !sheet.editable} onClick={save}>Save attendance</button>}</>)}</Card>
    {sel && rep && <Card title="Class report for this subject"><Table head={['Roll', 'Student', 'P', 'A', 'L', 'Total', '%']} rows={rep.rows.map(x => [x.roll, x.name, x.present, x.absent, x.leave, x.total, <b className={low(x.pct, rep.min) ? 'no' : 'ok'}>{x.pct ?? '–'}{x.pct != null && '%'}</b>])} /></Card>}
    <Card title="Students below minimum attendance (all subjects)"><div className="row"><ClassPicker f={flt} bind={fb} set={setFlt} courses={courses} all /></div>
      {!(flt.course && flt.semester) ? <p className="mut">Choose a course and semester.</p> : <Table head={['Roll', 'Student', 'Present / Total', 'Overall %']} empty="No student is below the minimum. 🎉" rows={(def?.rows || []).map(x => [x.roll, x.name, `${x.present} / ${x.total}`, <b className="no">{x.pct}%</b>])} />}</Card>
  </>;
}

// ---------------- Timetable ----------------
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function Timetable() {
  const { user } = useAuth(), toast = useToast(), adm = isAdm(user.role), [courses] = useGet('/courses'), [subs] = useGet('/subjects');
  const [flt, fb, setFlt] = useForm({}), [list, load] = useGet('/timetable', adm ? flt : null);
  const [add, setAdd] = useState(false), [f, bind, setF] = useForm({ day: 1 });
  const create = async e => { e.preventDefault(); if (await run(toast, () => api.post('/timetable', f), 'Period added')) { setAdd(false); load(); } };
  const by = {}; (list || []).forEach(t => (by[t.day] ||= []).push(t));
  return <>
    {adm && <Card title="Class timetable" right={<button className="btn" onClick={() => { setF({ day: 1, course: flt.course, branch: flt.branch, semester: flt.semester }); setAdd(true); }}>+ Add period</button>}>
      <div className="row"><ClassPicker f={flt} bind={fb} set={setFlt} courses={courses} all /></div><Field label="Section (optional)"><input {...fb('section')} placeholder="A" /></Field></Card>}
    <Card title={adm ? 'Weekly schedule' : 'My timetable'}>{[1, 2, 3, 4, 5, 6, 0].filter(d => by[d]).map(d => <div key={d} className="item"><b>{DAYS[d]}</b>
      <Table head={['Time', 'Subject', 'Room', adm ? '' : null].filter(x => x !== null)} rows={by[d].map(t => [t.start + ' – ' + t.end, t.subject?.name, t.room, ...(adm ? [<button className="btn r s" onClick={async () => (await run(toast, () => api.delete('/timetable/' + t._id), 'Removed')) && load()}>Remove</button>] : [])])} /></div>)}
      {!list?.length && <p className="empty">{adm ? 'Choose a class above, or add the first period.' : 'No timetable published yet.'}</p>}</Card>
    <Modal open={add} onClose={() => setAdd(false)} title="Add period"><form onSubmit={create}>
      <div className="row"><ClassPicker f={f} bind={bind} set={setF} courses={courses} /></div>
      <Field label="Section (blank = all)"><input {...bind('section')} /></Field>
      <Field label="Subject"><select {...bind('subject')} required><option value="">Select</option>{subjOpts((subs || []).filter(s => (!f.course || s.course === f.course) && (!f.semester || s.semester == f.semester)))}</select></Field>
      <div className="row"><Field label="Day"><select {...bind('day')}>{[1, 2, 3, 4, 5, 6, 0].map(d => <option key={d} value={d}>{DAYS[d]}</option>)}</select></Field><Field label="Start"><input type="time" {...bind('start')} required /></Field><Field label="End"><input type="time" {...bind('end')} required /></Field></div>
      <Field label="Room"><input {...bind('room')} /></Field><button className="btn">Add period</button></form></Modal>
  </>;
}
