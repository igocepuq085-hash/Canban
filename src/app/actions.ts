"use server";

import { Priority, StageStatus, WorkspaceRole } from "@prisma/client";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCardAccess, requireCardWorker, requireWorkspaceEditor, requireWorkspaceMember } from "@/lib/access";
import { createSession, destroySession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { buildInsight } from "@/lib/ai-analysis";
import { actualProgress, stagePlannedProgress } from "@/lib/progress";
import { prisma } from "@/lib/prisma";
import { analyzeRisk } from "@/lib/risk";
import { parseTaskWorkbook } from "@/lib/task-import";
import { validateExecutorTransition, validateReviewReturn } from "@/lib/transition";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const optionalDate = (value: string) => (value ? new Date(`${value}T12:00:00`) : null);

async function refreshCardAnalysis(cardId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: { stages: { orderBy: { position: "asc" } } }
  });
  if (!card) return;
  const planned = card.stages.length
    ? stagePlannedProgress(card.stages)
    : stagePlannedProgress([
        {
          plannedStartDate: card.plannedStartDate,
          plannedEndDate: card.plannedEndDate,
          plannedWeight: 1,
          actualProgress: card.manualProgress
        }
      ]);
  const actual = actualProgress(card.stages, card.manualProgress);
  const risk = analyzeRisk({
    dueDate: card.dueDate,
    assigneeId: card.assigneeId,
    plannedProgress: planned,
    actualProgress: actual,
    updatedAt: card.updatedAt,
    stages: card.stages
  });
  const insight = buildInsight(risk);

  await prisma.$transaction([
    prisma.card.update({
      where: { id: cardId },
      data: {
        riskLevel: risk.level,
        riskScore: risk.score,
        stuckFlag: risk.stuckFlag,
        stuckReason: risk.issues[0] ?? null
      }
    }),
    prisma.taskAiInsight.create({
      data: {
        cardId,
        riskLevel: insight.riskLevel,
        delayPercent: insight.delayPercent,
        delayDays: 0,
        summary: insight.summary,
        issuesJson: JSON.stringify(insight.issues),
        recommendationsJson: JSON.stringify(insight.recommendations)
      }
    })
  ]);
}

export async function registerAction(formData: FormData) {
  const name = text(formData, "name");
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  if (name.length < 2 || !email.includes("@") || password.length < 8) throw new Error("Проверьте данные регистрации");
  if (await prisma.user.findUnique({ where: { email } })) throw new Error("Электронная почта уже зарегистрирована");
  const user = await prisma.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  await createSession(user.id);
  redirect("/app");
}

export async function loginAction(formData: FormData) {
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) throw new Error("Неверный email или пароль");
  await createSession(user.id);
  redirect("/app");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function returnToPreviewOwnerAction() {
  await destroySession();
  redirect("/app");
}

export async function createWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  const name = text(formData, "name");
  if (!name) throw new Error("Введите название");
  const workspace = await prisma.workspace.create({
    data: {
      name,
      description: text(formData, "description") || null,
      ownerId: user.id,
      members: { create: { userId: user.id, role: WorkspaceRole.OWNER } }
    }
  });
  redirect(`/app/workspaces/${workspace.id}`);
}

export async function createBoardAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = text(formData, "workspaceId");
  await requireWorkspaceEditor(workspaceId, user.id);
  const board = await prisma.board.create({
    data: {
      workspaceId,
      name: text(formData, "name"),
      description: text(formData, "description") || null,
      columns: {
        create: [
          { name: "Входящие", wipLimit: null },
          { name: "Готово к работе", wipLimit: 10 },
          { name: "В работе", wipLimit: 3 },
          { name: "Проверка и согласование", wipLimit: 2 },
          { name: "Выполнено", wipLimit: null }
        ].map((column, position) => ({ ...column, position }))
      }
    }
  });
  const columns = await prisma.boardColumn.findMany({ where: { boardId: board.id }, orderBy: { position: "asc" } });
  await prisma.boardStageTransition.createMany({
    data: columns.slice(0, -1).map((column, index) => ({
      sourceColumnId: column.id,
      targetColumnId: columns[index + 1].id
    }))
  });
  redirect(`/app/workspaces/${workspaceId}/boards/${board.id}`);
}

