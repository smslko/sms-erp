import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { auth } from '../middleware/auth.js';
import { POLICY, istNow } from '../config.js';
import { notify, studentIds, staffIds } from '../notify.js';
import { User, Course, Subject, Attendance, Assignment, Submission, Notice, Leave, Timetable, Holiday, Fee } from '../models.js';

const R = Router();
const h = f => (q, r, n) => f(q, r, n).catch(n);
const STAFF = ['admin', 'hod', 'teacher'], ADM = ['admin', 'hod'], FIN = ['admin', 'accountant'];
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const classQ = u => ({ course: u.course, semester: u.semester, $or: [{ branch: u.branch || '' }, { branch: '' }] });
const mySubjects = u => u.role === 'student' ? Subject.find(classQ(u)) : ADM.includes(u.role) ? Subject.find() : Subject.find({ teacher: u._id });
const fail = (r, m, c = 400) => r.status(c).json({ message: m });
const paid = f => (f.payments || []).reduce((a, p) => a + p.amount, 0);
const bad = m => Object.assign(new Error(m), { status: 400 });
const mkUser = async b => {
  const role = b.role || 'student';
  if (role === 'student') {
    const c = await Course.findOne({ code: String(b.course || '').toUpperCase() });
    if (!c) throw bad('Unknown course. Use a code from Courses (e.g. BTECH, MBA).');
    b = { ...b, course: c.code }; const sem = Number(b.semester);
    if (!(sem >= 1 && sem <= c.years * 2)) throw bad(`Semester must be between 1 and ${c.years * 2} for ${c.code}`);
    if (b.branch && !c.branches.includes(b.branch)) throw bad(`Branch "${b.branch}" does not exist for ${c.code}`);
    if (!b.roll) throw bad('Roll number is required for students');
  }
  const username = String(b.username || b.roll || '').toLowerCase().trim();
  if (!b.name || !username) throw Object.assign(new Error('Name and username/roll are required'), { status: 400 });
  return { ...b, role, username, password: await bcrypt.hash(String(b.password || b.roll || 'Welcome@123'), 10) };
};

// ---------- Courses ----------
R.get('/courses', auth(), h(async (q, r) => r.json(await Course.find().sort('code'))));
R.post('/courses', auth('admin'), h(async (q, r) => r.json(await Course.create(q.body))));
R.put('/courses/:id', auth('admin'), h(async (q, r) => r.json(await Course.findByIdAndUpdate(q.params.id, q.body, { new: true, runValidators: true }))));
R.delete('/courses/:id', auth('admin'), h(async (q, r) => { await Course.findByIdAndDelete(q.params.id); r.json({ ok: true }); }));

// ---------- Subjects & syllabus ----------
R.get('/subjects', auth(), h(async (q, r) => {
  const u = q.user; let f = {};
  if (u.role === 'student') f = classQ(u);
  else if (!ADM.includes(u.role)) f = { teacher: u._id };
  else for (const k of ['course', 'branch', 'semester']) if (q.query[k]) f[k] = q.query[k];
  r.json(await Subject.find(f).populate('teacher', 'name').sort('course semester code'));
}));
R.post('/subjects', auth(...ADM), h(async (q, r) => r.json(await Subject.create(q.body))));
R.put('/subjects/:id', auth(...ADM), h(async (q, r) => r.json(await Subject.findByIdAndUpdate(q.params.id, q.body, { new: true }))));
R.delete('/subjects/:id', auth(...ADM), h(async (q, r) => { await Subject.findByIdAndDelete(q.params.id); r.json({ ok: true }); }));
R.put('/subjects/:id/syllabus', auth(...STAFF), h(async (q, r) => {
  const s = await Subject.findById(q.params.id);
  if (!s) return fail(r, 'Subject not found', 404);
  if (!ADM.includes(q.user.role) && String(s.teacher) !== String(q.user._id)) return fail(r, 'This subject is not assigned to you', 403);
  s.syllabus = q.body.syllabus ?? s.syllabus; s.outcomes = q.body.outcomes ?? s.outcomes; await s.save();
  notify(await studentIds(s), 'Syllabus updated: ' + s.name, 'Your teacher updated the syllabus.', '/syllabus');
  r.json(s);
}));

