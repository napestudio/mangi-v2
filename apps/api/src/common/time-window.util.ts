export { crossesMidnight, isTimeGridAligned, isTimeWithinRange, isWrappedPortion, minutesToTime, timeToMinutes } from "@mangiar/shared";

const WEEKDAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedNow(date: Date, timezone: string): { dayOfWeek: number; time: string; dateStr: string } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) map[part.type] = part.value;
  const hour = map["hour"] === "24" ? "00" : map["hour"];
  return {
    dayOfWeek: WEEKDAY_MAP[map["weekday"]!]!,
    time: `${hour}:${map["minute"]}`,
    dateStr: `${map["year"]}-${map["month"]}-${map["day"]}`,
  };
}

export function getTimezoneOffsetMinutes(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) map[part.type] = part.value;
  const hour = map["hour"] === "24" ? "0" : map["hour"]!;
  const asUtc = Date.UTC(
    Number(map["year"]),
    Number(map["month"]) - 1,
    Number(map["day"]),
    Number(hour),
    Number(map["minute"]),
    Number(map["second"]),
  );
  return (asUtc - date.getTime()) / 60000;
}

/** Converts a "wall clock" date+time in the given timezone into a real UTC instant (ISO string). */
export function zonedTimeToUtcISO(dateStr: string, timeStr: string, timezone: string): string {
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00.000Z`);
  const offsetMinutes = getTimezoneOffsetMinutes(naiveUtc, timezone);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60000).toISOString();
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
