import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/auth/state
// Tells the unlock screen which mode to render in:
//   { initialized: false } -> fresh database, first key registers the owner
//   { initialized: true  } -> owner already exists, only the real key unlocks
// Unauthenticated by design — it is used by the locked screen.
// Must stay dynamic: the answer changes as the database is initialized.
export const dynamic = 'force-dynamic';

export async function GET() {
  const count = await prisma.apiKey.count();
  return NextResponse.json({ initialized: count > 0 });
}
