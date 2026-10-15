import { Router } from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import { User, Subject, File, Material, Mark, Exam, EXAMS } from '../models.js';
import { notify, studentIds } from '../notify.js';

const R = Router();
const h = f => (q, r, n) => f(q, r, n).catch(n);
const STAFF = ['admin', 'hod', 'teacher'], ADM = ['admin', 'hod'];
const fail = (r, m, c = 400) => r.status(c).json({ message: m });
const classQ = u => ({ course: u.course, semester: u.semester, $or: [{ branch: u.branch || '' }, { branch: '' }] });
const mySubjects = u => u.role === 'student' ? Subject.find(classQ(u)) : ADM.includes(u.role) ? Subject.find() : Subject.find({ teacher: u._id });
// null = subject missing, false = not yours, doc = ok
const own = async (u, id) => { const s = await Subject.findById(id); if (!s) return null; return ADM.includes(u.role) || String(s.teacher) === String(u._id) ? s : false; };
const guard = (r, s) => s === null ? fail(r, 'Subject not found', 404) : s === false ? fail(r, 'This subject is not assigned to you', 403) : null;
const classStudents = s => { const f = { role: 'student', active: true, course: s.course, semester: s.semester }; if (s.branch) f.branch = s.branch; return User.find(f).select('name roll').sort('roll'); };

