import { BadRequestException, Injectable } from '@nestjs/common';
import {
  addDays,
  crossesMidnight,
  isTimeWithinRange,
  timeRangeToIntervals,
  zonedNow,
  zonedTimeToUtcISO,
} from '../../common/time-window.util';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpsertBusinessHoursDto } from './dto/upsert-business-hours.dto';

const DAY_NAMES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

export interface BusinessHoursShift {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  label: string | null;
}

export interface BusinessHoursStatus {
  isOpen: boolean;
  activeShift: BusinessHoursShift | null;
  todayShifts: BusinessHoursShift[];
  nextChange: string | null;
}

@Injectable()
export class BusinessHoursService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(restaurantId: string): Promise<BusinessHoursShift[]> {
    return this.prisma.businessHours.findMany({
      where: { restaurantId },
      orderBy: [{ dayOfWeek: 'asc' }, { openTime: 'asc' }],
      select: { dayOfWeek: true, openTime: true, closeTime: true, label: true },
    });
  }

  async upsert(
    restaurantId: string,
    dto: UpsertBusinessHoursDto,
  ): Promise<BusinessHoursShift[]> {
    this.assertNoOverlaps(dto.shifts);

    await this.prisma.$transaction([
      this.prisma.businessHours.deleteMany({ where: { restaurantId } }),
      this.prisma.businessHours.createMany({
        data: dto.shifts.map((shift) => ({
          restaurantId,
          dayOfWeek: shift.dayOfWeek,
          openTime: shift.openTime,
          closeTime: shift.closeTime,
          label: shift.label ?? null,
        })),
      }),
    ]);

    return this.findAll(restaurantId);
  }

  async getStatus(restaurantId: string): Promise<BusinessHoursStatus> {
    const restaurant = await this.prisma.restaurant.findUniqueOrThrow({
      where: { id: restaurantId },
      select: { timezone: true },
    });
    const shifts = await this.findAll(restaurantId);

    const now = new Date();
    const { dayOfWeek, time } = zonedNow(now, restaurant.timezone);
    const prevDayOfWeek = (dayOfWeek + 6) % 7;

    const todayShifts = shifts.filter((shift) => shift.dayOfWeek === dayOfWeek);
    const overnightFromYesterday = shifts.filter(
      (shift) =>
        shift.dayOfWeek === prevDayOfWeek &&
        crossesMidnight(shift.openTime, shift.closeTime),
    );

    const activeShift =
      todayShifts.find((shift) =>
        isTimeWithinRange(time, shift.openTime, shift.closeTime),
      ) ??
      overnightFromYesterday.find((shift) =>
        isTimeWithinRange(time, shift.openTime, shift.closeTime),
      ) ??
      null;

    return {
      isOpen: activeShift !== null,
      activeShift,
      todayShifts,
      nextChange: this.computeNextChange(
        now,
        restaurant.timezone,
        shifts,
        activeShift,
      ),
    };
  }

  /** Rejects shifts with an empty range or two shifts on the same day that overlap in time. */
  private assertNoOverlaps(
    shifts: { dayOfWeek: number; openTime: string; closeTime: string }[],
  ): void {
    const byDay = new Map<number, { openTime: string; closeTime: string }[]>();
    for (const shift of shifts) {
      if (shift.openTime === shift.closeTime) {
        throw new BadRequestException(
          'El horario de apertura y cierre no pueden ser iguales',
        );
      }
      const dayShifts = byDay.get(shift.dayOfWeek) ?? [];
      dayShifts.push(shift);
      byDay.set(shift.dayOfWeek, dayShifts);
    }

    for (const [dayOfWeek, dayShifts] of byDay) {
      const intervals = dayShifts
        .flatMap((shift) =>
          timeRangeToIntervals(shift.openTime, shift.closeTime),
        )
        .sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < intervals.length; i++) {
        if (intervals[i]![0] < intervals[i - 1]![1]) {
          throw new BadRequestException(
            `Hay horarios superpuestos el día ${DAY_NAMES[dayOfWeek]}`,
          );
        }
      }
    }
  }

  private computeNextChange(
    now: Date,
    timezone: string,
    shifts: BusinessHoursShift[],
    activeShift: BusinessHoursShift | null,
  ): string | null {
    const {
      dayOfWeek: todayDow,
      time: nowTime,
      dateStr: todayDateStr,
    } = zonedNow(now, timezone);

    if (activeShift) {
      const closesToday =
        activeShift.dayOfWeek !== todayDow ||
        !crossesMidnight(activeShift.openTime, activeShift.closeTime);
      const dateStr = closesToday ? todayDateStr : addDays(todayDateStr, 1);
      return zonedTimeToUtcISO(dateStr, activeShift.closeTime, timezone);
    }

    for (let offset = 0; offset <= 7; offset++) {
      const dow = (todayDow + offset) % 7;
      const next = shifts
        .filter(
          (shift) =>
            shift.dayOfWeek === dow &&
            (offset !== 0 || shift.openTime > nowTime),
        )
        .sort((a, b) => (a.openTime < b.openTime ? -1 : 1))[0];
      if (!next) continue;
      const dateStr = addDays(todayDateStr, offset);
      return zonedTimeToUtcISO(dateStr, next.openTime, timezone);
    }
    return null;
  }
}
