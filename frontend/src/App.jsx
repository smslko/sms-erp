import { useState, useEffect, createContext, useContext } from 'react';
import { NavLink, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import api, { err } from './api';
import { COLLEGE } from './college';
import { ToastProvider, useToast, Field, ThemeToggle } from './ui';
import Dashboard from './pages/Dashboard';
import { Assignments, Syllabus, Attendance, Timetable } from './pages/Academics';
import { Notices, Leave, Fees, Profile } from './pages/Services';
import { Courses, Subjects, Users, Holidays, Settings } from './pages/Admin';
import { Materials, Marks, Results, Exams, IdCards } from './pages/Phase2';

const Auth = createContext();
export const useAuth = () => useContext(Auth);

// Menu = groups of [path, icon, label]
const I = {
  dash: ['/', '🏠', 'Dashboard'], assign: ['/assignments', '📝', 'Assignments'], syl: ['/syllabus', '📚', 'Syllabus'], mat: ['/materials', '📂', 'Study material'],
  att: ['/attendance', '✅', 'Attendance'], mrk: ['/marks', '🧮', 'Internal marks'], tt: ['/timetable', '🗓️', 'Timetable'], exm: ['/exams', '🧾', 'Exams'], res: ['/results', '📊', 'Results'],
  idc: ['/idcard', '🪪', 'ID card'], not: ['/notices', '📢', 'Notices'], lv: ['/leave', '✈️', 'Leave'], fee: ['/fees', '💳', 'Fees'], pro: ['/profile', '👤', 'Profile'],
  ppl: ['/users', '👥', 'People'], stu: ['/users', '🎓', 'Students'], crs: ['/courses', '🏫', 'Courses'], sub: ['/subjects', '📖', 'Subjects'], hol: ['/holidays', '🎉', 'Holidays'], set: ['/settings', '⚙️', 'Settings'],
};
const MENU = {
  student: [['Main', [I.dash]], ['Academics', [I.assign, I.syl, I.mat, I.att, I.tt, I.exm, I.res]], ['Services', [I.not, I.lv, I.fee, I.idc]], ['Account', [I.pro]]],
  teacher: [['Main', [I.dash]], ['Academics', [I.assign, I.syl, I.mat, I.att, I.mrk, I.tt, I.exm]], ['Communication', [I.not, ['/leave', '✈️', 'Leave requests'], I.stu]], ['Account', [I.pro]]],
  hod: [['Main', [I.dash]], ['Manage', [I.ppl, I.sub]], ['Academics', [I.assign, I.syl, I.mat, I.att, I.mrk, I.tt, I.exm, I.res, I.idc]], ['Communication', [I.not, ['/leave', '✈️', 'Leave requests']]], ['Account', [I.pro]]],
  admin: [['Main', [I.dash]], ['Manage', [I.ppl, I.crs, I.sub, I.hol, I.set]], ['Academics', [I.assign, I.syl, I.mat, I.att, I.mrk, I.tt, I.exm, I.res, I.idc]], ['Communication', [I.not, ['/leave', '✈️', 'Leave requests']]], ['Finance', [I.fee]], ['Account', [I.pro]]],
  accountant: [['Main', [I.dash]], ['Finance', [I.fee, I.stu]], ['Communication', [I.not]], ['Account', [I.pro]]],
};
// [student text, staff text]
const HINTS = {
  '/': ['Your day at a glance: attendance, classes, notices and fees.', 'A quick overview of the college today.'],
  '/assignments': ['Submit your work before the due date and see your marks.', 'Create assignments for your classes, check submissions and give marks.'],
  '/syllabus': ['Units, topics and course outcomes of each subject.', 'Update the syllabus of your subjects. Students see changes immediately.'],
  '/materials': ['Notes, slides and links shared by your teachers.', 'Share notes, presentations and links with your class.'],
  '/attendance': ['Subject-wise attendance with graphs and how many classes you can miss.', 'Mark attendance period by period and see students below the minimum.'],
  '/marks': ['', 'Enter marks for tests and assignments. HOD or admin publishes them to students.'],
  '/timetable': ['Your weekly class schedule.', 'The weekly class schedule.'],
  '/exams': ['Exam dates and your admit card.', 'Exam schedule and admit cards.'],
  '/results': ['Your published marks and marksheet.', 'Open the marksheet of any student.'],
  '/idcard': ['Your college ID card.', 'Print ID cards for a whole class.'],
  '/notices': ['Announcements from your college and teachers.', 'Send announcements to everyone or to one class.'],
  '/leave': ['Apply for leave and track approval.', 'Review leave requests from students.'],
  '/fees': ['Your fee details and receipts.', 'Record fees and payments, and print receipts.'],
  '/profile': ['Your details, photo, documents and password.', 'Your details, photo and password.'],
  '/users': ['', 'Create and manage accounts. New users get the common default password.'],
  '/courses': ['', 'Courses, universities and branches used across the portal.'],
  '/subjects': ['', 'Add subjects for each class and assign teachers to them.'],
  '/holidays': ['', 'Holidays shown on dashboards.'],
  '/settings': ['', 'Portal settings for the admin.'],
};

function Login({ onLogin }) {
  const [as, setAs] = useState('student'), [f, setF] = useState({ username: '', password: '', captcha: '' }), [cap, setCap] = useState(null), [down, setDown] = useState(false), [busy, setBusy] = useState(false), [forgot, setForgot] = useState(false), toast = useToast();
  const newCap = () => { setDown(false); return api.get('/auth/captcha').then(r => setCap(r.data)).catch(() => { setCap(null); setDown(true); }); };
  useEffect(() => { newCap(); }, []);
  const go = async e => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.post('/auth/login', { ...f, as, token: cap.token }); localStorage.setItem('tk', r.data.token); onLogin(r.data.user); }
    catch (x) { toast(err(x), true); newCap(); setF(p => ({ ...p, captcha: '' })); } finally { setBusy(false); }
  };
  const student = as === 'student';
  return <div className="lgn">
    <section className="lg-brand"><img src="/logo.jpg" alt={COLLEGE.name} /><h1>{COLLEGE.short} Student &amp; Staff Portal</h1>
      <p>One place for attendance, assignments, notices, results and fees.</p>
      <ul><li>Attendance with graphs and 75% tracking</li><li>Assignments, study material and syllabus</li><li>Notices, exams, results and ID card</li></ul>
      <div className="mut">{COLLEGE.address}<br />{COLLEGE.phone}</div></section>
    <form className="lg-form glass" onSubmit={go}>
      <div className="lg-top"><ThemeToggle /></div>
      <h2>Welcome back</h2><p className="mut" style={{ margin: '2px 0 14px' }}>Choose how you want to sign in.</p>
      <div className="seg" role="tablist" aria-label="Login as"><button type="button" role="tab" aria-selected={student} className={student ? 'on' : ''} onClick={() => setAs('student')}>🎓 Student</button><button type="button" role="tab" aria-selected={!student} className={!student ? 'on' : ''} onClick={() => setAs('staff')}>🧑‍🏫 Teacher / Staff / Admin</button></div>
      <Field label={student ? 'Roll number' : 'Username'}><input value={f.username} onChange={e => setF({ ...f, username: e.target.value })} autoComplete="username" placeholder={student ? 'e.g. 2504230100075' : 'e.g. admin'} required /></Field>
      <Field label="Password"><input type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} autoComplete="current-password" required /></Field>
      {down ? <p className="no">Cannot reach the server. {import.meta.env.VITE_API_URL ? 'The backend may be starting up (wait about a minute and retry), or CLIENT_URL on the backend does not match this website address.' : 'VITE_API_URL is not set for this build. Set it in the hosting dashboard and redeploy.'} <button type="button" className="btn o s" onClick={newCap}>Retry</button></p> :
        <div className="cap">{cap ? <div dangerouslySetInnerHTML={{ __html: cap.svg }} /> : <span className="mut">Loading code…</span>}<button type="button" className="btn o s" onClick={newCap}>↻ New code</button></div>}
      <Field label="Type the code shown above"><input value={f.captcha} onChange={e => setF({ ...f, captcha: e.target.value })} required /></Field>
      <button className="btn" style={{ width: '100%' }} disabled={busy || !cap}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p style={{ textAlign: 'center', marginBottom: 0 }}><a href="#" onClick={e => { e.preventDefault(); setForgot(!forgot); }}>Forgot password?</a></p>
      {forgot && <div className="info"><b>Passwords are reset by the college office.</b><br />Students: ask your HOD, class teacher or the admin office. Teachers and staff: ask the admin. Your password becomes the common default password; you can then change it from Profile.<br />Call: {COLLEGE.phone}</div>}
      {!student && <p className="mut" style={{ marginBottom: 0 }}>The admin account (username <b>admin</b>) is created automatically when the system is first set up.</p>}
    </form></div>;
}