export async function createCardAction(formData: FormData) {
  const user = await requireUser();
  const boardId = text(formData, "boardId");
  const board = await prisma.board.findUnique({ where: { id: boardId }, include: { columns: { orderBy: { position: "asc" } } } });
  if (!board) throw new Error("Доска не найдена");
  await requireWorkspaceEditor(board.workspaceId, user.id);
  const firstColumn = board.columns[0];
  if (!firstColumn) throw new Error("Сначала создайте колонку");
  const card = await prisma.card.create({
    data: {
      boardId,
      columnId: firstColumn.id,
      title: text(formData, "title"),
      description: text(formData, "description") || null,
      creatorId: user.id,
      assigneeId: text(formData, "assigneeId") || null,
      priority: (text(formData, "priority") || Priority.MEDIUM) as Priority,
      dueDate: optionalDate(text(formData, "dueDate")),
      plannedStartDate: optionalDate(text(formData, "plannedStartDate")),
      plannedEndDate: optionalDate(text(formData, "plannedEndDate"))
    }
  });
  await refreshCardAnalysis(card.id);
  redirect(`/app/workspaces/${board.workspaceId}/cards/${card.id}`);
}

export async function importTasksAction(formData: FormData) {
  const user = await requireUser();
  const boardId = text(formData, "boardId");
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Загрузите файл в формате .xlsx");
  if (file.size > 5 * 1024 * 1024) throw new Error("Файл должен быть меньше 5 МБ");
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      columns: { orderBy: { position: "asc" }, include: { _count: { select: { cards: true } } } },
      workspace: { include: { members: { include: { user: true } } } }
    }
  });
  if (!board) throw new Error("Доска не найдена");
  await requireWorkspaceEditor(board.workspaceId, user.id);
  const { tasks, errors } = await parseTaskWorkbook(Buffer.from(await file.arrayBuffer()));
  const fallbackColumn = board.columns[0];
  if (!fallbackColumn) throw new Error("У доски нет этапов");
  const columns = new Map(board.columns.map((column) => [column.name.toLowerCase(), column]));
  const columnCounts = new Map(board.columns.map((column) => [column.id, column._count.cards]));
  const members = new Map(
    board.workspace.members.flatMap((member) => [
      [member.user.name.toLowerCase(), member.userId],
      [member.user.email.toLowerCase(), member.userId]
    ])
  );

  for (const task of tasks) {
    const requestedColumn = task.stage ? columns.get(task.stage.toLowerCase()) : null;
    const requestedCount = requestedColumn ? columnCounts.get(requestedColumn.id) ?? 0 : 0;
    const targetColumn =
      requestedColumn && (!requestedColumn.wipLimit || requestedCount < requestedColumn.wipLimit)
        ? requestedColumn
        : fallbackColumn;
    const card = await prisma.card.create({
      data: {
        boardId,
        columnId: targetColumn.id,
        title: task.title,
        description: task.description,
        creatorId: user.id,
        assigneeId: task.assignee ? members.get(task.assignee.toLowerCase()) ?? null : null,
        priority: task.priority,
        dueDate: task.dueDate,
        plannedStartDate: task.plannedStartDate,
        plannedEndDate: task.plannedEndDate,
        manualProgress: task.progress
      }
    });
    columnCounts.set(targetColumn.id, (columnCounts.get(targetColumn.id) ?? 0) + 1);
    await refreshCardAnalysis(card.id);
  }
  redirect(`/app/workspaces/${board.workspaceId}/boards/${boardId}?imported=${tasks.length}&skipped=${errors.length}`);
}

export async function moveCardAction(formData: FormData) {
  const user = await requireUser();
  const cardId = text(formData, "cardId");
  const columnId = text(formData, "columnId");
  const comment = text(formData, "comment");
  const card = await requireCardAccess(cardId, user.id);
  validateExecutorTransition({ assigneeId: card.assigneeId, userId: user.id, comment });
  const transition = await prisma.boardStageTransition.findUnique({
    where: { sourceColumnId_targetColumnId: { sourceColumnId: card.columnId, targetColumnId: columnId } },
    include: { targetColumn: { include: { _count: { select: { cards: true } } } } }
  });
  if (!transition || transition.targetColumn.boardId !== card.boardId) throw new Error("Этот переход не разрешён правилами доски");
  if (transition.targetColumn.wipLimit && transition.targetColumn._count.cards >= transition.targetColumn.wipLimit) {
    throw new Error("Достигнут лимит незавершённой работы для следующего этапа");
  }
  await prisma.$transaction([
    prisma.card.update({ where: { id: cardId }, data: { columnId } }),
    prisma.cardComment.create({ data: { cardId, userId: user.id, body: comment } }),
    prisma.cardActivityLog.create({
      data: { cardId, userId: user.id, action: "CARD_PULLED", oldValue: card.columnId, newValue: transition.targetColumn.name }
    }),
    prisma.cardActivityLog.create({ data: { cardId, userId: user.id, action: "COMMENT_ADDED", newValue: comment } })
  ]);
  revalidatePath(`/app/workspaces/${card.board.workspaceId}/boards/${card.boardId}`);
}

