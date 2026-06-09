import { RiskLevel, StageStatus } from "@prisma/client";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeRisk } from "./risk.ts";

const now = new Date("2026-06-08T12:00:00Z");
const base = {
  dueDate: new Date("2026-06-20T12:00:00Z"),
  assigneeId: "user",
  plannedProgress: 50,
  actualProgress: 50,
  updatedAt: now,
  stages: [] as Array<{ status: StageStatus; isBlocking: boolean; name: string }>
};

describe("risk analysis", () => {
  it("marks overdue tasks as critical", () => {
    assert.equal(analyzeRisk({ ...base, dueDate: new Date("2026-06-01T12:00:00Z") }, now).level, RiskLevel.CRITICAL);
  });

  it("creates an issue when assignee is missing", () => {
    assert.ok(analyzeRisk({ ...base, assigneeId: null }, now).issues.includes("Не назначен ответственный"));
  });

  it("marks delay over 25 percent as risk", () => {
    assert.equal(analyzeRisk({ ...base, plannedProgress: 70, actualProgress: 40 }, now).level, RiskLevel.RISK);
  });

  it("marks delay over 40 percent as critical", () => {
    assert.equal(analyzeRisk({ ...base, plannedProgress: 90, actualProgress: 40 }, now).level, RiskLevel.CRITICAL);
  });

  it("sets stuck flag after more than five days without updates", () => {
    assert.equal(analyzeRisk({ ...base, updatedAt: new Date("2026-06-01T12:00:00Z") }, now).stuckFlag, true);
  });

  it("marks blocked stage as risk", () => {
    assert.equal(analyzeRisk({ ...base, stages: [{ status: StageStatus.BLOCKED, isBlocking: true, name: "Согласование" }] }, now).level, RiskLevel.RISK);
  });

  it("marks low progress with due date in two days as risk", () => {
    assert.equal(analyzeRisk({ ...base, dueDate: new Date("2026-06-10T12:00:00Z"), actualProgress: 35 }, now).level, RiskLevel.RISK);
  });
});
