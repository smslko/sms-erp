// Runs on every server start. Creates the first admin and the course list when the database is empty,
// so no shell access is needed (Render free plan has none).
import bcrypt from 'bcryptjs';
import { User, Course, Holiday } from './models.js';

export const courses = [
  { code: 'BTECH', name: 'B.Tech', university: 'AKTU', years: 4, branches: ['CSE', 'CSE (AI)', 'IT', 'ECE', 'ME', 'EE', 'CE'] },
  { code: 'MBA', name: 'MBA', university: 'AKTU', years: 2, branches: ['Marketing', 'Finance', 'HR'] },
  { code: 'BBA', name: 'BBA', university: 'LU', years: 3, branches: [] },
  { code: 'BCA', name: 'BCA', university: 'LU', years: 3, branches: [] },
  { code: 'BCOM', name: 'B.Com', university: 'LU', years: 3, branches: [] },
  { code: 'BCOMH', name: 'B.Com (Hons)', university: 'LU', years: 3, branches: [] },
  { code: 'BVOC', name: 'B.Voc', university: 'LU', years: 3, branches: [] },
];
export const holidays = [['Makar Sankranti', '2026-01-14'], ['Republic Day', '2026-01-26'], ['Holi', '2026-03-02', '2026-03-05'], ['Independence Day', '2026-08-15'], ['Gandhi Jayanti', '2026-10-02'], ['Durga Puja / Dussehra', '2026-10-19', '2026-10-21'], ['Diwali', '2026-11-07', '2026-11-09'], ['Christmas', '2026-12-25']];

export async function bootstrap() {
  if (!(await Course.countDocuments())) { await Course.insertMany(courses); console.log('Courses created'); }
  if (!(await Holiday.countDocuments())) { await Holiday.insertMany(holidays.map(([name, from, to]) => ({ name, from, to: to || from }))); console.log('Holidays created'); }
  if (!(await User.exists({ role: 'admin' }))) {
    const pw = process.env.ADMIN_PASSWORD || 'Admin@123';
    await User.create({ name: 'Administrator', username: 'admin', role: 'admin', password: await bcrypt.hash(pw, 10), mustChange: !process.env.ADMIN_PASSWORD });
    console.log('Admin account created. Username: admin');
  } else if (process.env.RESET_ADMIN === 'true' && process.env.ADMIN_PASSWORD) {
    // Forgot the admin password? Set ADMIN_PASSWORD + RESET_ADMIN=true on the server, restart, then remove RESET_ADMIN.
    await User.updateOne({ username: 'admin', role: 'admin' }, { password: await bcrypt.hash(process.env.ADMIN_PASSWORD, 10), mustChange: false });
    console.log('Admin password reset from ADMIN_PASSWORD');
  }
}
