import { useAuth } from '../App';
import { useGet, Card, Table, fmt, inr } from '../ui';
import { AttBars } from '../charts';

const Stat = ({ v, l }) => <div className="stat clay"><b>{v}</b><span>{l}</span></div>;
const Hol = ({ list }) => <Card title="Upcoming holidays"><Table head={['Holiday', 'Date']} rows={(list || []).map(h => [h.name, fmt(h.from) + (h.to !== h.from ? ' – ' + fmt(h.to) : '')])} empty="No upcoming holidays." /></Card>;

export default function Dashboard() {
  const { user } = useAuth(), [d] = useGet('/dashboard'), [notices] = useGet('/notices');
  if (!d) return <p className="empty">Loading…</p>;
  const NB = <Card title="Latest notices">{(notices || []).slice(0, 4).map(n => <div className="item" key={n._id}><b>{n.title}</b> <span className="bd">{fmt(n.createdAt)}</span><div className="mut pre">{n.body.slice(0, 140)}</div></div>)}{!notices?.length && <p className="empty">No notices.</p>}</Card>;
  const TT = <Card title="Today's classes"><Table head={['Time', 'Subject', 'Room']} rows={(d.today || []).map(t => [t.start + ' – ' + t.end, t.subject?.name, t.room])} empty="No classes scheduled today." /></Card>;
  if (d.role === 'student') return <>
    <div className="hero"><span className="tg">{d.attendance == null ? 'No data yet' : d.attendance >= d.min ? 'Good attendance' : `Attendance below ${d.min}%`}</span>Overall attendance<b>{d.attendance == null ? '–' : d.attendance + '%'}</b></div>
    <div className="stats"><Stat v={d.pendingAssignments} l="Assignments pending" /><Stat v={inr(d.feesDue)} l="Fees due" /><Stat v={user.course + (user.branch ? ' · ' + user.branch : '')} l={'Semester ' + user.semester} /></div>
    <div className="grid">{TT}{NB}
      <Card title="Subject-wise attendance"><AttBars rows={d.subjects.map(s => ({ label: s.subject.code, pct: s.pct }))} min={d.min} /><Table head={['Subject', 'P', 'Total', '%']} rows={d.subjects.map(s => [s.subject.name, s.counted, s.total, <b className={s.pct != null && s.pct < d.min ? 'no' : 'ok'}>{s.pct ?? '–'}{s.pct != null && '%'}</b>])} /></Card>
      <Hol list={d.holidays} /></div></>;
  return <>
    <div className="stats"><Stat v={d.students} l="Students" /><Stat v={d.subjects} l="Subjects" /><Stat v={d.assignments} l="Assignments" />{['admin', 'hod', 'teacher'].includes(d.role) && <Stat v={d.pendingLeaves} l="Pending leaves" />}
      {d.feeTotal != null && <><Stat v={inr(d.feeCollected)} l="Fees collected" /><Stat v={inr(d.feeTotal - d.feeCollected)} l="Fees outstanding" /></>}</div>
    <div className="grid">{d.today && TT}{NB}<Hol list={d.holidays} /></div></>;
}
