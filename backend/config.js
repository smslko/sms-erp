// College policy. Change here, the app follows.
export const POLICY = {
  minAttendance: 75,          // required % (AKTU and LU both ask for 75)
  leaveCountsAsPresent: true, // approved leave (status "L") is condoned: counted as present
  editWindowDays: 7,          // teachers can edit attendance only this many days back (admin/HOD: any time)
};
// "Today" in India, whatever timezone the server runs in
export const istNow = () => { const d = new Date(Date.now() + 19800000); return { day: d.getUTCDay(), today: d.toISOString().slice(0, 10) }; };
