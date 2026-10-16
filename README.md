# SMS Lucknow ERP

```
sms-erp/                  <- repo root (push THIS folder to GitHub)
├── backend/              Node + Express + MongoDB API   -> deploy on Render
├── frontend/             React (Vite) website           -> deploy on Netlify OR Vercel
├── netlify.toml, render.yaml, package.json, README.md
```
Keep this structure. Do not move files out of `backend/` or `frontend/`.

## How login works
- **Admin** is created automatically the first time the backend starts. Login tab: *Teacher / Staff / Admin*, username `admin`, password = the `ADMIN_PASSWORD` you set on Render (if you did not set it: `Admin@123`, change it from Profile).
- Admin (and HOD) create everyone else from **People**: Students, Teachers (admin also HODs, Accountants, Admins). One by one, or **Bulk import** (CSV file or paste).
- Every new account gets one **common default password** (admin sets it in **Settings**, default `Welcome@123`). Users can keep it or change it from Profile; a small reminder is shown but never forced.
- Students log in with their roll number. Teachers/staff with the username the admin gave.
- **Forgot password:** admin or HOD opens People > Reset password (gives the common default password again). HOD can manage students and teachers only.
- **Admin forgot own password:** on Render set `ADMIN_PASSWORD` to a new value and `RESET_ADMIN=true`, redeploy, log in, then delete `RESET_ADMIN`.

## First-time setup (the dashboard shows a "Getting started" checklist)
1. Courses are already loaded (B.Tech, MBA via AKTU; BBA, BCA, B.Com, B.Com Hons, B.Voc via LU). Edit under Courses if needed.
2. People > Teachers: add teachers. 3. Subjects: add subjects and assign teachers. 4. People > Students: add or bulk import. 5. Timetable, Exams, Fees.

## Deploy
**Database:** MongoDB Atlas (free). Create a cluster + database user, Network Access `0.0.0.0/0`, copy the connection string and end it with `/sms_erp`.

**Backend on Render:** New > Web Service > repo. Root Directory `backend`, Build `npm install`, Start `npm start`.
Environment: `MONGO_URI`, `JWT_SECRET` (long random text), `ADMIN_PASSWORD`, `CLIENT_URL` (your website URL, no trailing slash; two sites: separate with a comma).
No shell or seed command is needed. Open the Render URL: it should show `{"ok":true,...}`. Check Logs for "Admin account created".

**Frontend on Netlify:** Import from Git. Base directory `frontend`, build `npm run build`, publish `dist`. Environment variable `VITE_API_URL` = Render URL (no trailing slash, no `/api`). Redeploy after changing it.
Without Git: run `npm install && npm run build` in `frontend` (with `frontend/.env` set) and drag `dist` into Netlify Drop.
**Frontend on Vercel:** Root Directory `frontend`, Framework Vite, same `VITE_API_URL`.

## Run on your PC
```
npm run install:all
cp backend/.env.example backend/.env     # fill MONGO_URI and JWT_SECRET
cp frontend/.env.example frontend/.env
npm run dev:backend      # terminal 1 -> http://localhost:5000
npm run dev:frontend     # terminal 2 -> http://localhost:5173
npm run seed:demo        # optional demo users (password Demo@123): hod, teacher, accountant, 2504230100001, 2504230100002
```

## Rules you can change
`backend/config.js`: minimum attendance (75%), approved leave counts as present, teacher edit window (7 days).
Attendance % = counted present / classes held; P present, A absent, L approved leave. Dates use IST.
`frontend/src/college.js`: college name, address, phone (verify before going live). Logo: `frontend/public/logo.jpg`.
Light/dark mode: button in the top bar (remembers your choice).
Notifications are in-app only (bell icon). Uploads max 5 MB, stored in MongoDB (Atlas free tier is 512 MB).

## Not included
Online payment, email/SMS, library, transport, admission. Marksheet is provisional, not the official AKTU/LU one.
Render free tier sleeps when idle; the first request can take about a minute.
