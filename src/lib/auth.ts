import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

const COOKIE_NAME = "taskflow_session";
const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "development-secret");
export const isAuthBypassed = process.env.BYPASS_AUTH === "true" && process.env.NODE_ENV !== "production";

export async function hashPassword(password: string) {
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secret);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      if (typeof payload.userId === "string") {
        const user = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (user) return user;
      }
    } catch {
      // Fall through to local preview mode.
    }
  }
  if (isAuthBypassed) {
    return prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  }
  return null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