export async function moveCardViaTransitionAction(sourceCardId: string, targetColumnId: string, comment = "") {
  const user = await requireUser();
  const card = await requireCardAccess(sourceCardId, user.id);
  validateExecutorTransition({ assigneeId: card.assigneeId, userId: user.id, comment });
  const transition = await prisma.boardStageTransition.findUnique({
    where: {
      sourceColumnId_targetColumnId: {
        sourceColumnId: card.columnId,
        targetColumnId
      }
    },
    include: { targetColumn: { include: { _count: { select: { cards: true } } } } }
  });
  if (!transition || transition.targetColumn.boardId !== card.boardId) {
    throw new Error("Переход в этот этап не разрешён правилами доски");
  }
  if (transition.targetColumn.wipLimit && transition.targetColumn._count.cards >= transition.targetColumn.wipLimit) {
    throw new Error("Достигнут лимит незавершённой работы для следующего этапа");
  }
  await prisma.$transaction([
    prisma.card.update({ where: { id: sourceCardId }, data: { columnId: targetColumnId } }),
    prisma.cardComment.create({ data: { cardId: sourceCardId, userId: user.id, body: comment } }),
    prisma.cardActivityLog.create({
      data: {
        cardId: sourceCardId,
        userId: user.id,
        action: "CARD_PULLED",
        oldValue: card.columnId,
        newValue: transition.targetColumn.name
      }
    }),
    prisma.cardActivityLog.create({ data: { cardId: sourceCardId, userId: user.id, action: "COMMENT_ADDED", newValue: comment } })
  ]);
  revalidatePath(`/app/workspaces/${card.board.workspaceId}/boards/${card.boardId}`);
}

export async function returnCardAction(formData: FormData) {
  const user = await requireUser();
  const cardId = text(formData, "cardId");
  const comment = text(formData, "comment");
  const card = await requireCardAccess(cardId, user.id);
  const membership = await requireWorkspaceMember(card.board.workspaceId, user.id);
  const canReview =
    membership.role === WorkspaceRole.OWNER ||
    membership.role === WorkspaceRole.ADMIN ||
    membership.role === WorkspaceRole.MEMBER;
  validateReviewReturn({ canReview, comment });
  if (!/провер|соглас|выполн|review|done/i.test(card.column.name)) {
    throw new Error("Вернуть задачу можно только с этапа проверки или выполнения");
  }
  const transition = await prisma.boardStageTransition.findFirst({
    where: { targetColumnId: card.columnId, sourceColumn: { boardId: card.boardId } },
    include: { sourceColumn: { include: { _count: { select: { cards: true } } } } },
    orderBy: { createdAt: "asc" }
  });
  if (!transition) throw new Error("Для текущего этапа нет предыдущего этапа");
  if (transition.sourceColumn.wipLimit && transition.sourceColumn._count.cards >= transition.sourceColumn.wipLimit) {
    throw new Error("На предыдущем этапе достигнут лимит задач");
  }
  await prisma.$transaction([
    prisma.card.update({ where: { id: cardId }, data: { columnId: transition.sourceColumnId } }),
    prisma.cardComment.create({ data: { cardId, userId: user.id, body: `Возврат на доработку: ${comment}` } }),
    prisma.cardActivityLog.create({
      data: { cardId, userId: user.id, action: "CARD_RETURNED", oldValue: card.columnId, newValue: transition.sourceColumn.name }
    })
  ]);
  revalidatePath(`/app/workspaces/${card.board.workspaceId}/boards/${card.boardId}`);
  revalidatePath(`/app/workspaces/${card.board.workspaceId}/cards/${cardId}`);
}

export async function assignCardAction(formData: FormData) {
  const user = await requireUser();
  const cardId = text(formData, "cardId");
  const assigneeId = text(formData, "assigneeId");
  const card = await requireCardAccess(cardId, user.id);
  await requireWorkspaceEditor(card.board.workspaceId, user.id);
  if (assigneeId) {
    await requireWorkspaceMember(card.board.workspaceId, assigneeId);
  }
  await prisma.$transaction([
    prisma.card.update({ where: { id: cardId }, data: { assigneeId: assigneeId || null } }),
    prisma.cardActivityLog.create({
      data: { cardId, userId: user.id, action: "ASSIGNEE_UPDATED", oldValue: card.assigneeId, newValue: assigneeId || null }
    })
  ]);
  revalidatePath(`/app/workspaces/${card.board.workspaceId}/boards/${card.boardId}`);
  revalidatePath(`/app/workspaces/${card.board.workspaceId}/cards/${cardId}`);
}