function Bell() {
  const [d, setD] = useState({ items: [], unread: 0 }), [open, setOpen] = useState(false), nav = useNavigate(), loc = useLocation();
  const load = () => api.get('/notifications').then(r => setD(r.data)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  useEffect(() => { load(); setOpen(false); }, [loc.pathname]);
  const go = n => { if (!n.read) api.put(`/notifications/${n._id}/read`).then(load); setOpen(false); nav(n.link || '/'); };
  const all = () => api.post('/notifications/read-all').then(load);
  return <div style={{ position: 'relative' }}>
    <button className="btn o s" onClick={() => { setOpen(!open); load(); }} aria-label={`Notifications, ${d.unread} unread`}>🔔{d.unread > 0 && <b className="dot">{d.unread > 9 ? '9+' : d.unread}</b>}</button>
    {open && <div className="npanel glass"><div className="ch" style={{ marginBottom: 6 }}><h3>Notifications</h3>{d.unread > 0 && <button className="btn o s" onClick={all}>Mark all read</button>}</div>
      {d.items.map(n => <div key={n._id} className={'nitem' + (n.read ? '' : ' un')} onClick={() => go(n)}><b>{n.title}</b>{n.body && <div className="mut">{n.body.slice(0, 90)}</div>}<div className="mut">{new Date(n.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></div>)}
      {!d.items.length && <p className="empty">You are all caught up.</p>}</div>}
  </div>;
}

const ROLE = { admin: 'Admin', hod: 'HOD', teacher: 'Teacher', student: 'Student', accountant: 'Accountant' };
function Shell({ user, logout }) {
  const [open, setOpen] = useState(false), [hide, setHide] = useState(false), loc = useLocation(), groups = MENU[user.role] || MENU.student;
  useEffect(() => setOpen(false), [loc.pathname]);
  const flat = groups.flatMap(g => g[1]), cur = flat.find(m => m[0] === loc.pathname) || flat[0], hint = (HINTS[cur[0]] || ['', ''])[user.role === 'student' ? 0 : 1];
  return <div className="shell">
    <aside className={'side glass' + (open ? ' open' : '')}>
      <img src="/logo.jpg" alt={COLLEGE.short} />
      {groups.map(([g, items]) => <div key={g}><div className="gl">{g}</div>{items.map(([to, ic, tx]) => <NavLink key={to + tx} to={to} end className={({ isActive }) => isActive ? 'on' : ''}><span>{ic}</span>{tx}</NavLink>)}</div>)}
      <a href="#" onClick={e => { e.preventDefault(); logout(); }} style={{ marginTop: 'auto' }}><span>🚪</span>Logout</a>
    </aside>
    <div className="main">
      <header className="top glass"><button className="btn o s burger" onClick={() => setOpen(!open)} aria-label="Menu">☰</button><span className="t">{COLLEGE.short} ERP</span><ThemeToggle /><Bell /><span className="chip">{user.name} · {ROLE[user.role]}</span></header>
      {user.mustChange && !hide && <div className="banner">🔐 You are using the common default password. You can keep it, or set your own for better security. <NavLink to="/profile">Change password</NavLink><button className="btn o s" onClick={() => setHide(true)}>Not now</button></div>}
      <div className="ph"><h1>{cur[2]}</h1>{hint && <p>{hint}</p>}</div>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/assignments" element={<Assignments />} /><Route path="/syllabus" element={<Syllabus />} /><Route path="/materials" element={<Materials />} />
        <Route path="/attendance" element={<Attendance />} /><Route path="/marks" element={<Marks />} /><Route path="/timetable" element={<Timetable />} />
        <Route path="/exams" element={<Exams />} /><Route path="/results" element={<Results />} /><Route path="/idcard" element={<IdCards />} />
        <Route path="/notices" element={<Notices />} /><Route path="/leave" element={<Leave />} /><Route path="/fees" element={<Fees />} /><Route path="/profile" element={<Profile />} />
        <Route path="/users" element={<Users />} /><Route path="/courses" element={<Courses />} /><Route path="/subjects" element={<Subjects />} />
        <Route path="/holidays" element={<Holidays />} /><Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  </div>;
}

export default function App() {
  const [user, setUser] = useState(null), [ready, setReady] = useState(false);
  useEffect(() => { localStorage.getItem('tk') ? api.get('/auth/me').then(r => setUser(r.data)).catch(() => localStorage.removeItem('tk')).finally(() => setReady(true)) : setReady(true); }, []);
  const logout = () => { localStorage.removeItem('tk'); setUser(null); };
  if (!ready) return <div className="login"><div className="lbox glass">Loading…</div></div>;
  return <ToastProvider><Auth.Provider value={{ user, setUser }}>{user ? <Shell user={user} logout={logout} /> : <Login onLogin={setUser} />}</Auth.Provider></ToastProvider>;
}