// ---------- Users ----------
R.get('/users', auth(...STAFF, 'accountant'), h(async (q, r) => {
  const f = { active: true };
  ['role', 'course', 'branch', 'semester', 'section'].forEach(k => q.query[k] && (f[k] = q.query[k]));
  if (q.query.q) { const re = new RegExp(esc(q.query.q), 'i'); f.$or = [{ name: re }, { roll: re }, { username: re }]; }
  r.json(await User.find(f).select('-password').sort('name').limit(500));
}));
R.post('/users', auth('admin'), h(async (q, r) => { const u = await User.create(await mkUser(q.body)); r.json({ ...u.toObject(), password: undefined }); }));
R.post('/users/bulk', auth('admin'), h(async (q, r) => {
  let ok = 0; const skipped = [];
  for (const row of (q.body.rows || []).slice(0, 1000)) {
    try { await User.create(await mkUser({ ...row, role: 'student' })); ok++; } catch (e) { skipped.push(row.roll || row.name || '?'); }
  }
  r.json({ created: ok, skipped });
}));
R.put('/users/:id', auth('admin'), h(async (q, r) => {
  const { password, username, ...rest } = q.body;
  r.json(await User.findByIdAndUpdate(q.params.id, rest, { new: true }).select('-password'));
}));
R.post('/users/:id/reset-password', auth('admin'), h(async (q, r) => {
  const u = await User.findById(q.params.id); if (!u) return fail(r, 'User not found', 404);
  const pw = q.body.password || u.roll || 'Welcome@123';
  u.password = await bcrypt.hash(String(pw), 10); await u.save(); r.json({ message: 'Password reset to ' + (q.body.password ? 'the new value' : 'roll number / Welcome@123') });
}));
R.delete('/users/:id', auth('admin'), h(async (q, r) => {
  if (String(q.user._id) === q.params.id) return fail(r, 'You cannot deactivate yourself');
  await User.findByIdAndUpdate(q.params.id, { active: false }); r.json({ ok: true });
}));

// ---------- Attendance ----------
// Rules: % = counted / total marked classes. P = present, A = absent, L = approved leave (counted as present when POLICY.leaveCountsAsPresent).
const indexDocs = docs => docs.map(d => ({ subject: String(d.subject), date: d.date, m: new Map(d.records.map(x => [String(x.student), x.status])) }));
const pctOf = (p, t) => t ? +(p / t * 100).toFixed(1) : null;
const isIn = x => x === 'P' || (x === 'L' && POLICY.leaveCountsAsPresent);
function calcFor(st, subs, docs) {
  const sid = String(st._id), months = {}, rows = [], m = POLICY.minAttendance / 100; let P = 0, T = 0;
  for (const s of subs) {
    if (s.branch && s.branch !== (st.branch || '')) continue;
    let p = 0, a = 0, l = 0;
    for (const d of docs) {
      if (d.subject !== String(s._id)) continue;
      const x = d.m.get(sid); if (!x) continue;
      x === 'P' ? p++ : x === 'L' ? l++ : a++;
      const mo = months[d.date.slice(0, 7)] ||= { present: 0, total: 0 }; mo.total++; if (isIn(x)) mo.present++;
    }
    const total = p + a + l, counted = p + (POLICY.leaveCountsAsPresent ? l : 0); P += counted; T += total;
    let canMiss = null, need = null;
    if (total) { if (counted / total >= m) canMiss = Math.max(0, Math.floor(counted / m - total + 1e-9)); else need = Math.ceil((m * total - counted) / (1 - m) - 1e-9); }
    rows.push({ subject: { _id: s._id, name: s.name, code: s.code }, present: p, absent: a, leave: l, counted, total, pct: pctOf(counted, total), canMiss, need });
  }
  const monthly = Object.keys(months).sort().map(k => ({ month: k, present: months[k].present, total: months[k].total, pct: pctOf(months[k].present, months[k].total) }));
  return { min: POLICY.minAttendance, subjects: rows, monthly, overall: { present: P, total: T, pct: pctOf(P, T) } };
}
async function calc(st) {
  const subs = await Subject.find(classQ(st)), docs = await Attendance.find({ subject: { $in: subs.map(s => s._id) } });
  return calcFor(st, subs, indexDocs(docs));
}
const ownSubject = async (u, id) => { const s = await Subject.findById(id); if (!s) return null; return ADM.includes(u.role) || String(s.teacher) === String(u._id) ? s : false; };
const withinWindow = d => (new Date(istNow().today) - new Date(d)) / 864e5 <= POLICY.editWindowDays;
const classOf = s => { const f = { role: 'student', active: true, course: s.course, semester: s.semester }; if (s.branch) f.branch = s.branch; return User.find(f).select('name roll').sort('roll'); };

