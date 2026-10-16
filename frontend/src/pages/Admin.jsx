import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
const ROLES = [['student', 'Students'], ['teacher', 'Teachers'], ['hod', 'HODs'], ['accountant', 'Accountants'], ['admin', 'Admins']];
const ONE = { student: 'student', teacher: 'teacher', hod: 'HOD', accountant: 'accountant', admin: 'admin' };
const TEMPLATE = { student: 'name,roll,course,branch,semester,section,phone\nAman Verma,2504230100010,BTECH,CSE,3,A,9876543210\n', teacher: 'name,username,phone,email\nRaj Sharma,raj.sharma,9876543210,raj@example.com\n' };
function parseCsv(text) {
  return text.replace(/\r/g, '').split('\n').filter(l => l.trim()).map(line => { const out = []; let cur = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; } else cur += ch; } out.push(cur.trim()); return out; });
}
function toRows(role, text) {
  let rows = parseCsv(text); if (rows.length && /^name$/i.test(rows[0][0])) rows = rows.slice(1);
  return rows.filter(r => r[0]).map(r => role === 'student'
    ? { name: r[0], roll: r[1], course: (r[2] || '').toUpperCase(), branch: r[3] || '', semester: +r[4] || undefined, section: r[5] || '', phone: r[6] || '' }
    : { name: r[0], username: r[1] || r[0].toLowerCase().replace(/[^a-z0-9]+/g, '.'), phone: r[2] || '', email: r[3] || '' });
}
function saveTemplate(role) { const u = URL.createObjectURL(new Blob([TEMPLATE[role]], { type: 'text/csv' })), a = document.createElement('a'); a.href = u; a.download = role + '-import-template.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); }

export function Users() {
  const { user } = useAuth(), toast = useToast(), [sp] = useSearchParams(), manage = ['admin', 'hod'].includes(user.role);
  const tabs = ROLES.filter(([k]) => user.role === 'admin' || ['student', 'teacher'].includes(k)), want = sp.get('role');
  const [courses] = useGet('/courses'), [flt, fb, setFlt] = useForm({ role: manage && tabs.some(t => t[0] === want) ? want : 'student' }), [list, load] = useGet('/users', flt);
  const role = flt.role, isStu = role === 'student';
  const [m, setM] = useState(false), [f, bind, setF] = useForm({}), [bulk, setBulk] = useState(false), [csv, setCsv] = useState(''), [res, setRes] = useState(null);
  const [ph, setPh] = useState(null), [dc, setDc] = useState(null), [at, setAt] = useState(null), [cred, setCred] = useState(null);
  const [atd] = useGet('/attendance/summary', { student: at?._id }, !at), [docs] = useGet('/files', { owner: dc?._id, kind: 'document' }, !dc);
  const open = u => { setF(u ? { ...u } : { role }); setM(true); };
  const save = async e => {
    e.preventDefault();
    try {
      if (f._id) { await api.put('/users/' + f._id, { name: f.name, phone: f.phone, email: f.email, course: f.course, branch: f.branch, semester: f.semester, section: f.section }); toast('Changes saved'); }
      else { const r = await api.post('/users', { ...f, role }); setCred({ name: r.data.name, ...r.data.login }); }
      setM(false); load();
    } catch (x) { toast(err(x), true); }
  };
  const reset = async u => { if (!confirm(`Reset the password of ${u.name} to the common default password?`)) return; try { const r = await api.post(`/users/${u._id}/reset-password`, {}); setCred({ name: u.name, ...r.data.login, reset: true }); } catch (x) { toast(err(x), true); } };
  const doBulk = async () => { const rows = toRows(role, csv); if (!rows.length) return toast('Paste or upload at least one row', true); try { const r = await api.post('/users/bulk', { role, rows }); setRes(r.data); setCsv(''); load(); } catch (x) { toast(err(x), true); } };
  const pickFile = e => { const file = e.target.files[0]; if (!file) return; const fr = new FileReader(); fr.onload = () => setCsv(String(fr.result)); fr.readAsText(file); e.target.value = ''; };
  const copy = t => navigator.clipboard ? navigator.clipboard.writeText(t).then(() => toast('Copied')) : toast('Copy not supported here', true);
  const title = manage ? ROLES.find(r => r[0] === role)[1] : 'Students';
  return <>
    <Card title={title} right={manage && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{['student', 'teacher'].includes(role) && <button className="btn o" onClick={() => { setRes(null); setBulk(true); }}>⬆ Bulk import</button>}<button className="btn" onClick={() => open()}>+ Add {ONE[role]}</button></div>}>
      {manage && <div className="seg" role="tablist">{tabs.map(([k, l]) => <button key={k} type="button" className={role === k ? 'on' : ''} onClick={() => setFlt({ ...flt, role: k, q: '' })}>{l}</button>)}</div>}
      {manage && <p className="mut">Login ID: {isStu ? 'roll number' : 'username'}. New accounts get the common default password (admin can change it in Settings). Users may keep it or change it from their Profile.</p>}
      <div className="row">{isStu && <ClassPicker f={flt} bind={fb} set={setFlt} courses={courses} all />}<Field label="Search"><input {...fb('q')} placeholder="Name or roll / username" /></Field></div>
      <Table head={isStu ? ['Roll', 'Name', 'Class', 'Phone', ''] : ['Name', 'Username', 'Phone', '']} empty={`No ${title.toLowerCase()} found.${manage ? ' Use the Add or Bulk import button.' : ''}`}
        rows={(list || []).map(u => {
          const act = <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {isStu && <button className="btn o s" onClick={() => setAt(u)}>Attendance</button>}
            {manage && <><button className="btn o s" onClick={() => open(u)}>Edit</button>
              {isStu && <><button className="btn o s" onClick={() => setPh(u)}>Photo</button><button className="btn o s" onClick={() => setDc(u)}>Docs</button></>}
              <button className="btn y s" onClick={() => reset(u)}>Reset password</button>
              <button className="btn r s" onClick={async () => confirm('Deactivate ' + u.name + '? They will not be able to log in.') && (await run(toast, () => api.delete('/users/' + u._id), 'Deactivated')) && load()}>Deactivate</button></>}</div>;
          return isStu ? [u.roll, u.name, `${u.course}${u.branch ? ' · ' + u.branch : ''} · Sem ${u.semester}${u.section ? ' · ' + u.section : ''}`, u.phone || '–', act] : [u.name, u.username, u.phone || '–', act];
        })} /></Card>

    <Modal open={m} onClose={() => setM(false)} title={f._id ? 'Edit ' + ONE[f.role || role] : 'Add ' + ONE[role]}><form onSubmit={save}>
      <div className="row"><Field label="Full name"><input {...bind('name')} required /></Field>
        {!f._id && <Field label={isStu ? 'Roll number (login ID)' : 'Username (login ID)'}><input {...bind(isStu ? 'roll' : 'username')} required /></Field>}</div>
      <div className="row"><Field label="Phone"><input {...bind('phone')} /></Field><Field label="Email (optional)"><input type="email" {...bind('email')} /></Field></div>
      {(isStu || f.role === 'student') && <><div className="row"><ClassPicker f={f} bind={bind} set={setF} courses={courses} /></div><Field label="Section (optional)"><input {...bind('section')} placeholder="A" /></Field></>}
      {!f._id && <Field label="Password (optional)"><input {...bind('password')} placeholder="Leave blank to use the common default password" /></Field>}
      <button className="btn">{f._id ? 'Save changes' : 'Create account'}</button></form></Modal>

    <Modal open={!!cred} onClose={() => setCred(null)} title={cred?.reset ? 'Password reset' : 'Account created'}>
      <p>Give these login details to <b>{cred?.name}</b>:</p>
      <div className="cred"><div className="mut">Login ID</div><code>{cred?.username}</code><div className="mut" style={{ marginTop: 8 }}>Password</div><code>{cred?.password}</code></div>
      <p className="mut">They can keep this password or change it from Profile at any time.</p>
      <button className="btn" onClick={() => copy(`Login ID: ${cred.username}\nPassword: ${cred.password}`)}>Copy login details</button></Modal>

    <Modal open={bulk} onClose={() => setBulk(false)} title={`Bulk import ${role === 'student' ? 'students' : 'teachers'}`}>
      {!res ? <>
        <p className="mut">One person per line (CSV). {role === 'student' ? 'Columns: name, roll, course, branch, semester, section, phone.' : 'Columns: name, username, phone, email.'} Using Excel? Save the sheet as CSV first. Everyone gets the common default password.</p>
        {role === 'student' && <p className="mut">Course codes: {(courses || []).map(c => c.code).join(', ')}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}><button className="btn o s" onClick={() => saveTemplate(role)}>⬇ Download template</button><input type="file" accept=".csv,text/csv,text/plain" onChange={pickFile} style={{ flex: 1, minWidth: 180 }} /></div>
        <textarea style={{ minHeight: 160 }} value={csv} onChange={e => setCsv(e.target.value)} placeholder={TEMPLATE[role]} />
        <button className="btn" style={{ marginTop: 12 }} onClick={doBulk} disabled={!csv.trim()}>Import</button></> :
        <><p><b className="ok">{res.created}</b> account(s) created. Common password: <code>{res.password}</code></p>
          {res.skipped.length > 0 && <><p className="no">{res.skipped.length} row(s) skipped:</p><Table head={['Row', 'Reason']} rows={res.skipped.map(x => [x.row, x.reason])} /></>}
          <button className="btn" style={{ marginTop: 12 }} onClick={() => { setBulk(false); setRes(null); }}>Done</button></>}</Modal>

    <Modal open={!!at} onClose={() => setAt(null)} title={'Attendance: ' + (at?.name || '')}>{atd ? <AttendanceView d={atd} /> : <p className="empty">Loading…</p>}</Modal>
    <Modal open={!!ph} onClose={() => setPh(null)} title={'Photo: ' + (ph?.name || '')}><FileInput kind="photo" label="Choose photo (JPG/PNG/WebP, max 5 MB)" accept="image/*" onDone={async file => { if (file && await run(toast, () => api.put('/users/' + ph._id, { photo: file.id }), 'Photo saved')) { setPh(null); load(); } }} /></Modal>
    <Modal open={!!dc} onClose={() => setDc(null)} title={'Documents: ' + (dc?.name || '')}><Table head={['Document', 'Size']} empty="No documents uploaded." rows={(docs || []).map(d => [<FileLink f={{ id: d._id, name: d.label ? d.label + ' – ' + d.name : d.name }} />, kb(d.size)])} /></Modal>
  </>;
}

// ---------------- Settings ----------------
export function Settings() {
  const toast = useToast(), [s, load] = useGet('/settings'), [pw, setPw] = useState(null);
  const val = pw ?? s?.defaultPassword ?? '';
  return <Card title="Common default password"><p>Every student and teacher created by the admin or HOD (single add, bulk import or password reset) gets this password. They can keep it or change it from their Profile.</p>
    <p className="mut">Tip: anyone who knows this password can sign in to accounts that still use it, so ask people to change it. Changing it here does not affect accounts that already have a password of their own.</p>
    <Field label="Default password (min 6 characters)"><input value={val} onChange={e => setPw(e.target.value)} /></Field>
    <button className="btn" onClick={async () => { if (await run(toast, () => api.put('/settings', { defaultPassword: val }), 'Default password updated')) { setPw(null); load(); } }}>Save</button></Card>;
}

// ---------------- Holidays ----------------
export function Holidays() {
  const toast = useToast(), [list, load] = useGet('/holidays'), [f, bind, setF] = useForm({});
  const add = async e => { e.preventDefault(); if (await run(toast, () => api.post('/holidays', f), 'Holiday added')) { setF({}); load(); } };
  return <div className="grid"><Card title="Add holiday"><form onSubmit={add}><Field label="Name"><input {...bind('name')} required /></Field><div className="row"><Field label="From"><input type="date" {...bind('from')} required /></Field><Field label="To (optional)"><input type="date" {...bind('to')} /></Field></div><button className="btn">Add holiday</button></form></Card>
    <Card title="Holiday calendar"><Table head={['Holiday', 'Date', '']} rows={(list || []).map(h => [h.name, fmt(h.from) + (h.to !== h.from ? ' – ' + fmt(h.to) : ''), <button className="btn r s" onClick={async () => (await run(toast, () => api.delete('/holidays/' + h._id), 'Removed')) && load()}>✕</button>])} /></Card></div>;
}
