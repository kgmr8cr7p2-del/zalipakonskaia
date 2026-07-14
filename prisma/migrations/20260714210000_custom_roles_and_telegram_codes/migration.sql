CREATE TYPE "PermissionKey" AS ENUM (
  'VIEW_BOARD',
  'CREATE_TASKS',
  'EDIT_ALL_TASKS',
  'DELETE_TASKS',
  'MANAGE_COLUMNS',
  'VIEW_REPORTS',
  'VIEW_HISTORY',
  'USE_CHATS',
  'USE_TELEGRAM',
  'MANAGE_WORKSPACE',
  'MANAGE_USERS'
);

ALTER TABLE "Role" ALTER COLUMN "name" TYPE TEXT USING "name"::TEXT;
ALTER TABLE "Role" ADD COLUMN "systemKey" TEXT;
ALTER TABLE "Role" ADD COLUMN "permissions" "PermissionKey"[] NOT NULL DEFAULT ARRAY[]::"PermissionKey"[];

UPDATE "Role"
SET
  "systemKey" = "name",
  "name" = CASE "name"
    WHEN 'ADMIN' THEN 'Администратор'
    WHEN 'MANAGER' THEN 'Менеджер'
    WHEN 'EXECUTOR' THEN 'Исполнитель'
    ELSE "name"
  END,
  "permissions" = CASE "name"
    WHEN 'ADMIN' THEN ARRAY[
      'VIEW_BOARD', 'CREATE_TASKS', 'EDIT_ALL_TASKS', 'DELETE_TASKS', 'MANAGE_COLUMNS',
      'VIEW_REPORTS', 'VIEW_HISTORY', 'USE_CHATS', 'USE_TELEGRAM', 'MANAGE_WORKSPACE', 'MANAGE_USERS'
    ]::"PermissionKey"[]
    WHEN 'MANAGER' THEN ARRAY[
      'VIEW_BOARD', 'CREATE_TASKS', 'EDIT_ALL_TASKS', 'VIEW_REPORTS', 'VIEW_HISTORY', 'USE_CHATS', 'USE_TELEGRAM'
    ]::"PermissionKey"[]
    ELSE ARRAY['VIEW_BOARD', 'VIEW_REPORTS', 'VIEW_HISTORY', 'USE_CHATS', 'USE_TELEGRAM']::"PermissionKey"[]
  END;

CREATE UNIQUE INDEX "Role_systemKey_key" ON "Role"("systemKey");
DROP TYPE "RoleName";

CREATE TABLE "TelegramConnectCode" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramConnectCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramConnectCode_codeHash_key" ON "TelegramConnectCode"("codeHash");
CREATE UNIQUE INDEX "TelegramConnectCode_userId_key" ON "TelegramConnectCode"("userId");
CREATE INDEX "TelegramConnectCode_expiresAt_idx" ON "TelegramConnectCode"("expiresAt");
ALTER TABLE "TelegramConnectCode" ADD CONSTRAINT "TelegramConnectCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