R.get('/attendance/summary', auth(), h(async (q, r) => {
  const me = q.user; if (me.role !== 'student' && !STAFF.includes(me.role)) return fail(r, 'Not allowed', 403);
  const st = me.role === 'student' ? me : await User.findById(q.query.student);
  if (!st || st.role !== 'student') return fail(r, 'Student not found', 404);
  r.json({ student: { name: st.name, roll: st.roll }, ...(await calc(st)) });
}));
R.get('/attendance/sheet', auth(...STAFF), h(async (q, r) => {
  const s = await ownSubject(q.user, q.query.subject); if (s === null) return fail(r, 'Subject not found', 404); if (s === false) return fail(r, 'This subject is not assigned to you', 403);
  const slot = +q.query.slot || 1, date = q.query.date, st = await classOf(s), a = await Attendance.findOne({ subject: s._id, date, slot });
  const m = new Map((a?.records || []).map(x => [String(x.student), x.status]));
  const onLeave = new Set((await Leave.find({ status: 'Approved', from: { $lte: date }, to: { $gte: date }, student: { $in: st.map(x => x._id) } }).distinct('student')).map(String));
  r.json({ saved: !!a, editable: ADM.includes(q.user.role) || withinWindow(date), students: st.map(x => ({ _id: x._id, name: x.name, roll: x.roll, status: m.get(String(x._id)) || (onLeave.has(String(x._id)) ? 'L' : 'P') })) });
}));
R.post('/attendance', auth(...STAFF), h(async (q, r) => {
  const { subject, date } = q.body, slot = +q.body.slot || 1, s = await ownSubject(q.user, subject);
  if (s === null) return fail(r, 'Subject not found', 404); if (s === false) return fail(r, 'This subject is not assigned to you', 403);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return fail(r, 'Invalid date');
  if (date > istNow().today) return fail(r, 'You cannot mark attendance for a future date');
  if (slot < 1 || slot > 8) return fail(r, 'Period must be between 1 and 8');
  if (!ADM.includes(q.user.role) && !withinWindow(date)) return fail(r, `Attendance older than ${POLICY.editWindowDays} days can only be changed by the HOD/admin`, 403);
  const ids = new Set((await classOf(s)).map(x => String(x._id)));
  const records = (q.body.records || []).filter(x => ids.has(String(x.student)) && ['P', 'A', 'L'].includes(x.status));
  if (!records.length) return fail(r, 'No students to save');
  await Attendance.findOneAndUpdate({ subject: s._id, date, slot }, { records, markedBy: q.user._id }, { upsert: true });
  const absent = records.filter(x => x.status === 'A').map(x => String(x.student));
  if (absent.length) {
    const docs = indexDocs(await Attendance.find({ subject: s._id }));
    for (const id of absent) { let p = 0, t = 0; docs.forEach(d => { const x = d.m.get(id); if (x) { t++; if (isIn(x)) p++; } }); const pc = pctOf(p, t);
      if (pc != null && pc < POLICY.minAttendance) await notify([id], `Low attendance in ${s.name}`, `Your attendance is ${pc}% (minimum ${POLICY.minAttendance}%).`, '/attendance'); }
  }
  r.json({ message: 'Attendance saved' });
}));
R.get('/attendance/report', auth(...STAFF), h(async (q, r) => {
  const s = await ownSubject(q.user, q.query.subject); if (s === null) return fail(r, 'Subject not found', 404); if (s === false) return fail(r, 'This subject is not assigned to you', 403);
  const st = await classOf(s), docs = indexDocs(await Attendance.find({ subject: s._id }));
  r.json({ min: POLICY.minAttendance, rows: st.map(x => { let p = 0, a = 0, l = 0; docs.forEach(d => { const y = d.m.get(String(x._id)); if (y) y === 'P' ? p++ : y === 'L' ? l++ : a++; }); const t = p + a + l, c = p + (POLICY.leaveCountsAsPresent ? l : 0); return { _id: x._id, name: x.name, roll: x.roll, present: p, absent: a, leave: l, total: t, pct: pctOf(c, t) }; }) });
}));
R.get('/attendance/defaulters', auth(...STAFF), h(async (q, r) => {
  const { course, branch, semester } = q.query; if (!course || !semester) return fail(r, 'Choose course and semester');
  const sf = { role: 'student', active: true, course, semester }; if (branch) sf.branch = branch;
  const st = await User.find(sf).select('name roll branch'), subs = await Subject.find({ course, semester }), docs = indexDocs(await Attendance.find({ subject: { $in: subs.map(x => x._id) } }));
  const rows = st.map(x => { const c = calcFor(x, subs, docs).overall; return { _id: x._id, name: x.name, roll: x.roll, pct: c.pct, present: c.present, total: c.total }; }).filter(x => x.pct != null && x.pct < POLICY.minAttendance).sort((a, b) => a.pct - b.pct);
  r.json({ min: POLICY.minAttendance, rows });
}));

