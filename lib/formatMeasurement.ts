/**
 * PC 版 FlowScreens と同じ表示ルール（良い姿勢時間・率・獲得日ラベル）。
 */

export function formatAcquiredAt(acquiredAt: string): string {
  const acquiredDate = new Date(acquiredAt);
  if (Number.isNaN(acquiredDate.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(acquiredDate);
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatOptionalDuration(durationMs: number | undefined): string {
  return typeof durationMs === "number" && Number.isFinite(durationMs)
    ? formatDuration(durationMs)
    : "-";
}

export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) {
    return "0%";
  }
  return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
}

export function formatOptionalPercent(ratio: number | undefined): string {
  return typeof ratio === "number" && Number.isFinite(ratio)
    ? formatPercent(ratio)
    : "-";
}
