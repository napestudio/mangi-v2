export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function minutesToTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Whether the range wraps past midnight (end time is not after start time, e.g. 23:00-02:00). */
export function crossesMidnight(startTime: string, endTime: string): boolean {
  return timeToMinutes(endTime) <= timeToMinutes(startTime);
}

/** Range-aware comparison: `time` in [startTime, endTime), correctly handling ranges that cross midnight. */
export function isTimeWithinRange(time: string, startTime: string, endTime: string): boolean {
  const t = timeToMinutes(time);
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (crossesMidnight(startTime, endTime)) {
    return t >= start || t < end;
  }
  return t >= start && t < end;
}

/** Whether `time` falls on the "past midnight" side of a range that crosses midnight. */
export function isWrappedPortion(time: string, startTime: string, endTime: string): boolean {
  return crossesMidnight(startTime, endTime) && timeToMinutes(time) < timeToMinutes(startTime);
}

/** Generates HH:mm options from startTime up to (excluding) endTime, every intervalMinutes, handling midnight crossing. */
export function generateTimeGrid(startTime: string, endTime: string, intervalMinutes: number): string[] {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end <= start) end += 24 * 60;

  const slots: string[] = [];
  for (let t = start; t < end; t += intervalMinutes) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

/** Whether `time` aligns to the intervalMinutes grid starting at startTime, handling midnight crossing. */
export function isTimeGridAligned(time: string, startTime: string, intervalMinutes: number): boolean {
  let t = timeToMinutes(time);
  const start = timeToMinutes(startTime);
  if (t < start) t += 24 * 60;
  return (t - start) % intervalMinutes === 0;
}