// ---------- Assignments ----------
R.get('/assignments', auth(), h(async (q, r) => {
  const u = q.user, subs = await mySubjects(u);
  const list = await Assignment.find({ subject: { $in: subs.map(s => s._id) } }).populate('subject', 'name code').populate('createdBy', 'name').sort('-dueDate').lean();
  if (u.role === 'student') {
    const mine = await Submission.find({ student: u._id, assignment: { $in: list.map(a => a._id) } }).lean();
    return r.json(list.map(a => ({ ...a, mine: mine.find(m => String(m.assignment) === String(a._id)) || null })));
  }
  const counts = await Promise.all(list.map(a => Submission.countDocuments({ assignment: a._id })));
  r.json(list.map((a, i) => ({ ...a, submissions: counts[i] })));
}));
R.post('/assignments', auth(...STAFF), h(async (q, r) => {
  const s = await Subject.findById(q.body.subject); if (!s) return fail(r, 'Choose a subject');
  if (!ADM.includes(q.user.role) && String(s.teacher) !== String(q.user._id)) return fail(r, 'This subject is not assigned to you', 403);
  if (!q.body.title || !q.body.dueDate) return fail(r, 'Title and due date are required');
  const a = await Assignment.create({ ...q.body, createdBy: q.user._id });
  notify(await studentIds(s), 'New assignment: ' + a.title, `${s.name} · due ${String(a.dueDate).slice(0, 10)}`, '/assignments'); r.json(a);
}));
R.delete('/assignments/:id', auth(...STAFF), h(async (q, r) => {
  const a = await Assignment.findById(q.params.id); if (!a) return fail(r, 'Not found', 404);
  if (!ADM.includes(q.user.role) && String(a.createdBy) !== String(q.user._id)) return fail(r, 'Only the creator can delete', 403);
  await Submission.deleteMany({ assignment: a._id }); await a.deleteOne(); r.json({ ok: true });
}));
R.post('/assignments/:id/submit', auth('student'), h(async (q, r) => {
  const a = await Assignment.findById(q.params.id).populate('subject'); if (!a) return fail(r, 'Not found', 404);
  if (!(await mySubjects(q.user)).some(s => String(s._id) === String(a.subject._id))) return fail(r, 'Not your subject', 403);
  const { text, link, file } = q.body; if (!text && !link && !file?.id) return fail(r, 'Write an answer, add a link or attach a file');
  const old = await Submission.findOne({ assignment: a._id, student: q.user._id });
  if (old && old.marks != null) return fail(r, 'Already graded, cannot resubmit');
  r.json(await Submission.findOneAndUpdate({ assignment: a._id, student: q.user._id }, { text, link, file: file?.id ? { id: file.id, name: file.name } : undefined, late: new Date() > a.dueDate }, { upsert: true, new: true }));
}));
R.get('/assignments/:id/submissions', auth(...STAFF), h(async (q, r) => r.json(await Submission.find({ assignment: q.params.id }).populate('student', 'name roll').sort('-createdAt'))));
R.put('/submissions/:id', auth(...STAFF), h(async (q, r) => {
  const sub = await Submission.findById(q.params.id).populate({ path: 'assignment', populate: 'subject' }); if (!sub) return fail(r, 'Not found', 404);
  const t = sub.assignment.subject.teacher;
  if (!ADM.includes(q.user.role) && String(t) !== String(q.user._id)) return fail(r, 'Not your subject', 403);
  const m = Number(q.body.marks); if (isNaN(m) || m < 0 || m > sub.assignment.maxMarks) return fail(r, 'Marks must be between 0 and ' + sub.assignment.maxMarks);
  sub.marks = m; sub.remark = q.body.remark; await sub.save();
  notify([sub.student], 'Assignment graded: ' + sub.assignment.title, `You scored ${m}/${sub.assignment.maxMarks}. ${q.body.remark || ''}`, '/assignments'); r.json(sub);
}));

