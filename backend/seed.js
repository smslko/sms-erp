// Run once:  npm run seed        (courses, holidays, admin)
//            npm run seed:demo   (also a demo HOD, teacher, accountant and 2 students)
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Course, Subject, Holiday } from './models.js';

const courses = [
  { code: 'BTECH', name: 'B.Tech', university: 'AKTU', years: 4, branches: ['CSE', 'CSE (AI)', 'IT', 'ECE', 'ME', 'EE', 'CE'] },
  { code: 'MBA', name: 'MBA', university: 'AKTU', years: 2, branches: ['Marketing', 'Finance', 'HR'] },
  { code: 'BBA', name: 'BBA', university: 'LU', years: 3, branches: [] },
  { code: 'BCA', name: 'BCA', university: 'LU', years: 3, branches: [] },
  { code: 'BCOM', name: 'B.Com', university: 'LU', years: 3, branches: [] },
  { code: 'BCOMH', name: 'B.Com (Hons)', university: 'LU', years: 3, branches: [] },
  { code: 'BVOC', name: 'B.Voc', university: 'LU', years: 3, branches: [] },
];
const holidays = [['Makar Sankranti', '2026-01-14'], ['Republic Day', '2026-01-26'], ['Holi', '2026-03-02', '2026-03-05'], ['Independence Day', '2026-08-15'], ['Gandhi Jayanti', '2026-10-02'], ['Durga Puja / Dussehra', '2026-10-19', '2026-10-21'], ['Diwali', '2026-11-07', '2026-11-09'], ['Christmas', '2026-12-25']];

await mongoose.connect(process.env.MONGO_URI);
for (const c of courses) await Course.updateOne({ code: c.code }, c, { upsert: true });
for (const [name, from, to] of holidays) await Holiday.updateOne({ name, from }, { name, from, to: to || from }, { upsert: true });
const mk = async (o, pw) => User.updateOne({ username: o.username }, { ...o, password: await bcrypt.hash(pw, 10) }, { upsert: true });
await mk({ name: 'Administrator', username: 'admin', role: 'admin' }, process.env.ADMIN_PASSWORD || 'Admin@123');

if (process.argv.includes('--demo')) {
  await mk({ name: 'Demo HOD', username: 'hod', role: 'hod' }, 'Demo@123');
  await mk({ name: 'Demo Teacher', username: 'teacher', role: 'teacher' }, 'Demo@123');
  await mk({ name: 'Demo Accountant', username: 'accountant', role: 'accountant' }, 'Demo@123');
  await mk({ name: 'Demo Student One', username: '2504230100001', roll: '2504230100001', role: 'student', course: 'BTECH', branch: 'CSE', semester: 3, section: 'A' }, 'Demo@123');
  await mk({ name: 'Demo Student Two', username: '2504230100002', roll: '2504230100002', role: 'student', course: 'BTECH', branch: 'CSE', semester: 3, section: 'A' }, 'Demo@123');
  const t = await User.findOne({ username: 'teacher' });
  for (const [code, name] of [['BCS301', 'Data Structures'], ['BCS302', 'Computer Organization & Architecture'], ['BCC302', 'Python Programming']])
    await Subject.updateOne({ code, course: 'BTECH' }, { code, name, course: 'BTECH', branch: 'CSE', semester: 3, credits: 4, teacher: t._id }, { upsert: true });
  console.log('Demo users added (password Demo@123): hod, teacher, accountant, 2504230100001, 2504230100002');
}
console.log('Seed done. Admin login: admin /', process.env.ADMIN_PASSWORD || 'Admin@123');
await mongoose.disconnect();
