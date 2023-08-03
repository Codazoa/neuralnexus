import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from "../auth/[...nextauth]/route"

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  const currentUserEmail = session?.user?.email!;

  const data = await request.json();

  const user = await prisma.user.findUnique({
    where: {email: currentUserEmail}
  });

  if (!user) {
    return NextResponse.json({error: 'No user found'}, { status: 404})
  }

  const newFeed = await prisma.feeds.create({
    data: {
      userId: user.id,
      feed_url: data.url
    }
  });

  return NextResponse.json(newFeed);
}

export async function GET(request: Request) {
  const users = await prisma.user.findMany();

  return NextResponse.json(users);
}