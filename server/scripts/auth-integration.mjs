import 'dotenv/config';

if (!process.env.MONGODB_URI) {
  console.error('Set MONGODB_URI in server/.env before running this script.');
  process.exit(1);
}

if (/\/(investiq|prod)(\?|$)/.test(process.env.MONGODB_URI) && !process.env.ALLOW_NON_TEST_DB) {
  console.error('Point MONGODB_URI at a throwaway database (e.g. .../investiq_test) — this script writes and deletes users.');
  process.exit(1);
}

process.env.NODE_ENV = 'development';

const ROOT = new URL('../dist', import.meta.url).href;
const { connectDatabase } = await import(`${ROOT}/config/database.js`);
const { createApp } = await import(`${ROOT}/app.js`);

await connectDatabase();
const server = createApp().listen(5098);
const BASE = 'http://localhost:5098/api';

let cookie = '';
const call = async (path, { method = 'POST', body, token } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const rt = setCookie.find((c) => c.startsWith('iq_rt='));
  if (rt) cookie = rt.split(';')[0];
  return { status: res.status, json: await res.json() };
};

const check = (label, cond, extra = '') =>
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);

// weak password rejected
let r = await call('/auth/register', { body: { name: 'Aman', email: 'aman@test.in', password: 'short' } });
check('weak password -> 422', r.status === 422, r.json.details?.map(d => d.message).join('; '));

// register
r = await call('/auth/register', { body: { name: 'Aman Verma', email: 'aman@test.in', password: 'Sensex2026x', defaultMarket: 'IN' } });
check('register -> 201', r.status === 201);
check('base currency defaults to INR', r.json.data?.user?.preferences?.baseCurrency === 'INR', r.json.data?.user?.preferences?.baseCurrency);
check('password never returned', !JSON.stringify(r.json).includes('passwordHash'));
let access = r.json.data?.accessToken;
const firstCookie = cookie;

// duplicate email
r = await call('/auth/register', { body: { name: 'Other', email: 'aman@test.in', password: 'Sensex2026x' } });
check('duplicate email -> 409', r.status === 409, r.json.message);

// protected route
r = await call('/auth/me', { method: 'GET', token: access });
check('GET /auth/me with token -> 200', r.status === 200, r.json.data?.email);

r = await call('/auth/me', { method: 'GET' });
check('GET /auth/me without token -> 401', r.status === 401);

// wrong password
r = await call('/auth/login', { body: { email: 'aman@test.in', password: 'WrongPass123' } });
check('wrong password -> 401', r.status === 401);

// login
r = await call('/auth/login', { body: { email: 'aman@test.in', password: 'Sensex2026x' } });
check('login -> 200', r.status === 200);
access = r.json.data?.accessToken;

// refresh rotation
const beforeRotate = cookie;
r = await call('/auth/refresh');
check('refresh -> 200', r.status === 200);
check('refresh token rotated', cookie !== beforeRotate);
const rotatedToken = cookie;

// reuse detection
cookie = beforeRotate;
r = await call('/auth/refresh');
check('reused refresh token -> 401', r.status === 401, r.json.message);

// the whole family dies, including the token that was legitimately rotated
cookie = rotatedToken;
r = await call('/auth/refresh');
check('rotated sibling token also revoked -> 401', r.status === 401, r.json.message);

r = await call('/auth/login', { body: { email: 'aman@test.in', password: 'Sensex2026x' } });
access = r.json.data?.accessToken;

// update prefs
r = await call('/auth/me', { method: 'PATCH', token: access, body: { preferences: { baseCurrency: 'USD', defaultMarket: 'US' } } });
check('PATCH preferences -> 200', r.status === 200, `${r.json.data?.preferences?.baseCurrency}/${r.json.data?.preferences?.defaultMarket}`);

// logout kills session
r = await call('/auth/logout');
check('logout -> 200', r.status === 200);
r = await call('/auth/me', { method: 'GET', token: access });
check('access token dead after logout -> 401', r.status === 401, r.json.message);

// logout is scoped to one session — signing out here must not sign out other devices.
// The session created at registration is a different family and should still work.
cookie = firstCookie;
r = await call('/auth/refresh');
check('other device session survives logout -> 200', r.status === 200);

// but change-password revokes everything, everywhere
const survivingAccess = r.json.data?.accessToken;
r = await call('/auth/change-password', {
  token: survivingAccess,
  body: { currentPassword: 'Sensex2026x', newPassword: 'Nifty2026xyz' },
});
check('change password -> 200', r.status === 200);

r = await call('/auth/refresh');
check('all sessions revoked after password change -> 401', r.status === 401, r.json.message);

r = await call('/auth/login', { body: { email: 'aman@test.in', password: 'Sensex2026x' } });
check('old password rejected after change -> 401', r.status === 401);

r = await call('/auth/login', { body: { email: 'aman@test.in', password: 'Nifty2026xyz' } });
check('new password works -> 200', r.status === 200);

// --- google sign-in --------------------------------------------------------------------------------

r = await call('/auth/google', { body: {} });
check('google sign-in without a credential -> 422', r.status === 422, r.json.message);

r = await call('/auth/google', { body: { credential: 'not-a-real-google-id-token' } });
if (process.env.GOOGLE_CLIENT_ID) {
  check('a bogus google credential is rejected -> 401', r.status === 401, r.json.message);
} else {
  // With no client id the server cannot verify anything, and it must say so plainly rather than
  // blaming the token — that message is what makes a misconfigured deployment diagnosable.
  check(
    'an unconfigured server says so instead of blaming the token',
    r.status === 400 && /not configured/i.test(r.json.message ?? ''),
    r.json.message,
  );
}

const mongoose = (await import('mongoose')).default;
await mongoose.connection.collection('users').deleteMany({ email: 'aman@test.in' });
await mongoose.connection.collection('sessions').deleteMany({});
console.log('\nTest data cleaned up.');

server.close();
await mongoose.connection.close();
process.exit(0);
