import { Injectable } from "@nestjs/common";
import { addDays, crossesMidnight, isTimeWithinRange, zonedNow, zonedTimeToUtcISO } from "../../common/time-window.util";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpsertBusinessHoursDto } from "./dto/upsert-business-hours.dto";

export interface BusinessHoursRow {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  label: string | null;
}

export interface BusinessHoursStatus {
  isOpen: boolean;
  today: BusinessHoursRow | null;
  nextChange: string | null;
}

@Injectable()
export class BusinessHoursService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(restaurantId: string): Promise<BusinessHoursRow[]> {
    return this.prisma.businessHours.findMany({ where: { restaurantId }, orderBy: { dayOfWeek: "asc" } });
  }

  async upsert(restaurantId: string, dto: UpsertBusinessHoursDto): Promise<BusinessHoursRow[]> {
    await this.prisma.$transaction(
      dto.rows.map((row) =>
        this.prisma.businessHours.upsert({
          where: { restaurantId_dayOfWeek: { restaurantId, dayOfWeek: row.dayOfWeek } },
          create: {
            restaurantId,
            dayOfWeek: row.dayOfWeek,
            isOpen: row.isOpen,
            openTime: row.openTime,
            closeTime: row.closeTime,
            label: row.label,
          },
          update: { isOpen: row.isOpen, openTime: row.openTime, closeTime: row.closeTime, label: row.label },
        }),
      ),
    );
    return this.findAll(restaurantId);
  }

  async getStatus(restaurantId: string): Promise<BusinessHoursStatus> {
    const restaurant = await this.prisma.restaurant.findUniqueOrThrow({
      where: { id: restaurantId },
      select: { timezone: true },
    });
    const rows = await this.findAll(restaurantId);

    const now = new Date();
    const { dayOfWeek, time } = zonedNow(now, restaurant.timezone);
    const today = rows.find((row) => row.dayOfWeek === dayOfWeek) ?? null;
    const isOpen = today ? today.isOpen && isTimeWithinRange(time, today.openTime, today.closeTime) : false;

    return {
      isOpen,
      today,
      nextChange: this.computeNextChange(now, restaurant.timezone, rows, isOpen),
    };
  }

  private computeNextChange(now: Date, timezone: string, rows: BusinessHoursRow[], currentlyOpen: boolean): string | null {
    if (rows.length === 0) return null;
    const { dayOfWeek: todayDow, time: nowTime, dateStr: todayDateStr } = zonedNow(now, timezone);

    if (currentlyOpen) {
      const today = rows.find((row) => row.dayOfWeek === todayDow);
      if (!today) return null;
      const dateStr = crossesMidnight(today.openTime, today.closeTime) ? addDays(todayDateStr, 1) : todayDateStr;
      return zonedTimeToUtcISO(dateStr, today.closeTime, timezone);
    }

    for (let offset = 0; offset <= 7; offset++) {
      const dow = (todayDow + offset) % 7;
      const row = rows.find((candidate) => candidate.dayOfWeek === dow);
      if (!row || !row.isOpen) continue;
      if (offset === 0 && row.openTime <= nowTime) continue;
      const dateStr = addDays(todayDateStr, offset);
      return zonedTimeToUtcISO(dateStr, row.openTime, timezone);
    }
    return null;
  }
}
