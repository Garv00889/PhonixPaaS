const crypto = require('crypto');
const db = require('./db');

const AUTH_SECRET = process.env.AUTH_SECRET || 'phonix-paas-secure-auth-secret-2026-edge';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  try {
    if (!storedHash || !storedHash.includes(':')) return false;
    const [salt, key] = storedHash.split(':');
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch (err) {
    return false;
  }
}

function createSessionToken(user) {
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role || 'admin',
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

function verifySessionToken(token) {
  try {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [payloadB64, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(payloadB64).digest('base64url');
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

// User Helpers
function getUsers() {
  const data = db.readDb();
  return data.users || [];
}

function getUserByEmail(email) {
  if (!email) return null;
  const users = getUsers();
  return users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
}

function getUserById(id) {
  if (!id) return null;
  const users = getUsers();
  return users.find(u => u.id === id);
}

function createUser({ name, email, password, role = 'developer' }) {
  const trimmedEmail = email.trim().toLowerCase();
  const existing = getUserByEmail(trimmedEmail);
  if (existing) {
    throw new Error('An account with this email address already exists.');
  }

  const data = db.readDb();
  if (!data.users) data.users = [];

  const newUser = {
    id: `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: (name || trimmedEmail.split('@')[0]).trim(),
    email: trimmedEmail,
    passwordHash: hashPassword(password),
    role,
    createdAt: new Date().toISOString()
  };

  data.users.push(newUser);
  db.writeDb(data);

  db.logActivity({
    type: 'SYSTEM',
    title: 'New Account Created',
    message: `User ${newUser.email} signed up on PhonixPaaS.`,
    status: 'SUCCESS'
  });

  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    createdAt: newUser.createdAt
  };
}

function authenticate(email, password) {
  const user = getUserByEmail(email);
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'admin',
    createdAt: user.createdAt
  };
}

// Seed initial admin user if no users exist
function ensureDefaultAdmin() {
  const users = getUsers();
  if (users.length === 0) {
    createUser({
      name: 'Phonix Admin',
      email: 'admin@phonixpaas.io',
      password: 'AdminPassword2026!',
      role: 'admin'
    });
    console.log('[Auth] Default administrator account seeded: admin@phonixpaas.io / AdminPassword2026!');
  }
}

// Cookie Parser helper
function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    if (!value) return;
    list[name] = decodeURIComponent(value);
  });
  return list;
}

// Extract auth token from request (Cookie or Authorization header)
function extractToken(req) {
  const cookies = parseCookies(req);
  if (cookies.phonix_token) {
    return cookies.phonix_token;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

// Authentication Middleware
function requireAuth(req, res, next) {
  const token = extractToken(req);
  const session = verifySessionToken(token);

  if (!session) {
    // If request accepts HTML (browser navigation), redirect to login
    const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
    if (acceptsHtml && req.method === 'GET') {
      const redirectUrl = encodeURIComponent(req.originalUrl || '/dashboard');
      return res.redirect(`/login?redirect=${redirectUrl}`);
    }
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in to access this resource.'
    });
  }

  req.user = session;
  next();
}

// Optional Auth (attaches req.user if token valid, but doesn't block)
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  const session = verifySessionToken(token);
  if (session) {
    req.user = session;
  }
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  getUsers,
  getUserByEmail,
  getUserById,
  createUser,
  authenticate,
  ensureDefaultAdmin,
  parseCookies,
  extractToken,
  requireAuth,
  optionalAuth
};
