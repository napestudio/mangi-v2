import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CashMovementType } from "@mangiar/shared";
import type { CashMovement as PrismaCashMovement } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateMovementDto } from "./dto/create-movement.dto";
import type { ListMovementsDto } from "./dto/list-movements.dto";

/** `/cash-movements` is the manual-entry list — SALE (Orders checkout) never shows up here. */
const MANUAL_MOVEMENT_TYPES = [CashMovementType.INCOME, CashMovementType.EXPENSE];

const MOVEMENT_WITH_SESSION_INCLUDE = {
  createdBy: { select: { id: true, name: true, username: true } },
  session: {
    select: {
      id: true,
      status: true,
      cashRegister: { select: { id: true, name: true } },
    },
  },
} as const;

@Injectable()
export class CashMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(restaurantId: string, sessionId: string): Promise<PrismaCashMovement[]> {
    await this.requireSession(restaurantId, sessionId);
    return this.prisma.cashMovement.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
  }

  findAllForRestaurant(restaurantId: string, query: ListMovementsDto) {
    return this.prisma.cashMovement.findMany({
      where: {
        session: {
          cashRegister: { restaurantId, id: query.cashRegisterId },
        },
        type: query.type ?? { in: MANUAL_MOVEMENT_TYPES },
        createdAt: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      include: MOVEMENT_WITH_SESSION_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    restaurantId: string,
    sessionId: string,
    currentUserId: string,
    dto: CreateMovementDto,
  ): Promise<PrismaCashMovement> {
    const session = await this.requireSession(restaurantId, sessionId);
    if (session.status !== "OPEN") {
      throw new BadRequestException("Cannot add a movement to a closed cash session");
    }

    let createdById = currentUserId;
    if (dto.createdById) {
      const staff = await this.prisma.user.findFirst({ where: { id: dto.createdById, restaurantId } });
      if (!staff) {
        throw new BadRequestException("Selected staff user not found");
      }
      createdById = dto.createdById;
    }

    return this.prisma.cashMovement.create({
      data: {
        sessionId,
        type: dto.type,
        method: dto.method,
        amount: dto.amount,
        description: dto.description,
        reference: dto.reference,
        createdById,
      },
    });
  }

  private async requireSession(restaurantId: string, sessionId: string) {
    const session = await this.prisma.cashRegisterSession.findFirst({
      where: { id: sessionId, cashRegister: { restaurantId } },
    });
    if (!session) {
      throw new NotFoundException("Cash session not found");
    }
    return session;
  }
}
