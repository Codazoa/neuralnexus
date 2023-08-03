-- CreateTable
CREATE TABLE "Feeds" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feed_url" TEXT NOT NULL,

    CONSTRAINT "Feeds_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Feeds" ADD CONSTRAINT "Feeds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
