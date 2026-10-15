import { useState } from 'react';
import api, { err } from '../api';
import { useAuth } from '../App';
import { COLLEGE } from '../college';
import { useGet, useForm, useToast, Card, Table, Field, Modal, Badge, ClassPicker, FileInput, FileLink, AuthImg, printDoc, letterhead, esc, kb, fmt, inr } from '../ui';

const isStaff = r => ['admin', 'hod', 'teacher'].includes(r);
const run = async (toast, fn, ok) => { try { const r = await fn(); toast(ok || r?.data?.message || 'Saved'); return true; } catch (e) { toast(err(e), true); return false; } };

// ---------------- Notices ----------------
export function Notices() {
  const { user } = useAuth(), toast = useToast(), canPost = user.role !== 'student', [list, load] = useGet('/notices'), [courses] = useGet('/courses');
  const [add, setAdd] = useState(false), [f, bind, setF] = useForm({});
  const post = async e => { e.preventDefault(); if (await run(toast, () => api.post('/notices', f), 'Notice sent to students')) { setAdd(false); setF({}); load(); } };
  return <>
    <Card title="Notices & circulars" right={canPost && <button className="btn" onClick={() => setAdd(true)}>+ Post notice</button>}>
      {list?.map(n => <div className="item" key={n._id}><b>{n.title}</b> <span className="bd">{fmt(n.createdAt)}</span>
        <span className="mut"> by {n.createdBy?.name}{n.course ? ` · ${n.course}${n.branch ? ' ' + n.branch : ''}${n.semester ? ' S' + n.semester : ''}` : ' · Everyone'}</span>
        <div className="pre">{n.body}</div>{canPost && (['admin', 'hod'].includes(user.role) || n.createdBy?._id === user._id) && <button className="btn r s" onClick={async () => (await run(toast, () => api.delete('/notices/' + n._id), 'Deleted')) && load()}>Delete</button>}</div>)}
      {!list?.length && <p className="empty">No notices yet.</p>}</Card>
    <Modal open={add} onClose={() => setAdd(false)} title="Post notice"><form onSubmit={post}>
      <Field label="Title"><input {...bind('title')} required /></Field><Field label="Message"><textarea {...bind('body')} required /></Field>
      <p className="mut">Leave the audience empty to send to every student.</p><div className="row"><ClassPicker f={f} bind={bind} set={setF} courses={courses} all /></div>
      <button className="btn">Send notice</button></form></Modal>
  </>;
}

// ---------------- Leave ----------------
export function Leave() {
  const { user } = useAuth(), toast = useToast(), staff = isStaff(user.role), [list, load] = useGet('/leaves'), [f, bind, setF] = useForm({ type: 'Medical' });
  const apply = async e => { e.preventDefault(); if (await run(toast, () => api.post('/leaves', f), 'Leave request sent')) { setF({ type: 'Medical' }); load(); } };
  const review = async (l, status) => { const remark = prompt(status + ' – add a remark (optional)') ?? ''; if (await run(toast, () => api.put(`/leaves/${l._id}/review`, { status, remark }), status)) load(); };
  return <>
    {!staff && <Card title="Apply for leave"><form onSubmit={apply}><div className="row">
      <Field label="Type"><select {...bind('type')}><option>Medical</option><option>Casual</option><option>Emergency</option></select></Field>
      <Field label="From"><input type="date" {...bind('from')} required /></Field><Field label="To"><input type="date" {...bind('to')} required /></Field></div>
      <Field label="Reason"><textarea {...bind('reason')} required /></Field><button className="btn">Send request</button></form></Card>}
    <Card title={staff ? 'Leave requests' : 'My leave history'}>
      <Table head={[...(staff ? ['Student'] : []), 'Type', 'Dates', 'Reason', 'Status', staff ? '' : 'Remark']} empty="No leave requests."
        rows={(list || []).map(l => [...(staff ? [<>{l.student?.name}<div className="mut">{l.student?.roll} · {l.student?.course}</div></>] : []), l.type, `${fmt(l.from)} – ${fmt(l.to)}`, l.reason, <Badge s={l.status} />,
          staff ? (l.status === 'Pending' ? <><button className="btn g s" onClick={() => review(l, 'Approved')}>Approve</button> <button className="btn r s" onClick={() => review(l, 'Rejected')}>Reject</button></> : l.remark) : l.remark])} /></Card>
  </>;
}

