const http = require('http');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DATA_FILE = path.join(DATA_DIR, 'arise-data.json');
const PORT = Number(process.env.PORT) || 3001;
const SESSION_COOKIE = 'arise_session';
const PASSWORD_ITERATIONS = 120000;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

let dbCache = null;
let writeQueue = Promise.resolve();

function createEmptyDatabase() {
  return {
    users: [],
    sessions: {},
    habitsByUser: {}
  };
}

async function loadDatabase() {
  if (dbCache) {
    return dbCache;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    dbCache = JSON.parse(raw);
  } catch {
    dbCache = createEmptyDatabase();
    await saveDatabase();
  }

  dbCache.users = Array.isArray(dbCache.users) ? dbCache.users : [];
  dbCache.sessions = dbCache.sessions && typeof dbCache.sessions === 'object' ? dbCache.sessions : {};
  dbCache.habitsByUser = dbCache.habitsByUser && typeof dbCache.habitsByUser === 'object' ? dbCache.habitsByUser : {};

  return dbCache;
}

function saveDatabase() {
  writeQueue = writeQueue.then(() => fs.writeFile(DATA_FILE, JSON.stringify(dbCache, null, 2), 'utf8'));
  return writeQueue;
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
  });
  res.end(text);
}

function applyCorsHeaders(res, origin) {
  if (!origin) {
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
}

function sendCorsPreflight(res, origin) {
  applyCorsHeaders(res, origin);
  res.writeHead(204, {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end();
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((cookies, pair) => {
    const [rawName, ...rawValueParts] = pair.trim().split('=');
    if (!rawName) {
      return cookies;
    }
    cookies[rawName] = decodeURIComponent(rawValueParts.join('=') || '');
    return cookies;
  }, {});
}

function getRequestUser(req, db) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionToken = cookies[SESSION_COOKIE];
  if (!sessionToken) {
    return null;
  }

  const userId = db.sessions[sessionToken];
  if (!userId) {
    return null;
  }

  return db.users.find((user) => user.id === userId) || null;
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, PASSWORD_ITERATIONS, 64, 'sha256').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  const stored = Buffer.from(user.passwordHash, 'hex');
  const computed = Buffer.from(hash, 'hex');
  return stored.length === computed.length && crypto.timingSafeEqual(stored, computed);
}

function createSession(res, db, userId) {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  db.sessions[sessionToken] = userId;
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; HttpOnly; Path=/; SameSite=Lax`);
  return sessionToken;
}

function clearSession(res, db, req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionToken = cookies[SESSION_COOKIE];
  if (sessionToken) {
    delete db.sessions[sessionToken];
  }
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function clearUserSessions(db, userId) {
  for (const [sessionToken, sessionUserId] of Object.entries(db.sessions)) {
    if (sessionUserId === userId) {
      delete db.sessions[sessionToken];
    }
  }
}

function normalizeHabitsForStorage(habits) {
  if (!Array.isArray(habits)) {
    return [];
  }

  return habits.map((habit) => ({
    name: String(habit?.name || '').trim(),
    frequency: ['daily', 'weekly', 'monthly', 'weekdays', 'weekends'].includes(String(habit?.frequency || '').toLowerCase())
      ? String(habit.frequency).toLowerCase()
      : 'daily',
    completed: Boolean(habit?.completed),
    startDate: String(habit?.startDate || ''),
    targetDate: String(habit?.targetDate || ''),
    notes: String(habit?.notes || ''),
    checkins: habit?.checkins && typeof habit.checkins === 'object' ? habit.checkins : {}
  })).filter((habit) => habit.name.length > 0);
}

async function handleRegister(req, res) {
  const db = await loadDatabase();
  const body = await readJsonBody(req);
  if (!body || typeof body !== 'object') {
    return sendJson(res, 400, { error: 'Invalid request body.' });
  }

  const email = normalizeEmail(body.email);
  const username = normalizeUsername(body.username);
  const password = String(body.password || '');

  if (!email || !username || password.length < 4) {
    return sendJson(res, 400, { error: 'Email, username, and password are required.' });
  }

  if (db.users.some((user) => user.username === username)) {
    return sendJson(res, 409, { error: 'That username is already registered.' });
  }

  if (db.users.some((user) => normalizeEmail(user.email) === email)) {
    return sendJson(res, 409, { error: 'That email is already registered.' });
  }

  const passwordRecord = hashPassword(password);

  const user = {
    id: crypto.randomUUID(),
    email,
    username,
    salt: passwordRecord.salt,
    passwordHash: passwordRecord.hash,
    createdAt: new Date().toISOString()
  };

  db.users.push(user);
  db.habitsByUser[user.id] = [];
  await saveDatabase();

  return sendJson(res, 201, { user: sanitizeUser(user) });
}

async function handleLogin(req, res) {
  const db = await loadDatabase();
  const body = await readJsonBody(req);
  if (!body || typeof body !== 'object') {
    return sendJson(res, 400, { error: 'Invalid request body.' });
  }

  const identifier = normalizeUsername(body.identifier || body.username || body.email);
  const password = String(body.password || '');
  const isEmailLogin = identifier.includes('@');
  const user = isEmailLogin
    ? db.users.find((entry) => normalizeEmail(entry.email) === identifier)
    : db.users.find((entry) => entry.username === identifier);

  if (!user) {
    return sendJson(res, 401, {
      error: isEmailLogin
        ? 'No account exists with that login information.'
        : 'Incorrect username/email.'
    });
  }

  if (!verifyPassword(password, user)) {
    return sendJson(res, 401, { error: 'Incorrect password.' });
  }

  createSession(res, db, user.id);
  await saveDatabase();
  return sendJson(res, 200, { user: sanitizeUser(user) });
}

async function handleLogout(req, res) {
  const db = await loadDatabase();
  clearSession(res, db, req);
  await saveDatabase();
  return sendJson(res, 200, { ok: true });
}

async function handleMe(req, res) {
  const db = await loadDatabase();
  const user = getRequestUser(req, db);
  if (!user) {
    return sendJson(res, 401, { error: 'Unauthorized.' });
  }
  return sendJson(res, 200, { user: sanitizeUser(user) });
}

async function handleUpdateMe(req, res) {
  const db = await loadDatabase();
  const user = getRequestUser(req, db);
  if (!user) {
    return sendJson(res, 401, { error: 'Unauthorized.' });
  }

  const body = await readJsonBody(req);
  if (!body || typeof body !== 'object') {
    return sendJson(res, 400, { error: 'Invalid request body.' });
  }

  const nextEmail = normalizeEmail(body.email ?? user.email);
  const nextUsername = normalizeUsername(body.username ?? user.username);
  const nextPassword = String(body.password || '').trim();

  if (!nextEmail || !nextUsername) {
    return sendJson(res, 400, { error: 'Username and email are required.' });
  }

  if (db.users.some((entry) => entry.id !== user.id && entry.username === nextUsername)) {
    return sendJson(res, 409, { error: 'That username is already registered.' });
  }

  if (db.users.some((entry) => entry.id !== user.id && normalizeEmail(entry.email) === nextEmail)) {
    return sendJson(res, 409, { error: 'That email is already registered.' });
  }

  user.username = nextUsername;
  user.email = nextEmail;

  if (nextPassword) {
    const passwordRecord = hashPassword(nextPassword);
    user.salt = passwordRecord.salt;
    user.passwordHash = passwordRecord.hash;
  }

  await saveDatabase();
  return sendJson(res, 200, { user: sanitizeUser(user) });
}

async function handleDeleteMe(req, res) {
  const db = await loadDatabase();
  const user = getRequestUser(req, db);
  if (!user) {
    return sendJson(res, 401, { error: 'Unauthorized.' });
  }

  db.users = db.users.filter((entry) => entry.id !== user.id);
  delete db.habitsByUser[user.id];
  clearUserSessions(db, user.id);
  clearSession(res, db, req);
  await saveDatabase();
  return sendJson(res, 200, { ok: true });
}

async function handleGetHabits(req, res) {
  const db = await loadDatabase();
  const user = getRequestUser(req, db);
  if (!user) {
    return sendJson(res, 401, { error: 'Unauthorized.' });
  }

  const habits = Array.isArray(db.habitsByUser[user.id]) ? db.habitsByUser[user.id] : [];
  return sendJson(res, 200, { habits });
}

async function handlePutHabits(req, res) {
  const db = await loadDatabase();
  const user = getRequestUser(req, db);
  if (!user) {
    return sendJson(res, 401, { error: 'Unauthorized.' });
  }

  const body = await readJsonBody(req);
  if (!body || typeof body !== 'object') {
    return sendJson(res, 400, { error: 'Invalid request body.' });
  }

  const habits = normalizeHabitsForStorage(body.habits);
  db.habitsByUser[user.id] = habits;
  await saveDatabase();
  return sendJson(res, 200, { habits });
}

async function serveStaticFile(req, res, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolvedPath = path.resolve(ROOT_DIR, relativePath);

  if (!resolvedPath.startsWith(ROOT_DIR)) {
    return sendText(res, 403, 'Forbidden');
  }

  try {
    const fileBuffer = await fs.readFile(resolvedPath);
    const extension = path.extname(resolvedPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream'
    });
    res.end(fileBuffer);
  } catch {
    if (pathname === '/login') {
      return serveStaticFile(req, res, '/Arise/login.html');
    }
    return sendText(res, 404, 'Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = requestUrl;
  const requestOrigin = req.headers.origin || '';

  applyCorsHeaders(res, requestOrigin);

  if (req.method === 'OPTIONS') {
    return sendCorsPreflight(res, requestOrigin);
  }

  if (pathname === '/api/register' && req.method === 'POST') {
    return handleRegister(req, res);
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    return handleLogin(req, res);
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    return handleLogout(req, res);
  }

  if (pathname === '/api/me' && req.method === 'GET') {
    return handleMe(req, res);
  }

  if (pathname === '/api/me' && req.method === 'PUT') {
    return handleUpdateMe(req, res);
  }

  if (pathname === '/api/me' && req.method === 'DELETE') {
    return handleDeleteMe(req, res);
  }

  if (pathname === '/api/habits' && req.method === 'GET') {
    return handleGetHabits(req, res);
  }

  if (pathname === '/api/habits' && req.method === 'PUT') {
    return handlePutHabits(req, res);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendText(res, 405, 'Method not allowed');
  }

  return serveStaticFile(req, res, pathname);
});

async function start() {
  await loadDatabase();
  server.listen(PORT, () => {
    console.log(`Arise server running at http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
