import { useState } from 'react';
import api, { err } from '../api';
import { useAuth } from '../App';
import { useGet, useForm, useToast, Card, Table, Field, Modal, ClassPicker, FileInput, FileLink, kb, fmt } from '../ui';
import { AttendanceView } from './Academics';

const run = async (toast, fn, ok) => { try { const r = await fn(); toast(ok || r?.data?.message || 'Saved'); return true; } catch (e) { toast(err(e), true); return false; } };

// ---------------- Courses & branches ----------------
export function Courses() {
  const toast = useToast(), [list, load] = useGet('/courses'), [m, setM] = useState(false), [f, bind, setF] = useForm({});
  const open = c => { setF(c ? { ...c, branches: c.branches.join(', ') } : { university: 'LU', years: 3 }); setM(true); };
  const save = async e => { e.preventDefault(); const body = { ...f, branches: String(f.branches || '').split(',').map(x => x.trim()).filter(Boolean) };
    if (await run(toast, () => f._id ? api.put('/courses/' + f._id, body) : api.post('/courses', body), 'Course saved')) { setM(false); load(); } };
  return <><Card title="Courses & branches" right={<button className="btn" onClick={() => open()}>+ Add course</button>}>
    <Table head={['Code', 'Course', 'University', 'Years', 'Branches / specialisations', '']} rows={(list || []).map(c => [c.code, c.name, c.university, c.years, c.branches.join(', ') || '–',
      <><button className="btn o s" onClick={() => open(c)}>Edit</button> <button className="btn r s" onClick={async () => confirm('Delete course?') && (await run(toast, () => api.delete('/courses/' + c._id), 'Deleted')) && load()}>✕</button></>])} /></Card>
    <Modal open={m} onClose={() => setM(false)} title={f._id ? 'Edit course' : 'Add course'}><form onSubmit={save}>
      <div className="row"><Field label="Code"><input {...bind('code')} required /></Field><Field label="Name"><input {...bind('name')} required /></Field></div>
      <div className="row"><Field label="University"><select {...bind('university')}><option value="AKTU">AKTU</option><option value="LU">Lucknow University</option></select></Field><Field label="Duration (years)"><input type="number" min="1" max="6" {...bind('years')} required /></Field></div>
      <Field label="Branches (comma separated)"><input {...bind('branches')} placeholder="CSE, IT, ECE" /></Field><button className="btn">Save course</button></form></Modal></>;
}

// ---------------- Subjects ----------------
export function Subjects() {
  const toast = useToast(), [courses] = useGet('/courses'), [flt, fb, setFlt] = useForm({}), [list, load] = useGet('/subjects', flt), [t1] = useGet('/users', { role: 'teacher' }), [t2] = useGet('/users', { role: 'hod' });
  const [m, setM] = useState(false), [f, bind, setF] = useForm({}), teachers = [...(t1 || []), ...(t2 || [])];
  const save = async e => { e.preventDefault(); if (await run(toast, () => f._id ? api.put('/subjects/' + f._id, f) : api.post('/subjects', f), 'Subject saved')) { setM(false); load(); } };
  return <><Card title="Subjects" right={<button className="btn" onClick={() => { setF({ course: flt.course, branch: flt.branch, semester: flt.semester }); setM(true); }}>+ Add subject</button>}>
    <div className="row"><ClassPicker f={flt} bind={fb} set={setFlt} courses={courses} all /></div>
    <Table head={['Code', 'Subject', 'Class', 'Teacher', '']} rows={(list || []).map(s => [s.code, s.name, `${s.course}${s.branch ? ' · ' + s.branch : ''} · S${s.semester}`, s.teacher?.name || <span className="no">Unassigned</span>,
      <><button className="btn o s" onClick={() => { setF({ ...s, teacher: s.teacher?._id }); setM(true); }}>Edit</button> <button className="btn r s" onClick={async () => confirm('Delete subject?') && (await run(toast, () => api.delete('/subjects/' + s._id), 'Deleted')) && load()}>✕</button></>])} /></Card>
    <Modal open={m} onClose={() => setM(false)} title={f._id ? 'Edit subject' : 'Add subject'}><form onSubmit={save}>
      <div className="row"><Field label="Code"><input {...bind('code')} required /></Field><Field label="Credits"><input type="number" {...bind('credits')} /></Field></div><Field label="Subject name"><input {...bind('name')} required /></Field>
      <div className="row"><ClassPicker f={f} bind={bind} set={setF} courses={courses} /></div>
      <Field label="Teacher"><select {...bind('teacher')}><option value="">Unassigned</option>{teachers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}</select></Field><button className="btn">Save subject</button></form></Modal></>;
}

