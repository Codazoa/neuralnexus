import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  AUTH_COOKIE,
  SESSION_MAX_AGE,
  sha256Hex,
  signSession,
} from '@/lib/key';

// POST /api/auth/login
// Body: { key: string }
//
// First valid key ever sent to this database becomes the owner's key
// (local registration, no sign-up). Later unlocks verify against the
// stored hash. The response sets an HttpOnly signed cookie so the UI
// stays unlocked.
export async function POST(req: Request) {
  let body: { key?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const key = (body.key || '').trim();
  if (!key) {
    return NextResponse.json({ error: 'Key is required' }, { status: 400 });
  }

  const keyHash = sha256Hex(key);
  let apiKey = await prisma.apiKey.findFirst({ where: { keyHash } });

  if (apiKey) {
    // Existing key — validate and issue a session.
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });
    const user = await prisma.user.findUnique({ where: { id: apiKey.userId } });
    if (!user) {
      return NextResponse.json({ error: 'Key is not associated with a user' }, { status: 403 });
    }

    const token = signSession(user.id, apiKey.id);
    const res = NextResponse.json({
      registered: true,
      user: {
        id: user.id,
        name: user.name,
        age: user.age,
        bio: user.bio,
        image: user.image,
      },
    });
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.NN_COOKIE_INSECURE !== '1',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  }

  // No key matched — only the very first key on a fresh database may
  // register (local-device use case). Anything after that is rejected
  // so a random key can't claim ownership of an existing user.
  const existing = await prisma.apiKey.findFirst();
  if (existing) {
    return NextResponse.json({ error: 'That key is not registered on this device' }, { status: 401 });
  }

  // Brand new database: create the user + key and issue a session.
  const user = await prisma.user.create({ data: {} });
  apiKey = await prisma.apiKey.create({
    data: { keyHash, userId: user.id, label: 'device-key' },
  });

  const token = signSession(user.id, apiKey!.id);
  const res = NextResponse.json({
    registered: false,
    user: {
      id: user.id,
      name: user.name,
      age: user.age,
      bio: user.bio,
      image: user.image,
    },
  });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.NN_COOKIE_INSECURE !== '1',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
