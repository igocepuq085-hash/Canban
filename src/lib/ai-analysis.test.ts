import { RiskLevel } from "@prisma/client";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildInsight } from "./ai-analysis.ts";

describe("rule-based AI insight", () => {
  it("returns a summary", () => {
    const insight = buildInsight({ level: RiskLevel.RISK, score: 50, stuckFlag: true, issues: ["Нет обновлений 6 дней"], delayPercent: 20 });
    assert.ok(insight.summary.length > 0);
  });

  it("returns recommendations when issues exist", () => {
    const insight = buildInsight({ level: RiskLevel.RISK, score: 50, stuckFlag: true, issues: ["Нет обновлений 6 дней"], delayPercent: 20 });
    assert.ok(insight.recommendations.length > 0);
  });

  it("uses the required JSON-friendly structure", () => {
    const insight = buildInsight({ level: RiskLevel.NORMAL, score: 0, stuckFlag: false, issues: [], delayPercent: 0 });
    const json = JSON.parse(JSON.stringify(insight));
    assert.equal(json.riskLevel, RiskLevel.NORMAL);
    assert.deepEqual(json.issues, []);
    assert.ok(Array.isArray(json.recommendations));
  });
});