// ---------- Notices ----------
R.get('/notices', auth(), h(async (q, r) => {
  const u = q.user; let f = {};
  if (u.role === 'student') f = { $and: [{ $or: [{ course: '' }, { course: u.course }] }, { $or: [{ branch: '' }, { branch: u.branch }] }, { $or: [{ semester: null }, { semester: u.semester }] }] };
  r.json(await Notice.find(f).populate('createdBy', 'name role').sort('-createdAt').limit(100));
}));
R.post('/notices', auth(...STAFF, 'accountant'), h(async (q, r) => {
  const { title, body, course = '', branch = '', semester = null } = q.body;
  if (!title || !body) return fail(r, 'Title and message are required');
  const n = await Notice.create({ title, body, course, branch, semester: semester || null, createdBy: q.user._id });
  notify(await studentIds({ course, branch, semester }), 'New notice: ' + title, body, '/notices'); r.json(n);
}));
R.delete('/notices/:id', auth(...STAFF, 'accountant'), h(async (q, r) => {
  const n = await Notice.findById(q.params.id); if (!n) return fail(r, 'Not found', 404);
  if (!ADM.includes(q.user.role) && String(n.createdBy) !== String(q.user._id)) return fail(r, 'Only the author can delete', 403);
  await n.deleteOne(); r.json({ ok: true });
}));

