ALTER TYPE "ActivityAction" ADD VALUE 'START_DATE_CHANGED';

ALTER TABLE "Task" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "titleKey" TEXT;

UPDATE "Task"
SET "startDate" = "createdAt"
WHERE "startDate" IS NULL;

ALTER TABLE "Task"
  ALTER COLUMN "startDate" SET NOT NULL,
  ALTER COLUMN "startDate" SET DEFAULT CURRENT_TIMESTAMP;

WITH normalized_titles AS (
  SELECT
    "id",
    lower(regexp_replace(btrim("title"), '\s+', ' ', 'g')) AS normalized_title,
    row_number() OVER (
      PARTITION BY lower(regexp_replace(btrim("title"), '\s+', ' ', 'g'))
      ORDER BY "createdAt", "id"
    ) AS duplicate_number
  FROM "Task"
)
UPDATE "Task" AS task
SET "titleKey" = normalized_titles.normalized_title || CASE
  WHEN normalized_titles.duplicate_number = 1 THEN ''
  ELSE '#legacy-' || task."id"
END
FROM normalized_titles
WHERE task."id" = normalized_titles."id";

ALTER TABLE "Task" ALTER COLUMN "titleKey" SET NOT NULL;

CREATE UNIQUE INDEX "Task_titleKey_key" ON "Task"("titleKey");
