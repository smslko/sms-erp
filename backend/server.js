import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import auth from './routes/auth.js';
import api from './routes/api.js';
import phase2 from './routes/phase2.js';
import notifications from './routes/notifications.js';
import { bootstrap } from './bootstrap.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: (process.env.CLIENT_URL || '*').split(',').map(s => s.trim()) }));
app.use(express.json({ limit: '2mb' }));
app.use('/api/auth', auth);
app.use('/api', api);
app.use('/api', phase2);
app.use('/api', notifications);
app.get('/', (q, r) => r.json({ ok: true, name: 'SMS Lucknow ERP API' }));
app.use((e, q, r, n) => {
  console.error(e);
  if (e.code === 11000) return r.status(409).json({ message: 'Duplicate entry already exists' });
  if (e.name === 'ValidationError') return r.status(400).json({ message: Object.values(e.errors).map(x => x.message).join('. ') });
  if (e.name === 'CastError') return r.status(400).json({ message: `Invalid value for ${e.path}` });
  r.status(e.status || 500).json({ message: e.message || 'Server error' });
});

mongoose.connect(process.env.MONGO_URI)
  .then(bootstrap)
  .then(() => app.listen(process.env.PORT || 5000, () => console.log('API running')))
  .catch(e => { console.error('Mongo connection failed', e.message); process.exit(1); });
