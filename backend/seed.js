// Optional: npm run seed:demo  -> adds a demo HOD, teacher, accountant, 2 students and 3 subjects.
// (The admin account and courses are created automatically when the server starts.)
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Subject } from './models.js';
import { bootstrap } from './bootstrap.js';

await mongoose.connect(process.env.MONGO_URI);
await bootstrap();
if (process.argv.includes('--demo')) {
  const mk = async o => User.updateOne({ username: o.username }, { ...o, password: await bcrypt.hash('Demo@123', 10) }, { upsert: true });
  await mk({ name: 'Demo HOD', username: 'hod', role: 'hod' });
  await mk({ name: 'Demo Teacher', username: 'teacher', role: 'teacher' });
  await mk({ name: 'Demo Accountant', username: 'accountant', role: 'accountant' });
  await mk({ name: 'Demo Student One', username: '2504230100001', roll: '2504230100001', role: 'student', course: 'BTECH', branch: 'CSE', semester: 3, section: 'A' });
  await mk({ name: 'Demo Student Two', username: '2504230100002', roll: '2504230100002', role: 'student', course: 'BTECH', branch: 'CSE', semester: 3, section: 'A' });
  const t = await User.findOne({ username: 'teacher' });
  for (const [code, name] of [['BCS301', 'Data Structures'], ['BCS302', 'Computer Organization & Architecture'], ['BCC302', 'Python Programming']])
    await Subject.updateOne({ code, course: 'BTECH' }, { code, name, course: 'BTECH', branch: 'CSE', semester: 3, credits: 4, teacher: t._id }, { upsert: true });
  console.log('Demo users added (password Demo@123): hod, teacher, accountant, 2504230100001, 2504230100002');
}
await mongoose.disconnect();
