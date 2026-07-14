ALTER TABLE "User" ADD COLUMN "approvedAt" TIMESTAMP(3);

UPDATE "User"
SET "approvedAt" = COALESCE("emailVerifiedAt", CURRENT_TIMESTAMP)
WHERE "emailVerifiedAt" IS NOT NULL;