// ---------- Files (stored in MongoDB, 5 MB max) ----------
const up = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const single = (q, r, n) => up.single('file')(q, r, e => e ? fail(r, e.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 5 MB)' : e.message) : n());
const OK = /^(application\/(pdf|zip|msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|presentationml\.presentation|spreadsheetml\.sheet)|vnd\.ms-(powerpoint|excel))|image\/(png|jpe?g|webp)|text\/plain)$/;
R.post('/files', auth(), single, h(async (q, r) => {
  const f = q.file, kind = q.body.kind;
  if (!f) return fail(r, 'Choose a file first');
  if (!OK.test(f.mimetype)) return fail(r, 'File type not allowed. Use PDF, Word, PowerPoint, Excel, ZIP, text or an image.');
  if (!['assignment', 'submission', 'material', 'photo', 'document'].includes(kind)) return fail(r, 'Invalid upload type');
  if (['assignment', 'material'].includes(kind) && !STAFF.includes(q.user.role)) return fail(r, 'Only teachers can upload this', 403);
  if (kind === 'photo' && !/^image\//.test(f.mimetype)) return fail(r, 'Photo must be an image (JPG, PNG or WebP)');
  const d = await File.create({ name: f.originalname.slice(0, 120), mime: f.mimetype, size: f.size, data: f.buffer, owner: q.user._id, kind, label: (q.body.label || '').slice(0, 80) });
  r.json({ _id: d._id, name: d.name, size: d.size, kind, label: d.label });
}));
R.get('/files', auth(), h(async (q, r) => {
  const owner = q.query.owner || q.user._id;
  if (String(owner) !== String(q.user._id) && !ADM.includes(q.user.role)) return fail(r, 'Not allowed', 403);
  r.json(await File.find({ owner, kind: q.query.kind || 'document' }).sort('-createdAt'));
}));
R.get('/files/:id', auth(), h(async (q, r) => {
  const f = await File.findById(q.params.id).select('+data'); if (!f) return fail(r, 'File not found', 404);
  const me = String(f.owner) === String(q.user._id);
  if (f.kind === 'document' && !me && !ADM.includes(q.user.role)) return fail(r, 'Not allowed', 403);
  if (f.kind === 'submission' && !me && !STAFF.includes(q.user.role)) return fail(r, 'Not allowed', 403);
  r.set({ 'Content-Type': f.mime, 'Content-Disposition': `${/^image\//.test(f.mime) ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`, 'Cache-Control': 'private, max-age=3600' });
  r.send(f.data);
}));
R.delete('/files/:id', auth(), h(async (q, r) => {
  const f = await File.findById(q.params.id); if (!f) return fail(r, 'File not found', 404);
  if (String(f.owner) !== String(q.user._id) && !ADM.includes(q.user.role)) return fail(r, 'Not allowed', 403);
  await f.deleteOne(); r.json({ ok: true });
}));
R.put('/me/photo', auth(), h(async (q, r) => {
  const f = await File.findOne({ _id: q.body.file, kind: 'photo', owner: q.user._id }); if (!f) return fail(r, 'Upload a photo first');
  await User.findByIdAndUpdate(q.user._id, { photo: f._id }); r.json({ ok: true });
}));

// ---------- Study material ----------
R.get('/materials', auth(), h(async (q, r) => {
  const subs = await mySubjects(q.user), f = { subject: { $in: subs.map(s => s._id) } };
  if (q.query.subject) f.subject = q.query.subject;
  r.json(await Material.find(f).populate('subject', 'name code').populate('createdBy', 'name').sort('-createdAt').limit(300));
}));
R.post('/materials', auth(...STAFF), h(async (q, r) => {
  const s = await own(q.user, q.body.subject); if (guard(r, s) !== null) return;
  const { title, description, link, file } = q.body; if (!title) return fail(r, 'Title is required'); if (!link && !file?.id) return fail(r, 'Attach a file or add a link');
  const m = await Material.create({ subject: s._id, title, description, link, file: file?.id ? { id: file.id, name: file.name } : undefined, createdBy: q.user._id });
  notify(await studentIds(s), 'New study material: ' + title, s.name, '/materials'); r.json(m);
}));
R.delete('/materials/:id', auth(...STAFF), h(async (q, r) => {
  const m = await Material.findById(q.params.id); if (!m) return fail(r, 'Not found', 404);
  if (!ADM.includes(q.user.role) && String(m.createdBy) !== String(q.user._id)) return fail(r, 'Only the uploader can delete', 403);
  if (m.file?.id) await File.findByIdAndDelete(m.file.id); await m.deleteOne(); r.json({ ok: true });
}));

// ---------- Internal marks ----------
R.get('/marks/sheet', auth(...STAFF), h(async (q, r) => {
  const s = await own(q.user, q.query.subject); if (guard(r, s) !== null) return;
  if (!EXAMS.includes(q.query.exam)) return fail(r, 'Choose an exam');
  const st = await classStudents(s), ms = await Mark.find({ subject: s._id, exam: q.query.exam }), m = new Map(ms.map(x => [String(x.student), x]));
  r.json({ max: ms[0]?.max ?? null, published: ms.length > 0 && ms.every(x => x.published), students: st.map(x => ({ _id: x._id, name: x.name, roll: x.roll, marks: m.get(String(x._id))?.marks ?? '' })) });
}));
R.post('/marks', auth(...STAFF), h(async (q, r) => {
  const { subject, exam, max, rows = [] } = q.body, s = await own(q.user, subject); if (guard(r, s) !== null) return;
  if (!EXAMS.includes(exam)) return fail(r, 'Choose an exam'); const M = Number(max); if (!(M > 0)) return fail(r, 'Enter maximum marks');
  const ids = new Set((await classStudents(s)).map(x => String(x._id))), ops = [];
  for (const x of rows) {
    if (!ids.has(String(x.student))) continue;
    if (x.marks === '' || x.marks == null) { ops.push({ deleteOne: { filter: { subject: s._id, student: x.student, exam } } }); continue; }
    const v = Number(x.marks); if (isNaN(v) || v < 0 || v > M) return fail(r, `Marks must be between 0 and ${M}`);
    ops.push({ updateOne: { filter: { subject: s._id, student: x.student, exam }, update: { $set: { marks: v, max: M, published: false, enteredBy: q.user._id } }, upsert: true } });
  }
  if (ops.length) await Mark.bulkWrite(ops);
  r.json({ message: 'Marks saved. They become visible to students once the HOD/admin publishes them.' });
}));
R.post('/marks/publish', auth(...ADM), h(async (q, r) => {
  const { subject, exam, publish } = q.body; if (!EXAMS.includes(exam)) return fail(r, 'Choose an exam');
  const x = await Mark.updateMany({ subject, exam }, { published: !!publish });
  if (publish && x.modifiedCount) { const sj = await Subject.findById(subject); notify(await Mark.find({ subject, exam }).distinct('student'), `Result published: ${exam}`, sj?.name || '', '/results'); }
  r.json({ message: `${publish ? 'Published' : 'Unpublished'} ${x.modifiedCount} result(s)` });
}));
const result = async st => {
  const subs = await Subject.find(classQ(st)).select('code name credits').sort('code');
  const ms = await Mark.find({ student: st._id, published: true, subject: { $in: subs.map(s => s._id) } });
  return { student: { _id: st._id, name: st.name, roll: st.roll, course: st.course, branch: st.branch, semester: st.semester, section: st.section, photo: st.photo },
    subjects: subs.map(s => ({ code: s.code, name: s.name, credits: s.credits, marks: ms.filter(m => String(m.subject) === String(s._id)).map(m => ({ exam: m.exam, marks: m.marks, max: m.max })) })) };
};
R.get('/results/me', auth('student'), h(async (q, r) => r.json(await result(q.user))));
R.get('/results/:id', auth(...ADM), h(async (q, r) => { const st = await User.findOne({ _id: q.params.id, role: 'student' }); if (!st) return fail(r, 'Student not found', 404); r.json(await result(st)); }));

// ---------- Exam schedule (admit card data) ----------
R.get('/exams', auth(), h(async (q, r) => {
  const u = q.user; let f = {};
  if (u.role === 'student') f = classQ(u);
  else if (q.query.student) { const st = await User.findById(q.query.student); if (!st) return fail(r, 'Student not found', 404); f = classQ(st); }
  else ['course', 'branch', 'semester'].forEach(k => q.query[k] && (f[k] = q.query[k]));
  r.json(await Exam.find(f).populate('subject', 'name code').sort('date start'));
}));
R.post('/exams', auth(...ADM), h(async (q, r) => {
  const b = q.body; if (!b.name || !b.course || !b.semester || !b.subject || !b.date || !b.start || !b.end) return fail(r, 'Exam name, class, subject, date and time are required');
  if (b.end <= b.start) return fail(r, 'End time must be after start time');
  const e = await Exam.create(b); notify(await studentIds(b), 'Exam scheduled: ' + b.name, `${b.date} ${b.start}`, '/exams'); r.json(e);
}));
R.delete('/exams/:id', auth(...ADM), h(async (q, r) => { await Exam.findByIdAndDelete(q.params.id); r.json({ ok: true }); }));

export default R;
