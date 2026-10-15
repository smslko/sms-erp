import { useState, useEffect, createContext, useContext } from 'react';
import { NavLink, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import api, { err } from './api';
import { COLLEGE } from './college';
import { ToastProvider, useToast, Field } from './ui';
import Dashboard from './pages/Dashboard';
import { Assignments, Syllabus, Attendance, Timetable } from './pages/Academics';
import { Notices, Leave, Fees, Profile } from './pages/Services';
import { Courses, Subjects, Users, Holidays } from './pages/Admin';
import { Materials, Marks, Results, Exams, IdCards } from './pages/Phase2';

const Auth = createContext();
export const useAuth = () => useContext(Auth);

const MENU = {
  student: [['/', '🏠', 'Dashboard'], ['/assignments', '📝', 'Assignments'], ['/syllabus', '📚', 'Syllabus'], ['/notices', '📢', 'Notices'], ['/attendance', '✅', 'Attendance'], ['/timetable', '🗓️', 'Timetable'], ['/leave', '✈️', 'Leave'], ['/fees', '💳', 'Fees'], ['/profile', '👤', 'Profile']],
  teacher: [['/', '🏠', 'Dashboard'], ['/assignments', '📝', 'Assignments'], ['/syllabus', '📚', 'Syllabus'], ['/notices', '📢', 'Notices'], ['/attendance', '✅', 'Attendance'], ['/timetable', '🗓️', 'Timetable'], ['/leave', '✈️', 'Leave requests'], ['/users', '🎓', 'Students'], ['/profile', '👤', 'Profile']],
  accountant: [['/', '🏠', 'Dashboard'], ['/fees', '💳', 'Fees'], ['/users', '🎓', 'Students'], ['/notices', '📢', 'Notices'], ['/profile', '👤', 'Profile']],
};
MENU.hod = [...MENU.teacher.slice(0, 8), ['/subjects', '📖', 'Subjects'], MENU.teacher[8]];
MENU.admin = [['/', '🏠', 'Dashboard'], ['/courses', '🏫', 'Courses'], ['/subjects', '📖', 'Subjects'], ['/users', '🎓', 'People'], ['/assignments', '📝', 'Assignments'], ['/syllabus', '📚', 'Syllabus'], ['/attendance', '✅', 'Attendance'], ['/timetable', '🗓️', 'Timetable'], ['/notices', '📢', 'Notices'], ['/leave', '✈️', 'Leave requests'], ['/fees', '💳', 'Fees'], ['/holidays', '🎉', 'Holidays'], ['/profile', '👤', 'Profile']];
const ins = (r, after, ...it) => { const i = MENU[r].findIndex(m => m[0] === after); MENU[r].splice(i + 1, 0, ...it); };
const MAT = ['/materials', '📂', 'Study material'], MRK = ['/marks', '🧮', 'Internal marks'], EXM = ['/exams', '🧾', 'Exams'], RES = ['/results', '📊', 'Results'], IDC = ['/idcard', '🪪', 'ID card'];
ins('student', '/syllabus', MAT); ins('student', '/attendance', EXM, RES, IDC);
ins('teacher', '/syllabus', MAT); ins('teacher', '/attendance', MRK, EXM);
['hod', 'admin'].forEach(r => { ins(r, '/syllabus', MAT); ins(r, '/attendance', MRK, EXM, RES, IDC); });
const ROLE = { admin: 'Admin', hod: 'HOD', teacher: 'Teacher', student: 'Student', accountant: 'Accountant' };

function Login({ onLogin }) {
  const [f, setF] = useState({ username: '', password: '', captcha: '' }), [cap, setCap] = useState(null), [busy, setBusy] = useState(false), toast = useToast();
  const newCap = () => api.get('/auth/captcha').then(r => setCap(r.data)).catch(() => toast('Cannot reach server. Try again in a minute.', true));
  useEffect(() => { newCap(); }, []);
  const go = async e => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.post('/auth/login', { ...f, token: cap.token }); localStorage.setItem('tk', r.data.token); onLogin(r.data.user); }
    catch (x) { toast(err(x), true); newCap(); setF(p => ({ ...p, captcha: '' })); } finally { setBusy(false); }
  };
  return <div className="login"><form className="lbox glass" onSubmit={go}>
    <img src="/logo.jpg" alt={COLLEGE.name} />
    <h2 style={{ marginBottom: 4 }}>Sign in to your portal</h2>
    <p className="mut" style={{ marginTop: 0 }}>Students use their roll number as username.</p>
    <Field label="Username / Roll number"><input value={f.username} onChange={e => setF({ ...f, username: e.target.value })} autoComplete="username" required /></Field>
    <Field label="Password"><input type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} autoComplete="current-password" required /></Field>
    <div className="cap">{cap && <div dangerouslySetInnerHTML={{ __html: cap.svg }} />}<button type="button" className="btn o s" onClick={newCap}>↻ New code</button></div>
    <Field label="Type the code above"><input value={f.captcha} onChange={e => setF({ ...f, captcha: e.target.value })} required /></Field>
    <button className="btn" style={{ width: '100%' }} disabled={busy || !cap}>{busy ? 'Signing in…' : 'Sign in'}</button>
    <p className="mut" style={{ textAlign: 'center', marginBottom: 0 }}>{COLLEGE.address}<br />{COLLEGE.phone}</p>
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

function Shell({ user, logout }) {
  const [open, setOpen] = useState(false), loc = useLocation(), menu = MENU[user.role] || MENU.student;
  useEffect(() => setOpen(false), [loc.pathname]);
  const title = (menu.find(m => m[0] === loc.pathname) || menu[0])[2];
  return <div className="shell">
    <aside className={'side glass' + (open ? ' open' : '')}>
      <img src="/logo.jpg" alt={COLLEGE.short} />
      {menu.map(([to, ic, tx]) => <NavLink key={to} to={to} end className={({ isActive }) => isActive ? 'on' : ''}><span>{ic}</span>{tx}</NavLink>)}
      <a href="#" onClick={e => { e.preventDefault(); logout(); }} style={{ marginTop: 'auto' }}><span>🚪</span>Logout</a>
    </aside>
    <div className="main">
      <header className="top glass"><button className="btn o s burger" onClick={() => setOpen(!open)} aria-label="Menu">☰</button><span className="t">{title}</span><Bell /><span className="chip">{user.name} · {ROLE[user.role]}</span></header>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/assignments" element={<Assignments />} /><Route path="/syllabus" element={<Syllabus />} />
        <Route path="/attendance" element={<Attendance />} /><Route path="/timetable" element={<Timetable />} />
        <Route path="/notices" element={<Notices />} /><Route path="/leave" element={<Leave />} />
        <Route path="/fees" element={<Fees />} /><Route path="/profile" element={<Profile />} />
        <Route path="/users" element={<Users />} /><Route path="/courses" element={<Courses />} />
        <Route path="/materials" element={<Materials />} /><Route path="/marks" element={<Marks />} /><Route path="/exams" element={<Exams />} /><Route path="/results" element={<Results />} /><Route path="/idcard" element={<IdCards />} />
        <Route path="/subjects" element={<Subjects />} /><Route path="/holidays" element={<Holidays />} />
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
