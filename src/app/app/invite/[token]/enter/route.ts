import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.invitation.findUnique({ where: { token } });
  if (!invite || !invite.userId || invite.expiresAt < new Date()) {
    return NextResponse.redirect(new URL(`/app/invite/${token}`, request.url));
  }
  await createSession(invite.userId);
  await prisma.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  return NextResponse.redirect(new URL("/app", request.url));
}
