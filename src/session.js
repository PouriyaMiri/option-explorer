// src/session.js
export function getSessionId() {
  let sid = localStorage.getItem('session_id');
  if (!sid) {
    const rand = Math.random().toString(36).slice(2);
    const ts = Date.now().toString(36);
    sid = `${ts}_${rand}`;
    localStorage.setItem('session_id', sid);
  }
  return sid;
}
