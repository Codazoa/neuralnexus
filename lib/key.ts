// Server-side auth core for the locally-generated private key scheme.
//
// - The key is created on the client (browser crypto) and never stored
//   in plaintext anywhere: the server keeps only sha256(key) in the DB.
// - Unlocking (POST /api/auth/login) mints an HttpOnly cookie carrying
//   an HMAC-signed session token, so server components/routes can
//   authenticate without the raw key.
// - API routes also accept `Authorization: Bearer <key>` as a fallback.

import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { prisma } from './prisma';

export const AUTH_COOKIE = 'nn_auth';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Insecure default keeps the local app working with zero config.
// If you ever expose this machine's port publicly, set NN_SESSION_SECRET.
function sessionSecret(): string {
  return process.env.NN_SESSION_SECRET || 'neuralnexus-local-insecure-secret';
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function signSession(userId: string, apiKeyId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ u: userId, k: apiKeyId, exp: Date.now() + SESSION_MAX_AGE * 1000 })
  ).toString('base64url');
  const sig = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySession(token: string): { userId: string; apiKeyId: string } | null {
  const idx = token.lastIndexOf('.');
  if (idx === -1) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.u !== 'string' || typeof data.k !== 'string') return null;
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return { userId: data.u, apiKeyId: data.k };
  } catch {
    return null;
  }
}

// Shape safe to ship to the client.
export type PublicUser = {
  id: string;
  name: string | null;
  age: number | null;
  bio: string | null;
  image: string | null;
};

export function publicUser(u: {
  id: string;
  name: string | null;
  age: number | null;
  bio: string | null;
  image: string | null;
}): PublicUser {
  return { id: u.id, name: u.name, age: u.age, bio: u.bio, image: u.image };
}

// Server components + route handlers: resolve the signed cookie to a User.
export async function getCurrentUser() {
  const token = cookies().get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const sess = verifySession(token);
  if (!sess) return null;
  const apiKey = await prisma.apiKey.findUnique({ where: { id: sess.apiKeyId } });
  if (!apiKey) return null;
  const user = await prisma.user.findUnique({ where: { id: apiKey.userId } });
  return user;
}

// Route handlers: cookie session first, then an explicit Bearer key.
export async function apiKeyFromRequest(req: NextRequest) {
  const token = cookies().get(AUTH_COOKIE)?.value;
  const sess = token ? verifySession(token) : null;
  if (sess) {
    const apiKey = await prisma.apiKey.findUnique({ where: { id: sess.apiKeyId } });
    if (apiKey) return apiKey;
  }
  const header = req.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (match) {
    const apiKey = await prisma.apiKey.findFirst({
      where: { keyHash: sha256Hex(match[1].trim()) },
    });
    if (apiKey) return apiKey;
  }
  return null;
}

// Returns the User for this request, or null (callers respond 401).
export async function requireUser(req: NextRequest) {
  const apiKey = await apiKeyFromRequest(req);
  if (!apiKey) return null;
  return prisma.user.findUnique({ where: { id: apiKey.userId } });
}
