export interface ExportScheduleInput {
  lastExportMs: number | null;
  nowMs: number;
  exportIntervalSeconds: number;
}

export function shouldExportAfterRound(input: ExportScheduleInput): boolean {
  return shouldRunScheduledTask({
    lastRunMs: input.lastExportMs,
    nowMs: input.nowMs,
    intervalSeconds: input.exportIntervalSeconds
  });
}

export interface ScheduledTaskInput {
  lastRunMs: number | null;
  nowMs: number;
  intervalSeconds: number;
}

export function shouldRunScheduledTask(input: ScheduledTaskInput): boolean {
  if (input.lastRunMs === null) return true;
  return input.nowMs - input.lastRunMs >= input.intervalSeconds * 1000;
}
