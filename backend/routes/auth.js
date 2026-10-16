import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models.js';
import { auth, sign } from '../middleware/auth.js';

const R = Router();
const h = f => (q, r, n) => f(q, r, n).catch(n);
const used = new Map(); // one-time captcha ids (single server instance)
setInterval(() => { const n = Date.now(); for (const [k, t] of used) if (t < n) used.delete(k); }, 60000).unref();
// Many students share one college IP, so limit per IP + username, and only on login
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 25, keyGenerator: q => q.ip + '|' + String(q.body?.username || '').toLowerCase(), message: { message: 'Too many attempts. Try again in 15 minutes.' } });
const hash = c => crypto.createHash('sha256').update(c.toUpperCase() + process.env.JWT_SECRET).digest('hex');

// Captcha: server makes a code, returns an SVG plus a signed token holding only the code's hash
R.get('/captcha', (q, r) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from({ length: 5 }, () => chars[crypto.randomInt(chars.length)]).join('');
  const lines = Array.from({ length: 4 }, () => `<line x1="${crypto.randomInt(120)}" y1="${crypto.randomInt(40)}" x2="${crypto.randomInt(120)}" y2="${crypto.randomInt(40)}" stroke="#1b2170" stroke-opacity=".3"/>`).join('');
  const text = code.split('').map((c, i) => `<text x="${10 + i * 21}" y="${27 + crypto.randomInt(8) - 4}" font-size="24" font-weight="700" fill="#1b2170" transform="rotate(${crypto.randomInt(21) - 10} ${16 + i * 21} 20)">${c}</text>`).join('');
  r.json({ svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" width="120" height="40">${lines}${text}</svg>`, token: jwt.sign({ h: hash(code), j: crypto.randomUUID() }, process.env.JWT_SECRET, { expiresIn: '5m' }) });
});

R.post('/login', loginLimit, h(async (q, r) => {
  const { username = '', password = '', captcha = '', token = '', as = '' } = q.body;
  try { const c = jwt.verify(token, process.env.JWT_SECRET); if (c.h !== hash(captcha) || used.has(c.j)) throw 0; used.set(c.j, Date.now() + 300000); }
  catch { return r.status(400).json({ message: 'Wrong or expired CAPTCHA' }); }
  const u = await User.findOne({ username: username.toLowerCase().trim() });
  if (!u || !u.active || !(await bcrypt.compare(password, u.password))) return r.status(401).json({ message: 'Invalid username or password' });
  if (as === 'student' && u.role !== 'student') return r.status(403).json({ message: 'This is a staff account. Choose the Teacher / Staff tab.' });
  if (as === 'staff' && u.role === 'student') return r.status(403).json({ message: 'This is a student account. Choose the Student tab.' });
  r.json({ token: sign(u), user: { ...u.toObject(), password: undefined } });
}));

R.get('/me', auth(), (q, r) => r.json(q.user));

R.post('/change-password', auth(), h(async (q, r) => {
  const { current, next } = q.body;
  const u = await User.findById(q.user._id);
  if (!(await bcrypt.compare(current || '', u.password))) return r.status(400).json({ message: 'Current password is wrong' });
  if (!next || next.length < 6) return r.status(400).json({ message: 'New password must be at least 6 characters' });
  if (next === current) return r.status(400).json({ message: 'Choose a different password from the current one' });
  u.password = await bcrypt.hash(next, 10); u.mustChange = false; await u.save();
  r.json({ message: 'Password updated' });
}));

export default R;
