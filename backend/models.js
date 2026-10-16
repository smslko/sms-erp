import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const ref = n => ({ type: Schema.Types.ObjectId, ref: n });
const opt = { timestamps: true };

export const User = model('User', new Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'hod', 'teacher', 'student', 'accountant'], required: true },
  roll: { type: String, trim: true }, course: { type: String, default: '' }, branch: { type: String, default: '' },
  semester: Number, section: { type: String, default: '' }, phone: String, email: String, photo: ref('File'), mustChange: { type: Boolean, default: false }, active: { type: Boolean, default: true },
}, opt));

export const Course = model('Course', new Schema({
  code: { type: String, required: true, unique: true, uppercase: true }, name: { type: String, required: true },
  university: { type: String, enum: ['AKTU', 'LU'], required: true }, years: { type: Number, required: true }, branches: [String],
}, opt));

export const Subject = model('Subject', new Schema({
  code: { type: String, required: true }, name: { type: String, required: true }, course: { type: String, required: true },
  branch: { type: String, default: '' }, semester: { type: Number, required: true }, credits: Number, teacher: ref('User'),
  syllabus: { type: String, default: '' }, outcomes: [String],
}, opt));

export const Attendance = model('Attendance', new Schema({
  subject: { ...ref('Subject'), required: true }, date: { type: String, required: true }, slot: { type: Number, default: 1 }, markedBy: ref('User'),
  records: [{ student: ref('User'), status: { type: String, enum: ['P', 'A', 'L'] } }], // P present, A absent, L approved leave
}, opt).index({ subject: 1, date: 1, slot: 1 }, { unique: true }));

export const Assignment = model('Assignment', new Schema({
  subject: { ...ref('Subject'), required: true }, title: { type: String, required: true }, description: String, link: String, file: { id: ref('File'), name: String },
  dueDate: { type: Date, required: true }, maxMarks: { type: Number, default: 10 }, createdBy: ref('User'),
}, opt));

export const Submission = model('Submission', new Schema({
  assignment: { ...ref('Assignment'), required: true }, student: { ...ref('User'), required: true },
  text: String, link: String, file: { id: ref('File'), name: String }, late: Boolean, marks: Number, remark: String,
}, opt).index({ assignment: 1, student: 1 }, { unique: true }));

export const Notice = model('Notice', new Schema({
  title: { type: String, required: true }, body: { type: String, required: true }, createdBy: ref('User'),
  course: { type: String, default: '' }, branch: { type: String, default: '' }, semester: { type: Number, default: null },
}, opt));

export const Leave = model('Leave', new Schema({
  student: { ...ref('User'), required: true }, type: String, from: { type: String, required: true }, to: { type: String, required: true }, reason: String,
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' }, remark: String, reviewedBy: ref('User'),
}, opt));

export const Timetable = model('Timetable', new Schema({
  course: String, branch: { type: String, default: '' }, semester: Number, section: { type: String, default: '' },
  day: { type: Number, min: 0, max: 6 }, start: String, end: String, subject: ref('Subject'), room: String,
}, opt));

export const Holiday = model('Holiday', new Schema({ name: String, from: String, to: String }, opt));

export const Fee = model('Fee', new Schema({
  student: { ...ref('User'), required: true }, title: { type: String, required: true }, amount: { type: Number, required: true }, dueDate: String,
  payments: [{ amount: Number, date: { type: Date, default: Date.now }, mode: String, note: String, receiptNo: String, by: ref('User') }],
}, opt));

export const File = model('File', new Schema({
  name: String, mime: String, size: Number, data: { type: Buffer, select: false }, owner: ref('User'), label: String,
  kind: { type: String, enum: ['assignment', 'submission', 'material', 'photo', 'document'] },
}, opt));

export const Material = model('Material', new Schema({
  subject: { ...ref('Subject'), required: true }, title: { type: String, required: true }, description: String, link: String,
  file: { id: ref('File'), name: String }, createdBy: ref('User'),
}, opt));

export const EXAMS = ['CT-1', 'CT-2', 'Prelim', 'Assignment', 'Practical', 'External'];
export const Mark = model('Mark', new Schema({
  subject: { ...ref('Subject'), required: true }, student: { ...ref('User'), required: true }, exam: { type: String, enum: EXAMS, required: true },
  marks: Number, max: Number, published: { type: Boolean, default: false }, enteredBy: ref('User'),
}, opt).index({ subject: 1, student: 1, exam: 1 }, { unique: true }));

export const Exam = model('Exam', new Schema({
  name: { type: String, required: true }, course: String, branch: { type: String, default: '' }, semester: Number,
  subject: ref('Subject'), date: String, start: String, end: String, room: String,
}, opt));

export const Notification = model('Notification', new Schema({
  user: { ...ref('User'), required: true, index: true }, title: String, body: String, link: { type: String, default: '/' }, read: { type: Boolean, default: false },
}, opt).index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }));

export const Setting = model('Setting', new Schema({ key: { type: String, unique: true }, value: String }, opt));
