import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { actualProgress, linearPlannedProgress, stagePlannedProgress } from "./progress.ts";

describe("progress calculations", () => {
  it("returns 0 before planned start", () => {
    assert.equal(linearPlannedProgress(new Date("2026-01-10"), new Date("2026-01-20"), new Date("2026-01-01")), 0);
  });

  it("returns 100 after planned end", () => {
    assert.equal(linearPlannedProgress(new Date("2026-01-10"), new Date("2026-01-20"), new Date("2026-01-21")), 100);
  });

  it("returns about 50 in the middle", () => {
    assert.equal(linearPlannedProgress(new Date("2026-01-10"), new Date("2026-01-20"), new Date("2026-01-15")), 50);
  });

  it("calculates weighted planned progress by stages", () => {
    assert.equal(
      stagePlannedProgress(
        [
          { plannedStartDate: new Date("2026-01-01"), plannedEndDate: new Date("2026-01-11"), plannedWeight: 1, actualProgress: 0 },
          { plannedStartDate: new Date("2026-01-01"), plannedEndDate: new Date("2026-01-11"), plannedWeight: 3, actualProgress: 0 }
        ],
        new Date("2026-01-06")
      ),
      50
    );
  });

  it("calculates weighted actual progress by stages", () => {
    assert.equal(
      actualProgress([
        { plannedWeight: 1, actualProgress: 100 },
        { plannedWeight: 3, actualProgress: 0 }
      ]),
      25
    );
  });

  it("uses manual progress when present", () => {
    assert.equal(actualProgress([{ plannedWeight: 1, actualProgress: 0 }], 64), 64);
  });
});
