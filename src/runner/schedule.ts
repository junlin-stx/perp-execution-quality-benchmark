export interface ExportScheduleInput {
  lastExportMs: number | null;
  nowMs: number;
  exportIntervalSeconds: number;
}

export function shouldExportAfterRound(input: ExportScheduleInput): boolean {
  if (input.lastExportMs === null) return true;
  return input.nowMs - input.lastExportMs >= input.exportIntervalSeconds * 1000;
}
