# SMS Lucknow ERP

```
sms-erp/                  <- repo root (push THIS folder to GitHub)
├── backend/              Node + Express + MongoDB API   -> deploy on Render
├── frontend/             React (Vite) website           -> deploy on Netlify OR Vercel
├── netlify.toml          Netlify config (when repo root is used)
├── render.yaml           Render blueprint (optional)
├── package.json          helper scripts (install:all, dev:backend, dev:frontend)
└── README.md
```
Keep this structure. Do not move files out of `backend/` or `frontend/`.

## Features
Login (JWT + CAPTCHA), roles (admin, hod, teacher, student, accountant), courses/branches (B.Tech, MBA via AKTU; BBA, BCA, B.Com, B.Com Hons, B.Voc via LU),
subjects, people + bulk student upload, assignments with files and grading, syllabus and outcomes, study material, notices, attendance with graphs,
internal marks + publish, marksheet, exam schedule + admit card, ID cards, timetable, holidays, leave, fee records + receipts, in-app notifications.
Not included: online payment, email/SMS, library, transport, admission.

## Step 1: Database (MongoDB Atlas, free)
Create a cluster, a database user, Network Access `0.0.0.0/0`. Copy the connection string and add a database name: `...mongodb.net/sms_erp`.

## Step 2: Backend on Render
1. Push the whole `sms-erp` folder to GitHub.
2. Render > New > Web Service > pick the repo. Root Directory: `backend`. Build: `npm install`. Start: `npm start`.
3. Environment variables: `MONGO_URI`, `JWT_SECRET` (long random text), `ADMIN_PASSWORD`, `CLIENT_URL` (fill in Step 4).
4. After it is live, open the Render Shell and run `npm run seed` once (or `npm run seed:demo` for demo users).
Your API URL looks like `https://sms-erp-api.onrender.com`. Test: opening it should show `{"ok":true,...}`.

## Step 3a: Frontend on Netlify
1. Netlify > Add new site > Import from Git > pick the repo.
2. Base directory: `frontend`. Build command: `npm run build`. Publish directory: `dist` (or leave blank; netlify.toml fills it in).
3. Site settings > Environment variables: `VITE_API_URL` = your Render URL (no trailing slash, no `/api`).
4. Deploy. Page refreshes work because of `_redirects` / `netlify.toml`.
Quick way without Git: run `npm install && npm run build` inside `frontend`, then drag the `dist` folder into Netlify Drop. Set `VITE_API_URL` in `frontend/.env` before building.

## Step 3b: Frontend on Vercel (alternative)
Vercel > Add New > Project > pick the repo. Root Directory: `frontend`. Framework: Vite. Environment variable `VITE_API_URL` = Render URL. `vercel.json` handles page refreshes.

## Step 4: Connect them
In Render set `CLIENT_URL` to your website URL (no trailing slash). Using both hosts? Separate with a comma:
`https://my-erp.netlify.app,https://my-erp.vercel.app`. Redeploy the backend. If you change `VITE_API_URL`, redeploy the frontend (Vite reads it at build time).

## Run on your PC
```
npm run install:all
cp backend/.env.example backend/.env      # fill MONGO_URI, JWT_SECRET
cp frontend/.env.example frontend/.env
npm run seed:demo
npm run dev:backend      # terminal 1  -> http://localhost:5000
npm run dev:frontend     # terminal 2  -> http://localhost:5173
```
Login: `admin / Admin@123` (change it). Demo password `Demo@123`: hod, teacher, accountant, 2504230100001, 2504230100002.
Students log in with roll number; default password is the roll number (or Welcome@123).

## First-time setup in the app
Admin > Subjects (add subjects, assign teachers) > People (add teachers; add or bulk upload students) > Timetable, Exams, Fees.

## Rules you can change
`backend/config.js`: minimum attendance (75%), whether approved leave counts as present, teacher edit window (7 days).
Attendance: % = counted present / classes held; P present, A absent, L approved leave. Dates use IST.
`frontend/src/college.js`: college name, address, phone (verify before going live). Logo: `frontend/public/logo.jpg`.
Notifications are in-app only (bell icon). Uploads are limited to 5 MB and stored in MongoDB (Atlas free tier is 512 MB).

## Notes
Render free tier sleeps when idle; the first request can take about a minute. Marksheet here is provisional, not the official AKTU/LU one.
