-- CreateTable
CREATE TABLE "ReadState" (
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReadState_userId_itemId_key" ON "ReadState"("userId", "itemId");
