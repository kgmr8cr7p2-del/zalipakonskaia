ALTER TABLE "User"
ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "middleName" TEXT NOT NULL DEFAULT '';

UPDATE "User"
SET "firstName" = "name"
WHERE "firstName" = '';