export async function updateProgressAction(formData: FormData) {
  const user = await requireUser();
  const cardId = text(formData, "cardId");
  const card = await requireCardWorker(cardId, user.id);
  const progress = Math.max(0, Math.min(100, Number(text(formData, "progress"))));
  await prisma.$transaction([
    prisma.card.update({ where: { id: cardId }, data: { manualProgress: progress } }),
    prisma.progressSnapshot.create({
      data: {
        cardId,
        snapshotDate: new Date(),
        plannedPercent: Number(text(formData, "plannedProgress")) || 0,
        actualPercent: progress,
        source: "MANUAL",
        createdById: user.id,
        comment: text(formData, "comment") || null
      }
    }),
    prisma.cardActivityLog.create({
      data: { cardId, userId: user.id, action: "PROGRESS_UPDATED", oldValue: String(card.manualProgress), newValue: String(progress) }
    })
  ]);
  await refreshCardAnalysis(cardId);
  revalidatePath(`/app/workspaces/${card.board.workspaceId}/cards/${cardId}`);
}

export async function createStageAction(formData: FormData) {
  const user = await requireUser();
  const cardId = text(formData, "cardId");
  const card = await requireCardWorker(cardId, user.id);
  const position = await prisma.taskStage.count({ where: { cardId } });
  await prisma.taskStage.create({
    data: {
      cardId,
      name: text(formData, "name"),
      position,
      plannedWeight: Number(text(formData, "plannedWeight")) || 1,
      actualProgress: Number(text(formData, "actualProgress")) || 0,
      status: (text(formData, "status") || StageStatus.NOT_STARTED) as StageStatus,
      isBlocking: formData.get("isBlocking") === "on",
      plannedStartDate: optionalDate(text(formData, "plannedStartDate")),
      plannedEndDate: optionalDate(text(formData, "plannedEndDate"))
    }
  });
  await refreshCardAnalysis(cardId);
  revalidatePath(`/app/workspaces/${card.board.workspaceId}/cards/${cardId}`);
}

export async function addCommentAction(formData: FormData) {
  const user = await requireUser();
  const cardId = text(formData, "cardId");
  const card = await requireCardAccess(cardId, user.id);
  const body = text(formData, "body");
  if (!body) return;
  await prisma.$transaction([
    prisma.cardComment.create({ data: { cardId, userId: user.id, body } }),
    prisma.cardActivityLog.create({ data: { cardId, userId: user.id, action: "COMMENT_ADDED", newValue: body } })
  ]);
  revalidatePath(`/app/workspaces/${card.board.workspaceId}/cards/${cardId}`);
}

export async function inviteMemberAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = text(formData, "workspaceId");
  const member = await requireWorkspaceMember(workspaceId, user.id);
  if (member.role !== WorkspaceRole.OWNER && member.role !== WorkspaceRole.ADMIN) throw new Error("Недостаточно прав");
  const name = text(formData, "name");
  if (name.length < 2) throw new Error("Укажите фамилию исполнителя");
  const existingMember = await prisma.workspaceMember.findFirst({
    where: { workspaceId, role: WorkspaceRole.EXECUTOR, user: { name: { equals: name } } },
    include: { user: true }
  });
  const invitedUser =
    existingMember?.user ??
    (await prisma.user.create({
      data: {
        name,
        email: `invite-${randomBytes(12).toString("hex")}@local.invalid`,
        passwordHash: randomBytes(32).toString("hex")
      }
    }));
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId: invitedUser.id } },
    update: { role: WorkspaceRole.EXECUTOR },
    create: { workspaceId, userId: invitedUser.id, role: WorkspaceRole.EXECUTOR }
  });
  await prisma.invitation.create({
    data: {
      workspaceId,
      email: invitedUser.email,
      name,
      userId: invitedUser.id,
      role: WorkspaceRole.EXECUTOR,
      token: randomBytes(24).toString("hex"),
      expiresAt: new Date(Date.now() + 30 * 86_400_000)
    }
  });
  revalidatePath(`/app/workspaces/${workspaceId}`);
}

export async function acceptInvitationAction(formData: FormData) {
  const token = text(formData, "token");
  const invite = await prisma.invitation.findUnique({ where: { token } });
  if (!invite || invite.expiresAt < new Date() || !invite.userId) throw new Error("Приглашение недействительно");
  await prisma.$transaction([
    prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: invite.userId } },
      update: { role: invite.role },
      create: { workspaceId: invite.workspaceId, userId: invite.userId, role: invite.role }
    }),
    prisma.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } })
  ]);
  await createSession(invite.userId);
  redirect("/app");
}
