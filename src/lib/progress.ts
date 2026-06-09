export type ProgressStage = {
  plannedStartDate?: Date | null;
  plannedEndDate?: Date | null;
  plannedWeight: number;
  actualProgress: number;
};

export function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function linearPlannedProgress(start: Date | null, end: Date | null, at = new Date()) {
  if (!start || !end || end <= start) return 0;
  if (at <= start) return 0;
  if (at >= end) return 100;
  return clampPercent(((at.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100);
}

export function stagePlannedProgress(stages: ProgressStage[], at = new Date()) {
  const totalWeight = stages.reduce((sum, stage) => sum + Math.max(stage.plannedWeight, 0), 0);
  if (!totalWeight) return 0;

  const weighted = stages.reduce(
    (sum, stage) =>
      sum +
      linearPlannedProgress(stage.plannedStartDate ?? null, stage.plannedEndDate ?? null, at) *
        Math.max(stage.plannedWeight, 0),
    0
  );
  return clampPercent(weighted / totalWeight);
}

export function actualProgress(stages: ProgressStage[], manualProgress?: number | null) {
  if (typeof manualProgress === "number") return clampPercent(manualProgress);
  const totalWeight = stages.reduce((sum, stage) => sum + Math.max(stage.plannedWeight, 0), 0);
  if (!totalWeight) return 0;
  return clampPercent(
    stages.reduce(
      (sum, stage) => sum + clampPercent(stage.actualProgress) * Math.max(stage.plannedWeight, 0),
      0
    ) / totalWeight
  );
}
