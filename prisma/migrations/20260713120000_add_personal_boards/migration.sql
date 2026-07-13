ALTER TABLE "Board" ADD COLUMN "ownerId" TEXT;

CREATE INDEX "Board_ownerId_idx" ON "Board"("ownerId");

ALTER TABLE "Board"
ADD CONSTRAINT "Board_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
