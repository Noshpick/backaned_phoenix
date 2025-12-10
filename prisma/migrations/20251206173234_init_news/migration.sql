-- CreateTable
CREATE TABLE "news" (
    "id" SERIAL NOT NULL,
    "titleRu" TEXT NOT NULL,
    "titleEn" TEXT,
    "contentRu" TEXT NOT NULL,
    "contentEn" TEXT,
    "photo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);
