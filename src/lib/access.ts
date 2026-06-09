import { WorkspaceRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "./prisma";

export async function requireWorkspaceMember(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { workspace: true }
  });
  if (!member) notFound();
  return member;
}

export async function requireWorkspaceEditor(workspaceId: string, userId: string) {
  const member = await requireWorkspaceMember(workspaceId, userId);
  if (member.role === WorkspaceRole.VIEWER || member.role === WorkspaceRole.EXECUTOR) {
    throw new Error("Недостаточно прав для управления пространством");
  }
  return member;
}

export async function requireCardWorker(cardId: string, userId: string) {
  const card = await requireCardAccess(cardId, userId);
  const member = await requireWorkspaceMember(card.board.workspaceId, userId);
  const canManage = member.role === WorkspaceRole.OWNER || member.role === WorkspaceRole.ADMIN || member.role === WorkspaceRole.MEMBER;
  if (!canManage && card.assigneeId !== userId) throw new Error("Работать с задачей может только назначенный исполнитель");
  return card;
}

export async function requireCardAccess(cardId: string, userId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { column: true, board: { include: { workspace: true } } }
  });
  if (!card) notFound();
  const member = await requireWorkspaceMember(card.board.workspaceId, userId);
  if (member.role === WorkspaceRole.EXECUTOR && card.assigneeId !== userId) notFound();
  return card;
}
