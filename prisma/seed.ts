import { PrismaClient, Priority, RiskLevel, StageStatus, WorkspaceRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const DAY = 86_400_000;
const days = (delta: number) => new Date(Date.now() + delta * DAY);

async function main() {
  await prisma.user.upsert({
    where: { email: "owner@potok.local" },
    update: {},
    create: { name: "Руководитель проекта", email: "owner@potok.local", passwordHash: await hash("change-me-123", 12) }
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "owner@potok.local" } });

  await prisma.workspace.deleteMany({ where: { ownerId: user.id } });
  const workspace = await prisma.workspace.create({
    data: {
      name: "Проектный отдел",
      description: "Контроль подготовки проекта и управленческий обзор рисков",
      ownerId: user.id,
      members: { create: { userId: user.id, role: WorkspaceRole.OWNER } },
      boards: {
        create: {
          name: "Подготовка проекта",
          description: "Основные задачи запуска",
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
      }
    },
    include: { boards: { include: { columns: true } } }
  });
  const board = workspace.boards[0];
  const columns = Object.fromEntries(board.columns.map((column) => [column.name, column.id]));

  const cards = [
    {
      title: "Подготовить комплект документов",
      columnId: columns["Проверка и согласование"],
      description: "Собрать, проверить и согласовать комплект для запуска.",
      priority: Priority.CRITICAL,
      plannedStartDate: days(-12),
      plannedEndDate: days(4),
      dueDate: days(4),
      manualProgress: 42,
      riskLevel: RiskLevel.RISK,
      riskScore: 72,
      stuckFlag: true,
      stuckReason: "Согласование не начато"
    },
    {
      title: "Согласовать макет презентации",
      columnId: columns["Проверка и согласование"],
      description: "Получить финальные комментарии руководителей.",
      priority: Priority.HIGH,
      plannedStartDate: days(-8),
      plannedEndDate: days(2),
      dueDate: days(2),
      manualProgress: 55,
      riskLevel: RiskLevel.ATTENTION,
      riskScore: 45,
      stuckFlag: true,
      stuckReason: "Нет обновлений 6 дней"
    },
    {
      title: "Собрать исходные данные",
      columnId: columns["В работе"],
      description: "Сводный набор входных данных готовится раньше плана.",
      priority: Priority.MEDIUM,
      plannedStartDate: days(-5),
      plannedEndDate: days(6),
      dueDate: days(6),
      manualProgress: 68,
      riskLevel: RiskLevel.NORMAL,
      riskScore: 5,
      stuckFlag: false
    },
    {
      title: "Подготовить отчёт руководителю",
      columnId: columns["Проверка и согласование"],
      description: "Короткая управленческая сводка по срокам и блокерам.",
      priority: Priority.HIGH,
      plannedStartDate: days(-4),
      plannedEndDate: days(1),
      dueDate: days(1),
      manualProgress: 35,
      riskLevel: RiskLevel.RISK,
      riskScore: 64,
      stuckFlag: false
    }
  ];

  for (const item of cards) {
    const card = await prisma.card.create({ data: { ...item, boardId: board.id, creatorId: user.id, assigneeId: user.id } });
    await prisma.taskStage.createMany({
      data: [
        {
          cardId: card.id,
          name: "Подготовка",
          position: 0,
          plannedWeight: 30,
          actualProgress: Math.min(100, item.manualProgress + 20),
          plannedStartDate: item.plannedStartDate,
          plannedEndDate: days(-2),
          status: StageStatus.DONE
        },
        {
          cardId: card.id,
          name: "Согласование",
          position: 1,
          plannedWeight: 45,
          actualProgress: Math.max(0, item.manualProgress - 20),
          plannedStartDate: days(-2),
          plannedEndDate: item.plannedEndDate,
          status: item.stuckFlag ? StageStatus.BLOCKED : StageStatus.IN_PROGRESS,
          isBlocking: item.stuckFlag
        },
        {
          cardId: card.id,
          name: "Финализация",
          position: 2,
          plannedWeight: 25,
          actualProgress: 0,
          plannedStartDate: days(1),
          plannedEndDate: item.plannedEndDate,
          status: StageStatus.NOT_STARTED
        }
      ]
    });
    await prisma.progressSnapshot.createMany({
      data: [
        { cardId: card.id, snapshotDate: days(-7), plannedPercent: 30, actualPercent: 25, source: "SEED", createdById: user.id },
        { cardId: card.id, snapshotDate: days(-3), plannedPercent: 52, actualPercent: Math.max(15, item.manualProgress - 12), source: "SEED", createdById: user.id },
        { cardId: card.id, snapshotDate: new Date(), plannedPercent: 68, actualPercent: item.manualProgress, source: "SEED", createdById: user.id }
      ]
    });
    await prisma.taskAiInsight.create({
      data: {
        cardId: card.id,
        riskLevel: item.riskLevel,
        delayPercent: Math.max(0, 68 - item.manualProgress),
        delayDays: item.stuckFlag ? 4 : 0,
        summary: item.riskLevel === RiskLevel.NORMAL ? "Задача идёт по плану." : "Задаче требуется управленческое внимание.",
        issuesJson: JSON.stringify(item.stuckFlag ? [item.stuckReason, `Факт ${item.manualProgress}%, план 68%`] : []),
        recommendationsJson: JSON.stringify(item.stuckFlag ? ["Запросить статус у исполнителя", "Назначить владельца согласования"] : ["Продолжать по плану"])
      }
    });
    await prisma.cardComment.create({ data: { cardId: card.id, userId: user.id, body: "Статус проверен на еженедельной встрече." } });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
