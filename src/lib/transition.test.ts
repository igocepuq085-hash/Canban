import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateExecutorTransition, validateReviewReturn } from "./transition.ts";

describe("executor transition", () => {
  it("allows the assigned executor to move a task with a comment", () => {
    assert.doesNotThrow(() =>
      validateExecutorTransition({ assigneeId: "user-1", userId: "user-1", comment: "Работа завершена" })
    );
  });

  it("requires a comment", () => {
    assert.throws(
      () => validateExecutorTransition({ assigneeId: "user-1", userId: "user-1", comment: "" }),
      /комментарий/
    );
  });

  it("rejects a different user", () => {
    assert.throws(
      () => validateExecutorTransition({ assigneeId: "user-1", userId: "user-2", comment: "Готово" }),
      /исполнитель/
    );
  });
});

describe("review return", () => {
  it("allows a reviewer to return a task with a reason", () => {
    assert.doesNotThrow(() => validateReviewReturn({ canReview: true, comment: "Нужно исправить расчёты" }));
  });

  it("requires a return reason", () => {
    assert.throws(() => validateReviewReturn({ canReview: true, comment: "" }), /причину/);
  });
});
