-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedCategory" (
    "feedId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "FeedCategory_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feeds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("feedId", "categoryId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category" ("userId", "name");
