import { createCookieSessionStorage, redirect } from 'react-router';
import bcrypt from 'bcryptjs';
import { prisma } from './db.server';
import { generateSecureToken } from './crypto.server';

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Session storage using cookies
const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
  },
});

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  accountId: string;
  role: string;
};

/**
 * Get the session from the request.
 */
async function getSession(request: Request) {
  const cookie = request.headers.get('Cookie');
  return sessionStorage.getSession(cookie);
}

/**
 * Create a new user account.
 */
export async function signup(data: {
  email: string;
  password: string;
  name: string;
  companyName: string;
  allowedDomains?: string[];
}): Promise<{ user: SessionUser; headers: Headers }> {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });

  if (existingUser) {
    throw new Error('User already exists with this email');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, 10);

  // Create account and user in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        name: data.companyName,
        allowedDomains: data.allowedDomains || [],
      },
    });

    const user = await tx.user.create({
      data: {
        accountId: account.id,
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name,
        role: 'admin', // First user is admin
      },
    });

    // Create default widget config
    await tx.widgetConfig.create({
      data: {
        accountId: account.id,
        companyName: data.companyName,
      },
    });

    return user;
  });

  return createUserSession(result);
}

/**
 * Log in an existing user.
 */
export async function login(email: string, password: string): Promise<{ user: SessionUser; headers: Headers }> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    throw new Error('Invalid email or password');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  return createUserSession(user);
}

/**
 * Create a session for a user.
 */
async function createUserSession(user: {
  id: string;
  email: string;
  name: string | null;
  accountId: string;
  role: string;
}): Promise<{ user: SessionUser; headers: Headers }> {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  // Store session in database
  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  const session = await sessionStorage.getSession();
  session.set('token', token);
  session.set('userId', user.id);

  const headers = new Headers();
  headers.append('Set-Cookie', await sessionStorage.commitSession(session));

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      accountId: user.accountId,
      role: user.role,
    },
    headers,
  };
}

/**
 * Get the current user from the session.
 */
export async function getCurrentUser(request: Request): Promise<SessionUser | null> {
  const session = await getSession(request);
  const token = session.get('token');
  const userId = session.get('userId');

  if (!token || !userId) {
    return null;
  }

  // Verify session in database
  const dbSession = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!dbSession || dbSession.expiresAt < new Date() || dbSession.userId !== userId) {
    return null;
  }

  return {
    id: dbSession.user.id,
    email: dbSession.user.email,
    name: dbSession.user.name,
    accountId: dbSession.user.accountId,
    role: dbSession.user.role,
  };
}

/**
 * Require authentication - redirects to login if not authenticated.
 */
export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw redirect('/login');
  }
  return user;
}

/**
 * Log out the current user.
 */
export async function logout(request: Request): Promise<Headers> {
  const session = await getSession(request);
  const token = session.get('token');

  if (token) {
    // Delete session from database
    await prisma.session.deleteMany({
      where: { token },
    });
  }

  const headers = new Headers();
  headers.append('Set-Cookie', await sessionStorage.destroySession(session));

  return headers;
}

/**
 * Clean up expired sessions (run periodically).
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
  return result.count;
}