// ---------------- People ----------------
export function Users() {
  const { user } = useAuth(), toast = useToast(), adm = user.role === 'admin', [courses] = useGet('/courses'), [flt, fb, setFlt] = useForm({ role: 'student' }), [list, load] = useGet('/users', flt);
  const [m, setM] = useState(false), [f, bind, setF] = useForm({}), [bulk, setBulk] = useState(false), [csv, setCsv] = useState(''), [ph, setPh] = useState(null), [dc, setDc] = useState(null), [at, setAt] = useState(null), [atd] = useGet('/attendance/summary', { student: at?._id }, !at), [docs] = useGet('/files', { owner: dc?._id, kind: 'document' }, !dc);
  const save = async e => { e.preventDefault(); if (await run(toast, () => api.post('/users', f), 'User created. Default password is the roll number (or Welcome@123).')) { setM(false); load(); } };
  const doBulk = async () => {
    const rows = csv.trim().split('\n').map(l => l.split(',').map(x => x.trim())).filter(r => r[0] && r[1]).map(([name, roll, course, branch, semester, section, phone]) => ({ name, roll, course: (course || '').toUpperCase(), branch: branch || '', semester: +semester || undefined, section: section || '', phone }));
    try { const r = await api.post('/users/bulk', { rows }); toast(`${r.data.created} created${r.data.skipped.length ? ', skipped (duplicate/invalid): ' + r.data.skipped.join(', ') : ''}`); setBulk(false); setCsv(''); load(); } catch (x) { toast(err(x), true); }
  };
  return <><Card title={adm ? 'People' : 'Students'} right={adm && <div style={{ display: 'flex', gap: 8 }}><button className="btn o" onClick={() => setBulk(true)}>Bulk upload students</button><button className="btn" onClick={() => { setF({ role: 'student' }); setM(true); }}>+ Add user</button></div>}>
    <div className="row">{adm && <Field label="Role"><select {...fb('role')}><option value="student">Student</option><option value="teacher">Teacher</option><option value="hod">HOD</option><option value="accountant">Accountant</option><option value="admin">Admin</option></select></Field>}
      <ClassPicker f={flt} bind={fb} set={setFlt} courses={courses} all /><Field label="Search"><input {...fb('q')} placeholder="Name or roll" /></Field></div>
    <Table head={['Name', 'Roll / username', 'Class', 'Phone', '']} empty="No users found." rows={(list || []).map(u => [u.name, u.roll || u.username, u.course ? `${u.course}${u.branch ? ' · ' + u.branch : ''} · S${u.semester}${u.section ? ' · ' + u.section : ''}` : u.role, u.phone || '–',
      <>{u.role === 'student' && <button className="btn o s" onClick={() => setAt(u)}>Attendance</button>} {adm && <><button className="btn o s" onClick={() => setPh(u)}>Photo</button> <button className="btn o s" onClick={() => setDc(u)}>Docs</button> <button className="btn o s" onClick={async () => { const p = prompt('New password (leave blank to reset to roll number / Welcome@123)') ; if (p !== null) await run(toast, () => api.post(`/users/${u._id}/reset-password`, { password: p || undefined })); }}>Reset password</button> <button className="btn r s" onClick={async () => confirm('Deactivate ' + u.name + '?') && (await run(toast, () => api.delete('/users/' + u._id), 'Deactivated')) && load()}>Deactivate</button></>}</>])} /></Card>
    <Modal open={m} onClose={() => setM(false)} title="Add user"><form onSubmit={save}>
      <Field label="Role"><select {...bind('role')}><option value="student">Student</option><option value="teacher">Teacher</option><option value="hod">HOD</option><option value="accountant">Accountant</option><option value="admin">Admin</option></select></Field>
      <div className="row"><Field label="Full name"><input {...bind('name')} required /></Field><Field label={f.role === 'student' ? 'Roll number (also username)' : 'Username'}><input {...bind(f.role === 'student' ? 'roll' : 'username')} required /></Field></div>
      <div className="row"><Field label="Password (optional)"><input {...bind('password')} /></Field><Field label="Phone"><input {...bind('phone')} /></Field></div>
      {f.role === 'student' && <><div className="row"><ClassPicker f={f} bind={bind} set={setF} courses={courses} /></div><Field label="Section"><input {...bind('section')} placeholder="A" /></Field></>}<button className="btn">Create user</button></form></Modal>
    <Modal open={!!at} onClose={() => setAt(null)} title={'Attendance: ' + (at?.name || '')}>{atd ? <AttendanceView d={atd} /> : <p className="empty">Loading…</p>}</Modal>
    <Modal open={!!ph} onClose={() => setPh(null)} title={'Photo: ' + (ph?.name || '')}><FileInput kind="photo" label="Choose photo (JPG/PNG/WebP, max 5 MB)" accept="image/*" onDone={async file => { if (file && await run(toast, () => api.put('/users/' + ph._id, { photo: file.id }), 'Photo saved')) { setPh(null); load(); } }} /></Modal>
    <Modal open={!!dc} onClose={() => setDc(null)} title={'Documents: ' + (dc?.name || '')}><Table head={['Document', 'Size']} empty="No documents uploaded." rows={(docs || []).map(d => [<FileLink f={{ id: d._id, name: d.label ? d.label + ' – ' + d.name : d.name }} />, kb(d.size)])} /></Modal>
    <Modal open={bulk} onClose={() => setBulk(false)} title="Bulk upload students"><p className="mut">One student per line:<br /><code>name, roll, course, branch, semester, section, phone</code><br />Example: <code>Aman Verma, 2504230100010, BTECH, CSE, 3, A, 9876543210</code><br />Course codes: BTECH, MBA, BBA, BCA, BCOM, BCOMH, BVOC. Password = roll number.</p>
      <textarea style={{ minHeight: 180 }} value={csv} onChange={e => setCsv(e.target.value)} /><button className="btn" style={{ marginTop: 12 }} onClick={doBulk}>Upload</button></Modal></>;
}

// ---------------- Holidays ----------------
export function Holidays() {
  const toast = useToast(), [list, load] = useGet('/holidays'), [f, bind, setF] = useForm({});
  const add = async e => { e.preventDefault(); if (await run(toast, () => api.post('/holidays', f), 'Holiday added')) { setF({}); load(); } };
  return <div className="grid"><Card title="Add holiday"><form onSubmit={add}><Field label="Name"><input {...bind('name')} required /></Field><div className="row"><Field label="From"><input type="date" {...bind('from')} required /></Field><Field label="To (optional)"><input type="date" {...bind('to')} /></Field></div><button className="btn">Add holiday</button></form></Card>
    <Card title="Holiday calendar"><Table head={['Holiday', 'Date', '']} rows={(list || []).map(h => [h.name, fmt(h.from) + (h.to !== h.from ? ' – ' + fmt(h.to) : ''), <button className="btn r s" onClick={async () => (await run(toast, () => api.delete('/holidays/' + h._id), 'Removed')) && load()}>✕</button>])} /></Card></div>;
}
