import jwt from 'jsonwebtoken';
import { User } from '../models.js';

export const sign = u => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

// auth() = any logged-in user; auth('admin','teacher') = only those roles
export const auth = (...roles) => async (q, r, n) => {
  try {
    const t = (q.headers.authorization || '').replace('Bearer ', '');
    const p = jwt.verify(t, process.env.JWT_SECRET);
    const u = await User.findById(p.id).select('-password');
    if (!u || !u.active) throw new Error('inactive');
    if (roles.length && !roles.includes(u.role)) return r.status(403).json({ message: 'You do not have access to this' });
    q.user = u; n();
  } catch { r.status(401).json({ message: 'Please login again' }); }
};
