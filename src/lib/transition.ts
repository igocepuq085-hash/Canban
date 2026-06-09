export function validateExecutorTransition(input: {
  assigneeId?: string | null;
  userId: string;
  comment: string;
}) {
  if (!input.assigneeId) {
    throw new Error("Назначьте исполнителя перед передачей задачи");
  }
  if (input.assigneeId !== input.userId) {
    throw new Error("Передать задачу может только назначенный исполнитель");
  }
  if (input.comment.trim().length < 3) {
    throw new Error("Перед передачей добавьте комментарий исполнителя");
  }
}

export function validateReviewReturn(input: { canReview: boolean; comment: string }) {
  if (!input.canReview) {
    throw new Error("Вернуть задачу может только руководитель или участник проверки");
  }
  if (input.comment.trim().length < 3) {
    throw new Error("Перед возвратом укажите причину доработки");
  }
}
