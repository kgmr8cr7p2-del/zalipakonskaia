import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { RoleName, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashToken, randomToken } from "@/lib/crypto";

export const SESSION_COOKIE = "tkb_session";
const SESSION_DAYS = 14;

export type CurrentUser = User & { role: { name: RoleName } };

export async function createSession(userId: string) {
  const token = randomToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { userId, tokenHash, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { role: true } } },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAccountUser() {
  const user = await requireUser();
  if (!user.emailVerifiedAt) redirect("/verify-email?reason=unverified");
  return user;
}

export async function requireVerifiedUser() {
  const user = await requireAccountUser();
  if (!user.approvedAt) redirect("/pending-approval");
  return user;
}

export async function requireRole(roles: RoleName[]) {
  const user = await requireVerifiedUser();
  if (!roles.includes(user.role.name)) redirect("/no-access");
  return user;
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}
