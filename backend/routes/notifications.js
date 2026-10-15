import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { Notification } from '../models.js';
const R = Router();
const h = f => (q, r, n) => f(q, r, n).catch(n);
R.get('/notifications', auth(), h(async (q, r) => {
  const [items, unread] = await Promise.all([Notification.find({ user: q.user._id }).sort('-createdAt').limit(40), Notification.countDocuments({ user: q.user._id, read: false })]);
  r.json({ items, unread });
}));
R.post('/notifications/read-all', auth(), h(async (q, r) => { await Notification.updateMany({ user: q.user._id, read: false }, { read: true }); r.json({ ok: true }); }));
R.put('/notifications/:id/read', auth(), h(async (q, r) => { await Notification.updateOne({ _id: q.params.id, user: q.user._id }, { read: true }); r.json({ ok: true }); }));
export default R;
