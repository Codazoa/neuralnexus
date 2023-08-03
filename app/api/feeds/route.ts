import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from "../auth/[...nextauth]/route"

// add a new feed for a user
export async function PUT(request: Request) {
  
  // user validation
  const session = await getServerSession(authOptions);
  const currentUserEmail = session?.user?.email!;

  const data = await request.json();

  const user = await prisma.user.findUnique({
    where: { email: currentUserEmail }
  });

  if (!user) {
    return NextResponse.json({error: 'No user found'}, { status: 404})
  }

  // check if feed exists already
  const checkFeed = await prisma.feeds.findMany({
    where: { 
      userId: user.id,
      feed_url: data.url,
    }
  });

  if (checkFeed.length != 0) {
    return NextResponse.json({error: 'Duplicate Feed url'});
  }

  // creating the new feed entry
  const newFeed = await prisma.feeds.create({
    data: {
      userId: user.id,
      feed_url: data.url
    }
  });

  return NextResponse.json(newFeed);
}

// get all the feeds for a particular user
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const currentUserEmail = session?.user?.email!;

  const data = await request.json();

  const user = await prisma.user.findUnique({
    where: {email: currentUserEmail}
  });

  if (!user) {
    return NextResponse.json({error: 'No user found'}, { status: 404})
  }

  const feed_list = await prisma.feeds.findMany({
    where: {
      userId: user.id
    }
  });

  return NextResponse.json(feed_list);
}

// delete a feed from user account
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const currentUserEmail = session?.user?.email!;
  const targetFeedId = request.nextUrl.searchParams.get('feedId');

  const delFeed = await prisma.feeds.delete({
    where: {
      id: targetFeedId!
    }
  });
}