// ---------------- Fees (records only) ----------------
export function Fees() {
  const { user } = useAuth();
  return user.role === 'student' ? <MyFees /> : ['admin', 'accountant'].includes(user.role) ? <FeeDesk /> : <p className="empty">You do not have access to fees.</p>;
}
const Rcpts = ({ fee, student }) => fee.payments.map(p => <button key={p.receiptNo} className="btn o s" onClick={() => printDoc('Receipt', `${letterhead(COLLEGE)}<h3 style="text-align:center">FEE RECEIPT</h3><div class="kv"><div><b>Receipt no.:</b> ${esc(p.receiptNo)}</div><div><b>Date:</b> ${fmt(p.date)}</div><div><b>Student:</b> ${esc(student.name)}</div><div><b>Roll:</b> ${esc(student.roll)}</div><div><b>Fee:</b> ${esc(fee.title)}</div><div><b>Mode:</b> ${esc(p.mode)}</div></div><table><tr><th>Amount received</th><td>${inr(p.amount)}</td></tr><tr><th>Current balance due on this fee</th><td>${inr(fee.due)}</td></tr></table><p class="note">Computer generated receipt.</p><div class="sig"><span></span><span>Accounts office</span></div>`)}>🖨 {p.receiptNo}</button>);
const status = f => f.due <= 0 ? 'Paid' : f.paid > 0 ? 'Partial' : 'Due';
function MyFees() {
  const { user } = useAuth(), [list] = useGet('/fees'), due = (list || []).reduce((a, f) => a + f.due, 0);
  return <><div className="stats"><div className="stat clay"><b>{inr(due)}</b><span>Total due</span></div></div>
    <Card title="My fees"><p className="mut">Payments are recorded by the accounts office. Pay at the college counter and keep your receipt number.</p>
      <Table head={['Fee', 'Amount', 'Paid', 'Due', 'Due date', 'Status', 'Receipts']} empty="No fees assigned yet." rows={(list || []).map(f => [f.title, inr(f.amount), inr(f.paid), inr(f.due), fmt(f.dueDate), <Badge s={status(f)} />, <Rcpts fee={f} student={user} />])} /></Card></>;
}
function FeeDesk() {
  const { user } = useAuth(), toast = useToast(), [courses] = useGet('/courses'), [flt, fb, setFlt] = useForm({}), [list, load] = useGet('/fees', flt);
  const [add, setAdd] = useState(false), [f, bind, setF] = useForm({}), [pay, setPay] = useState(null), [pf, pbind, setPf] = useForm({ mode: 'Cash' });
  const create = async e => { e.preventDefault(); if (await run(toast, () => api.post('/fees', f))) { setAdd(false); setF({}); load(); } };
  const record = async e => { e.preventDefault(); if (await run(toast, () => api.post(`/fees/${pay._id}/payment`, pf))) { setPay(null); setPf({ mode: 'Cash' }); load(); } };
  const tot = (list || []).reduce((a, x) => ({ amt: a.amt + x.amount, paid: a.paid + x.paid }), { amt: 0, paid: 0 });
  return <>
    <div className="stats"><div className="stat clay"><b>{inr(tot.amt)}</b><span>Billed (filtered)</span></div><div className="stat clay"><b>{inr(tot.paid)}</b><span>Collected</span></div><div className="stat clay"><b>{inr(tot.amt - tot.paid)}</b><span>Outstanding</span></div></div>
    <Card title="Fee records" right={<button className="btn" onClick={() => setAdd(true)}>+ Add fee</button>}>
      <div className="row"><ClassPicker f={flt} bind={fb} set={setFlt} courses={courses} all /><Field label="Search name / roll"><input {...fb('q')} /></Field></div>
      <Table head={['Student', 'Fee', 'Amount', 'Paid', 'Due', 'Status', '']} empty="No fee records for this filter." rows={(list || []).map(x => [<>{x.student?.name}<div className="mut">{x.student?.roll} · {x.student?.course} S{x.student?.semester}</div></>, x.title, inr(x.amount), inr(x.paid), inr(x.due), <Badge s={status(x)} />,
        <><Rcpts fee={x} student={x.student} />{x.due > 0 && <button className="btn g s" onClick={() => { setPay(x); setPf({ mode: 'Cash', amount: x.due }); }}>Record payment</button>} {user.role === 'admin' && <button className="btn r s" onClick={async () => confirm('Delete this fee record?') && (await run(toast, () => api.delete('/fees/' + x._id), 'Deleted')) && load()}>✕</button>}</>])} /></Card>
    <Modal open={add} onClose={() => setAdd(false)} title="Add fee for a class"><form onSubmit={create}>
      <Field label="Fee title"><input {...bind('title')} placeholder="Tuition Fee – Sem 3" required /></Field>
      <div className="row"><Field label="Amount (₹)"><input type="number" min="1" {...bind('amount')} required /></Field><Field label="Due date"><input type="date" {...bind('dueDate')} /></Field></div>
      <div className="row"><ClassPicker f={f} bind={bind} set={setF} courses={courses} /></div><p className="mut">Added for every active student in the selected course / branch / semester.</p><button className="btn">Add fee</button></form></Modal>
    <Modal open={!!pay} onClose={() => setPay(null)} title={'Record payment: ' + (pay?.student?.name || '')}><form onSubmit={record}>
      <p className="mut">{pay?.title} · Due {inr(pay?.due)}</p><div className="row"><Field label="Amount (₹)"><input type="number" min="1" max={pay?.due} {...pbind('amount')} required /></Field>
        <Field label="Mode"><select {...pbind('mode')}><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Cheque</option><option>DD</option></select></Field></div>
      <Field label="Note / reference no."><input {...pbind('note')} /></Field><button className="btn g">Save payment</button></form></Modal>
  </>;
}