// ---------- Leave ----------
R.get('/leaves', auth(), h(async (q, r) => {
  const f = q.user.role === 'student' ? { student: q.user._id } : STAFF.includes(q.user.role) ? {} : null;
  if (!f) return fail(r, 'Not allowed', 403);
  r.json(await Leave.find(f).populate('student', 'name roll course branch semester').sort('-createdAt').limit(200));
}));
R.post('/leaves', auth('student'), h(async (q, r) => {
  const { type, from, to, reason } = q.body;
  if (!from || !to || to < from || !reason) return fail(r, 'Fill all fields (end date cannot be before start date)');
  const l = await Leave.create({ student: q.user._id, type, from, to, reason });
  notify(await staffIds(['admin', 'hod']), 'New leave request', `${q.user.name} · ${from} to ${to}`, '/leave'); r.json(l);
}));
R.put('/leaves/:id/review', auth(...STAFF), h(async (q, r) => {
  if (!['Approved', 'Rejected'].includes(q.body.status)) return fail(r, 'Invalid status');
  const l = await Leave.findByIdAndUpdate(q.params.id, { status: q.body.status, remark: q.body.remark, reviewedBy: q.user._id }, { new: true }); if (!l) return fail(r, 'Not found', 404);
  notify([l.student], 'Leave ' + q.body.status.toLowerCase(), `${l.from} to ${l.to}. ${q.body.remark || ''}`, '/leave'); r.json(l);
}));

// ---------- Timetable & holidays ----------
R.get('/timetable', auth(), h(async (q, r) => {
  const u = q.user; let f = {};
  if (u.role === 'student') { f = { course: u.course, semester: u.semester, $and: [{ $or: [{ branch: u.branch || '' }, { branch: '' }] }, { $or: [{ section: u.section || '' }, { section: '' }] }] }; }
  else if (u.role === 'teacher') f = { subject: { $in: (await Subject.find({ teacher: u._id })).map(s => s._id) } };
  else ['course', 'branch', 'semester', 'section'].forEach(k => q.query[k] && (f[k] = q.query[k]));
  r.json(await Timetable.find(f).populate('subject', 'name code').sort('day start'));
}));
R.post('/timetable', auth(...ADM), h(async (q, r) => {
  const b = q.body; if (!b.course || !b.semester || !b.subject || !b.start || !b.end || b.day === '' || b.day == null) return fail(r, 'Course, semester, subject, day and time are required');
  if (b.end <= b.start) return fail(r, 'End time must be after start time');
  const t = await Timetable.create(b); notify(await studentIds(b), 'Timetable updated', 'A period was added to your class timetable.', '/timetable'); r.json(t);
}));
R.delete('/timetable/:id', auth(...ADM), h(async (q, r) => { await Timetable.findByIdAndDelete(q.params.id); r.json({ ok: true }); }));
R.get('/holidays', auth(), h(async (q, r) => r.json(await Holiday.find().sort('from'))));
R.post('/holidays', auth('admin'), h(async (q, r) => r.json(await Holiday.create({ ...q.body, to: q.body.to || q.body.from }))));
R.delete('/holidays/:id', auth('admin'), h(async (q, r) => { await Holiday.findByIdAndDelete(q.params.id); r.json({ ok: true }); }));

