/* eslint-disable */
// Tiny Express + cookie-session app. NOT production: hard-coded creds, no CSRF.
// Single purpose: give the Verifai crawler a stable local target on :8080.
const express = require('express');

const PORT = 8080;
const VALID_USER = 'qa@local.test';
const VALID_PASS = 'Passw0rd!';

const app = express();
app.use(express.urlencoded({ extended: false }));

const sessions = new Set();
function makeSid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function authed(req) {
  const m = (req.headers.cookie || '').match(/sid=([^;]+)/);
  return m && sessions.has(m[1]);
}

function layout(title, body) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${title} · Sample</title>
<style>body{font-family:system-ui;background:#f8fafc;color:#0f172a;margin:0}
nav{background:#fff;border-bottom:1px solid #e2e8f0;padding:12px 24px;display:flex;gap:16px}
nav a{color:#4f46e5;text-decoration:none;font-weight:500}
main{max-width:720px;margin:24px auto;padding:24px;background:#fff;border-radius:12px;border:1px solid #e2e8f0}
h1{margin-top:0}label{display:block;margin:12px 0 4px;font-weight:500;font-size:14px}
input{width:100%;height:36px;padding:0 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px}
button{margin-top:16px;height:36px;padding:0 16px;background:#4f46e5;color:#fff;border:0;border-radius:8px;font-weight:500;cursor:pointer}
button:hover{background:#4338ca}.err{color:#e11d48;font-size:13px;margin-top:8px}</style>
</head><body>${body}</body></html>`;
}

app.get('/login', (req, res) => {
  if (authed(req)) return res.redirect('/dashboard');
  const err = req.query.err ? `<p class="err">Invalid credentials</p>` : '';
  res.send(layout('Sign in', `
    <main>
      <h1>Sample sign-in</h1>
      <form method="post" action="/login">
        <label>Email</label>
        <input name="email" type="email" autocomplete="username" required />
        <label>Password</label>
        <input name="password" type="password" autocomplete="current-password" required />
        ${err}
        <button type="submit">Sign in</button>
      </form>
    </main>`));
});

app.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (email === VALID_USER && password === VALID_PASS) {
    const sid = makeSid();
    sessions.add(sid);
    res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly`);
    return res.redirect('/dashboard');
  }
  res.redirect('/login?err=1');
});

function requireAuth(req, res, next) {
  if (!authed(req)) return res.redirect('/login');
  next();
}

app.get('/dashboard', requireAuth, (req, res) => {
  res.send(layout('Dashboard', `
    <nav>
      <a href="/dashboard">Dashboard</a>
      <a href="/users">Users</a>
      <a href="/settings">Settings</a>
      <a href="/contact">Contact</a>
      <a href="/logout" style="margin-left:auto;color:#e11d48">Logout</a>
    </nav>
    <main>
      <h1>Dashboard</h1>
      <p>Welcome back. This is a tiny app the Verifai crawler can map.</p>
      <ul>
        <li><a href="/users">Browse users</a></li>
        <li><a href="/settings">Settings</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    </main>`));
});

app.get('/users', requireAuth, (req, res) => {
  res.send(layout('Users', `
    <nav><a href="/dashboard">Dashboard</a><a href="/users">Users</a><a href="/settings">Settings</a><a href="/contact">Contact</a></nav>
    <main>
      <h1>Users</h1>
      <ul><li>QA</li><li>Alice</li><li>Bob</li></ul>
      <a href="/dashboard">← back</a>
    </main>`));
});

app.get('/settings', requireAuth, (req, res) => {
  res.send(layout('Settings', `
    <nav><a href="/dashboard">Dashboard</a><a href="/users">Users</a><a href="/settings">Settings</a><a href="/contact">Contact</a></nav>
    <main>
      <h1>Settings</h1>
      <form method="post" action="/settings"><label>Display name</label><input name="name"/><button type="submit">Save</button></form>
    </main>`));
});

app.post('/settings', requireAuth, (req, res) => res.redirect('/settings'));

app.get('/contact', (req, res) => {
  res.send(layout('Contact', `
    <main>
      <h1>Contact</h1>
      <form method="post" action="/contact"><label>Name</label><input name="name"/><label>Message</label><input name="msg"/><button type="submit">Send</button></form>
      <p><a href="/dashboard">Dashboard</a></p>
    </main>`));
});

app.post('/contact', (req, res) => res.send(layout('Sent', '<main><h1>Thanks!</h1><a href="/dashboard">Home</a></main>')));

app.get('/logout', (req, res) => {
  const m = (req.headers.cookie || '').match(/sid=([^;]+)/);
  if (m) sessions.delete(m[1]);
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0');
  res.redirect('/login');
});

app.get('/', (req, res) => res.redirect(authed(req) ? '/dashboard' : '/login'));

app.listen(PORT, () => {
  console.log(`[sample-target] http://localhost:${PORT}  (creds: ${VALID_USER} / ${VALID_PASS})`);
});
