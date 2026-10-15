import { Notification, User } from './models.js';
// In-app notifications. Never throws, so a failure here cannot break the main action.
export const notify = async (ids, title, body = '', link = '/') => {
  try {
    const u = [...new Set((ids || []).map(String))];
    if (u.length) await Notification.insertMany(u.map(user => ({ user, title: String(title).slice(0, 120), body: String(body).slice(0, 200), link })));
  } catch (e) { console.error('notify failed:', e.message); }
};
export const studentIds = async f => {
  const q = { role: 'student', active: true };
  if (f.course) q.course = f.course; if (f.branch) q.branch = f.branch; if (f.semester) q.semester = f.semester;
  return (await User.find(q).select('_id')).map(x => x._id);
};
export const staffIds = async roles => (await User.find({ role: { $in: roles }, active: true }).select('_id')).map(x => x._id);