// ---------------- Profile ----------------
export function Profile() {
  const { user, setUser } = useAuth(), toast = useToast(), [f, bind, setF] = useForm({}), [docs, loadDocs] = useGet('/files', { kind: 'document' }), [lab, setLab] = useState('');
  const change = async e => { e.preventDefault(); if (f.next !== f.again) return toast('New passwords do not match', true); if (await run(toast, () => api.post('/auth/change-password', f), 'Password updated')) setF({}); };
  const photo = async file => { if (file && await run(toast, () => api.put('/me/photo', { file: file.id }), 'Photo updated')) setUser((await api.get('/auth/me')).data); };
  return <div className="grid"><Card title="My profile"><div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12 }}><AuthImg id={user.photo} style={{ width: 90, height: 112, objectFit: 'cover', borderRadius: 18 }} /><FileInput kind="photo" label="Profile photo (JPG/PNG, max 5 MB)" onDone={photo} accept="image/*" /></div>
    <Table head={['Field', 'Value']} rows={[['Name', user.name], ['Username', user.username], ['Role', user.role], ...(user.roll ? [['Roll no.', user.roll]] : []), ...(user.course ? [['Course', user.course + (user.branch ? ' · ' + user.branch : '')], ['Semester', user.semester], ['Section', user.section || '–']] : []), ['Phone', user.phone || '–']]} /></Card>
    <Card title="Change password"><form onSubmit={change}><Field label="Current password"><input type="password" {...bind('current')} required /></Field><Field label="New password (min 6)"><input type="password" {...bind('next')} required minLength={6} /></Field>
      <Field label="Repeat new password"><input type="password" {...bind('again')} required /></Field><button className="btn">Update password</button></form></Card>
    <Card title="My documents"><p className="mut">Visible only to you and the admin/HOD office. Do not upload anything you are not asked for.</p>
      <Field label="Document name"><input value={lab} onChange={e => setLab(e.target.value)} placeholder="e.g. 12th marksheet" /></Field>
      <FileInput kind="document" label="Choose file (PDF/image, max 5 MB)" fields={{ label: lab }} onDone={file => { if (file) { setLab(''); loadDocs(); } }} />
      <Table head={['Document', 'Size', '']} empty="No documents uploaded." rows={(docs || []).map(d => [<FileLink f={{ id: d._id, name: d.label ? d.label + ' – ' + d.name : d.name }} />, kb(d.size), <button className="btn r s" onClick={async () => (await run(toast, () => api.delete('/files/' + d._id), 'Deleted')) && loadDocs()}>Delete</button>])} /></Card></div>;
}