// ---------- Fees (record keeping only) ----------
R.get('/fees', auth(), h(async (q, r) => {
  const u = q.user; let f = {};
  if (u.role === 'student') f = { student: u._id };
  else if (FIN.includes(u.role)) {
    const sf = { role: 'student', active: true }; ['course', 'branch', 'semester'].forEach(k => q.query[k] && (sf[k] = q.query[k]));
    if (q.query.q) { const re = new RegExp(esc(q.query.q), 'i'); sf.$or = [{ name: re }, { roll: re }]; }
    f = { student: { $in: (await User.find(sf).select('_id').limit(500)).map(s => s._id) } };
  } else return fail(r, 'Not allowed', 403);
  const list = await Fee.find(f).populate('student', 'name roll course branch semester').sort('-createdAt').limit(500).lean();
  r.json(list.map(x => ({ ...x, paid: paid(x), due: x.amount - paid(x) })));
}));
R.post('/fees', auth(...FIN), h(async (q, r) => {
  const { title, amount, dueDate, student, course, branch, semester } = q.body;
  if (!title || !(Number(amount) > 0)) return fail(r, 'Title and a valid amount are required');
  let ids = [];
  if (student) ids = [student];
  else { if (!course) return fail(r, 'Choose a student or a course'); const sf = { role: 'student', active: true, course }; if (branch) sf.branch = branch; if (semester) sf.semester = semester; ids = (await User.find(sf).select('_id')).map(s => s._id); }
  if (!ids.length) return fail(r, 'No students match this selection');
  await Fee.insertMany(ids.map(id => ({ student: id, title, amount: Number(amount), dueDate })));
  notify(ids, 'New fee: ' + title, `₹${Number(amount)}${dueDate ? ' · due ' + dueDate : ''}`, '/fees');
  r.json({ message: `Fee added for ${ids.length} student(s)` });
}));
R.post('/fees/:id/payment', auth(...FIN), h(async (q, r) => {
  const f = await Fee.findById(q.params.id); if (!f) return fail(r, 'Not found', 404);
  const amt = Number(q.body.amount), due = f.amount - paid(f);
  if (!(amt > 0) || amt > due) return fail(r, `Amount must be between 1 and ${due}`);
  f.payments.push({ amount: amt, mode: q.body.mode || 'Cash', note: q.body.note, receiptNo: 'RCP' + Date.now().toString().slice(-8), by: q.user._id });
  await f.save(); notify([f.student], 'Payment received', `₹${amt} for ${f.title}. Receipt ${f.payments.at(-1).receiptNo}`, '/fees'); r.json({ message: 'Payment recorded', receiptNo: f.payments.at(-1).receiptNo });
}));
R.delete('/fees/:id', auth('admin'), h(async (q, r) => { await Fee.findByIdAndDelete(q.params.id); r.json({ ok: true }); }));

// ---------- Dashboard ----------
R.get('/dashboard', auth(), h(async (q, r) => {
  const u = q.user, { day, today } = istNow();
  const holidays = (await Holiday.find({ to: { $gte: today } }).sort('from').limit(5)).map(x => ({ name: x.name, from: x.from, to: x.to }));
  if (u.role === 'student') {
    const cs = await calc(u);
    const subs = await mySubjects(u), asg = await Assignment.find({ subject: { $in: subs.map(s => s._id) }, dueDate: { $gte: new Date() } }).select('_id');
    const done = await Submission.countDocuments({ student: u._id, assignment: { $in: asg.map(a => a._id) } });
    const fees = await Fee.find({ student: u._id }).lean(), due = fees.reduce((a, f) => a + f.amount - paid(f), 0);
    const tt = await Timetable.find({ course: u.course, semester: u.semester, day, $and: [{ $or: [{ branch: u.branch || '' }, { branch: '' }] }, { $or: [{ section: u.section || '' }, { section: '' }] }] }).populate('subject', 'name').sort('start');
    return r.json({ role: 'student', attendance: cs.overall.pct, min: cs.min, subjects: cs.subjects, pendingAssignments: asg.length - done, feesDue: due, today: tt, holidays });
  }
  const subs = await mySubjects(u), pend = await Leave.countDocuments({ status: 'Pending' });
  const base = { role: u.role, holidays, students: await User.countDocuments({ role: 'student', active: true }), pendingLeaves: pend, subjects: subs.length, assignments: await Assignment.countDocuments(ADM.includes(u.role) ? {} : { subject: { $in: subs.map(s => s._id) } }) };
  if (u.role === 'teacher') base.today = await Timetable.find({ day, subject: { $in: subs.map(s => s._id) } }).populate('subject', 'name').sort('start');
  if (FIN.includes(u.role)) { const all = await Fee.find().lean(); base.feeTotal = all.reduce((a, f) => a + f.amount, 0); base.feeCollected = all.reduce((a, f) => a + paid(f), 0); }
  r.json(base);
}));

export default R;
